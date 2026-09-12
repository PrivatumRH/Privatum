import "./polyfills";
import {
  createWalletClient,
  defineChain,
  http,
  parseEther,
  parseUnits,
  isAddress,
  erc20Abi,
  type Hex,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_NAME,
  ROBINHOOD_RPC_URL,
  USDG_TOKEN_ADDRESS,
  ROBINHOOD_EXPLORER_URL,
} from "../config/chain";
import { loadDeviceShard } from "./secureStorage";
import { getMobileFreezeState } from "./freeze";

export interface MobileSendParams {
  walletAddress: string;
  recipient: string;
  amount: string;
  token: string;
}

export interface MobileSendResult {
  txHash: `0x${string}`;
  explorerUrl: string;
}

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: ROBINHOOD_CHAIN_NAME,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [ROBINHOOD_RPC_URL] },
  },
});

/**
 * Executes a real on-chain transfer on Robinhood Chain using the device-held Shard A key.
 * Checks account freeze status prior to broadcast and submits directly to Robinhood Chain RPC.
 */
export async function executeMobileSend(
  params: MobileSendParams
): Promise<MobileSendResult> {
  const { walletAddress, recipient, amount, token } = params;

  if (!walletAddress) {
    throw new Error("No active wallet account connected.");
  }
  if (!recipient || !isAddress(recipient)) {
    throw new Error("Invalid recipient address. Must be a valid 0x Ethereum address.");
  }
  const cleanRecipient = recipient.trim() as Address;
  const numAmount = parseFloat(amount);
  if (!numAmount || numAmount <= 0) {
    throw new Error("Invalid transfer amount. Must be greater than 0.");
  }

  // 1. Check if the wallet is currently frozen on the Co-Signer backend
  try {
    const freezeState = await getMobileFreezeState(walletAddress);
    if (freezeState.frozen) {
      throw new Error(
        "Wallet is currently frozen. Outgoing transfers are locked. Please unfreeze your account first."
      );
    }
  } catch (err: any) {
    if (err?.message?.includes("Wallet is currently frozen")) {
      throw err;
    }
    // Proceed if backend is temporarily unreachable
  }

  // 2. Load the device signing key (Shard A) from hardware-backed SecureStore
  const shardAKey = await loadDeviceShard(walletAddress);
  if (!shardAKey || !shardAKey.startsWith("0x")) {
    throw new Error(
      "Signing key (Shard A) not found in secure storage on this device. Cannot send from watch-only address."
    );
  }

  const account = privateKeyToAccount(shardAKey as Hex);
  const client = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(ROBINHOOD_RPC_URL),
  });

  const upperToken = token.trim().toUpperCase();
  let txHash: `0x${string}`;

  if (upperToken === "ETH") {
    const weiValue = parseEther(amount.trim());
    txHash = await client.sendTransaction({
      to: cleanRecipient,
      value: weiValue,
    });
  } else if (upperToken === "USDG") {
    // USDG uses 6 decimals
    const usdgUnits = parseUnits(amount.trim(), 6);
    txHash = await client.writeContract({
      address: USDG_TOKEN_ADDRESS as Address,
      abi: erc20Abi,
      functionName: "transfer",
      args: [cleanRecipient, usdgUnits],
    });
  } else {
    throw new Error(`Unsupported token: ${token}`);
  }

  return {
    txHash,
    explorerUrl: `${ROBINHOOD_EXPLORER_URL}/tx/${txHash}`,
  };
}
