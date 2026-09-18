import { describe, it, expect, beforeEach } from "bun:test";
import {
  loadOfflineOutbox,
  saveOfflineOutbox,
  loadLastKnownNonce,
  saveLastKnownNonce,
  loadForceAirGap,
  saveForceAirGap,
  getNextOfflineNonce,
  signOfflineTransaction,
  queueOfflineTransaction,
  removeOfflineTransaction,
  cancelOfflineTransaction,
  clearFinishedOfflineTransactions,
  broadcastSingleOfflineTx,
  broadcastAllQueuedOfflineTxs,
  exportTransactionJson,
  OfflineTransaction,
} from "./offlineOutbox";
import { parseTransaction } from "viem";
import { robinhoodChain } from "@privatumrh/robinhood-chain-sdk";

const TEST_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const TEST_RECIPIENT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const TEST_PRIV_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // standard test key for 0xf39F...

describe("offlineOutbox engine", () => {
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

  describe("storage and settings", () => {
    it("persists and retrieves force air-gap toggle", () => {
      expect(loadForceAirGap()).toBe(false);
      saveForceAirGap(true);
      expect(loadForceAirGap()).toBe(true);
      saveForceAirGap(false);
      expect(loadForceAirGap()).toBe(false);
    });

    it("persists and retrieves last known confirmed nonce", () => {
      expect(loadLastKnownNonce(TEST_WALLET)).toBe(0);
      saveLastKnownNonce(TEST_WALLET, 42);
      expect(loadLastKnownNonce(TEST_WALLET)).toBe(42);
    });

    it("saves and loads outbox array", () => {
      expect(loadOfflineOutbox(TEST_WALLET)).toEqual([]);
      const dummyTx: OfflineTransaction = {
        id: "test-1",
        walletAddress: TEST_WALLET.toLowerCase(),
        recipient: TEST_RECIPIENT,
        amount: "1.5",
        asset: "ETH",
        chainId: 2151908,
        nonce: 0,
        gasLimit: "21000",
        rawSignedTx: "0x02",
        txHash: "0xabc",
        createdAt: 1000,
        status: "queued",
      };
      saveOfflineOutbox(TEST_WALLET, [dummyTx]);
      const loaded = loadOfflineOutbox(TEST_WALLET);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe("test-1");
    });
  });

  describe("getNextOfflineNonce", () => {
    it("returns confirmedNonce if provided when outbox is empty", () => {
      const nonce = getNextOfflineNonce(TEST_WALLET, 10);
      expect(nonce).toBe(10);
    });

    it("falls back to stored lastKnownNonce if confirmedNonce is not provided", () => {
      saveLastKnownNonce(TEST_WALLET, 7);
      const nonce = getNextOfflineNonce(TEST_WALLET);
      expect(nonce).toBe(7);
    });

    it("increments sequentially past queued transactions", () => {
      saveLastKnownNonce(TEST_WALLET, 3);
      const tx1: OfflineTransaction = {
        id: "tx-1",
        walletAddress: TEST_WALLET.toLowerCase(),
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
        chainId: 2151908,
        nonce: 3,
        gasLimit: "21000",
        rawSignedTx: "0x02",
        txHash: "0x111",
        createdAt: 1000,
        status: "queued",
      };
      const tx2: OfflineTransaction = {
        id: "tx-2",
        walletAddress: TEST_WALLET.toLowerCase(),
        recipient: TEST_RECIPIENT,
        amount: "0.2",
        asset: "ETH",
        chainId: 2151908,
        nonce: 4,
        gasLimit: "21000",
        rawSignedTx: "0x02",
        txHash: "0x222",
        createdAt: 1001,
        status: "queued",
      };
      saveOfflineOutbox(TEST_WALLET, [tx1, tx2]);

      const nextNonce = getNextOfflineNonce(TEST_WALLET, 3);
      expect(nextNonce).toBe(5);
    });

    it("ignores broadcasted and cancelled transactions when finding highest queued nonce", () => {
      saveLastKnownNonce(TEST_WALLET, 5);
      const txOld: OfflineTransaction = {
        id: "tx-old",
        walletAddress: TEST_WALLET.toLowerCase(),
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
        chainId: 2151908,
        nonce: 5,
        gasLimit: "21000",
        rawSignedTx: "0x02",
        txHash: "0x111",
        createdAt: 1000,
        status: "broadcasted",
      };
      const txCancelled: OfflineTransaction = {
        id: "tx-cancel",
        walletAddress: TEST_WALLET.toLowerCase(),
        recipient: TEST_RECIPIENT,
        amount: "0.2",
        asset: "ETH",
        chainId: 2151908,
        nonce: 6,
        gasLimit: "21000",
        rawSignedTx: "0x02",
        txHash: "0x222",
        createdAt: 1001,
        status: "cancelled",
      };
      saveOfflineOutbox(TEST_WALLET, [txOld, txCancelled]);

      // Because none are queued, next nonce is the base (5)
      const nextNonce = getNextOfflineNonce(TEST_WALLET, 5);
      expect(nextNonce).toBe(5);
    });
  });

  describe("signOfflineTransaction", () => {
    it("signs an ETH transaction with valid raw hex and verifiable fields", async () => {
      const signed = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.05",
        asset: "ETH",
        confirmedNonce: 2,
        tag: "payroll",
        note: "offline payment",
      });

      expect(signed.asset).toBe("ETH");
      expect(signed.amount).toBe("0.05");
      expect(signed.nonce).toBe(2);
      expect(signed.status).toBe("queued");
      expect(signed.tag).toBe("payroll");
      expect(signed.note).toBe("offline payment");
      expect(signed.rawSignedTx.startsWith("0x02")).toBe(true);
      expect(signed.txHash.startsWith("0x")).toBe(true);

      const parsed = parseTransaction(signed.rawSignedTx);
      expect(parsed.to?.toLowerCase()).toBe(TEST_RECIPIENT.toLowerCase());
      expect(parsed.nonce).toBe(2);
      expect(parsed.chainId).toBe(robinhoodChain.id);
      expect(parsed.value).toBe(50000000000000000n); // 0.05 ETH
    });

    it("signs a USDG ERC-20 transaction with encoded calldata", async () => {
      const signed = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "100.0",
        asset: "USDG",
        confirmedNonce: 0,
      });

      expect(signed.asset).toBe("USDG");
      expect(signed.amount).toBe("100.0");
      expect(signed.rawSignedTx.startsWith("0x02")).toBe(true);

      const parsed = parseTransaction(signed.rawSignedTx);
      // Recipient of tx is USDG token contract
      expect(parsed.value ?? 0n).toBe(0n);
      expect(parsed.data?.startsWith("0xa9059cbb")).toBe(true); // ERC20 transfer(address,uint256) selector
    });

    it("validates input parameters and throws descriptive errors", async () => {
      // Invalid recipient
      await expect(
        signOfflineTransaction({
          shardAPrivKey: TEST_PRIV_KEY,
          walletAddress: TEST_WALLET,
          recipient: "not-an-address",
          amount: "1.0",
          asset: "ETH",
        })
      ).rejects.toThrow("Invalid recipient address");

      // Non-positive amount
      await expect(
        signOfflineTransaction({
          shardAPrivKey: TEST_PRIV_KEY,
          walletAddress: TEST_WALLET,
          recipient: TEST_RECIPIENT,
          amount: "0",
          asset: "ETH",
        })
      ).rejects.toThrow("Amount must be greater than zero");
    });
  });

  describe("outbox queue modifications", () => {
    it("queues and removes transactions", async () => {
      const signed = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
      });

      queueOfflineTransaction(TEST_WALLET, signed);
      expect(loadOfflineOutbox(TEST_WALLET)).toHaveLength(1);

      removeOfflineTransaction(TEST_WALLET, signed.id);
      expect(loadOfflineOutbox(TEST_WALLET)).toHaveLength(0);
    });

    it("cancels transaction and updates status", async () => {
      const signed = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
      });

      queueOfflineTransaction(TEST_WALLET, signed);
      cancelOfflineTransaction(TEST_WALLET, signed.id);

      const items = loadOfflineOutbox(TEST_WALLET);
      expect(items[0].status).toBe("cancelled");
    });

    it("clears finished and preserves queued items", async () => {
      const tx1 = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
        confirmedNonce: 0,
      });
      const tx2 = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.2",
        asset: "ETH",
        confirmedNonce: 1,
      });

      tx1.status = "broadcasted";
      saveOfflineOutbox(TEST_WALLET, [tx1, tx2]);

      clearFinishedOfflineTransactions(TEST_WALLET);
      const remaining = loadOfflineOutbox(TEST_WALLET);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(tx2.id);
    });
  });

  describe("broadcast operations", () => {
    it("broadcasts single offline tx via sendRawTransaction", async () => {
      const tx = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
        confirmedNonce: 0,
      });

      const mockClient = {
        sendRawTransaction: async ({ serializedTransaction }: { serializedTransaction: string }) => {
          expect(serializedTransaction).toBe(tx.rawSignedTx);
          return "0xmockhash123";
        },
      } as any;

      const hash = await broadcastSingleOfflineTx(mockClient, tx);
      expect(hash).toBe("0xmockhash123");
    });

    it("broadcasts all queued transactions sequentially in nonce order", async () => {
      const txB = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.2",
        asset: "ETH",
        customNonce: 5,
      });
      const txA = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
        customNonce: 4,
      });

      // Intentionally save in reverse order
      saveOfflineOutbox(TEST_WALLET, [txB, txA]);

      const broadcastOrder: number[] = [];
      const mockClient = {
        sendRawTransaction: async ({ serializedTransaction }: { serializedTransaction: string }) => {
          const parsed = parseTransaction(serializedTransaction as `0x${string}`);
          broadcastOrder.push(parsed.nonce!);
          return `0xbroadcast-${parsed.nonce}`;
        },
      } as any;

      const summary = await broadcastAllQueuedOfflineTxs(mockClient, TEST_WALLET);

      expect(broadcastOrder).toEqual([4, 5]);
      expect(summary.successful).toHaveLength(2);
      expect(summary.failed).toHaveLength(0);
      expect(summary.updatedOutbox.every((t) => t.status === "broadcasted")).toBe(true);
    });

    it("halts sequence immediately if a transaction broadcast fails", async () => {
      const txA = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.1",
        asset: "ETH",
        customNonce: 1,
      });
      const txB = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.2",
        asset: "ETH",
        customNonce: 2,
      });

      saveOfflineOutbox(TEST_WALLET, [txA, txB]);

      const mockClient = {
        sendRawTransaction: async ({ serializedTransaction }: { serializedTransaction: string }) => {
          const parsed = parseTransaction(serializedTransaction as `0x${string}`);
          if (parsed.nonce === 1) {
            throw new Error("nonce too low");
          }
          return "0xok";
        },
      } as any;

      const summary = await broadcastAllQueuedOfflineTxs(mockClient, TEST_WALLET);

      expect(summary.successful).toHaveLength(0);
      expect(summary.failed).toHaveLength(1);
      expect(summary.failed[0].error).toContain("nonce too low");

      // txB should remain "queued" rather than failing or running out of order
      const remainingTxB = summary.updatedOutbox.find((t) => t.id === txB.id);
      expect(remainingTxB?.status).toBe("queued");
    });
  });

  describe("exportTransactionJson", () => {
    it("serializes transaction to formatted JSON string", async () => {
      const tx = await signOfflineTransaction({
        shardAPrivKey: TEST_PRIV_KEY,
        walletAddress: TEST_WALLET,
        recipient: TEST_RECIPIENT,
        amount: "0.5",
        asset: "ETH",
        confirmedNonce: 0,
      });

      const json = exportTransactionJson(tx);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(tx.id);
      expect(parsed.rawSignedTx).toBe(tx.rawSignedTx);
      expect(parsed.amount).toBe("0.5");
    });
  });
});
