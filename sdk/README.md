# @privatum/robinhood-chain-sdk

Viem-native TypeScript SDK enabling developers to embed PRIVATUM 2-of-3 threshold self-custody directly into applications on Robinhood Chain (Chain ID: 4663).

## Installation

```bash
bun add @privatum/robinhood-chain-sdk viem
# or
npm install @privatum/robinhood-chain-sdk viem
```

## Quick Start: Create Wallet

```typescript
import { PrivatumWallet, LocalShard } from "@privatum/robinhood-chain-sdk";

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

## Transfer USDG or Native ETH

Transfers are executed via ERC-4337 UserOperations signed by 2-of-3 threshold quorum:

```typescript
import { parseEther, parseUnits } from "viem";

// Send native ETH on Robinhood Chain
const ethReceipt = await wallet.sendAsset({
  to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  amount: parseEther("0.1"),
  asset: "ETH",
});
console.log("Submitted UserOp hash:", ethReceipt.userOpHash);

// Send USDG on Robinhood Chain
const usdgReceipt = await wallet.sendAsset({
  to: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  amount: parseUnits("50.0", 6),
  asset: "USDG",
});
console.log("Submitted UserOp hash:", usdgReceipt.userOpHash);
```

## Emergency Recovery (Shard C + TOTP)

If Shard A is lost, recover the account by rotating Shard A using Shard C and standard RFC 6238 TOTP 2FA:

```typescript
import { PrivatumWallet, LocalShard } from "@privatum/robinhood-chain-sdk";

// Generate new device key
const newShardA = LocalShard.create("device");

// Submit recovery rotation
const receipt = await PrivatumWallet.recoverWallet({
  walletAddress: "0x...",
  shardC: savedRecoveryShardC,
  totpCode: "123456",
  newShardAAddress: newShardA.address,
});
console.log("Recovery UserOp broadcast:", receipt.userOpHash);
```

## License
MIT
