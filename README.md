# Sentinel Vault

On-chain stop-loss / take-profit **exit orders** for the
[Reactive Omni Buildathon](https://dorahacks.io/hackathon/reactive-omni-buildathon/detail)
— track **Set It and Forget It**.

> ⚠️ Testnet demo. Educational project. Nothing here is investment advice.

## The idea

Deposit an ERC-20 into your personal vault, set a stop-loss and a take-profit price, then
walk away. A contract on the Reactive Network watches the price feed; the moment the price
crosses either threshold it triggers a cross-chain callback, and the vault releases the
funds back to your wallet.

Nothing needs to keep running. That is the point: the watcher is a contract, not a bot.

## How it works

```
Base Sepolia                                   Reactive Lasna (5318007)
┌──────────────────┐   PriceUpdated (LOG3)     ┌────────────────────┐
│ MockOracle       │ ─────────────────────────►│ SentinelReactive   │
│ (manual/real feed)│                           │  - subscribed at   │
└──────────────────┘                           │    construction    │
┌──────────────────┐   callback: execute()      │  - threshold check │
│ SentinelVault    │ ◄──────────────────────────│  - requestCallback │
│ holds your token │     via callback proxy     └────────────────────┘
│ re-verifies price│
│ releases funds   │
└──────────────────┘
```

1. **Origin** — a price oracle emits `PriceUpdated(uint256 price, uint256 timestamp)`
   on Base Sepolia. The repo ships a `MockOracle` so the demo is deterministic; in
   production mode the same subscription shape works with a Chainlink `AnswerUpdated` feed.
2. **Reactive** — `SentinelReactive` lives on Lasna. Its constructor subscribes to the
   oracle event via `SYSTEM.subscribe(...)`. On every matching event, `react()` compares
   the price against the thresholds and, once crossed, calls
   `SYSTEM.requestCallback(...)` to deliver an `execute(address,uint256)` call to the
   vault on Base Sepolia.
3. **Destination** — `SentinelVault` receives the callback through the callback proxy.
   It authenticates the call twice (service provider + callback sender), re-reads the
   on-chain oracle price, and only then transfers the full balance back to the owner and
   emits `VaultClosed`.

Both contracts must stay funded: the reactive contract pays its own gas in lREACT, and the
vault pays callback fees in Base Sepolia ETH (see the docs' Economy section).

## Contracts

| Contract | Chain | Role |
|---|---|---|
| `MockOracle` | Base Sepolia | Controllable 8-decimal price feed |
| `SentinelReactive` | Lasna | Watches price, requests callbacks |
| `SentinelVault` | Base Sepolia | Holds funds, verifies and executes exits |
| `MockToken` | Base Sepolia | Test asset (6 decimals, USDC-style) |

## Prerequisites

- Node 20+, npm
- A **fresh testnet wallet** (never a real one)
- Base Sepolia ETH: [base faucets](https://docs.base.org/chain/network-faucets)
- lREACT: send ≤5 Base Sepolia ETH to the Lasna faucet
  `0x2afaFD298b23b62760711756088F75B7409f5967` — 1 ETH → 100 lREACT
  (docs: [Reactive Mainnet / Lasna Testnet](https://dev.reactive.network/reactive-mainnet))

## Run it

```bash
npm install
cp .env.example .env    # fill DEST_PK and REACTIVE_PK (same test wallet is fine)

npm run compile
npm test               # local unit tests, no network

npm run deploy:oracle   # -> ORACLE_ADDR, ASSET_ADDR
npm run deploy:reactive # -> REACTIVE_ADDR   (Lasna)
npm run deploy:vault    # -> VAULT_ADDR      (Base Sepolia)
npm run bind            # reactive.setVault(VAULT_ADDR)   (Lasna)
npm run demo            # fund -> arm -> poke price -> watch the callback land
```

## Why this scores

- **Execution** — a real `react()` transaction on Lasna and a real callback transaction
  on Base Sepolia, both verifiable on explorers.
- **Integration** — the vault genuinely holds value and genuinely moves it; it re-verifies
  the price on-chain instead of blindly trusting the callback.
- **Usefulness** — "set a stop, forget it" is a real user need; every piece of this pattern
  (oracle, watcher, executor) is reusable.
- **Craft** — unit tests cover the threshold logic, both authentication checks, the
  fire-once rule, and the subscription; deployment is scripted and documented.

## Roadmap (documented, honest scope)

- v1 (this repo): exit-to-wallet on threshold breach, mock oracle.
- v2: real Chainlink feed subscription, Uniswap V2 swap instead of exit-to-wallet.
- v3: multiple vaults per reactive contract, pause/resume, cooldowns.

## Known limits

- Mock oracle is centralized (demo only).
- The reactive contract fires once; thresholds must be updated to re-arm.
- Callback fees on the vault require native-token funding on the destination chain.
