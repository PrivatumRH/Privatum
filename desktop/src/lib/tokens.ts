import type { Address } from "viem";

export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  native?: boolean;
  isRwa?: boolean;
  color?: string;
  icon?: string;
}

export const USDG_ADDRESS: Address = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
export const WETH_ADDRESS: Address = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
export const PRIV_TOKEN_ADDRESS: Address = "0xee2ddd7128c291b027712eca157b3ff31a55a05a";

export const TOKENS: TokenInfo[] = [
  {
    symbol: "PRIV",
    name: "Privatum",
    address: PRIV_TOKEN_ADDRESS,
    decimals: 18,
    color: "#f64b43",
    icon: "/logo.png",
  },
  {
    symbol: "USDG",
    name: "Global Dollar",
    address: USDG_ADDRESS,
    decimals: 6,
    color: "#22c55e",
    icon: "/usdg_logo.png",
  },
  {
    symbol: "ETH",
    name: "Ether",
    address: WETH_ADDRESS,
    decimals: 18,
    native: true,
    color: "#627eea",
    icon: "/eth.jpeg",
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
    decimals: 18,
    isRwa: true,
    color: "#a3a3a3",
    icon: "/apple.png",
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
    decimals: 18,
    isRwa: true,
    color: "#ef4444",
    icon: "/tesla.png",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
    decimals: 18,
    isRwa: true,
    color: "#10b981",
    icon: "/nvidia.png",
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3",
    decimals: 18,
    isRwa: true,
    color: "#4285f4",
    icon: "/google.png",
  },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54",
    decimals: 18,
    isRwa: true,
    color: "#f59e0b",
    icon: "/amazon.png",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
    decimals: 18,
    isRwa: true,
    color: "#00a4ef",
    icon: "/microsoft.png",
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35",
    decimals: 18,
    isRwa: true,
    color: "#0668e1",
    icon: "/meta.jpg",
  },
  {
    symbol: "COIN",
    name: "Coinbase Global",
    address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b",
    decimals: 18,
    isRwa: true,
    color: "#0052ff",
    icon: "/rh-icon.png",
  },
  {
    symbol: "SPACEX",
    name: "SpaceX",
    address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa",
    decimals: 18,
    isRwa: true,
    color: "#6366f1",
    icon: "/spacex.png",
  },
];

export function findToken(symbolOrAddress: string): TokenInfo | undefined {
  const q = symbolOrAddress.toLowerCase();
  return TOKENS.find(
    (t) => t.symbol.toLowerCase() === q || t.address.toLowerCase() === q
  );
}
