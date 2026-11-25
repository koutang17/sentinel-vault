# Sentinel Vault

Price-triggered ERC-20 vault release for the [Reactive Omni Buildathon](https://dorahacks.io/hackathon/reactive-omni-buildathon/detail), track **Set It and Forget It**.

> Testnet proof of concept. The current version returns the **same token** to the owner's wallet when a threshold is crossed. It does not swap the token or remove market price exposure, so it is not a financial stop-loss or realized take-profit order.

## What it does

An owner deposits an ERC-20 token in a personal vault and sets lower and upper price thresholds. A `MockOracle` emits a price event on Ethereum Sepolia. A reactive contract on Lasna watches that event and requests a callback when the price leaves the configured band. The vault authenticates the callback, reads the oracle price again, and releases its token balance to the owner.

The event watcher runs on-chain; no continuously running bot or server is needed after setup. The demo oracle is manually updated, so the price feed itself is not autonomous in this version.

## Architecture

```text
Ethereum Sepolia (11155111)                 Reactive Lasna (5318007)
┌──────────────────────┐                   ┌───────────────────────┐
│ MockOracle           │  PriceUpdated     │ SentinelReactive      │
│ manual 8-decimal feed├──────────────────►│ checks thresholds     │
└──────────────────────┘                   │ requests callback     │
┌──────────────────────┐                   └───────────┬───────────┘
│ SentinelVault        │◄──────────────────────────────┘
│ holds the ERC-20     │     callback via Sepolia proxy
│ checks oracle again  │
│ returns same token   │
└──────────────────────┘
```

1. **Origin:** `MockOracle` emits `PriceUpdated(uint256 price, uint256 timestamp)` on Ethereum Sepolia.
2. **Reactive:** `SentinelReactive` on Lasna subscribes to that event, checks the thresholds, and requests a callback once.
3. **Destination:** `SentinelVault` on Ethereum Sepolia requires the callback proxy and the configured reactive sender, rechecks `oracle.price()`, then transfers the vault's token balance to its owner.

The reactive contract needs lREACT for execution. Destination callback fees can require Ethereum Sepolia ETH; see the [Reactive economy documentation](https://dev.reactive.network/economy).

## Live testnet deployment

| Contract | Chain | Address |
|---|---|---|
| MockOracle | Ethereum Sepolia | `0x5042cB9256E8F722263A29Ea2334C2eBD7B85979` |
| MockToken (sUSD) | Ethereum Sepolia | `0x2959Dd4D518a5D534abf2097C408e0BA6FD701dB` |
| SentinelVault | Ethereum Sepolia | `0x3a5820b60499dD05548055eeA21B786EA31F3826` |
| SentinelReactive | Reactive Lasna | `0x31297a441F9EC94B34236344ea5F1cE6EC001614` |

The [source event](https://sepolia.etherscan.io/tx/0x5b954e5f4fe9e13bb999eb2a1ec7a8d0994c5b19b1daef1d408b8712853bc4ee), [Lasna reaction](https://lasna.reactscan.net/tx/0x4c91ad1c838ab9dcceea0e4d3a9bd091442777e2df8868a5e8e234e4034757ae), and [destination callback](https://sepolia.etherscan.io/tx/0x441b18f6417a5302aa54360a78f3e256426e6e1fbffd6cb8fd1dde3188da0676) all succeeded. The callback emitted `VaultClosed` with price `0.94` and reason `STOP`; 500 sUSD was returned to the owner. Addresses, deployment transactions, and the full evidence trail are in [docs/submission.md](docs/submission.md).

Anyone can recheck this published run without a wallet or private key:

```bash
npm ci
npm run public:evidence
```

The command reads the three public transaction receipts, checks their events and the 500 sUSD transfer, and prints the current state on both chains.

This published instance has already fired: `SentinelReactive.triggered() = true` and `SentinelVault.closed() = true`. Use the recorded transactions to review the completed run. A repeat live demonstration requires resetting the reactive thresholds on Lasna before running `demo.js` again.

## Contracts

| Contract | Chain | Role |
|---|---|---|
| `MockOracle` | Ethereum Sepolia | Manually controlled 8-decimal test price feed |
| `SentinelReactive` | Reactive Lasna | Subscribes to price events and requests one callback |
| `SentinelVault` | Ethereum Sepolia | Holds tokens, verifies callbacks and price, releases tokens |
| `MockToken` | Ethereum Sepolia | Test ERC-20 asset with 6 decimals |

## Reproduce from a fresh deployment

Requirements: Node.js 20+, npm, a testnet-only wallet, Ethereum Sepolia ETH, and lREACT. Never use a wallet that holds real funds. The deploy and demo scripts reject chain IDs outside Ethereum Sepolia, Base Sepolia, Lasna, and local Hardhat.

Copy `.env.example` to `.env`, then set `SEPOLIA_RPC`, `DEST_PK`, and `REACTIVE_PK`. The two private keys may represent the same test wallet. Keep `.env` local; it is gitignored. `REACTIVE_RPC` defaults to Lasna. The optional `DEST_RPC` is for a separate Base Sepolia deployment and is not used by the commands below.

```bash
npm ci
npm run compile
npm test

npm run deploy:oracle
npm run deploy:reactive
npm run deploy:vault
npm run bind
npm run demo
npm run verify
npm run evidence
```

The deploy scripts save new addresses in the gitignored `deployments.local.json`. They create **new contracts** and do not reuse the published addresses above. To obtain lREACT when needed, `npm run faucet` sends 0.02 testnet ETH from Ethereum Sepolia to the Lasna faucet; review its transaction before running it.

`demo.js` checks the Lasna contract before sending any Sepolia transaction. It stops if the reactive contract has already fired or is bound to a different vault. To run a second cycle on the same deployment, the owner must first call `updateThresholds` on Lasna with the intended thresholds; the vault is then armed by `demo.js`. Keep thresholds on both chains consistent.

## 共学营小实验：Xfers 监控与动态订阅

两个独立的 Reactive 小实验，均部署在 Lasna，源码、脚本与 npm 命令可一键复现。环境变量与上一节相同（`SEPOLIA_RPC`、`REACTIVE_PK`、`DEST_PK`）。

| 实验 | 合约 | 行为 |
|---|---|---|
| Xfers | `contracts/Xfers.sol` | Lasna 上订阅 Sepolia 全部 ERC-20 `Transfer`（`contract=0x0`、topic1-3 用 `REACTIVE_IGNORE`），累计满 5 笔后自动退订 |
| DynamicSub | `contracts/DynamicSub.sol` | 运行时 `start()` 增加订阅、达到 `maxTriggers` 自动取消、owner 也可 `stop()` 手动取消 |
| MonitorToken | `contracts/MonitorToken.sol` | Sepolia 上的测试代币，仅 DynamicSub 监控（避免全链流量噪声） |

```bash
npm run compile

# 1) Xfers（D3 场景 1：第一个监控合约）
npm run demo:token          # Sepolia: 部署 MonitorToken
npm run demo:xfers:deploy   # Lasna: 部署 Xfers(limit=5)，部署时充值 0.2 lREACT
npm run demo:xfers:run      # Sepolia 发一笔转账，轮询 Lasna 抓 react() 交易

# 2) 动态订阅（D5 场景 5）
npm run demo:dynsub:deploy  # Lasna: 部署 DynamicSub(maxTriggers=3)，充值 0.3 lREACT
npm run demo:dynsub:run     # Lasna start() → Sepolia 3 笔转账 → 抓 3 次 react() 并验证自动退订
```

已发布的证据（Lasna）：

- Xfers `0x98af77c1132f26c9BB1046446D7E9e528E0bFa82`：[contract](https://lasna.reactscan.net/address/0x98af77c1132f26c9BB1046446D7E9e528E0bFa82) · [react() tx](https://lasna.reactscan.net/tx/0x15fb1316b77ea7363550df33a4478665e5f1a86f975ba8b2b0ec49eab38e0a9b)（共 5 笔，`limit` 5→0 自动退订）
- DynamicSub `0x6D38Ec4aF68b8ea069a6C21970f76426FbAb2b65`：[contract](https://lasna.reactscan.net/address/0x6D38Ec4aF68b8ea069a6C21970f76426FbAb2b65) · [react#1](https://lasna.reactscan.net/tx/0x72b48f5d636ba08ba69cf1fde5f20435b8f3cf7567aa3d37f4cdea559dc1b5fc) · [react#2](https://lasna.reactscan.net/tx/0x465b305f177b5e9ea0a68028d098e0d027ccc17826df81a5b930f9ad056801d2) · [react#3](https://lasna.reactscan.net/tx/0x5cf7ce29d174d7bacdaec8ab4bb42d7d777629cba8381e8d2defa01313242349)

`Triggered(n, sourceTx)` 事件携带触发它的 Sepolia 源交易哈希，可与源链记录一一对应；第 3 次 react 的同一笔交易里还会发出 `Unsubscribed("limit")`。

无需私钥即可复核当前状态：

```bash
cast call 0x98af77c1132f26c9BB1046446D7E9e528E0bFa82 "limit()(uint256)" --rpc-url https://lasna-rpc.rnk.dev/
cast call 0x6D38Ec4aF68b8ea069a6C21970f76426FbAb2b65 "count()(uint256)" --rpc-url https://lasna-rpc.rnk.dev/
cast call 0x6D38Ec4aF68b8ea069a6C21970f76426FbAb2b65 "active()(bool)" --rpc-url https://lasna-rpc.rnk.dev/
```

## Scope and limits

- The oracle is manually controlled. A real feed needs an adapter, deployment, and new end-to-end validation.
- The callback releases the deposited token to the owner. It does not sell or hedge that token.
- Each reactive deployment fires once until its owner updates thresholds. The published instance is currently closed.
- The demo uses one owner and one vault. Multi-user operation is not implemented.

A future version could use a production oracle and swap into a different asset. Neither is part of the deployed evidence above.

## Failure modes (出问题怎么办)

- **余额用完自动停：** `SentinelReactive` 在 Lasna 上以预付 gas 运行；当其余额不足以支付回调 gas 时，`react()` 无法再发出 `requestCallback`，链路自动停止，**不会消耗目标链资金**。充值恢复：向 `SentinelReactive` 地址转入 Lasna 测试币即可（可通过 `npm run faucet` 间接获取），无需重新部署。
- **目标链交易失败：** 回调在 `SentinelVault.execute()` 内执行；若 revert（价格回到带内、金库未 armed、或调用方不是回调代理），目标链交易回滚、金库资金不动。此时 Reactive 侧 `triggered` 已置位，会阻止重复触发；需 owner 在 Lasna 调 `updateThresholds` 重新武装后才能开启下一轮。
- **冒充回调被拒：** `execute()` 带 `onlyServiceProvider` + `onlyCallbackSender`，非授权地址调用直接 revert（只读复现见下「验证」，单测见 `test/Vault.test.js`）。
- **重复事件只执行一次：** Reactive 侧 `triggered` 标志确保同一越线只请求一次回调（`test/Reactive.test.js`："fires only once until thresholds are updated"）；vault 侧 `armed` → `false` 确保同一金库只平仓一次（`test/Vault.test.js`："does nothing when not armed"）。

## License

MIT — see [LICENSE](LICENSE).
