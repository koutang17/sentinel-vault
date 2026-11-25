# 读懂费用 —— Lasna 系统合约参数与计费模型

> 系统合约地址：`0x8888888888888888888888888888888888888888`
> RPC：`https://lasna-rpc.rnk.dev/`
> 参考：官方文档 [Economy & System Interactions](https://dev.reactive.network/economy)
>
> 注：本机未安装 `cast`（WDAC/应用控制策略拦截 Foundry 安装），以下三个参数用 ethers `staticCall` 对同一合约同一读取函数做只读调用得到，与 `cast call` 输出等价。`cast` 命令形式一并给出。

## 一、三条 cast 命令及输出

```bash
cast call 0x8888888888888888888888888888888888888888 "_gasPriceCoeffPer1000()" --rpc-url https://lasna-rpc.rnk.dev/ | cast to-dec
cast call 0x8888888888888888888888888888888888888888 "_extraGas()"             --rpc-url https://lasna-rpc.rnk.dev/ | cast to-dec
cast call 0x8888888888888888888888888888888888888888 "_maxChargeGas()"         --rpc-url https://lasna-rpc.rnk.dev/ | cast to-dec
```

输出（2026-11-25 实测，ethers 只读复现）：

```
_gasPriceCoeffPer1000 = 1000
_extraGas             = 100000
_maxChargeGas         = 50000
```

附赠：本项目 reactive 合约（`0x31297a441F9EC94B34236344ea5F1cE6EC001614`）的账务实测（证明执行后已结清、处于 active）：

```
cast balance 0x31297a441F9EC94B34236344ea5F1cE6EC001614 --rpc-url https://lasna-rpc.rnk.dev/  →  0.0849439 REACT
cast call 0x8888888888888888888888888888888888888888 "debts(address)"    0x31297a441F9EC94B34236344ea5F1cE6EC001614 --rpc-url https://lasna-rpc.rnk.dev/  →  0
cast call 0x8888888888888888888888888888888888888888 "reserves(address)" 0x31297a441F9EC94B34236344ea5F1cE6EC001614 --rpc-url https://lasna-rpc.rnk.dev/  →  0
```

## 二、一次 react() / 回调的费用怎么算？

官方文档把两类执行分开计费：

1. **react() 执行费**：`fee = BaseFee × GasUsed`
   - `BaseFee`：当前区块的基础 gas 单价；`GasUsed`：`react()` 执行实际消耗的 gas。
   - 由系统合约在执行 `react()` 时**同步**从合约余额扣除（或记入 debt）。

2. **回调费**（即本题三个参数控制的定价）：`p_callback = p_base × C × (g_callback + K)`
   - `p_base`：基础 gas 价格（`tx.gasprice` / `block.basefee`）；
   - `C` = `_gasPriceCoeffPer1000 / 1000` = `1000 / 1000` = **1**（定价系数，×1）；
   - `K` = `_extraGas` = **100000**（固定附加 gas，也对应官方文档「回调最低 gas limit 100,000」）；
   - `_maxChargeGas` = **50000**：单次回调计费用 gas 的上限，超过部分不再多收（封顶）。
   - 即：`回调费 ≈ 基础 gas 价 × 1 × (实际回调 gas + 100000)`，且计费 gas 不超过 50000。

## 三、balance、reserves、debt 分别是什么？为什么「有一点 debt 就停止执行」？

- **balance**：合约自身账户里的 REACT / 原生币余额（`cast balance`），是可用于支付的现金。
- **reserves**：系统合约 / 回调代理为该合约**预留冻结**的资金，用于覆盖正在进行中的回调或执行的预估费用（`reserves(address)`）。预留后这部分不能再被当作可用余额。
- **debt**：系统记账的、该合约**已发生但尚未支付**的欠费（`debts(address)`）。当余额不足以覆盖某次执行/回调费用时，系统先让执行发生，把缺口记为 debt。

**为什么有 debt 就停**：官方文档明确，资金不足的合约会被 **blocklist**，合约状态从 `active` 变为 `inactive`（"outstanding debt must be settled"），**不再处理事件，也不能发回调**。这是防坏账机制：一旦出现未结清欠费，立即停摆，避免债务越滚越大。恢复方式是 owner 充值后调用 `coverDebt()`（或通过 `depositTo()` 充值，系统自动结清 debt），状态回到 active。

本项目 reactive 当前 `debts = 0`、`reserves = 0`、`balance = 0.085 REACT`，说明上一笔回调已结清，处于 active。

## 四、react() 执行回滚了，还收费吗？对合约设计意味着什么？

**还收费。** 官方文档：反应交易费在系统合约执行 `react()` 时**同步**收取，金额 = `BaseFee × GasUsed`。即使 `react()` 业务逻辑 revert（或被过滤提前 `return`），revert 之前已经消耗的 gas 仍然计费——要么从余额扣减，要么余额不足就计入 debt 并触发 blocklist。

对合约设计的意味：

1. **便宜的过滤放最前面**：`react()` 里先校验 `topic0` / `contractAddress` / `opCode`，不匹配立刻 `return`（如 `SentinelReactive.sol:76-83`），让无关事件只消耗极少 gas 就退出，降低被收费金额。
2. **回调入口必须鉴权**：`SentinelVault.execute()` 加了 `onlyServiceProvider` + `onlyCallbackSender`，否则任意地址都能调用回调、消耗你（callback 合约）的余额，甚至把金库转走。
3. **留够余额、关注 debt**：余额耗尽会进入 debt → blocklist 停摆；要在 README 写清充值与 `coverDebt()` 恢复方式（见 README「Failure modes」段）。
4. **回调 gas 要够最低 100,000**：低于该下限的回调请求会被系统忽略，所以 `GAS_LIMIT` 要设得足够高（本项目 `SentinelReactive` 设为 500,000）。

复现脚本（只读，仓库内可跑，无需私钥）：`node tmp_gas.js`（提交后已删除，逻辑等价于上方 cast 命令）。
