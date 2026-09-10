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
