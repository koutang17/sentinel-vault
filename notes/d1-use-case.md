# 用例拆解卡 — Sentinel Vault（止损 / 止盈自动平仓）

> 说明：本项目用例属于「赛道 2 · Set It and Forget It（个人自动化）」。

## 1. 监听哪条链、哪个合约的什么事件？

- 链：**Ethereum Sepolia**（源链 = 目标链，同一条链；Reactive 侧在 Lasna）。
- 合约：`MockOracle`（地址见仓库 `deployments.local.json` / README）。
- 事件：`PriceUpdated(uint256 indexed price, uint256 indexed timestamp)`。
- 订阅方式：`SYSTEM.subscribe(originChainId, oracle, topic0, REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE)`，其中 `topic0 = keccak256("PriceUpdated(uint256,uint256)")`。

## 2. 满足什么条件时触发？

`SentinelReactive.react()` 中：
1. `log_.topic0 == _topic0` 且 `log_.contractAddress == _oracle`（只认指定合约的指定事件）；
2. `log_.opCode >= 3`（LOG3，保证有两个 indexed 参数）；
3. `!triggered && vaultSet`（尚未触发过、金库已绑定）；
4. `price != 0` 且 **价格越线**：`price <= stopLoss` 或 `price >= takeProfit`（在带内则 `return`，不触发）。

越线后置 `triggered = true`，同一越线只触发一次。

## 3. 在哪条链做什么动作？

- 目标链：**Ethereum Sepolia**。
- 动作：Reactive 网络通过 Callback Proxy 调用 `SentinelVault.execute(reactive_, reportedPrice_)`。
- Vault 内：`onlyCallbackSender` / `onlyServiceProvider` 鉴权 → 再次读取 `oracle.price()` 复核仍越线 → 将金库全部代币余额 `transfer` 给 depositor → 置 `armed = false`、`closed = true`，防止重复平仓。

## 4. 如果不用 Reactive，要怎么做？Reactive 让它简单在哪里，代价是什么？

**不用 Reactive 的做法**：自己跑一个 7×24 机器人——订阅 Sepolia RPC 事件流 → 内存里判断价格带 → 用保管在服务器的私钥签名并发送平仓交易 → 自己处理 RPC 宕机 / 重试 / gas / 非ce。私钥长期在线，机器掉线即失去保护。

**Reactive 让它简单在哪里**：
- 事件订阅 + 条件判定 + 跨链请求回调全部托管在 Reactive 网络，无需自建常驻机器人；
- 私钥不离开部署者，回调经 `onlyCallbackSender` 鉴权，任意地址无法冒领金库；
- 触发逻辑在链上可验证（`triggered`、`armed` 状态公开可读）。

**代价**：
- 依赖 Reactive 网络（Lasna）的可用性与回调 gas 预付（余额用完自动停，需充值恢复）；
- 回调有秒级延迟，不适合亚秒级套利（所以本项目选赛道 2 而非赛道 1）；
- 回调入口必须正确加 `onlyCallbackSender` / `onlyServiceProvider`，否则任何人都能调用。

## 简图：源链 → Reactive → 目标链

```
源链 Ethereum Sepolia          Reactive 网络 Lasna              目标链 Ethereum Sepolia
┌──────────────────┐          ┌─────────────────────┐          ┌──────────────────────┐
│  MockOracle      │  事件    │  SentinelReactive   │  回调     │  SentinelVault       │
│  setPrice()      │──log────▶│  react(): 越线判定  │──callback▶│  execute(): 复核     │
│  emit PriceUpdate│          │  requestCallback    │          │   + 退币给 depositor │
│  (price越线)     │          │  triggered = true   │          │  armed = false       │
└──────────────────┘          └─────────────────────┘          └──────────────────────┘
```

本卡链接：https://github.com/koutang17/sentinel-vault/blob/main/notes/d1-use-case.md
