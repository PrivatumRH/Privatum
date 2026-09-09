import { defineChain } from "viem";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.robinhoodchain.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
  contracts: {
    entryPoint: {
      address: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    },
  },
});

export const USDG_ROBINHOOD_ADDRESS = "0x2D734407B184FF66b26D0cf32168e65842820579" as const;
