import {
  Address,
  encodeFunctionData,
  Hex,
  isAddress,
  keccak256,
  parseEther,
  parseUnits,
  PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  erc20Abi,
  robinhoodChain,
  USDG_ADDRESS,
} from "@privatumrh/robinhood-chain-sdk";

export type OfflineTxStatus =
  | "queued"
  | "broadcasting"
  | "broadcasted"
  | "failed"
  | "cancelled";

export interface OfflineTransaction {
  id: string;
  walletAddress: string;
  recipient: string;
  recipientLabel?: string;
  amount: string;
  asset: "ETH" | "USDG";
  chainId: number;
  nonce: number;
  gasLimit: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  rawSignedTx: Hex;
  txHash: Hex;
  createdAt: number;
  status: OfflineTxStatus;
  broadcastedAt?: number;
  broadcastHash?: string;
  error?: string;
  tag?: string;
  note?: string;
}

const OUTBOX_STORAGE_PREFIX = "privatum_offline_outbox_";
const LAST_NONCE_PREFIX = "privatum_last_nonce_";
const AIRGAP_STORAGE_KEY = "privatum_force_airgap";

export function getOutboxStorageKey(walletAddress: string): string {
  return `${OUTBOX_STORAGE_PREFIX}${walletAddress.toLowerCase()}`;
}

export function getLastNonceStorageKey(walletAddress: string): string {
  return `${LAST_NONCE_PREFIX}${walletAddress.toLowerCase()}`;
}

export function loadOfflineOutbox(walletAddress: string): OfflineTransaction[] {
  if (typeof window === "undefined" || !walletAddress) return [];
  try {
    const raw = localStorage.getItem(getOutboxStorageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to load offline outbox:", err);
    return [];
  }
}

export function saveOfflineOutbox(
  walletAddress: string,
  txs: OfflineTransaction[]
): void {
  if (typeof window === "undefined" || !walletAddress) return;
  try {
    localStorage.setItem(
      getOutboxStorageKey(walletAddress),
      JSON.stringify(txs)
    );
  } catch (err) {
    console.error("Failed to save offline outbox:", err);
  }
}

export function loadLastKnownNonce(walletAddress: string): number {
  if (typeof window === "undefined" || !walletAddress) return 0;
  try {
    const raw = localStorage.getItem(getLastNonceStorageKey(walletAddress));
    if (!raw) return 0;
    const num = parseInt(raw, 10);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
}

export function saveLastKnownNonce(walletAddress: string, nonce: number): void {
  if (typeof window === "undefined" || !walletAddress) return;
  try {
    localStorage.setItem(
      getLastNonceStorageKey(walletAddress),
      nonce.toString()
    );
  } catch {}
}

export function loadForceAirGap(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AIRGAP_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveForceAirGap(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AIRGAP_STORAGE_KEY, enabled ? "true" : "false");
  } catch {}
}

export function getNextOfflineNonce(
  walletAddress: string,
  confirmedNonce?: number
): number {
  const baseNonce =
    typeof confirmedNonce === "number" && !isNaN(confirmedNonce)
      ? confirmedNonce
      : loadLastKnownNonce(walletAddress);

  const outbox = loadOfflineOutbox(walletAddress);
  const queuedTxs = outbox.filter((t) => t.status === "queued");

  if (queuedTxs.length === 0) {
    return baseNonce;
  }

  // Determine highest nonce among queued transactions and increment by 1
  const highestQueuedNonce = queuedTxs.reduce(
    (max, t) => (t.nonce > max ? t.nonce : max),
    baseNonce - 1
  );

  return Math.max(highestQueuedNonce + 1, baseNonce);
}

export interface SignOfflineTxParams {
  shardAPrivKey: Hex;
  walletAddress: string;
  recipient: string;
  recipientLabel?: string;
  amount: string;
  asset: "ETH" | "USDG";
  customNonce?: number;
  confirmedNonce?: number;
  gasLimit?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  tag?: string;
  note?: string;
}

export async function signOfflineTransaction(
  params: SignOfflineTxParams
): Promise<OfflineTransaction> {
  const {
    shardAPrivKey,
    walletAddress,
    recipient,
    recipientLabel,
    amount,
    asset,
    customNonce,
    confirmedNonce,
    tag,
    note,
  } = params;

  if (!shardAPrivKey) {
    throw new Error("Device private key (Shard A) is required to sign offline.");
  }
  const cleanRecipient = recipient.trim();
  if (!isAddress(cleanRecipient)) {
    throw new Error("Invalid recipient address.");
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const account = privateKeyToAccount(shardAPrivKey);

  const nonce =
    typeof customNonce === "number" && !isNaN(customNonce)
      ? customNonce
      : getNextOfflineNonce(walletAddress, confirmedNonce);

  const chainId = robinhoodChain.id;
  const maxFeePerGas = params.maxFeePerGas ?? 100_000_000n; // 0.1 gwei default (Robinhood Chain average is ~0.055 gwei)
  const maxPriorityFeePerGas = params.maxPriorityFeePerGas ?? 100_000_000n;

  let rawSignedTx: Hex;
  let gasLimitBigInt: bigint;

  if (asset === "ETH") {
    const parsedAmount = parseEther(amount);
    gasLimitBigInt = params.gasLimit ?? 21_000n;

    rawSignedTx = await account.signTransaction({
      to: cleanRecipient as Address,
      value: parsedAmount,
      data: "0x",
      nonce,
      gas: gasLimitBigInt,
      maxFeePerGas,
      maxPriorityFeePerGas,
      chainId,
      type: "eip1559",
    });
  } else {
    // USDG ERC-20 transfer
    const parsedAmount = parseUnits(amount, 6);
    gasLimitBigInt = params.gasLimit ?? 65_000n;

    const callData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [cleanRecipient as Address, parsedAmount],
    });

    rawSignedTx = await account.signTransaction({
      to: USDG_ADDRESS,
      value: 0n,
      data: callData,
      nonce,
      gas: gasLimitBigInt,
      maxFeePerGas,
      maxPriorityFeePerGas,
      chainId,
      type: "eip1559",
    });
  }

  const txHash = keccak256(rawSignedTx);
  const offlineTx: OfflineTransaction = {
    id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    walletAddress: walletAddress.toLowerCase(),
    recipient: cleanRecipient,
    recipientLabel,
    amount,
    asset,
    chainId,
    nonce,
    gasLimit: gasLimitBigInt.toString(),
    maxFeePerGas: maxFeePerGas.toString(),
    maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
    rawSignedTx,
    txHash,
    createdAt: Date.now(),
    status: "queued",
    tag,
    note: note?.trim() || undefined,
  };

  return offlineTx;
}

