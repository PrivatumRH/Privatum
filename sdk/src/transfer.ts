import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  toHex,
  type Address,
  type Hex,
} from "viem";
import {
  DEFAULT_API_URL,
  ENTRY_POINT_ADDRESS,
  PRIVATUM_FACTORY_ADDRESS,
  ROBINHOOD_CHAIN_ID,
  USDG_ADDRESS,
} from "./chain.js";
import type {
  BundlerSubmissionResponse,
  SendAssetOptions,
  UserOperation,
  UserOperationRpc,
} from "./types.js";

export const privatumAccountAbi = [
  {
    type: "function",
    name: "execute",
    inputs: [
      { name: "target", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "executeBatch",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "datas", type: "bytes[]" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rotateShardA",
    inputs: [{ name: "newShardA", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "rotateShardC",
    inputs: [{ name: "newShardC", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isOwner",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

export const erc20Abi = [
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

export const privatumFactoryAbi = [
  {
    type: "function",
    name: "createAccount",
    inputs: [
      { name: "shardA", type: "address" },
      { name: "shardB", type: "address" },
      { name: "shardC", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "ret", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAddress",
    inputs: [
      { name: "shardA", type: "address" },
      { name: "shardB", type: "address" },
      { name: "shardC", type: "address" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "entryPoint",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

/**
 * Builds standard ERC-4337 initCode (factory address + createAccount calldata)
 */
export function buildFactoryInitCode(
  shardA: Address,
  shardB: Address,
  shardC: Address,
  salt: Hex = "0x0000000000000000000000000000000000000000000000000000000000000001",
  factoryAddress: Address = PRIVATUM_FACTORY_ADDRESS
): Hex {
  const callData = encodeFunctionData({
    abi: privatumFactoryAbi,
    functionName: "createAccount",
    args: [shardA, shardB, shardC, salt],
  });
  return `${factoryAddress}${callData.slice(2)}` as Hex;
}

/**
 * Encodes calldata for sending ETH or USDG through PrivatumAccount.execute
 */
export function buildTransferCallData(
  asset: "ETH" | "USDG",
  to: Address,
  amount: bigint
): Hex {
  if (asset === "ETH") {
    return encodeFunctionData({
      abi: privatumAccountAbi,
      functionName: "execute",
      args: [to, amount, "0x"],
    });
  }

  const erc20Data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });

  return encodeFunctionData({
    abi: privatumAccountAbi,
    functionName: "execute",
    args: [USDG_ADDRESS, 0n, erc20Data],
  });
}

/**
 * Encodes calldata for rotating Shard A on emergency recovery
 */
export function buildRotateShardACallData(newShardA: Address): Hex {
  return encodeFunctionData({
    abi: privatumAccountAbi,
    functionName: "rotateShardA",
    args: [newShardA],
  });
}

/**
 * Calculates ERC-4337 v0.6 UserOperation hash
 */
export function getUserOpHash(
  userOp: Omit<UserOperation, "signature">,
  entryPoint: Address = ENTRY_POINT_ADDRESS,
  chainId: number = ROBINHOOD_CHAIN_ID
): Hex {
  const packedUserOp = encodeAbiParameters(
    [
      { type: "address" },
      { type: "uint256" },
      { type: "bytes32" },
      { type: "bytes32" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "bytes32" },
    ],
    [
      userOp.sender,
      userOp.nonce,
      keccak256(userOp.initCode || "0x"),
      keccak256(userOp.callData || "0x"),
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      keccak256(userOp.paymasterAndData || "0x"),
    ]
  );

  const enc = encodeAbiParameters(
    [
      { type: "bytes32" },
      { type: "address" },
      { type: "uint256" },
    ],
    [
      keccak256(packedUserOp),
      entryPoint,
      BigInt(chainId),
    ]
  );

  return keccak256(enc);
}

/**
 * Formats a UserOperation for standard JSON-RPC submission
 */
export function formatUserOpForRpc(userOp: UserOperation): UserOperationRpc {
  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: toHex(userOp.callGasLimit),
    verificationGasLimit: toHex(userOp.verificationGasLimit),
    preVerificationGas: toHex(userOp.preVerificationGas),
    maxFeePerGas: toHex(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  };
}

/**
 * Builds an ERC-4337 UserOperation struct with default gas values for Robinhood Chain
 */
export function buildUserOperation(params: {
  sender: Address;
  callData: Hex;
  nonce?: bigint;
  initCode?: Hex;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  paymasterAndData?: Hex;
}): Omit<UserOperation, "signature"> {
  return {
    sender: params.sender,
    nonce: params.nonce ?? 0n,
    initCode: params.initCode ?? "0x",
    callData: params.callData,
    callGasLimit: params.callGasLimit ?? 100_000n,
    verificationGasLimit: params.verificationGasLimit ?? 150_000n,
    preVerificationGas: params.preVerificationGas ?? 50_000n,
    maxFeePerGas: params.maxFeePerGas ?? 1_000_000_000n, // 1 gwei
    maxPriorityFeePerGas: params.maxPriorityFeePerGas ?? 100_000_000n, // 0.1 gwei
    paymasterAndData: params.paymasterAndData ?? "0x",
  };
}

/**
 * Submit signed UserOperation to the PRIVATUM bundler
 */
export async function submitUserOp(params: {
  userOp: UserOperation;
  entryPoint?: Address;
  apiUrl?: string;
}): Promise<BundlerSubmissionResponse> {
  const apiUrl = (params.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
  const entryPoint = params.entryPoint || ENTRY_POINT_ADDRESS;

  const rpcUserOp = formatUserOpForRpc(params.userOp);

  const response = await fetch(`${apiUrl}/v1/bundler/userop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userOp: rpcUserOp,
      entryPoint,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bundler rejected UserOp (${response.status}): ${errorText}`);
  }

  return (await response.json()) as BundlerSubmissionResponse;
}
