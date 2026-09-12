# @privatumrh/robinhood-chain-sdk

Viem-native TypeScript SDK enabling developers to embed PRIVATUM 2-of-3 threshold self-custody directly into applications on Robinhood Chain (Chain ID: 4663).

## Features

- **2-of-3 Threshold Custody**: Cryptographic key splitting across client device (Shard A), co-signer service (Shard B), and recovery passkey (Shard C).
- **Native ERC-4337 Account Abstraction**: Gasless sponsored UserOperations or direct settlement for native ETH and USDG.
- **Emergency Account Recovery**: Recover and rotate device keys using Shard C and standard RFC 6238 TOTP 2FA without exposing private keys.
- **Address Poisoning Sentinel**: Client-side heuristic analysis to detect look-alike dust addresses before signing.
- **In-App Spending Guardrails**: Configurable daily and per-transaction limits with 24-hour rolling velocity tracking.
- **Disposable Payment Links**: Escrowed burner-address paylinks for privacy-preserving payments with zero main address exposure.
- **Private Address Book**: Encrypted local counterparty storage with categorization and search.
- **Gasless Staking & Cross-Chain Bridging**: Protocol staking tier calculations and cross-chain bridge quote with PRIV relayer rebate math.

## Installation

```bash
bun add @privatumrh/robinhood-chain-sdk viem
# or
npm install @privatumrh/robinhood-chain-sdk viem
```

## Quick Start: Create Wallet

Generate a device key locally and register a new threshold smart account with the live PRIVATUM co-signer:

```typescript
import { PrivatumWallet, LocalShard } from "@privatumrh/robinhood-chain-sdk";

// 1. Generate local device key (Shard A)
const shardA = LocalShard.create("device");

// 2. Register wallet with the live PRIVATUM co-signer
const { wallet, shardC } = await PrivatumWallet.create({
  existingShardA: shardA,
});

console.log("Wallet address:", wallet.address);
console.log("Co-signer Shard B address:", wallet.shardB.address);
console.log("Recovery Shard C address:", shardC.address);
console.log("API Key for co-signing:", wallet.apiKey);
```

Securely persist `shardA.privateKey` in your platform keystore (such as OS Keychain or encrypted local storage) and deliver `shardC.privateKey` to the user as their emergency recovery backup.

## Transfer USDG or Native ETH

Transfers execute as ERC-4337 UserOperations authorized by a 2-of-3 threshold quorum:

```typescript
import { parseEther, parseUnits } from "viem";

// Send native ETH on Robinhood Chain
const ethReceipt = await wallet.sendAsset({
  to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  amount: parseEther("0.05"),
  asset: "ETH",
});
console.log("ETH UserOp hash:", ethReceipt.userOpHash);

// Send USDG on Robinhood Chain
const usdgReceipt = await wallet.sendAsset({
  to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  amount: parseUnits("25.0", 6),
  asset: "USDG",
});
console.log("USDG UserOp hash:", usdgReceipt.userOpHash);
```

## Emergency Recovery (Shard C + TOTP)

If Shard A is lost or compromised, recover the account by rotating Shard A using Shard C and standard RFC 6238 TOTP 2FA.

### 1. Setup TOTP 2FA (During Onboarding)

```typescript
// Request TOTP secret and provisioning URI
const totpSetup = await wallet.setupTotpRecovery();
console.log("Scan QR or enter secret into authenticator:", totpSetup.secret);

// Confirm code to activate recovery policy
const confirmed = await wallet.confirmTotpRecovery("123456");
console.log("TOTP recovery active:", confirmed);
```

### 2. Execute Recovery Rotation

```typescript
import { PrivatumWallet, LocalShard } from "@privatumrh/robinhood-chain-sdk";

// Generate replacement device key
const newShardA = LocalShard.create("device");

// Submit recovery rotation signed by Shard C + Co-signer Shard B
const receipt = await PrivatumWallet.recoverWallet({
  walletAddress: "0xYourWalletAddress",
  shardC: savedRecoveryShardC,
  totpCode: "654321",
  newShardAAddress: newShardA.address,
});

console.log("Recovery UserOp broadcast:", receipt.userOpHash);
```

## Address Poisoning Sentinel

Attackers send dust transactions from vanity addresses that match the first and last characters of addresses in your history, hoping you will copy their address from recent activity.

The Sentinel inspects target addresses before any signature occurs:

```typescript
import {
  checkAddressPoisoning,
  requiresAcknowledgement,
} from "@privatumrh/robinhood-chain-sdk";

const verdict = checkAddressPoisoning({
  recipient: "0x1234c0532925a3b844bc454e4438f44e1234abcd",
  history: [
    {
      type: "send",
      counterparty: "0x123488888888888888888888888888888888abcd",
      amount: "10.0",
      asset: "USDG",
    },
  ],
  ownAddresses: [wallet.address],
});

if (requiresAcknowledgement(verdict)) {
  console.warn("Security Alert:", verdict.title);
  console.warn(verdict.detail);
  console.warn("Look-alike of:", verdict.lookalikeOf);
  console.warn(`Prefix match: ${verdict.prefixMatch}, Suffix match: ${verdict.suffixMatch}`);
}
```

