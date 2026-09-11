import type { Address, Hex } from "viem";

export type ShardRole = "device" | "cosigner" | "recovery";

export interface ILocalShard {
  role: "device" | "recovery";
  address: Address;
  privateKey: Hex;
  signHash(hash: Hex): Promise<Hex>;
}

export interface RemoteCosignerConfig {
  address: Address;
  walletAddress: Address;
  apiUrl?: string;
  headers?: Record<string, string>;
  customSigner?: (hash: Hex, apiKey: string) => Promise<Hex>;
}

export interface IRemoteCosigner {
  role: "cosigner";
  address: Address;
  apiUrl: string;
  signHash(hash: Hex, apiKey: string): Promise<Hex>;
}

export type IShard = ILocalShard | IRemoteCosigner;

export interface PrivatumWalletRegistration {
  address: Address;
  chainId: number;
  shardAAddress: Address;
  shardBAddress: Address;
  shardCAddress: Address;
  threshold: 2;
  apiKey: string;
}

export interface PrivatumWalletConfig {
  address: Address;
  shardA: ILocalShard;
  shardB: IRemoteCosigner;
  shardCAddress: Address;
  apiKey: string;
  chainId?: number;
  apiUrl?: string;
  entryPointAddress?: Address;
}

export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface UserOperationRpc {
  sender: Address;
  nonce: Hex;
  initCode: Hex;
  callData: Hex;
  callGasLimit: Hex;
  verificationGasLimit: Hex;
  preVerificationGas: Hex;
  maxFeePerGas: Hex;
  maxPriorityFeePerGas: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface SendAssetOptions {
  to: Address;
  amount: bigint;
  asset: "ETH" | "USDG";
  nonce?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

export interface TotpSetupResponse {
  secret: string;
  uri: string;
}

export interface BundlerSubmissionResponse {
  status: string;
  userOpHash: Hex;
  chainId: number;
  timestamp: string;
  sponsored?: boolean;
}

export interface StakingConfigResponse {
  platformPoolWallet: Address;
  tokenAddress: Address;
  minStake: number;
  cycleDays: number;
  tiers: {
    name: string;
    minPriv: number;
    txnsPerMonth: number | string;
  }[];
}

export interface StakingStatusResponse {
  walletAddress: Address;
  isStaked: boolean;
  stakedAmount: number;
  tier: string;
  monthlyQuota: number;
  quotaUsed: number;
  quotaRemaining: number;
  expiresAt: string | null;
  daysRemaining: number;
  isExpired: boolean;
  canRenew: boolean;
}

export interface RecoveryOptions {
  walletAddress: Address;
  shardC: ILocalShard;
  totpCode: string;
  newShardAAddress: Address;
  apiUrl?: string;
  chainId?: number;
  entryPointAddress?: Address;
  nonce?: bigint;
}

/* ---------- Cross-chain bridging & PRIV rebates ---------- */

/** Chains Privatum bridges between (Ethereum, Base, Arbitrum, Robinhood Chain). */
export type BridgeChainId = 1 | 8453 | 42161 | 4663;

export type BridgeTradeType = "EXACT_INPUT" | "EXACT_OUTPUT";

export interface BridgeQuoteRequest {
  user: Address;
  recipient?: Address;
  originChainId: number;
  destinationChainId: number;
  /** Token address on the origin chain. Defaults to native. */
  originCurrency?: Address;
  /** Token address on the destination chain. Defaults to native. */
  destinationCurrency?: Address;
  /** Amount in the smallest unit of the origin currency, as a decimal string. */
  amount: string;
  tradeType?: BridgeTradeType;
  /** Wallet that accrues Privatum's app fee with Relay. */
  appFeeRecipient?: Address;
  /** Privatum's app fee in basis points. */
  appFeeBps?: number;
}

export interface RelayFeeAmount {
  currency?: {
    chainId?: number;
    address?: string;
    symbol?: string;
    name?: string;
    decimals?: number;
  };
  amount?: string;
  amountFormatted?: string;
  amountUsd?: string;
  minimumAmount?: string;
}

export interface RelayQuoteFees {
  gas?: RelayFeeAmount;
  relayer?: RelayFeeAmount;
  relayerGas?: RelayFeeAmount;
  /** The relayer's margin above gas - the spread the rebate is calculated on. */
  relayerService?: RelayFeeAmount;
  app?: RelayFeeAmount;
}

export interface RelayQuoteStep {
  id?: string;
  requestId?: string;
  kind?: string;
  items?: unknown[];
}

export interface RelayQuoteResponse {
  requestId?: string;
  steps?: RelayQuoteStep[];
  fees?: RelayQuoteFees;
  details?: {
    currencyIn?: unknown;
    currencyOut?: unknown;
    totalImpact?: { usd?: string; percent?: string };
    timeEstimate?: number;
    rate?: string;
  };
}

export interface BridgeRebateEstimate {
  /** Relayer spread on this route, as a decimal USD string. */
  spreadUsd: string;
  /** Rebate owed to the user, as a decimal USD string. */
  rebateUsd: string;
  rebateBps: number;
  /** Rebates are always denominated for payout in PRIV. */
  rebateCurrency: string;
  /** PRIV only exists on Robinhood Chain, so rebates settle there. */
  settlementChainId: number;
}

export interface BridgeQuote {
  requestId: string | null;
  quote: RelayQuoteResponse;
  rebate: BridgeRebateEstimate;
}

export type RelayIntentStatusValue =
  | "unknown"
  | "pending"
  | "success"
  | "failure"
  | "refund"
  | "delayed";

export interface RelayIntentStatus {
  status: RelayIntentStatusValue;
  details?: string;
  txHashes?: string[];
  inTxHashes?: string[];
}
