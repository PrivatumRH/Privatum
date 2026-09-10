import type { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import { hexToBytes, isHex } from "viem";
import type { ILocalShard, IRemoteCosigner, RemoteCosignerConfig } from "./types.js";
import { DEFAULT_API_URL } from "./chain.js";

export class LocalShard implements ILocalShard {
  public role: "device" | "recovery";
  public address: Address;
  public privateKey: Hex;

  constructor(role: "device" | "recovery", privateKey: Hex) {
    this.role = role;
    this.privateKey = privateKey;
    this.address = privateKeyToAddress(privateKey);
  }

  static create(role: "device" | "recovery" = "device"): LocalShard {
    const privateKey = generatePrivateKey();
    return new LocalShard(role, privateKey);
  }

  static fromPrivateKey(privateKey: Hex, role: "device" | "recovery" = "device"): LocalShard {
    return new LocalShard(role, privateKey);
  }

  async signHash(hash: Hex): Promise<Hex> {
    if (!isHex(hash) || hash.length !== 66) {
      throw new Error("Invalid hash: must be 0x-prefixed 32-byte hex");
    }

    const account = privateKeyToAccount(this.privateKey);
    const signature = await account.signMessage({
      message: { raw: hexToBytes(hash) },
    });

    return signature;
  }
}

export class RemoteCosigner implements IRemoteCosigner {
  public role: "cosigner" = "cosigner";
  public address: Address;
  public walletAddress: Address;
  public apiUrl: string;
  public headers: Record<string, string>;
  public customSigner?: (hash: Hex, apiKey: string) => Promise<Hex>;

  constructor(
    shardBAddressOrConfig: Address | RemoteCosignerConfig,
    walletAddress?: Address,
    apiUrl?: string
  ) {
    if (typeof shardBAddressOrConfig === "object") {
      this.address = shardBAddressOrConfig.address;
      this.walletAddress = shardBAddressOrConfig.walletAddress;
      this.apiUrl = (shardBAddressOrConfig.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
      this.headers = shardBAddressOrConfig.headers || {};
      this.customSigner = shardBAddressOrConfig.customSigner;
    } else {
      this.address = shardBAddressOrConfig;
      this.walletAddress = walletAddress || ("0x0000000000000000000000000000000000000000" as Address);
      this.apiUrl = (apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
      this.headers = {};
    }
  }

  async signHash(hash: Hex, apiKey: string): Promise<Hex> {
    if (this.customSigner) {
      return this.customSigner(hash, apiKey);
    }

    const response = await fetch(`${this.apiUrl}/v1/wallets/${this.walletAddress}/cosign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...this.headers,
      },
      body: JSON.stringify({ userOpHash: hash }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Co-signer failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as { signatureB: Hex };
    return data.signatureB;
  }
}
