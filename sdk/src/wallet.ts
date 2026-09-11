import type { Address, Hex } from "viem";
import { DEFAULT_API_URL, ENTRY_POINT_ADDRESS, ROBINHOOD_CHAIN_ID } from "./chain.js";
import { LocalShard, RemoteCosigner } from "./shard.js";
import {
  buildRotateShardACallData,
  buildTransferCallData,
  buildUserOperation,
  getUserOpHash,
  submitUserOp,
} from "./transfer.js";
import type {
  BundlerSubmissionResponse,
  PrivatumWalletConfig,
  PrivatumWalletRegistration,
  RecoveryOptions,
  SendAssetOptions,
  TotpSetupResponse,
  UserOperation,
} from "./types.js";

export class PrivatumWallet {
  public address: Address;
  public shardA: LocalShard;
  public shardB: RemoteCosigner;
  public shardCAddress: Address;
  public apiKey: string;
  public chainId: number;
  public apiUrl: string;

  public entryPointAddress: Address;

  constructor(config: PrivatumWalletConfig) {
    this.address = config.address;
    this.shardA = config.shardA as LocalShard;
    this.shardB = config.shardB as RemoteCosigner;
    this.shardCAddress = config.shardCAddress;
    this.apiKey = config.apiKey;
    this.chainId = config.chainId || ROBINHOOD_CHAIN_ID;
    this.apiUrl = (config.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
    this.entryPointAddress = config.entryPointAddress || ENTRY_POINT_ADDRESS;
  }

  /**
   * Onboard and register a new 2-of-3 threshold smart account with the live PRIVATUM co-signer
   */
  static async create(options?: {
    apiUrl?: string;
    existingShardA?: LocalShard;
    existingShardCAddress?: Address;
    cosignerHeaders?: Record<string, string>;
    customSigner?: (hash: Hex, apiKey: string) => Promise<Hex>;
  }): Promise<{ wallet: PrivatumWallet; shardC: LocalShard }> {
    const apiUrl = (options?.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");

    // 1. Generate local device key (Shard A)
    const shardA = options?.existingShardA || LocalShard.create("device");

    // 2. Generate local recovery key (Shard C)
    const shardC = LocalShard.create("recovery");
    const shardCAddress = options?.existingShardCAddress || shardC.address;

    // 3. Temporary counterfactual address placeholder (or deterministic CREATE2 derived)
    const predictedWalletAddress = shardA.address; // Counterfactual or factory predicted

    // 4. Register with backend
    const response = await fetch(`${apiUrl}/v1/wallets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options?.cosignerHeaders || {}),
      },
      body: JSON.stringify({
        address: predictedWalletAddress,
        shardAAddress: shardA.address,
        shardCAddress: shardCAddress,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to register wallet (${response.status}): ${errorText}`);
    }

    const reg = (await response.json()) as PrivatumWalletRegistration;

    const shardB = new RemoteCosigner({
      address: reg.shardBAddress,
      walletAddress: reg.address,
      apiUrl,
      headers: options?.cosignerHeaders,
      customSigner: options?.customSigner,
    });

    const wallet = new PrivatumWallet({
      address: reg.address,
      shardA,
      shardB,
      shardCAddress: reg.shardCAddress,
      apiKey: reg.apiKey,
      chainId: reg.chainId,
      apiUrl,
    });

    return { wallet, shardC };
  }

  /**
   * Combine two 65-byte signatures into the 130-byte payload expected by PrivatumAccount.sol
   */
  static combineSignatures(sig1: Hex, sig2: Hex): Hex {
    const clean1 = sig1.startsWith("0x") ? sig1.slice(2) : sig1;
    const clean2 = sig2.startsWith("0x") ? sig2.slice(2) : sig2;
    if (clean1.length !== 130 || clean2.length !== 130) {
      throw new Error("Both signatures must be exactly 65 bytes (130 hex chars)");
    }
    return `0x${clean1}${clean2}` as Hex;
  }

  /**
   * Initialize standard TOTP 2FA for emergency recovery
   */
  async setupTotpRecovery(): Promise<TotpSetupResponse> {
    const response = await fetch(`${this.apiUrl}/v1/wallets/${this.address}/totp/setup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to setup TOTP (${response.status}): ${err}`);
    }

    return (await response.json()) as TotpSetupResponse;
  }

