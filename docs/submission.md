# Buildathon 提交材料（Set It and Forget It）

截止：**2026-12-05**。以下全部为链上已验证数据。

## 部署地址（已上线）

| 合约 | 网络 | 地址 | Explorer |
|---|---|---|---|
| MockOracle | Ethereum Sepolia (11155111) | `0x5042cB9256E8F722263A29Ea2334C2eBD7B85979` | https://sepolia.etherscan.io/address/0x5042cB9256E8F722263A29Ea2334C2eBD7B85979 |
| MockToken (sUSD) | Ethereum Sepolia | `0x2959Dd4D518a5D534abf2097C408e0BA6FD701dB` | https://sepolia.etherscan.io/address/0x2959Dd4D518a5D534abf2097C408e0BA6FD701dB |
| SentinelVault | Ethereum Sepolia | `0x3a5820b60499dD05548055eeA21B786EA31F3826` | https://sepolia.etherscan.io/address/0x3a5820b60499dD05548055eeA21B786EA31F3826 |
| SentinelReactive | Reactive Lasna (5318007) | `0x31297a441F9EC94B34236344ea5F1cE6EC001614` | https://lasna.reactscan.net/address/0x31297a441F9EC94B34236344ea5F1cE6EC001614 |

部署交易：

| 动作 | Tx |
|---|---|
| MockOracle 部署 | `0xa4b7fd94dba694c2833b811c28eb2000139388d20bdf168dbc3feb88760e6eba` |
| MockToken 部署 | `0xae3f880c042a3e50795be80320e5615b5addde3e99e403ce02700d6b7e375335` |
| SentinelReactive 部署 | `0xfd5d4381164aebfb39e5c0b38d05cdc04abdd7a707a28bfe1ee8e5d517971cf2` |
| SentinelVault 部署 | `0x36d31d43722a8ce144f9b4802b99669c5962a59d32e3c7f728505f96c32dbc47` |
| bind（Lasna: setVault） | `0x8d3ea9c8492b5330c42cd687d25bf0fbef7adbb580e180c658159bf8e2b7ac7c` |

## 完整链路证据（一次真实的止损失效）

| 步骤 | 网络 | Tx / 结果 |
|---|---|---|
| 1. 入金 500 sUSD | Eth Sepolia | `0x56f5c4737d552470fdf7148b7e25710faf774811b7b4d3c9dafe0d01ba02f17b` |
| 2. arm（SL 0.95 / TP 1.05） | Eth Sepolia | `0xe9f4e052ad0c88a55d681acd2f29ce3671cb9cc65227ba794c243ede8664b389` |
| 3. 推价到 0.94（源事件） | Eth Sepolia | `0x5b954e5f4fe9e13bb999eb2a1ec7a8d0994c5b19b1daef1d408b8712853bc4ee` |
| 4. Reactive 合约 react() | Lasna | `0x4c91ad1c838ab9dcceea0e4d3a9bd091442777e2df8868a5e8e234e4034757ae`（Triggered price=94000000 reason=STOP） |
| 5. 跨链 callback → 金库平仓 | Eth Sepolia | `0x441b18f6417a5302aa54360a78f3e256426e6e1fbffd6cb8fd1dde3188da0676` |

链上复核结果：

```
vault.closed()        = true
vault.armed()         = false
vault token balance   = 0            （资金已全部退出）
owner token balance   = 500000000    （500 sUSD 已退回）
VaultClosed.reason    = STOP
VaultClosed.exitPrice = 94000000     （0.94，8 位小数）
```


## 官方要求 → 交付状态

| 要求 | 状态 |
|---|---|
| 公开 GitHub 仓库 | ⬜ 待推送 |
| 已部署合约地址 | ✅ 见上表 |
| 完整链路交易哈希 | ✅ 见上表 |
| ≤3 分钟演示视频 | ⬜ 待录（脚本见下） |
| README 可复现 | ✅ |

## 3 分钟视频脚本

1. **0:00–0:30 问题**：持有代币但没法 7×24 盯盘；链下机器人要服务器、要私钥、会掉线。让"触发平仓"这件事本身跑在链上。
2. **0:30–1:10 架构**：一张图 —— Eth Sepolia 上的 Oracle 发价格事件 → Lasna 上的 Reactive 合约订阅并判断 → 通过 callback proxy 回调 Eth Sepolia 的 Vault。
3. **1:10–2:20 现场演示**：入金 500 sUSD → arm SL=0.95/TP=1.05 → 推价到 0.94 → 展示 Lasna reactscan 上的 react 交易 → 展示 Etherscan 上 VaultClosed 与资金回到钱包。点明两点：**双层认证**（proxy + sender）与**链上复核价格**。
4. **2:20–3:00 收尾**：局限（mock oracle、单次触发）+ 下一步（Chainlink、Uniswap 真实兑换、多金库）。

## 评分自检

- **Execution**：两端链上交易可查，react 与 callback 都有哈希 ✅
- **Integration**：金库真实持有并转移资产（余额 500 → 0，owner 0 → 500）✅
- **Usefulness**：止损 + 遗忘的真实场景
- **Craft**：README runbook + 15 个单测 + natspec ✅

## 待办

- [ ] 推送 GitHub 仓库
- [ ] 录 3 分钟视频
- [ ] 在 DoraHacks 提交（确认窗口仍开放）
