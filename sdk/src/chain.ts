import { defineChain } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.mainnet.chain.robinhood.com"],
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

export const DEFAULT_API_URL = "https://api.privatumrh.com";
export const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789" as const;
export const USDG_ADDRESS = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
export const PRIVATUM_FACTORY_ADDRESS = "0x5308e6f5faafa7ef6fff948994bd396a982be0d0" as const;
