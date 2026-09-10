<div align="center">

# PRIVATUM

**Private payments. Non-custodial. On Robinhood Chain.**

[![Backend CI](https://github.com/notadeveloper7/privatum/actions/workflows/backend.yml/badge.svg)](https://github.com/notadeveloper7/privatum/actions/workflows/backend.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-38B6FF.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)](https://bun.sh/)
[![TanStack React](https://img.shields.io/badge/TanStack-React-FF4154?logo=react&logoColor=white)](https://tanstack.com/)
[![Robinhood Chain](https://img.shields.io/badge/Robinhood_Chain-4663-00C805?logo=ethereum&logoColor=white)](https://robinhoodchain.blockscout.com)
[![Foundry](https://img.shields.io/badge/Foundry-Solidity-FFA500?logo=solidity&logoColor=white)](https://getfoundry.sh/)

</div>

---

## What It Does

**PRIVATUM** is a self-custodial smart wallet and open developer toolkit engineered for **Robinhood Chain** (Arbitrum-powered EVM L2, Chain ID `4663`). It enables individuals and automated workflows to hold, send, and swap frontier assets (specifically **USDG** and native **ETH**) with zero single points of failure. Your private key is mathematically split into three independent shards (2-of-3 quorum): one on your local device, one with the automated co-signer service, and one in hardware passkey recovery. No single party, not even PRIVATUM, can ever move your funds.

---

## Core Capabilities

| Capability | Surface | Description | Implementation Status |
|---|---|---|---|
| **2-of-3 Threshold Quorum** | Contracts / SDK | Off-chain ECDSA shard aggregation requiring 2 signatures to authorize ERC-4337 UserOps | Active |
| **Frontier Asset Settlement** | Multi-surface | Native settlement and routing for **USDG** stablecoin and **ETH** on Robinhood Chain | Active |
| **Co-Signer Service** | Backend | High-availability policy evaluation engine enforcing daily spend limits and velocity rules | Active |
| **Tauri v2 Desktop Client** | Desktop | Native OS client (macOS, Windows, Linux) storing Shard A encrypted in OS keystores | Scaffolded |
| **Viem Open SDK** | SDK (`@privatumrh/robinhood-chain-sdk`) | Developer library to programmatically assemble threshold wallets and dispatch transactions | Active |
| **ERC-5564 Stealth Addresses** | Privacy Plane | One-time destination addresses derived from public `.privatum` meta-addresses | In Progress |
| **Screened Privacy Pools** | Privacy Plane | Association-set cryptographic proofs verifying clean asset provenance | Roadmap |

---

## How It Works: The 5-Step Signing Pipeline

```
[1. Build] ──► [2. Client Sign (Shard A)] ──► [3. Co-Sign (Shard B)] ──► [4. Combine] ──► [5. Settle]
  Desktop        Local OS Keystore              Co-Signer API (TLS)       130-byte payload   Robinhood Chain
  or SDK         Partial ECDSA Signature        Evaluates Policy Engine    (sigA || sigB)    ERC-4337 EntryPoint
```

1. **Build**: The desktop application or SDK prepares an unsigned ERC-4337 UserOperation for USDG or ETH transfer.
2. **Client Sign (Shard A)**: Local client decrypts Shard A via device credentials and signs the `userOpHash`.
3. **Co-Sign (Shard B)**: The payload is dispatched over TLS to the Co-signer API. The service verifies velocity and balance rules, then signs with Shard B.
4. **Combine**: The two 65-byte signatures are merged into an aggregate 130-byte threshold signature (`sigA || sigB`).
5. **Settle**: The operation is dispatched to the Robinhood Chain bundler. The `PrivatumAccount` contract validates the 2-of-3 quorum and executes onchain.

*Note: If the client device is lost, **Shard C (Passkey)** combines with **Shard B (Co-signer)** to initiate emergency key rotation or fund migration.*

---

## Co-Signer API Endpoints

The co-signer backend (`backend/`) exposes the following HTTP endpoints:

| Method | Endpoint | Description | Payload / Notes |
|---|---|---|---|
| `GET` | `/health` | Service health, version, and Robinhood Chain ID check | Returns `{ status: "ok", chainId: 4663 }` |
| `POST` | `/v1/wallets` | Registers a new 2-of-3 threshold account | `{ address, shardAPubkey, shardBEncrypted, shardCPasskeyPubkey }` |
| `POST` | `/v1/cosign` | Submits UserOp for policy validation and Shard B co-signing | `{ walletAddress, asset, amount, userOpHash, recipient }` |

---

## Repository Structure

```
privatum/
├── .github/workflows/
│   └── backend.yml           # CI/CD: Test, GHCR build/push, Git release, Render deploy
├── backend/                  # Bun + Express + PostgreSQL Co-Signer Service
│   ├── src/
│   │   ├── db/               # PostgreSQL pool & automated migration runner
│   │   ├── routes/           # /health, /v1/wallets, /v1/cosign
│   │   ├── app.ts            # Exported Express app (for supertest)
│   │   └── index.ts          # Server bootstrap
│   ├── db/migrations/        # Schema migrations (wallets, policies, requests)
│   ├── tests/                # Bun test suite (health, cosigning)
│   └── Dockerfile            # Multi-stage Bun production container
├── contracts/                # Foundry smart contracts for Robinhood Chain
│   ├── src/
│   │   ├── PrivatumAccount.sol # ERC-4337 2-of-3 threshold account
│   │   └── PrivatumFactory.sol # CREATE2 deterministic deployment factory
│   ├── test/                 # Foundry test suites (forge test)
│   └── script/               # Deployment scripts (forge script Deploy.s.sol)
├── desktop/                  # Tauri v2 native desktop application
│   ├── src/                  # React UI (balances, shard health monitor)
│   └── src-tauri/            # Rust core & OS keychain integration
├── sdk/                      # @privatumrh/robinhood-chain-sdk (Viem-based)
│   └── src/                  # Shard lifecycle, PrivatumWallet, transfer helpers
├── src/                      # TanStack React web frontend (Vite + Tailwind + shadcn)
│   ├── routes/               # TanStack router routes (__root, index)
│   └── lib/                  # UI utility helpers
├── technical-docs/           # Product specifications & architecture PRD
├── tailwind.config.ts        # Design tokens: #38B6FF accent, Geist & Fraunces fonts
├── vite.config.ts            # Vite bundler configuration
└── LICENSE                   # MIT License
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (`curl -fsSL https://bun.sh/install | bash`)
- [Foundry](https://getfoundry.sh/) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)

### 1. Web Frontend (TanStack React)
```bash
# Install dependencies
bun install

# Run local development server
bun run dev

# Run typecheck and production build
bun run check && bun run build
```

### 2. Co-Signer Backend
```bash
cd backend
bun install
bun run check
bun test
bun run dev
```

### 3. Smart Contracts (Foundry)
```bash
cd contracts
forge test
```

### 4. Open SDK
```bash
cd sdk
bun install
bun run check
```

---

## Technical Specifications

- **Execution Network:** Robinhood Chain Mainnet
- **Network Stack:** Arbitrum Dedicated Blockchains / L2
- **Chain ID:** `4663`
- **Native Gas Token:** `ETH`
- **Frontier Settlement Assets:** `USDG` and `ETH`
- **Block Explorer:** [https://robinhoodchain.blockscout.com](https://robinhoodchain.blockscout.com)
- **Account Abstraction Standard:** ERC-4337 v0.6

---

## Roadmap

```
Phase 1: Robinhood Chain Custody MVP (Current)
├── ERC-4337 threshold contracts (Robinhood Chain ID: 4663)
├── Co-signer service with automated spending policies
├── Tauri v2 desktop application scaffold
└── Open SDK @privatumrh/robinhood-chain-sdk

Phase 2: Open SDK & Developer Ecosystem
Phase 3: DEX Aggregation & USDG/ETH Swaps
Phase 4: Privacy Plane One (Threshold ECDSA & Blind Co-signing)
Phase 5: Privacy Plane Two (ERC-5564 Stealth Addresses & Screened Pools)
Phase 6: Multichain Expansion
```

---

## Security

Security reports are taken with utmost priority. Please review our [SECURITY.md](SECURITY.md) and report any vulnerability directly to:
**`security@privatumrh.com`**

---

## License

This project is licensed under the [MIT License](LICENSE).
