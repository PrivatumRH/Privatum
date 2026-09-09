import type { Address, Hex } from "viem";

export type ShardRole = "drive" | "server" | "recovery";

export interface IShard {
  role: ShardRole;
  address: Address;
  publicKey: Hex;
  signMessage(messageHash: Hex): Promise<Hex>;
}

export interface PrivatumWalletConfig {
  shards: [IShard, IShard, IShard];
  threshold: 2;
  chainId: number;
  entryPointAddress?: Address;
  accountFactoryAddress?: Address;
}

export interface SendAssetOptions {
  wallet: {
    address: Address;
    shards: [IShard, IShard, IShard];
  };
  to: string; // address or .privatum meta-address
  amount: string;
  signingShards: [IShard, IShard];
}
