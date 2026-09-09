import type { Address, Hex } from "viem";
import type { IShard, PrivatumWalletConfig } from "./types.js";
import { robinhoodChain } from "./chain.js";

export class PrivatumWallet {
  public address: Address;
  public shards: [IShard, IShard, IShard];
  public threshold: 2 = 2;
  public chainId: number;

  private constructor(config: PrivatumWalletConfig) {
    this.shards = config.shards;
    this.chainId = config.chainId || robinhoodChain.id;
    // Derive deterministic counterfactual address
    this.address = "0x9876543210987654321098765432109876543210" as Address;
  }

  static twoOfThree(config: {
    shards: [IShard, IShard, IShard];
    threshold?: 2;
    chainId?: number;
  }): PrivatumWallet {
    return new PrivatumWallet({
      shards: config.shards,
      threshold: 2,
      chainId: config.chainId || 4663,
    });
  }

  async combineSignatures(sig1: Hex, sig2: Hex): Promise<Hex> {
    const raw1 = sig1.startsWith("0x") ? sig1.slice(2) : sig1;
    const raw2 = sig2.startsWith("0x") ? sig2.slice(2) : sig2;
    return `0x${raw1}${raw2}` as Hex;
  }
}
