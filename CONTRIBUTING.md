# Contributing to PRIVATUM

Thank you for your interest in contributing to **PRIVATUM**. We welcome contributions from developers, cryptographers, and privacy advocates working to advance private self-custody on **Robinhood Chain**.

---

## What We Need Right Now

We are actively seeking contributions in the following specific areas:
- **Robinhood Chain ERC-4337 Optimization**: Gas optimization in `contracts/src/PrivatumAccount.sol` and EntryPoint v0.6 compatibility.
- **Passkey (WebAuthn / P-256) Verifier**: Solidity verification for secp256r1 signatures in recovery flows (Shard C).
- **Stealth Address Scanning (ERC-5564)**: Ephemeral key derivation and event parsing in `@privatumrh/robinhood-chain-sdk`.
- **Co-Signer Rate Limiting & Zero-Knowledge Policy Proofs**: Anonymous limit proofs using Noir or Circom in `backend/`.
- **Tauri v2 OS Keystore Bindings**: Enhancing native keychain access across Linux Secret Service, macOS Keychain, and Windows Credential Manager in `desktop/`.

### What Is Out of Scope
- Adding unsupported blockchain networks without prior RFC approval.
- Modifying the 2-of-3 threshold quorum to any custodial single-key alternative.
- Obfuscated code, proprietary dependencies, or untyped JavaScript.

---

## Development Setup

PRIVATUM uses [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

### Prerequisites
- Bun v1.1+ (`curl -fsSL https://bun.sh/install | bash`)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- Rust toolchain (for Tauri desktop development)

### 1. Clone & Install
```bash
git clone https://github.com/notadeveloper7/privatum.git
cd privatum

# Install root dependencies (TanStack React web frontend)
bun install

# Install backend dependencies
cd backend && bun install && cd ..

# Install SDK dependencies
cd sdk && bun install && cd ..
```

### 2. Run Tests
```bash
# Frontend typecheck & build
bun run check && bun run build

# Backend unit & integration tests
cd backend && bun test && bun run check && cd ..

# Smart contracts tests (Foundry)
cd contracts && forge test && cd ..

# SDK typecheck
cd sdk && bun run check && cd ..
```

---

## Workflow & PR Guidelines

1. **Fork the repo** and create your branch from `master`:
   ```bash
   git checkout -b feat/stealth-address-parser
   ```
2. **One concern per pull request**: Keep PRs focused. Do not mix refactors with new features.
3. **Tests are mandatory**: Every contract change must include Foundry tests in `contracts/test/`. Every backend or SDK change must include Bun tests.
4. **Sign-off and Commit Style**: Use concise, imperative, present-tense commit messages in plain English:
   - `add ERC-5564 stealth key derivation to sdk`
   - `fix signature offset validation in PrivatumAccount`
   - `implement rate limiting sliding window in cosigner`
   Do not add co-author trailers or AI tool watermarks.

---

## Bug Reports

If you encounter an operational bug (non-security), please open a GitHub Issue with the following details:
- **Environment**: OS, Bun version, node version, network (Robinhood Mainnet vs Local).
- **Component**: Frontend, Desktop, Co-signer Backend, Contracts, or SDK.
- **What You Did**: Exact command line, API request, or UI action.
- **What You Expected**: The intended result.
- **What Actually Happened**: The actual error message, stack trace, or unexpected behavior.
- **Reproduction Steps**: Minimal reproducible code or steps.

> [!IMPORTANT]
> For security vulnerabilities, **do not file a public issue**. Refer directly to our [SECURITY.md](SECURITY.md) and report via `security@privatumrh.com`.
