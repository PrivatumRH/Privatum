import type { Address, Hex } from "viem";

export const RELAY_API_URL = "https://api.relay.link";
export const RELAY_API_KEY = "edcabeb0-41ed-4827-9d8a-976280cfc0b7";

export interface SupportedDestinationChain {
  chainId: number;
  name: string;
  symbol: string;
  iconColor: string;
  usdcAddress: Address;
  ethAddress: Address;
  explorerUrl: string;
}

export const DESTINATION_CHAINS: SupportedDestinationChain[] = [
  {
    chainId: 8453,
    name: "Base",
    symbol: "BASE",
    iconColor: "#0052ff",
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ethAddress: "0x0000000000000000000000000000000000000000",
    explorerUrl: "https://basescan.org",
  },
  {
    chainId: 1,
    name: "Ethereum",
    symbol: "ETH",
    iconColor: "#627eea",
    usdcAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ethAddress: "0x0000000000000000000000000000000000000000",
    explorerUrl: "https://etherscan.io",
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    symbol: "ARB",
    iconColor: "#28a0f0",
    usdcAddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    ethAddress: "0x0000000000000000000000000000000000000000",
    explorerUrl: "https://arbiscan.io",
  },
];

export interface RelayQuoteResponse {
  steps?: {
    id: string;
    action: string;
    description: string;
    kind: string;
    items: {
      status: string;
      data: {
        from: Address;
        to: Address;
        data: Hex;
        value: string;
        chainId: number;
      };
    }[];
  }[];
  fees?: {
    relayer?: { amount: string; formatted: string; amountUsd: string };
    gas?: { amount: string; formatted: string; amountUsd: string };
  };
  details?: {
    currencyIn?: { currency: { symbol: string; decimals: number }; amount: string; amountFormatted: string };
    currencyOut?: { currency: { symbol: string; decimals: number }; amount: string; amountFormatted: string };
    rate?: string;
    timeEstimate?: number;
  };
}

export async function fetchRelayCrossChainQuote(params: {
  userAddress: Address;
  recipientAddress: Address;
  destinationChainId: number;
  originCurrency: Address;
  destinationCurrency: Address;
  amount: string; // in wei
}): Promise<RelayQuoteResponse | null> {
  try {
    const res = await fetch(`${RELAY_API_URL}/quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": RELAY_API_KEY,
      },
      body: JSON.stringify({
        user: params.userAddress,
        recipient: params.recipientAddress,
        originChainId: 4663,
        destinationChainId: params.destinationChainId,
        originCurrency: params.originCurrency,
        destinationCurrency: params.destinationCurrency,
        amount: params.amount,
        tradeType: "EXACT_INPUT",
      }),
    });

    if (!res.ok) {
      console.warn("Relay quote response error status:", res.status);
      return null;
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Failed to fetch Relay quote:", err);
    return null;
  }
}

export async function checkRelayIntentStatus(requestId: string): Promise<string> {
  try {
    const res = await fetch(`${RELAY_API_URL}/intents/status?requestId=${requestId}`, {
      headers: { "x-api-key": RELAY_API_KEY },
    });
    if (!res.ok) return "pending";
    const data = await res.json();
    return data?.status || "pending";
  } catch {
    return "pending";
  }
}
