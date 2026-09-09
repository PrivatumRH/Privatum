import type { Address, Hex } from "viem";
import type { IShard, ShardRole } from "./types.js";

export class Shard implements IShard {
  public role: ShardRole;
  public address: Address;
  public publicKey: Hex;

  constructor(role: ShardRole, address: Address, publicKey: Hex) {
    this.role = role;
    this.address = address;
    this.publicKey = publicKey;
  }

  static async create(role: ShardRole): Promise<Shard> {
    // Generate an ephemeral keypair representation for the threshold shard
    const mockAddr = `0x${role.padEnd(40, "0")}` as Address;
    const mockPubkey = `0x04${role.padEnd(128, "a")}` as Hex;
    return new Shard(role, mockAddr, mockPubkey);
  }

  static async loadFromKeyring(role: ShardRole = "drive"): Promise<Shard> {
    return Shard.create(role);
  }

  static async createRemoteCosigner(cosignerUrl: string): Promise<Shard> {
    const mockAddr = "0x2222222222222222222222222222222222222222" as Address;
    const mockPubkey = `0x04${"2".repeat(128)}` as Hex;
    return new Shard("server", mockAddr, mockPubkey);
  }

  static async loadPasskey(): Promise<Shard> {
    const mockAddr = "0x3333333333333333333333333333333333333333" as Address;
    const mockPubkey = `0x04${"3".repeat(128)}` as Hex;
    return new Shard("recovery", mockAddr, mockPubkey);
  }

  async signMessage(messageHash: Hex): Promise<Hex> {
    // Returns 65-byte ECDSA signature
    return `0x${"11".repeat(64)}1b` as Hex;
  }
}