  /**
   * Confirm and lock in TOTP 2FA code
   */
  async confirmTotpRecovery(code: string): Promise<boolean> {
    const response = await fetch(`${this.apiUrl}/v1/wallets/${this.address}/totp/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to confirm TOTP code (${response.status}): ${err}`);
    }

    const data = (await response.json()) as { ok: boolean };
    return data.ok;
  }

  /**
   * Co-sign a userOpHash using Shard A and Remote Shard B
   */
  async signUserOp(userOpHash: Hex): Promise<Hex> {
    const [sigA, sigB] = await Promise.all([
      this.shardA.signHash(userOpHash),
      this.shardB.signHash(userOpHash, this.apiKey),
    ]);

    return PrivatumWallet.combineSignatures(sigA, sigB);
  }

  /**
   * Build UserOperation for asset transfer (ETH or USDG)
   */
  buildTransferUserOp(options: SendAssetOptions): Omit<UserOperation, "signature"> {
    const callData = buildTransferCallData(options.asset, options.to, options.amount);
    return buildUserOperation({
      sender: this.address,
      callData,
      nonce: options.nonce,
      callGasLimit: options.callGasLimit,
      verificationGasLimit: options.verificationGasLimit,
      preVerificationGas: options.preVerificationGas,
      maxFeePerGas: options.maxFeePerGas,
      maxPriorityFeePerGas: options.maxPriorityFeePerGas,
    });
  }

  /**
   * Execute asset transfer (ETH or USDG) via 2-of-3 threshold quorum and bundler
   */
  async sendAsset(options: SendAssetOptions): Promise<BundlerSubmissionResponse> {
    const userOpBase = this.buildTransferUserOp(options);
    const userOpHash = getUserOpHash(userOpBase, this.entryPointAddress, this.chainId);
    const signature = await this.signUserOp(userOpHash);

    const userOp: UserOperation = {
      ...userOpBase,
      signature,
    };

    return submitUserOp({
      userOp,
      entryPoint: this.entryPointAddress,
      apiUrl: this.apiUrl,
    });
  }

  /**
   * Emergency recovery flow using Shard C and TOTP code to rotate compromised/lost Shard A
   */
  static async recoverWallet(options: RecoveryOptions): Promise<BundlerSubmissionResponse> {
    const apiUrl = (options.apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
    const chainId = options.chainId || ROBINHOOD_CHAIN_ID;
    const entryPoint = options.entryPointAddress || ENTRY_POINT_ADDRESS;

    // 1. Build rotation UserOp
    const callData = buildRotateShardACallData(options.newShardAAddress);
    const userOpBase = buildUserOperation({
      sender: options.walletAddress,
      callData,
      nonce: options.nonce ?? 0n,
    });

    // 2. Compute UserOp hash
    const userOpHash = getUserOpHash(userOpBase, entryPoint, chainId);

    // 3. Shard C signs locally
    const sigC = await options.shardC.signHash(userOpHash);

    // 4. Request emergency co-signing from Shard B via TOTP
    const recoverRes = await fetch(`${apiUrl}/v1/wallets/${options.walletAddress}/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: options.totpCode,
        userOpHash,
      }),
    });

    if (!recoverRes.ok) {
      const errText = await recoverRes.text();
      let cleanMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        cleanMsg = parsed.error || parsed.message || errText;
      } catch {}
      throw new Error(`Recovery co-signing failed (${recoverRes.status}): ${cleanMsg}`);
    }

    const { signatureB } = (await recoverRes.json()) as { signatureB: Hex };

    // 5. Combine Shard C and Shard B signatures
    const signature = PrivatumWallet.combineSignatures(sigC, signatureB);

    const userOp: UserOperation = {
      ...userOpBase,
      signature,
    };

    // 6. Broadcast via bundler
    try {
      return await submitUserOp({
        userOp,
        entryPoint,
        apiUrl,
      });
    } catch (bundlerErr: any) {
      const msg = bundlerErr?.message || String(bundlerErr);
      throw new Error(
        `Failed to broadcast recovery UserOp to EntryPoint on Robinhood Chain (${msg}). Ensure an active ERC-4337 bundler or relayer is reachable.`
      );
    }
  }
}
