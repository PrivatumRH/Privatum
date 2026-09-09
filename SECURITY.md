# Security Policy

PRIVATUM is an open-source, self-custodial 2-of-3 threshold payment system built on **Robinhood Chain** (Chain ID: 4663). Because we protect user capital and private financial workflows, we treat security vulnerabilities with the highest priority.

## Reporting a Vulnerability

**Do not file public GitHub issues for security vulnerabilities.**

Please report security issues directly to our security team:
- **Email:** `security@privatumrh.com`
- **PGP Key:** Available upon request or via published keybase profile.

### What to Include
1. A descriptive title and vulnerability severity rating.
2. Detailed steps to reproduce (proof-of-concept scripts or forge test cases preferred).
3. The component affected (`contracts/`, `backend/`, `sdk/`, or `desktop/`).
4. Potential attack scenarios and impact analysis.

### Response Timelines
- **Initial Acknowledgment:** Within 48 hours.
- **Triage & Severity Assessment:** Within 72 hours.
- **Critical Patch & Deployment:** Targeted within 7 calendar days.

We will keep you informed of our progress throughout remediation.

---

## Scope & Threat Model

### In-Scope Components
| Component | Surface | Primary Risk Vectors |
|---|---|---|
| **Smart Contracts (`contracts/`)** | `PrivatumAccount.sol`, `PrivatumFactory.sol` | Quorum bypass, signature malleability, ERC-4337 entry point reentrancy, unauthorized execution |
| **Co-Signer Backend (`backend/`)** | Express + Bun Co-Signer API | Spending policy bypass, rate-limit circumvention, encrypted Shard B exposure, replay attacks |
| **Open SDK (`sdk/`)** | `@privatum/robinhood-chain-sdk` | Cryptographic key leakage, weak randomness in ephemeral key generation |
| **Desktop Client (`desktop/`)** | Tauri v2 (Rust Core + React) | OS Keychain credential leakage, memory extraction of Shard A |

### Out of Scope
- Denial of Service attacks on public RPC endpoints or third-party bundlers.
- Attacks requiring physical possession of both the unlocked user device AND the user's biometric hardware passkey.
- Social engineering, phishing, or user error.

---

## Safe Harbor & Research Guidelines

We consider security research conducted under the following conditions to be authorized and in good faith:
- You make a good-faith effort to avoid privacy violations, data destruction, and service disruption.
- You do not exploit a vulnerability beyond what is necessary to prove the risk.
- You give us reasonable time to remediate before disclosing details publicly.

We will not pursue legal action against researchers who adhere to these guidelines.

---

## Network & Contract Reference

- **Execution Network:** Robinhood Chain Mainnet (Chain ID: `4663`, Arbitrum Dedicated L2)
- **ERC-4337 EntryPoint v0.6:** `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
- **Frontier Settlement Assets:** USDG (`0x2D734407B184FF66b26D0cf32168e65842820579`), Native ETH
