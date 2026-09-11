import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { pool } from "./db/index";
import { decryptSecret } from "./crypto";
import {
  POOL_ADDRESS,
  RPC_URL,
  CHAIN_ID,
  ERC20_ABI,
  getPublicClient,
  loadPoolAccount,
} from "./poolWallet";

const NATIVE_ETH = "0x0000000000000000000000000000000000000000";

export interface SweepResult {
  swept: boolean;
  slug: string;
  status: string;
  receivedAmount?: string;
  sweptAmount?: string;
  txHash?: string;
  error?: string;
}

export async function checkAndSweepPaylink(slug: string): Promise<SweepResult> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT * FROM disposable_paylinks WHERE slug = $1 LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return { swept: false, slug, status: "not_found", error: "Paylink not found" };
    }

    const paylink = rows[0];

    // If already settled, expired, or cancelled, return current state
    if (paylink.status === "settled") {
      return {
        swept: true,
        slug,
        status: "settled",
        receivedAmount: paylink.received_amount,
        sweptAmount: paylink.swept_amount,
        txHash: paylink.sweep_tx_hash,
      };
    }

    if (paylink.status === "expired" || paylink.status === "cancelled") {
      return { swept: false, slug, status: paylink.status };
    }

    // Check expiration
    if (new Date() > new Date(paylink.expires_at)) {
      await client.query(
        `UPDATE disposable_paylinks SET status = 'expired' WHERE id = $1`,
        [paylink.id]
      );
      return { swept: false, slug, status: "expired" };
    }

    const publicClient = getPublicClient();
    const depositAddress = paylink.deposit_address as Address;
    const isNative = paylink.token_address.toLowerCase() === NATIVE_ETH.toLowerCase();

    let balanceWei = 0n;
    let decimals = 18;

    if (isNative) {
      balanceWei = await publicClient.getBalance({ address: depositAddress });
    } else {
      try {
        const bal = await publicClient.readContract({
          address: paylink.token_address as Address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [depositAddress],
        });
        balanceWei = bal as bigint;
        decimals = paylink.token_symbol.toUpperCase() === "USDC" || paylink.token_symbol.toUpperCase() === "USDT" ? 6 : 18;
      } catch (err) {
        console.error(`[sweeper] Failed reading token balance for ${depositAddress}:`, err);
        return { swept: false, slug, status: paylink.status, error: "Failed to read token balance" };
      }
    }

    if (balanceWei <= 0n) {
      return { swept: false, slug, status: paylink.status };
    }

    // Check if expected amount requirement is met
    const receivedFormatted = formatUnits(balanceWei, decimals);
    if (paylink.expected_amount) {
      const expectedNum = Number(paylink.expected_amount);
      const receivedNum = Number(receivedFormatted);
      if (receivedNum < expectedNum * 0.99) { // 1% tolerance for float rounding
        return {
          swept: false,
          slug,
          status: "insufficient_amount",
          receivedAmount: receivedFormatted,
        };
      }
    }

    // Mark as sweeping to prevent race conditions
    await client.query(
      `UPDATE disposable_paylinks SET status = 'sweeping', received_amount = $1 WHERE id = $2`,
      [receivedFormatted, paylink.id]
    );

    // Decrypt burner account
    let burnerPrivateKey: string;
    try {
      burnerPrivateKey = decryptSecret(paylink.encrypted_burner_key);
    } catch (err) {
      console.error(`[sweeper] Failed decrypting burner key for ${slug}:`, err);
      await client.query(
        `UPDATE disposable_paylinks SET status = 'active' WHERE id = $1`,
        [paylink.id]
      );
      return { swept: false, slug, status: "error", error: "Key decryption failed" };
    }

    const burnerAccount = privateKeyToAccount(burnerPrivateKey as Hex);
    const burnerWallet = createWalletClient({
      account: burnerAccount,
      transport: http(RPC_URL),
    });

    const recipientAddress = paylink.recipient_address as Address;
    const poolAccount = loadPoolAccount();

    let sweepTxHash = "";

    if (isNative) {
      // Native ETH: sweep balance minus estimated gas
      const gasPrice = await publicClient.getGasPrice().catch(() => 100000000n);
      const estimatedGas = 21000n;
      const gasFee = gasPrice * estimatedGas;

      if (balanceWei <= gasFee) {
        return { swept: false, slug, status: "dust", error: "Balance below gas fee" };
      }

      const sendAmount = balanceWei - gasFee;
      sweepTxHash = await burnerWallet.sendTransaction({
        to: recipientAddress,
        value: sendAmount,
      });
    } else {
      // ERC20 Token (USDG or PRIV)
      // Check if burner has enough ETH for gas (requires ~25000 gas)
      const burnerEth = await publicClient.getBalance({ address: depositAddress });
      const minGasEth = parseEther("0.000025");

      if (burnerEth < minGasEth && poolAccount) {
        // Pool wallet sponsors gas by granting micro-ETH to burner
        const poolWallet = createWalletClient({
          account: poolAccount,
          transport: http(RPC_URL),
        });

        const grantTx = await poolWallet.sendTransaction({
          to: depositAddress,
          value: parseEther("0.000035"),
        });

        await publicClient.waitForTransactionReceipt({ hash: grantTx, timeout: 20000 }).catch(() => null);
      }

      // Execute ERC20 transfer from burner to recipient
      // If route_mode is 'pool_shielded', route via pool first
      const destination = paylink.route_mode === "pool_shielded" ? POOL_ADDRESS : recipientAddress;

      sweepTxHash = await burnerWallet.writeContract({
        address: paylink.token_address as Address,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [destination, balanceWei],
      });

      // If routed via pool, pool forwards to recipient
      if (paylink.route_mode === "pool_shielded" && poolAccount) {
        await publicClient.waitForTransactionReceipt({ hash: sweepTxHash as Hex, timeout: 20000 }).catch(() => null);

        const poolWallet = createWalletClient({
          account: poolAccount,
          transport: http(RPC_URL),
        });

        const poolForwardTx = await poolWallet.writeContract({
          address: paylink.token_address as Address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [recipientAddress, balanceWei],
        });

        sweepTxHash = poolForwardTx;
      }
    }

    // Mark settled
    await client.query(
      `UPDATE disposable_paylinks 
       SET status = 'settled', 
           swept_amount = $1, 
           sweep_tx_hash = $2, 
           settled_at = NOW() 
       WHERE id = $3`,
      [receivedFormatted, sweepTxHash, paylink.id]
    );

    return {
      swept: true,
      slug,
      status: "settled",
      receivedAmount: receivedFormatted,
      sweptAmount: receivedFormatted,
      txHash: sweepTxHash,
    };
  } catch (err) {
    console.error(`[sweeper] Error sweeping paylink ${slug}:`, err);
    await client.query(
      `UPDATE disposable_paylinks SET status = 'active' WHERE slug = $1 AND status = 'sweeping'`,
      [slug]
    ).catch(() => null);

    return { swept: false, slug, status: "error", error: (err as Error).message };
  } finally {
    client.release();
  }
}
