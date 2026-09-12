import { generatePrivateKey, privateKeyToAddress } from "viem/accounts";
import {
  ROBINHOOD_RPC_URL,
  USDG_TOKEN_ADDRESS,
  COSIGNER_API_URL,
} from "../config/chain";
import {
  saveDeviceShard,
  loadDeviceShard,
  saveActiveAccount,
  saveEncryptedItem,
  loadEncryptedItem,
} from "./secureStorage";

export interface LiveBalance {
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
}

export interface LiveTransaction {
  id: string;
  type: "send" | "receive";
  token: string;
  amount: string;
  usdValue: string;
  counterparty: string;
  timestamp: number;
  hash: string;
}

export interface MobilePayLink {
  id: string;
  slug: string;
  token: string;
  amount: string;
  memo?: string;
  status: "pending" | "swept";
  createdAt: number;
}

/**
 * Queries real native ETH balance from Robinhood Chain RPC.
 */
export async function getLiveEthBalance(address: string): Promise<string> {
  if (!address) return "0.0000";
  try {
    const res = await fetch(ROBINHOOD_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBalance",
        params: [address.trim(), "latest"],
        id: 1,
      }),
    });
    const data = await res.json();
    if (data?.result) {
      const wei = BigInt(data.result);
      const eth = Number(wei) / 1e18;
      return eth.toFixed(4);
    }
    return "0.0000";
  } catch (err) {
    console.warn("Failed to fetch live ETH balance:", err);
    return "0.0000";
  }
}

/**
 * Queries real USDG ERC-20 balance from Robinhood Chain USDG contract.
 */
export async function getLiveUsdgBalance(address: string): Promise<string> {
  if (!address) return "0.00";
  try {
    const cleanAddr = address.trim().toLowerCase().replace("0x", "").padStart(64, "0");
    const calldata = "0x70a08231" + cleanAddr; // balanceOf(address)

    const res = await fetch(ROBINHOOD_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [
          {
            to: USDG_TOKEN_ADDRESS,
            data: calldata,
          },
          "latest",
        ],
        id: 2,
      }),
    });
    const data = await res.json();
    if (data?.result && data.result !== "0x") {
      const units = BigInt(data.result);
      return (Number(units) / 1e6).toFixed(2);
    }
    return "0.00";
  } catch (err) {
    console.warn("Failed to fetch live USDG balance:", err);
    return "0.00";
  }
}

/**
 * Fetches all live balances from Robinhood Chain.
 */
export async function fetchAllLiveBalances(address: string): Promise<LiveBalance[]> {
  const [ethBal, usdgBal] = await Promise.all([
    getLiveEthBalance(address),
    getLiveUsdgBalance(address),
  ]);

  const ethNum = parseFloat(ethBal) || 0;
  const usdgNum = parseFloat(usdgBal) || 0;

  const ethUsd = (ethNum * 2500).toFixed(2);
  const usdgUsd = usdgNum.toFixed(2);

  return [
    {
      symbol: "USDG",
      name: "Robinhood USD",
      balance: usdgBal,
      usdValue: usdgUsd,
    },
    {
      symbol: "ETH",
      name: "Ethereum",
      balance: ethBal,
      usdValue: ethUsd,
    },
  ];
}

/**
 * Creates a real 2-of-3 threshold smart account:
 * 1. Generates Shard A key on device
 * 2. Generates Shard C recovery key
 * 3. Registers with live Co-Signer backend at api.privatumrh.com
 * 4. Saves Shard A into hardware-backed SecureStore
 */
export async function createRealSmartAccount(): Promise<{
  address: string;
  shardAKey: string;
  shardBAddress: string;
  apiKey: string;
}> {
  const shardAKey = generatePrivateKey();
  const shardAAddress = privateKeyToAddress(shardAKey);

  const shardCKey = generatePrivateKey();
  const shardCAddress = privateKeyToAddress(shardCKey);

  const predictedAddress = shardAAddress;

  const res = await fetch(`${COSIGNER_API_URL}/v1/wallets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: predictedAddress,
      shardAAddress: shardAAddress,
      shardCAddress: shardCAddress,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Co-Signer registration failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const realAddress = (data.address || predictedAddress).toLowerCase();

  await saveDeviceShard(realAddress, shardAKey);
  await saveActiveAccount(realAddress);
  await saveEncryptedItem(`privatum_apikey_${realAddress}`, data.apiKey || "");
  await saveEncryptedItem(`privatum_shard_b_${realAddress}`, data.shardBAddress || "");

  return {
    address: realAddress,
    shardAKey,
    shardBAddress: data.shardBAddress || "",
    apiKey: data.apiKey || "",
  };
}

/**
 * Imports an existing address to observe and manage.
 */
export async function importExistingSmartAccount(
  address: string,
  privateKey?: string
): Promise<string> {
  const cleanAddr = address.trim().toLowerCase();
  await saveActiveAccount(cleanAddr);
  if (privateKey && privateKey.trim().startsWith("0x")) {
    await saveDeviceShard(cleanAddr, privateKey.trim());
  }
  return cleanAddr;
}

export async function loadStoredTransactions(address: string): Promise<LiveTransaction[]> {
  if (!address) return [];
  try {
    const raw = await loadEncryptedItem(`privatum_txs_${address.toLowerCase()}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveStoredTransactions(
  address: string,
  txs: LiveTransaction[]
): Promise<void> {
  if (!address) return;
  try {
    await saveEncryptedItem(`privatum_txs_${address.toLowerCase()}`, JSON.stringify(txs));
  } catch (err) {
    console.error("Failed to save transactions:", err);
  }
}

export async function loadStoredPayLinks(address: string): Promise<MobilePayLink[]> {
  if (!address) return [];
  try {
    const raw = await loadEncryptedItem(`privatum_paylinks_${address.toLowerCase()}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveStoredPayLinks(
  address: string,
  links: MobilePayLink[]
): Promise<void> {
  if (!address) return;
  try {
    await saveEncryptedItem(`privatum_paylinks_${address.toLowerCase()}`, JSON.stringify(links));
  } catch (err) {
    console.error("Failed to save pay links:", err);
  }
}
