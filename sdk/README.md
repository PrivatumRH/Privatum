# @privatum/robinhood-chain-sdk

Viem-native TypeScript SDK enabling developers to embed **PRIVATUM 2-of-3 threshold self-custody** directly into applications on **Robinhood Chain (Chain ID: 4663)**.

## Installation

```bash
npm install @privatum/robinhood-chain-sdk viem
```

## Quick Start (USDG Transfer)

```typescript
import { Shard, PrivatumWallet, sendUsdg } from "@privatum/robinhood-chain-sdk";

// 1. Initialize threshold shards
const driveShard = await Shard.loadFromKeyring("drive");
const serverShard = await Shard.createRemoteCosigner("https://api.privatumrh.com");
const recoveryShard = await Shard.loadPasskey();

// 2. Assemble 2-of-3 threshold smart account
const wallet = PrivatumWallet.twoOfThree({
  shards: [driveShard, serverShard, recoveryShard],
  threshold: 2,
  chainId: 4663,
});

// 3. Dispatch private USDG transfer on Robinhood Chain
const txHash = await sendUsdg({
  wallet,
  to: "recipient.privatum",
  amount: "50.0", // 50 USDG
  signingShards: [driveShard, serverShard],
});

console.log(`Settled: https://robinhoodchain.blockscout.com/tx/${txHash}`);
```

## License
MIT
