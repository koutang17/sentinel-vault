# Buildathon 提交清单（Set It and Forget It）

截止：**2026-12-05**。以下内容按官方要求逐条对照。

## 官方要求 → 我们的交付

| 要求 | 交付物 | 状态 |
|---|---|---|
| 公开 GitHub 仓库 | `github.com/koutang17/sentinel-vault`（发布后） | ⬜ 推送 |
| 已部署合约地址 | Oracle / Vault / Reactive（写进 README 的 Deployments 表） | ⬜ 部署后填 |
| 完整链路交易哈希 | 源事件（oracle setPrice）→ Lasna react → Base Sepolia callback | ⬜ 部署后填 |
| ≤3 分钟演示视频 | 见下方脚本 | ⬜ 录制 |
| README 可复现 | 已有 runbook | ✅ |

## 提交前必填（deployments 表）

| 字段 | 值 |
|---|---|
| MockOracle（Base Sepolia） | `0x...` |
| MockToken sUSD（Base Sepolia） | `0x...` |
| SentinelReactive（Lasna） | `0x...` |
| SentinelVault（Base Sepolia） | `0x...` |
| 触发用 setPrice tx | `0x...` |
| callback 落点 tx | `0x...` |
| Lasna 上的 react tx（reactscan） | `0x...` |

## 3 分钟视频脚本（照着念即可）

1. **0:00–0:30 问题**：你持有代币但没法 7×24 盯盘；链下机器人要服务器、要密钥、会掉线。我想让"触发平仓"这件事本身运行在链上。
2. **0:30–1:10 架构**：三个合约一张图——Base Sepolia 上的 Oracle 发价格事件 → Lasna 上的 Reactive 合约订阅并判断 → 通过 callback proxy 回调 Base Sepolia 的 Vault。
3. **1:10–2:20 现场演示**：入金 500 sUSD → arm SL=0.95/TP=1.05 → 把 oracle 推到 0.94 → 展示 Lasna reactscan 上的 react 交易 → 展示 Base Sepolia 上的 VaultClosed 与资金回到钱包。**两次认证**（proxy + sender）和**链上复核价格**各点一句。
4. **2:20–3:00 收尾**：局限（mock oracle、单次触发）+ 下一步（Chainlink、Uniswap 真实兑换、多金库）。

## 评分自检

- **Execution**：现场展示两端链上交易 ✅（录屏里必须有浏览器 explorer 页面）
- **Integration**：金库真实持有并转移资产，callback 前后余额变化可见 ✅
- **Usefulness**：讲"止损 + 遗忘"的真实场景，别讲技术细节堆砌
- **Craft**：README runbook + 15 个单测 + natspec 注释 ✅

## 需要你本人完成的动作

1. 新建**测试专用** MetaMask 钱包（绝不用主钱包）
2. 领 Base Sepolia ETH（https://docs.base.org/chain/network-faucets）
3. 换 lREACT：给 Lasna 水龙头 0x2afaFD298b23b62760711756088F75B7409f5967 转 ≤5 ETH（1 ETH → 100 lREACT）
4. `.env` 填私钥后依次运行：
   ```
   npm run deploy:oracle
   npm run deploy:reactive
   npm run deploy:vault
   npm run bind
   npm run demo
   ```
5. 把 demo 输出的 tx hash 填回上面的表