export function queueOfflineTransaction(
  walletAddress: string,
  tx: OfflineTransaction
): OfflineTransaction[] {
  const current = loadOfflineOutbox(walletAddress);
  const updated = [tx, ...current];
  saveOfflineOutbox(walletAddress, updated);
  return updated;
}

export function removeOfflineTransaction(
  walletAddress: string,
  txId: string
): OfflineTransaction[] {
  const current = loadOfflineOutbox(walletAddress);
  const updated = current.filter((t) => t.id !== txId);
  saveOfflineOutbox(walletAddress, updated);
  return updated;
}

export function cancelOfflineTransaction(
  walletAddress: string,
  txId: string
): OfflineTransaction[] {
  const current = loadOfflineOutbox(walletAddress);
  const updated = current.map((t) =>
    t.id === txId ? { ...t, status: "cancelled" as const } : t
  );
  saveOfflineOutbox(walletAddress, updated);
  return updated;
}

export function clearFinishedOfflineTransactions(
  walletAddress: string
): OfflineTransaction[] {
  const current = loadOfflineOutbox(walletAddress);
  const updated = current.filter((t) => t.status === "queued");
  saveOfflineOutbox(walletAddress, updated);
  return updated;
}

export function extractBroadcastError(err: any): string {
  if (!err) return "Unknown broadcast error.";
  if (err.details) {
    return err.details;
  }
  if (err.shortMessage && !err.shortMessage.includes("Missing or invalid parameters")) {
    return err.shortMessage;
  }
  if (err.message) {
    const match = err.message.match(/Details:\s*([^\n]+)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return err.message.split("\n")[0];
  }
  return String(err);
}

export async function broadcastSingleOfflineTx(
  client: PublicClient,
  tx: OfflineTransaction
): Promise<string> {
  const broadcastHash = await client.sendRawTransaction({
    serializedTransaction: tx.rawSignedTx,
  });
  return broadcastHash;
}

export interface BroadcastSummary {
  successful: Array<{ id: string; txHash: string; broadcastHash: string }>;
  failed: Array<{ id: string; error: string }>;
  updatedOutbox: OfflineTransaction[];
}

export async function broadcastAllQueuedOfflineTxs(
  client: PublicClient,
  walletAddress: string,
  onProgress?: (index: number, total: number, currentTx: OfflineTransaction) => void
): Promise<BroadcastSummary> {
  const outbox = loadOfflineOutbox(walletAddress);
  const queued = outbox
    .filter((t) => t.status === "queued")
    .sort((a, b) => a.nonce - b.nonce);

  const successful: Array<{ id: string; txHash: string; broadcastHash: string }> = [];
  const failed: Array<{ id: string; error: string }> = [];

  let currentList = [...outbox];

  for (let i = 0; i < queued.length; i++) {
    const item = queued[i];
    if (onProgress) {
      onProgress(i + 1, queued.length, item);
    }

    try {
      const bHash = await broadcastSingleOfflineTx(client, item);
      successful.push({
        id: item.id,
        txHash: item.txHash,
        broadcastHash: bHash,
      });

      currentList = currentList.map((t) =>
        t.id === item.id
          ? {
              ...t,
              status: "broadcasted" as const,
              broadcastedAt: Date.now(),
              broadcastHash: bHash,
            }
          : t
      );
      saveOfflineOutbox(walletAddress, currentList);
    } catch (err: any) {
      const errMsg = extractBroadcastError(err);
      failed.push({
        id: item.id,
        error: errMsg,
      });

      currentList = currentList.map((t) =>
        t.id === item.id
          ? {
              ...t,
              status: "failed" as const,
              error: errMsg,
            }
          : t
      );
      saveOfflineOutbox(walletAddress, currentList);
      // Nonce sequential execution: if one fails, stop immediately to prevent out-of-order execution
      break;
    }
  }

  return {
    successful,
    failed,
    updatedOutbox: currentList,
  };
}

export function exportTransactionJson(tx: OfflineTransaction): string {
  return JSON.stringify(tx, null, 2);
}
