import { describe, it, expect, beforeEach } from "bun:test";
import { evaluateOutboxQuery } from "./outboxQueries";
import type { OfflineTransaction } from "../offlineOutbox";
import { saveOfflineOutbox } from "../offlineOutbox";

describe("Local Natural Language Outbox & Queue Intelligence", () => {
  const mockWallet = "0x1234567890abcdef1234567890abcdef12345678";

  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  });

  const sampleTxs: OfflineTransaction[] = [
    {
      id: "tx-1",
      walletAddress: mockWallet,
      nonce: 4,
      recipient: "0x3f8a0000000000000000000000000000000091b2",
      recipientLabel: "Alice Treasury",
      amount: "0.05",
      asset: "ETH",
      rawSignedTx: "0x02f8",
      txHash: "0x1111",
      gasLimit: "21000",
      chainId: 11155111,
      createdAt: Date.now() - 10000,
      status: "queued",
    },
    {
      id: "tx-2",
      walletAddress: mockWallet,
      nonce: 5,
      recipient: "0x7b2200000000000000000000000000000000c418",
      recipientLabel: "Bob Personal",
      amount: "100",
      asset: "USDG",
      rawSignedTx: "0x02f8",
      txHash: "0x2222",
      gasLimit: "65000",
      chainId: 11155111,
      createdAt: Date.now() - 8000,
      status: "queued",
    },
    {
      id: "tx-3",
      walletAddress: mockWallet,
      nonce: 3,
      recipient: "0x3f8a0000000000000000000000000000000091b2",
      amount: "0.1",
      asset: "ETH",
      rawSignedTx: "0x02f8",
      txHash: "0x3333",
      gasLimit: "21000",
      chainId: 11155111,
      createdAt: Date.now() - 20000,
      status: "broadcasted",
      broadcastedAt: Date.now() - 15000,
      broadcastHash: "0xabcd1234",
    },
    {
      id: "tx-4",
      walletAddress: mockWallet,
      nonce: 2,
      recipient: "0x7b2200000000000000000000000000000000c418",
      amount: "0.01",
      asset: "ETH",
      rawSignedTx: "0x02f8",
      txHash: "0x4444",
      gasLimit: "21000",
      chainId: 11155111,
      createdAt: Date.now() - 30000,
      status: "failed",
      error: "insufficient funds for gas * price + value: address 0x1234 have 10000000000000000 want 10000021000000000",
    },
  ];

  it("handles empty outbox summary query", () => {
    const result = evaluateOutboxQuery("what is in my outbox?", {
      walletAddress: mockWallet,
      offlineOutbox: [],
      confirmedNonce: 0,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.queryType).toBe("outbox_summary");
    expect(result?.summary).toContain("empty");
    expect(result?.details?.some((d) => d.includes("Next Nonce: #0"))).toBe(true);
  });

  it("handles populated outbox status query", () => {
    const result = evaluateOutboxQuery("how many transfers are queued in my outbox?", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.queryType).toBe("outbox_summary");
    expect(result?.summary).toContain("2 queued transfer");
    expect(result?.details?.some((d) => d.includes("Alice Treasury"))).toBe(true);
    expect(result?.details?.some((d) => d.includes("Bob Personal"))).toBe(true);
  });

  it("produces broadcast_outbox intent when queued transfers exist", () => {
    const result = evaluateOutboxQuery("broadcast my queued transfers", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("broadcast_outbox");
    if (result?.intent?.type === "broadcast_outbox") {
      expect(result.intent.queuedCount).toBe(2);
    }
    expect(result?.summary).toContain("Found 2 queued transfers");
    expect(result?.summary).toContain("0.0500 ETH + 100.00 USDG");
  });

  it("informs user when broadcast requested on empty outbox", () => {
    const result = evaluateOutboxQuery("broadcast outbox", {
      walletAddress: mockWallet,
      offlineOutbox: [],
      confirmedNonce: 0,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent).toBeUndefined();
    expect(result?.summary).toContain("clear");
  });

  it("produces view_outbox intent on open/show outbox requests", () => {
    const result = evaluateOutboxQuery("open my offline outbox", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("view_outbox");
    expect(result?.summary).toContain("Opening your Offline Outbox");
  });

  it("produces clear_outbox_history intent on clean outbox requests", () => {
    const result = evaluateOutboxQuery("clear outbox history", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.intent?.type).toBe("clear_outbox_history");
    expect(result?.summary).toContain("2 completed or failed transaction(s) eligible for clearing");
  });

  it("diagnoses failed transfers and suggests automated gas remedies", () => {
    const result = evaluateOutboxQuery("why did my broadcast fail?", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.queryType).toBe("failure_diagnostic");
    expect(result?.summary).toContain("Found 1 failed offline transfer");
    expect(
      result?.details?.some((d) => d.includes("Fund your wallet with a small amount of ETH"))
    ).toBe(true);
  });

  it("diagnoses nonce drift failures and recommends re-signing", () => {
    const nonceFailedTx: OfflineTransaction = {
      id: "tx-nonce-fail",
      walletAddress: mockWallet,
      nonce: 1,
      recipient: "0x3f8a0000000000000000000000000000000091b2",
      amount: "0.01",
      asset: "ETH",
      rawSignedTx: "0x02f8",
      txHash: "0x5555",
      gasLimit: "21000",
      chainId: 11155111,
      createdAt: Date.now(),
      status: "failed",
      error: "nonce too low: next nonce 5, tx nonce 1",
    };

    const result = evaluateOutboxQuery("failure in outbox", {
      walletAddress: mockWallet,
      offlineOutbox: [nonceFailedTx],
      confirmedNonce: 5,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(
      result?.details?.some((d) => d.includes("re-sign with the current confirmed nonce"))
    ).toBe(true);
  });

  it("calculates next sequential nonce correctly using storage and base nonce", () => {
    localStorage.clear();
    saveOfflineOutbox(mockWallet, [sampleTxs[0], sampleTxs[1]]);

    const result = evaluateOutboxQuery("what is my next offline nonce?", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).not.toBeNull();
    expect(result?.handled).toBe(true);
    expect(result?.queryType).toBe("next_nonce");
    // Since highest queued nonce is 5, next nonce should be 6
    expect(result?.summary).toContain("Nonce #6");
    expect(result?.details?.some((d) => d.includes("Confirmed Onchain Base Nonce: #4"))).toBe(true);
    expect(result?.details?.some((d) => d.includes("Highest Queued Nonce: #5"))).toBe(true);
  });

  it("reports air-gap and connectivity status accurately", () => {
    const resultForced = evaluateOutboxQuery("is air gap mode active?", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: true,
    });

    expect(resultForced).not.toBeNull();
    expect(resultForced?.queryType).toBe("airgap_status");
    expect(resultForced?.summary).toContain("Forced Air-Gap Mode is ACTIVE");

    const resultOnline = evaluateOutboxQuery("connectivity status", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(resultOnline).not.toBeNull();
    expect(resultOnline?.summary).toContain("Network connection is ONLINE");
  });

  it("returns null for unrelated queries", () => {
    const result = evaluateOutboxQuery("send 10 ETH to alice", {
      walletAddress: mockWallet,
      offlineOutbox: sampleTxs,
      confirmedNonce: 4,
      isOnline: true,
      forceAirGap: false,
    });

    expect(result).toBeNull();
  });
});
