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

## Scope and limits

- The oracle is manually controlled. A real feed needs an adapter, deployment, and new end-to-end validation.
- The callback releases the deposited token to the owner. It does not sell or hedge that token.
- Each reactive deployment fires once until its owner updates thresholds. The published instance is currently closed.
- The demo uses one owner and one vault. Multi-user operation is not implemented.

A future version could use a production oracle and swap into a different asset. Neither is part of the deployed evidence above.

## License

MIT — see [LICENSE](LICENSE).
