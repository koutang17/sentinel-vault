# Reactive Omni Buildathon 提交材料 — 赛道 2：Set It and Forget It

截至 2026-11-25：用户已确认报名赛道 2。公开仓库和链上证据已具备；正式演示视频、公开链接与 DoraHacks 项目提交仍待完成。[DoraHacks 活动页](https://dorahacks.io/hackathon/reactive-omni-buildathon/detail)标明的截止时间为 **2026-12-06 04:00（UTC+8）**，对应活动介绍中的 12 月 5 日（UTC）。

## 可直接填写的项目文字

**Title:** Sentinel Vault

**One-liner:** A price-event-driven ERC-20 vault release, executed through a Reactive cross-chain callback.

**Description:** Sentinel Vault demonstrates personal on-chain automation on Ethereum Sepolia and Reactive Lasna. A user deposits an ERC-20 token in a vault and configures lower and upper price thresholds. A mock oracle emits a price event; a Lasna reactive contract checks the threshold and requests a callback. The vault authenticates the callback, reads the oracle price again, and returns its token balance to the owner. The published testnet run shows the source event, reactive transaction, callback, and token return on-chain. This version uses a manually updated oracle and returns the same token rather than swapping it, so it does not remove the owner's market price exposure.

**Repository:** https://github.com/koutang17/sentinel-vault

**Demo video:** 待填公开链接（时长必须少于 3 分钟）

## 部署地址

| 合约 | 网络 | 地址与浏览器 |
|---|---|---|
| MockOracle | Ethereum Sepolia (11155111) | [`0x5042cB9256E8F722263A29Ea2334C2eBD7B85979`](https://sepolia.etherscan.io/address/0x5042cB9256E8F722263A29Ea2334C2eBD7B85979) |
| MockToken (sUSD) | Ethereum Sepolia | [`0x2959Dd4D518a5D534abf2097C408e0BA6FD701dB`](https://sepolia.etherscan.io/address/0x2959Dd4D518a5D534abf2097C408e0BA6FD701dB) |
| SentinelVault | Ethereum Sepolia | [`0x3a5820b60499dD05548055eeA21B786EA31F3826`](https://sepolia.etherscan.io/address/0x3a5820b60499dD05548055eeA21B786EA31F3826) |
| SentinelReactive | Reactive Lasna (5318007) | [`0x31297a441F9EC94B34236344ea5F1cE6EC001614`](https://lasna.reactscan.net/address/0x31297a441F9EC94B34236344ea5F1cE6EC001614) |

部署交易：

| 动作 | Tx |
|---|---|
| MockOracle | `0xa4b7fd94dba694c2833b811c28eb2000139388d20bdf168dbc3feb88760e6eba` |
| MockToken | `0xae3f880c042a3e50795be80320e5615b5addde3e99e403ce02700d6b7e375335` |
| SentinelReactive | `0xfd5d4381164aebfb39e5c0b38d05cdc04abdd7a707a28bfe1ee8e5d517971cf2` |
| SentinelVault | `0x36d31d43722a8ce144f9b4802b99669c5962a59d32e3c7f728505f96c32dbc47` |
| Lasna `setVault` | `0x8d3ea9c8492b5330c42cd687d25bf0fbef7adbb580e180c658159bf8e2b7ac7c` |

## 完整链路证据：价格越线后自动退回资产

| 步骤 | 网络 | 交易 |
|---|---|---|
| 1. `deposit(500 sUSD)` | Ethereum Sepolia | [`0x56f5c473…02f17b`](https://sepolia.etherscan.io/tx/0x56f5c4737d552470fdf7148b7e25710faf774811b7b4d3c9dafe0d01ba02f17b) |
| 2. `arm(0.95, 1.05)` | Ethereum Sepolia | [`0xe9f4e052…b389`](https://sepolia.etherscan.io/tx/0xe9f4e052ad0c88a55d681acd2f29ce3671cb9cc65227ba794c243ede8664b389) |
| 3. Oracle 设价为 0.94，发出 `PriceUpdated` | Ethereum Sepolia | [`0x5b954e5f…bc4ee`](https://sepolia.etherscan.io/tx/0x5b954e5f4fe9e13bb999eb2a1ec7a8d0994c5b19b1daef1d408b8712853bc4ee) |
| 4. Reactive 执行，发出 `Triggered(94000000, "STOP")` | Lasna | [`0x4c91ad1c…757ae`](https://lasna.reactscan.net/tx/0x4c91ad1c838ab9dcceea0e4d3a9bd091442777e2df8868a5e8e234e4034757ae) |
| 5. callback 执行，发出 `VaultClosed` | Ethereum Sepolia | [`0x441b18f6…0676`](https://sepolia.etherscan.io/tx/0x441b18f6417a5302aa54360a78f3e256426e6e1fbffd6cb8fd1dde3188da0676) |

2026-11-25 经公开 RPC 只读核对：上述第 3–5 步交易状态均为成功；三个事件的价格均为 `94000000`，原因均指向 `STOP`。当前 `vault.closed() = true`、`vault.armed() = false`、`reactive.triggered() = true`；Vault 的 sUSD 余额为 0，owner 的 sUSD 余额为 `500000000`（6 位小数，即 500 sUSD）。

[Reactscan 的 Reactive 交易页](https://lasna.reactscan.net/tx/0x4c91ad1c838ab9dcceea0e4d3a9bd091442777e2df8868a5e8e234e4034757ae)还直接列出了源交易、已确认的 callback 及目标链交易链接，可在一个页面核对完整因果链。

无需私钥的公开复核命令：`npm ci && npm run public:evidence`。该命令只读取公开 RPC 的交易收据、事件和合约状态，不发送交易。

## 提交检查

| 要求 | 当前状态 |
|---|---|
| 已报名赛道 2 | ✅ 用户确认 |
| 活动期间构建 | ✅ 仓库首次提交于 2026-11-19 |
| 公开且带明确许可的仓库 | ✅ [GitHub](https://github.com/koutang17/sentinel-vault)，MIT `LICENSE` |
| 已部署合约地址 | ✅ 见上表 |
| 源事件 → Reactive → callback 交易 | ✅ 见上表 |
| README 复现说明 | ✅ 指向 Ethereum Sepolia 与 Lasna |
| 少于 3 分钟的公开视频 | ⬜ 待录制真实命令与链上证据演示并上传 |
| DoraHacks 项目正式提交 | ⬜ 待提交；账号内状态未核验 |

## 演示视频分镜（目标少于 3 分钟）

1. **0:00–0:15 — 场景与范围。** 简述价格事件触发个人金库资产退回；说明当前版本未卖出代币。
2. **0:15–0:40 — 实际命令。** 在仓库终端执行 `npm run public:evidence`，说明无需私钥、只读核验已发生的测试网运行。
3. **0:40–1:55 — 链上证据。** 依次展示命令输出及浏览器交易页：源事件 `PriceUpdated(0.94)`、Lasna `Triggered(0.94, STOP)`、已确认 callback 和 Sepolia `VaultClosed(0.94, STOP)`。让交易哈希可见。
4. **1:55–2:35 — 结果与局限。** 展示金库余额 0、owner 余额 500 sUSD；说明 MockOracle 手动推价、一次触发、同币退回不消除价格敞口。

已部署实例目前 `triggered=true`。录屏优先展示以上已完成交易。若必须现场重跑，先由 owner 在 Lasna 调用 `updateThresholds` 重置 Reactive；`demo.js` 的预检会阻止未经重置的重复演示。

## 评审维度自检

- **Execution：** 价格源事件、Lasna 反应交易、Sepolia callback 均有链上交易和事件。
- **Integration：** Reactive 合约判断阈值并请求跨链回调；Vault 复核价格后转移代币。
- **Usefulness：** 可复用的价格触发资产退回模式。当前版本不消除同一代币的价格风险，视频与提交文字需如实说明。
- **Craft：** 合约分层、单测用例、部署脚本和复现说明。2026-11-25 本机复测被 Windows Application Control 拦截 Hardhat EDR 原生模块，未能重新验证历史“15 passing”结果。

## 剩余动作

- [ ] 录制少于 3 分钟的真实命令与链上证据演示
- [ ] 上传为无需登录即可观看的公开链接
- [ ] 将公开视频链接填入本文件及 DoraHacks 表单
- [ ] 在 DoraHacks 完成项目提交，并核对赛道、链接和提交成功状态