## In-App Spending Guardrails

Protect against accidental fat-finger transfers or unauthorized wallet drain with client-side velocity tracking:

```typescript
import {
  evaluateSpend,
  recordSpend,
  loadGuardrailConfig,
  loadSpendingHistory,
  estimateUsdValue,
} from "@privatumrh/robinhood-chain-sdk";

const config = loadGuardrailConfig(wallet.address);
const history = loadSpendingHistory(wallet.address);

const amountUsd = estimateUsdValue("150", "USDG");
const verdict = evaluateSpend(config, amountUsd, history);

if (!verdict.allowed) {
  throw new Error(`Transfer blocked by strict guardrail: ${verdict.message}`);
}

if (verdict.warning) {
  console.warn("Guardrail Warning:", verdict.message);
  // Prompt user for confirmation if strictMode is false
}

// After broadcast:
recordSpend(wallet.address, {
  txHash: receipt.userOpHash,
  amount: 150,
  symbol: "USDG",
  amountUsd,
  recipient: "0xRecipientAddress",
});
```

## Disposable Payment Links

Create disposable, escrowed payment links with single-use burner addresses for non-interactive payments that prevent linking to your primary wallet:

```typescript
import {
  createPayLink,
  getPayLink,
  checkAndSweepPayLink,
  listUserPayLinks,
} from "@privatumrh/robinhood-chain-sdk";

// 1. Create a paylink
const paylink = await createPayLink({
  senderWallet: wallet.address,
  amount: "50",
  asset: "USDG",
  expiryHours: 24,
  memo: "Invoice #1042",
  singleUse: true,
});
console.log("PayLink URL:", `https://privatum.io/pay/${paylink.slug}`);
console.log("Deposit address:", paylink.depositAddress);

// 2. Query paylink status
const details = await getPayLink(paylink.slug);
console.log("Status:", details.status);

// 3. Sweep funds to recipient once deposit arrives
const sweep = await checkAndSweepPayLink(paylink.slug);
console.log("Swept:", sweep.swept, "Tx Hash:", sweep.txHash);
```

## Private Address Book

Store friendly labels, categories, and notes for counterparties with local encryption and zero cloud exposure:

```typescript
import {
  loadContacts,
  addContact,
  findContactByAddress,
  searchContacts,
} from "@privatumrh/robinhood-chain-sdk";

// Add contact
addContact(wallet.address, {
  name: "Alice Engineering",
  address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  category: "Work",
  note: "Lead auditor",
});

// Search
const contacts = loadContacts(wallet.address);
const match = findContactByAddress(contacts, "0x742d35cc6634c0532925a3b844bc454e4438f44e");
console.log("Contact name:", match?.name);
```

## Staking & Cross-Chain Bridging

### Gasless Staking Tiers

Calculate monthly transaction quotas based on staked $PRIV:

```typescript
import {
  calculateStakingTier,
  getStakingStatus,
} from "@privatumrh/robinhood-chain-sdk";

const tier = calculateStakingTier(50000);
console.log("Tier:", tier.tierName, "Monthly quota:", tier.monthlyQuota);

const status = await getStakingStatus(wallet.address);
console.log("Active stake:", status.stakedAmount, "Pass active:", status.isActive);
```

### Cross-Chain Bridge Quotes with Relayer Rebate

Estimate cross-chain bridging routes via Relay.link with automated $PRIV rebates on the relayer margin:

```typescript
import {
  quoteBridgeWithRebate,
  ROBINHOOD_CHAIN_ID,
} from "@privatumrh/robinhood-chain-sdk";

const quote = await quoteBridgeWithRebate({
  user: wallet.address,
  originChainId: 8453, // Base
  destinationChainId: ROBINHOOD_CHAIN_ID, // 4663
  amount: "100000000", // 100 USDC (6 decimals)
});

console.log("Spread USD:", quote.rebate.spreadUsd);
console.log("Rebate USD in PRIV:", quote.rebate.rebateUsd);
```

## Network Constants

```typescript
import {
  ROBINHOOD_CHAIN_ID,
  robinhoodChain,
  ENTRY_POINT_ADDRESS,
  USDG_ADDRESS,
  PRIVATUM_FACTORY_ADDRESS,
  DEFAULT_API_URL,
} from "@privatumrh/robinhood-chain-sdk";

console.log("Chain ID:", ROBINHOOD_CHAIN_ID); // 4663
console.log("RPC:", robinhoodChain.rpcUrls.default.http[0]);
console.log("EntryPoint:", ENTRY_POINT_ADDRESS);
console.log("USDG:", USDG_ADDRESS);
console.log("Factory:", PRIVATUM_FACTORY_ADDRESS);
```

## License

MIT
