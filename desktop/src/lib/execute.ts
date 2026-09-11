import {
  encodeFunctionData,
  parseAbi,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import {
  type PrivatumWallet,
  robinhoodChain,
  getUserOpHash,
  submitUserOp,
} from "@privatumrh/robinhood-chain-sdk";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATUM_ACCOUNT_ABI = parseAbi([
  "function execute(address target, uint256 value, bytes calldata data) external",
  "function executeBatch(address[] calldata targets, uint256[] calldata values, bytes[] calldata datas) external",
]);

export async function executeAccountCall(params: {
  wallet: PrivatumWallet;
  shardAPrivKey?: string;
  client: PublicClient;
  target: Address;
  value: bigint;
  data: Hex;
  sponsor?: boolean;
}): Promise<Hex> {
  const { wallet, shardAPrivKey, client, target, value, data, sponsor } = params;

  const callData = encodeFunctionData({
    abi: PRIVATUM_ACCOUNT_ABI,
    functionName: "execute",
    args: [target, value, data],
  });

  try {
    const nonce = await client.readContract({
      address: wallet.entryPointAddress,
      abi: parseAbi(["function getNonce(address sender, uint192 key) view returns (uint256)"]),
      functionName: "getNonce",
      args: [wallet.address, 0n],
    }).catch(() => 0n);

    const userOpBase = {
      sender: wallet.address,
      nonce,
      initCode: "0x" as Hex,
      callData,
      callGasLimit: 350000n,
      verificationGasLimit: 200000n,
      preVerificationGas: 60000n,
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1000000000n,
      paymasterAndData: "0x" as Hex,
    };

    const userOpHash = getUserOpHash(userOpBase, wallet.entryPointAddress, wallet.chainId);
    const signature = await wallet.signUserOp(userOpHash);

    const receipt = await submitUserOp({
      userOp: { ...userOpBase, signature },
      entryPoint: wallet.entryPointAddress,
      apiUrl: wallet.apiUrl,
      sponsor,
    });
    return receipt.userOpHash;
  } catch (bundlerErr: any) {
    if (shardAPrivKey) {
      const account = privateKeyToAccount(shardAPrivKey as Hex);
      if (account.address.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error(
          `Signer key mismatch: Local signing key (${account.address.slice(0, 6)}...${account.address.slice(-4)}) differs from wallet address (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}). Cannot broadcast direct transaction.`
        );
      }
      const walletClient = createWalletClient({
        account,
        chain: robinhoodChain,
        transport: http(),
      });
      return await walletClient.sendTransaction({
        to: target,
        value,
        data,
      });
    }
    throw bundlerErr;
  }
}

export async function executeAccountBatch(params: {
  wallet: PrivatumWallet;
  shardAPrivKey?: string;
  client: PublicClient;
  targets: Address[];
  values: bigint[];
  datas: Hex[];
  sponsor?: boolean;
}): Promise<Hex> {
  const { wallet, shardAPrivKey, client, targets, values, datas, sponsor } = params;

  const callData = encodeFunctionData({
    abi: PRIVATUM_ACCOUNT_ABI,
    functionName: "executeBatch",
    args: [targets, values, datas],
  });

  try {
    const nonce = await client.readContract({
      address: wallet.entryPointAddress,
      abi: parseAbi(["function getNonce(address sender, uint192 key) view returns (uint256)"]),
      functionName: "getNonce",
      args: [wallet.address, 0n],
    }).catch(() => 0n);

    const userOpBase = {
      sender: wallet.address,
      nonce,
      initCode: "0x" as Hex,
      callData,
      callGasLimit: 600000n,
      verificationGasLimit: 250000n,
      preVerificationGas: 80000n,
      maxFeePerGas: 2000000000n,
      maxPriorityFeePerGas: 1000000000n,
      paymasterAndData: "0x" as Hex,
    };

    const userOpHash = getUserOpHash(userOpBase, wallet.entryPointAddress, wallet.chainId);
    const signature = await wallet.signUserOp(userOpHash);

    const receipt = await submitUserOp({
      userOp: { ...userOpBase, signature },
      entryPoint: wallet.entryPointAddress,
      apiUrl: wallet.apiUrl,
      sponsor,
    });
    return receipt.userOpHash;
  } catch (bundlerErr: any) {
    if (shardAPrivKey) {
      const account = privateKeyToAccount(shardAPrivKey as Hex);
      if (account.address.toLowerCase() !== wallet.address.toLowerCase()) {
        throw new Error(
          `Signer key mismatch: Local signing key (${account.address.slice(0, 6)}...${account.address.slice(-4)}) differs from wallet address (${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}). Cannot broadcast direct transaction.`
        );
      }
      const walletClient = createWalletClient({
        account,
        chain: robinhoodChain,
        transport: http(),
      });
      let lastHash: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
      for (let i = 0; i < targets.length; i++) {
        lastHash = await walletClient.sendTransaction({
          to: targets[i],
          value: values[i],
          data: datas[i],
        });
      }
      return lastHash;
    }
    throw bundlerErr;
  }
}
