import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { decryptSecret } from "./crypto";

/**
 * The platform pool wallet.
 *
 * One wallet backs both products: it custodies PRIV staked for gasless
 * transactions and pays ETH gas sponsorship, and from v0.1.8 it also settles
 * bridge rebates. Because staked PRIV is user property owed back on unstake,
 * every spend path must respect the staking reserve - see `getPoolSolvency`.
 */

export const POOL_ADDRESS = (
  process.env.PLATFORM_POOL_WALLET_PUBLIC_KEY?.trim() ||
  "0xf5370a080A8c8Eed95E71982b228A3C0BdEfF41f"
) as Address;

export const RPC_URL =
  process.env.ROBINHOOD_RPC_URL?.trim() || "https://rpc.mainnet.chain.robinhood.com";

export const CHAIN_ID = Number(process.env.ROBINHOOD_CHAIN_ID) || 4663;

/** PRIV (PrivatumRH), 18 decimals, Robinhood Chain. */
export const PRIV_TOKEN_ADDRESS = (
  process.env.PRIV_TOKEN_ADDRESS?.trim() || "0xee2ddd7128c291b027712eca157b3ff31a55a05a"
) as Address;

export const PRIV_DECIMALS = 18;

/** USDG - not PRIV. Kept here so misconfiguration can be detected explicitly. */
const USDG_ADDRESS = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";

export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

/**
 * Guards against the PRIV token address being set to USDG.
 *
 * These are different assets on the same chain, so a mix-up silently moves the
 * wrong token rather than failing - worth refusing at startup.
 */
export function assertPrivTokenConfigured(): void {
  if (PRIV_TOKEN_ADDRESS.toLowerCase() === USDG_ADDRESS) {
    throw new Error(
      "PRIV_TOKEN_ADDRESS is set to the USDG contract. PRIV is 0xee2ddd7128c291b027712eca157b3ff31a55a05a."
    );
  }
}

export function getPublicClient() {
  return createPublicClient({ transport: http(RPC_URL) });
}

/**
 * Loads the pool signer.
 *
 * Prefers PLATFORM_POOL_WALLET_PRIVATE_KEY_ENCRYPTED (AES-256-GCM, same scheme
 * as Shard B). The plaintext PLATFORM_POOL_WALLET_PRIVATE_KEY is still accepted
 * for local work but refused under NODE_ENV=production, so a deploy carrying a
 * bare key fails loudly instead of running with it.
 */
export function loadPoolAccount() {
  const encrypted = process.env.PLATFORM_POOL_WALLET_PRIVATE_KEY_ENCRYPTED?.trim();
  const plaintext = process.env.PLATFORM_POOL_WALLET_PRIVATE_KEY?.trim();

  let privateKey: string | undefined;

  if (encrypted) {
    try {
      privateKey = decryptSecret(encrypted);
    } catch (error) {
      throw new Error(
        `Failed to decrypt PLATFORM_POOL_WALLET_PRIVATE_KEY_ENCRYPTED: ${(error as Error).message}`
      );
    }
  } else if (plaintext) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PLATFORM_POOL_WALLET_PRIVATE_KEY may not be used in production - " +
          "set PLATFORM_POOL_WALLET_PRIVATE_KEY_ENCRYPTED instead"
      );
    }
    privateKey = plaintext;
  }

  if (!privateKey) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("Pool wallet private key is not a 32-byte hex value");
  }

  const account = privateKeyToAccount(privateKey as Hex);

  // A signer that does not control the advertised pool address would send funds
  // from somewhere unexpected, so refuse rather than guess.
  if (account.address.toLowerCase() !== POOL_ADDRESS.toLowerCase()) {
    throw new Error(
      `Pool signer ${account.address} does not match PLATFORM_POOL_WALLET_PUBLIC_KEY ${POOL_ADDRESS}`
    );
  }

  return account;
}

export function getPoolWalletClient() {
  const account = loadPoolAccount();
  if (!account) return null;
  return { account, client: createWalletClient({ account, transport: http(RPC_URL) }) };
}

/** PRIV held by the pool, in wei. */
export async function getPoolPrivBalance(): Promise<bigint> {
  const balance = await getPublicClient().readContract({
    address: PRIV_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [POOL_ADDRESS],
  });
  return balance as bigint;
}

/** Native ETH held by the pool, used for gas sponsorship. */
export async function getPoolEthBalance(): Promise<bigint> {
  return await getPublicClient().getBalance({ address: POOL_ADDRESS });
}
