import type { Address, Hex } from "viem";

export const RELAY_API_URL = "https://api.relay.link";
export const RELAY_API_KEY = "edcabeb0-41ed-4827-9d8a-976280cfc0b7";

export interface DestinationTokenInfo {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  isNative?: boolean;
}

export interface SupportedDestinationChain {
  chainId: number;
  name: string;
  symbol: string;
  iconColor: string;
  usdcAddress: Address;
  ethAddress: Address;
  explorerUrl: string;
  tokens: DestinationTokenInfo[];
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
    tokens: [
      {
        symbol: "ETH",
        name: "Ether",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        isNative: true,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
      },
      {
        symbol: "cbBTC",
        name: "Coinbase Wrapped BTC",
        address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
        decimals: 8,
      },
      {
        symbol: "EURC",
        name: "Circle Euro",
        address: "0x60a3E35Cc655a00529c9cc2163E731847780063D",
        decimals: 6,
      },
      {
        symbol: "USDbC",
        name: "Bridged USD Coin",
        address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA",
        decimals: 6,
      },
      {
        symbol: "AERO",
        name: "Aerodrome Finance",
        address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
        decimals: 18,
      },
    ],
  },
  {
    chainId: 10,
    name: "Optimism",
    symbol: "OP",
    iconColor: "#ff0420",
    usdcAddress: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    ethAddress: "0x0000000000000000000000000000000000000000",
    explorerUrl: "https://optimistic.etherscan.io",
    tokens: [
      {
        symbol: "ETH",
        name: "Ether",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        isNative: true,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        decimals: 6,
      },
      {
        symbol: "OP",
        name: "Optimism",
        address: "0x4200000000000000000000000000000000000042",
        decimals: 18,
      },
    ],
  },
  {
    chainId: 1,
    name: "Ethereum",
    symbol: "ETH",
    iconColor: "#627eea",
    usdcAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ethAddress: "0x0000000000000000000000000000000000000000",
    explorerUrl: "https://etherscan.io",
    tokens: [
      {
        symbol: "ETH",
        name: "Ether",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        isNative: true,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6,
      },
      {
        symbol: "WBTC",
        name: "Wrapped BTC",
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        decimals: 8,
      },
    ],
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    symbol: "ARB",
    iconColor: "#28a0f0",
    usdcAddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
    ethAddress: "0x0000000000000000000000000000000000000000",
    explorerUrl: "https://arbiscan.io",
    tokens: [
      {
        symbol: "ETH",
        name: "Ether",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        isNative: true,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        decimals: 6,
      },
      {
        symbol: "ARB",
        name: "Arbitrum",
        address: "0x912CE59144191C1204E64559FE8253a0e49E6548",
        decimals: 18,
      },
    ],
  },
];

/**
 * Resolves a supported destination chain by chainId, name, or symbol.
 */
export function findDestinationChain(
  identifier: string | number
): SupportedDestinationChain | undefined {
  if (typeof identifier === "number") {
    return DESTINATION_CHAINS.find((c) => c.chainId === identifier);
  }
  const clean = identifier.trim().toLowerCase();
  const numeric = parseInt(clean, 10);
  if (!isNaN(numeric)) {
    const byId = DESTINATION_CHAINS.find((c) => c.chainId === numeric);
    if (byId) return byId;
  }
  return DESTINATION_CHAINS.find(
    (c) =>
      c.name.toLowerCase() === clean ||
      c.symbol.toLowerCase() === clean ||
      (clean === "op mainnet" && c.symbol === "OP") ||
      (clean === "arbitrum" && c.symbol === "ARB")
  );
}

/**
 * Checks whether a given chain ID is supported for cross-chain bridging.
 */
export function isSupportedDestinationChain(chainId: number): boolean {
  return DESTINATION_CHAINS.some((c) => c.chainId === chainId);
}

/**
 * Returns supported destination tokens for a given chain ID.
 */
export function getDestinationTokens(chainId: number): DestinationTokenInfo[] {
  const chain = findDestinationChain(chainId);
  return chain?.tokens || [];
}

/**
 * Resolves a destination token on a specific chain by symbol or address.
 */
export function findDestinationToken(
  chainId: number,
  symbolOrAddress: string
): DestinationTokenInfo | undefined {
  const tokens = getDestinationTokens(chainId);
  const clean = symbolOrAddress.trim().toLowerCase();
  return tokens.find(
    (t) =>
      t.symbol.toLowerCase() === clean ||
      t.address.toLowerCase() === clean ||
      (clean === "usd" && t.symbol === "USDC") ||
      (clean === "ether" && t.symbol === "ETH")
  );
}

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
