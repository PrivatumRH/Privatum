# How PRIVATUM Works: Private, Un-drainable Self-Custody on Robinhood Chain

> *Imagine a crypto wallet where a stolen laptop does not cost you your savings, a server breach cannot touch your coins, and your transactions stay completely private.*
>
> **Welcome to PRIVATUM.**

---

## The Problem: The Unfair Crypto Compromise

Today, storing and using cryptocurrency forces you into an unacceptable trade-off:

1. **Hot Wallets (Browser Extensions and Mobile Apps)**: Your entire private key lives in one place on your device. One click on a malicious link, one rogue extension, or one piece of malware, and your balance is drained instantly.
2. **Hardware Wallets**: They cost $150+, require proprietary cables, and interrupt your day with tedious physical confirmations.
3. **Zero Financial Privacy**: On traditional ledgers, your wallet address is completely public. Anyone who sends you funds can see your entire net worth, your transaction history, and everyone you do business with.

PRIVATUM solves this permanently with **2-of-3 Threshold Self-Custody** and **Native Stealth Payments** on Robinhood Chain.

---

## The Core Innovation: One Wallet, Split in Three

Instead of storing one single private key that can be stolen, PRIVATUM splits your wallet authority into **three independent shards**. 

To move funds, any **2 out of 3 shards** must agree. **No single shard can ever spend your money alone.**

```
                      ┌────────────────────────────┐
                      │    YOUR PRIVATUM WALLET    │
                      └─────────────┬──────────────┘
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
   [ Key 1: Shard A ]         [ Key 2: Shard B ]         [ Key 3: Shard C ]
    "Your Device Key"         "The Co-Signer Key"        "The Rescue Key"
   Stored in your laptop      Protected by PRIVATUM's    Gated by your 2FA
    hardware secure vault       automated co-signer      authenticator app
         │                          │                          │
         └─────────────┬────────────┘                          │
                       │ (Daily Spending: 2-of-3)              │ (Emergency Recovery)
                       ▼                                       ▼
             [ 2-of-3 Quorum Validated ]             [ 2-of-3 Quorum Validated ]
                       │                                       │
                       └───────────────────┬───────────────────┘
                                           ▼
                                 [ Robinhood Chain L2 ]
                               Transaction confirmed instantly
```

### The Three Keys

* **Key 1 (Shard A) - Your Device Key**: Generated locally and stored inside your computer's native hardware-encrypted keychain (Apple Keychain, Windows Credential Vault, or Linux Secret Service). It never leaves your machine.
* **Key 2 (Shard B) - The Co-Signer Key**: Held in PRIVATUM's automated, hardened cloud co-signer. When your device requests a transaction, the co-signer verifies your authorized session and co-signs in milliseconds.
* **Key 3 (Shard C) - The 2FA Rescue Key**: An encrypted emergency shard stored safely in our recovery vault, unlocked only when you enter a standard 6-digit code from **Google Authenticator**, **Authy**, or **1Password**.

---

## How It Works in Real Life

### 1. Onboarding in 30 Seconds
When you first open the PRIVATUM Desktop App:
1. The app generates your keys mathematically.
2. You scan a standard QR code with your phone's Authenticator app (for your Rescue Key).
3. That is it. No complicated seed phrase writing, no gas fees, and no waiting. Your wallet is live.

---

### 2. Daily Spending: Fast, Fluid, and Secure
Sending ETH, USDG, or swapping tokens on Robinhood Chain feels seamless:
1. You hit **Send** in the PRIVATUM desktop app.
2. Your laptop signs with **Key 1**.
3. PRIVATUM's Co-Signer verifies your authenticated session and co-signs with **Key 2**.
4. Both signatures combine to authorize the transfer on Robinhood Chain.

The experience is instant. You do not have to enter 2FA codes for normal daily payments. The threshold cryptography executes automatically in the background.

---

### 3. Stealth Privacy: Financial Discretion by Default
On ordinary blockchains, sharing your wallet address reveals everything you own. PRIVATUM changes this with **Stealth Addresses (ERC-5564)**:

* When someone pays you, PRIVATUM automatically derives a **single-use, one-time stealth address**.
* The sender transfers ETH or USDG to this one-time address.
* Only your private desktop app can detect and control those funds.
* To the outside world, your main wallet address, total balance, and identity remain completely invisible.

---

### 4. The Worst-Case Scenario: What If Your Laptop Is Stolen?
If your laptop is lost, broken, or stolen, your crypto is safe.

1. **Why the thief cannot steal your money**: The thief only has **Key 1**. They cannot spend anything without **Key 2** or **Key 3**.
2. **How you recover your funds**:
   * Download PRIVATUM on a new computer.
   * Enter your wallet address and the 6-digit code from your phone's Authenticator app.
   * **Key 2 (Co-Signer)** and **Key 3 (Rescue Key)** join forces to verify you and issue a brand-new **Key 1** to your new computer.
   * The stolen laptop's key is instantly revoked and disabled on-chain.

---

## Why PRIVATUM is Un-drainable

| What Happens If... | Your Funds | Why You Are Safe |
| :--- | :---: | :--- |
| **Your laptop gets malware or is physically stolen** | **Safe** | The thief has only 1 of 3 keys. It takes 2 keys to move funds. |
| **PRIVATUM's servers are completely breached** | **Safe** | The hacker only gets 1 of 3 keys. PRIVATUM cannot move your funds without your physical laptop. |
| **PRIVATUM the company disappears tomorrow** | **Safe** | You hold Key 1 on your computer and Key 3 via your backup. Any 2 keys can execute smart contract transactions directly. |

---

## Why Robinhood Chain?

PRIVATUM is built directly for **Robinhood Chain (Chain ID 4663)**:
* **Near-Zero Gas**: Smart transactions execute for fractions of a cent.
* **Instant Settlement**: Sub-second finality powered by the Arbitrum tech stack.
* **Native Assets**: Direct liquidity for ETH and USDG.

---

## The Verdict

* No seed phrases that can be stolen from a desk drawer.
* No hot-wallet drains from malicious browser extensions.
* No hardware dongles or clunky physical buttons.
* True financial privacy that keeps your wealth your business.

**PRIVATUM: Private by design. Non-custodial by math.**
