import { describe, expect, it } from "bun:test";
import { PrivatumWallet } from "../src/wallet.js";
import { LocalShard, RemoteCosigner } from "../src/shard.js";

describe("PrivatumWallet", () => {
  const dummySig65 = `0x${"ab".repeat(65)}` as const;
  const shortSig = "0xabcd" as const;

  it("combines two valid 65-byte signatures into 130 bytes", () => {
    const combined = PrivatumWallet.combineSignatures(dummySig65, dummySig65);
    expect(combined.length).toBe(2 + 130 + 130); // 262 characters
    expect(combined.startsWith("0x")).toBe(true);
  });

  it("throws when combining signatures of invalid length", () => {
    expect(() => PrivatumWallet.combineSignatures(dummySig65, shortSig as any)).toThrow(
      "Both signatures must be exactly 65 bytes"
    );
  });

  it("instantiates wallet configuration correctly", () => {
    const shardA = LocalShard.create("device");
    const shardB = new RemoteCosigner(
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333"
    );
    const wallet = new PrivatumWallet({
      address: "0x3333333333333333333333333333333333333333",
      shardA,
      shardB,
      shardCAddress: "0x4444444444444444444444444444444444444444",
      apiKey: "pvt_testkey12345",
    });

    expect(wallet.address).toBe("0x3333333333333333333333333333333333333333");
    expect(wallet.chainId).toBe(4663);
    expect(wallet.shardA).toBe(shardA);
    expect(wallet.shardB).toBe(shardB);
  });

  it("builds transfer UserOp accurately", () => {
    const shardA = LocalShard.create("device");
    const shardB = new RemoteCosigner(
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333"
    );
    const wallet = new PrivatumWallet({
      address: "0x3333333333333333333333333333333333333333",
      shardA,
      shardB,
      shardCAddress: "0x4444444444444444444444444444444444444444",
      apiKey: "pvt_testkey12345",
    });

    const userOp = wallet.buildTransferUserOp({
      to: "0x5555555555555555555555555555555555555555",
      amount: 1000n,
      asset: "ETH",
    });

    expect(userOp.sender).toBe(wallet.address);
    expect(userOp.callData.startsWith("0xb61d27f6")).toBe(true);
    expect(userOp.nonce).toBe(0n);
  });
});
