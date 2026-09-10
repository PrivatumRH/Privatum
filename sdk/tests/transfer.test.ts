import { describe, expect, it } from "bun:test";
import { isHex } from "viem";
import {
  buildRotateShardACallData,
  buildTransferCallData,
  buildUserOperation,
  formatUserOpForRpc,
  getUserOpHash,
} from "../src/transfer.js";
import { ENTRY_POINT_ADDRESS, ROBINHOOD_CHAIN_ID, USDG_ADDRESS } from "../src/chain.js";

describe("transfer helpers", () => {
  const mockSender = "0x1111111111111111111111111111111111111111";
  const mockRecipient = "0x2222222222222222222222222222222222222222";

  it("encodes ETH transfer calldata calling execute", () => {
    const callData = buildTransferCallData("ETH", mockRecipient, 1000000000000000000n);
    expect(isHex(callData)).toBe(true);
    // PrivatumAccount.execute selector is 0xb61d27f6
    expect(callData.startsWith("0xb61d27f6")).toBe(true);
  });

  it("encodes USDG transfer calldata calling execute with ERC20 transfer", () => {
    const callData = buildTransferCallData("USDG", mockRecipient, 5000000n);
    expect(isHex(callData)).toBe(true);
    expect(callData.startsWith("0xb61d27f6")).toBe(true);
  });

  it("encodes rotateShardA calldata", () => {
    const callData = buildRotateShardACallData(mockRecipient);
    expect(isHex(callData)).toBe(true);
  });

  it("computes standard ERC-4337 UserOp hash", () => {
    const callData = buildTransferCallData("ETH", mockRecipient, 100n);
    const userOp = buildUserOperation({
      sender: mockSender,
      callData,
      nonce: 0n,
    });

    const hash = getUserOpHash(userOp, ENTRY_POINT_ADDRESS, ROBINHOOD_CHAIN_ID);
    expect(isHex(hash)).toBe(true);
    expect(hash.length).toBe(66);
  });

  it("formats UserOp with hex fields for RPC bundler", () => {
    const callData = buildTransferCallData("ETH", mockRecipient, 100n);
    const userOp = {
      ...buildUserOperation({
        sender: mockSender,
        callData,
      }),
      signature: "0x1234" as `0x${string}`,
    };

    const rpcOp = formatUserOpForRpc(userOp);
    expect(rpcOp.nonce).toBe("0x0");
    expect(typeof rpcOp.callGasLimit).toBe("string");
    expect(rpcOp.callGasLimit.startsWith("0x")).toBe(true);
    expect(rpcOp.signature).toBe("0x1234");
  });
});
