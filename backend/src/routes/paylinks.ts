import { Router, type Request, type Response } from "express";
import { isAddress, getAddress } from "viem";
import { randomBytes } from "node:crypto";
import { pool } from "../db/index";
import { generateShardKey, encryptSecret } from "../crypto";
import { checkAndSweepPaylink } from "../sweeper";

export const paylinksRouter = Router();

const DEFAULT_TOKEN = "0x5fc5360d0400a0fd4f2af552add042d716f1d168"; // USDG
const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
const PRIV_TOKEN = "0xee2ddd7128c291b027712eca157b3ff31a55a05a";

function generateSlug(): string {
  // Clean alphanumeric slug like "pay_7f9c2d1b"
  return "pay_" + randomBytes(5).toString("hex");
}

/**
 * POST /v1/paylinks/create
 * Creates a new disposable payment link with an ephemeral burner address.
 */
paylinksRouter.post("/create", async (req: Request, res: Response) => {
  try {
    const {
      recipient_address,
      token_address = DEFAULT_TOKEN,
      token_symbol,
      amount,
      memo,
      route_mode = "direct",
      expires_in_hours = 72,
    } = req.body;

    if (!recipient_address || !isAddress(recipient_address)) {
      return res.status(400).json({ error: "Valid recipient_address is required" });
    }

    if (token_address && !isAddress(token_address)) {
      return res.status(400).json({ error: "Invalid token_address" });
    }

    const cleanRecipient = getAddress(recipient_address);
    const cleanToken = getAddress(token_address);

    let symbol = token_symbol || "USDG";
    if (cleanToken.toLowerCase() === NATIVE_ETH.toLowerCase()) {
      symbol = "ETH";
    } else if (cleanToken.toLowerCase() === PRIV_TOKEN.toLowerCase()) {
      symbol = "PRIV";
    }

    const expectedAmount = amount ? Number(amount) : null;
    if (expectedAmount !== null && (isNaN(expectedAmount) || expectedAmount <= 0)) {
      return res.status(400).json({ error: "amount must be a positive number or null" });
    }

    // Generate ephemeral burner key
    const { privateKey, address: depositAddress } = generateShardKey();
    const encryptedKey = encryptSecret(privateKey);
    const slug = generateSlug();

    const hours = Math.max(1, Math.min(Number(expires_in_hours) || 72, 720)); // 1h to 30 days
    const expiresAt = new Date(Date.now() + hours * 3600 * 1000);

    const client = await pool.connect();
    try {
      const parts = encryptedKey.split(":");
      const keyIv = parts[0] || "";
      const keyTag = parts[1] || "";

      await client.query(
        `INSERT INTO disposable_paylinks (
          slug, recipient_address, token_address, token_symbol, expected_amount, 
          memo, deposit_address, encrypted_burner_key, key_iv, key_tag, 
          route_mode, status, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12)`,
        [
          slug,
          cleanRecipient,
          cleanToken,
          symbol,
          expectedAmount,
          memo ? String(memo).slice(0, 255) : null,
          depositAddress,
          encryptedKey,
          keyIv,
          keyTag,
          route_mode === "pool_shielded" ? "pool_shielded" : "direct",
          expiresAt.toISOString(),
        ]
      );

      const baseUrl = process.env.PUBLIC_APP_URL || "https://privatumrh.com";

      return res.status(201).json({
        success: true,
        slug,
        deposit_address: depositAddress,
        token_address: cleanToken,
        token_symbol: symbol,
        expected_amount: expectedAmount,
        memo: memo || null,
        route_mode,
        expires_at: expiresAt.toISOString(),
        pay_url: `${baseUrl}/pay/${slug}`,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[paylinks] Error creating paylink:", err);
    return res.status(500).json({ error: "Internal server error creating paylink" });
  }
});

/**
 * GET /v1/paylinks/:slug
 * Public endpoint used by the payment checkout portal.
 * STRICT PRIVACY: recipient_address and encrypted_burner_key are NEVER exposed.
 */
paylinksRouter.get("/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT slug, token_address, token_symbol, expected_amount, memo, 
                deposit_address, route_mode, status, received_amount, swept_amount, 
                sweep_tx_hash, expires_at, settled_at, created_at
         FROM disposable_paylinks 
         WHERE slug = $1 LIMIT 1`,
        [slug]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: "Payment link not found" });
      }

      const item = rows[0];

      // Auto-check expiration
      if (item.status === "active" && new Date() > new Date(item.expires_at)) {
        await client.query(
          `UPDATE disposable_paylinks SET status = 'expired' WHERE slug = $1`,
          [slug]
        );
        item.status = "expired";
      }

      return res.json({
        success: true,
        paylink: {
          slug: item.slug,
          token_address: item.token_address,
          token_symbol: item.token_symbol,
          expected_amount: item.expected_amount,
          memo: item.memo,
          deposit_address: item.deposit_address,
          route_mode: item.route_mode,
          status: item.status,
          received_amount: item.received_amount,
          swept_amount: item.swept_amount,
          sweep_tx_hash: item.sweep_tx_hash,
          expires_at: item.expires_at,
          settled_at: item.settled_at,
          created_at: item.created_at,
        },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[paylinks] Error fetching paylink:", err);
    return res.status(500).json({ error: "Internal server error fetching paylink" });
  }
});

/**
 * POST /v1/paylinks/check/:slug
 * Trigger an on-chain check and auto-sweep for a paylink.
 */
paylinksRouter.post("/check/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const result = await checkAndSweepPaylink(slug);
    return res.json({ success: true, result });
  } catch (err) {
    console.error("[paylinks] Error in check/sweep:", err);
    return res.status(500).json({ error: "Failed to check or sweep paylink" });
  }
});

/**
 * GET /v1/paylinks/user/:address
 * Lists paylinks created by a recipient smart account address.
 */
paylinksRouter.get("/user/:address", async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!address || !isAddress(address)) {
      return res.status(400).json({ error: "Valid user address is required" });
    }

    const cleanAddress = getAddress(address);
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT slug, token_address, token_symbol, expected_amount, memo, 
                deposit_address, route_mode, status, received_amount, swept_amount, 
                deposit_tx_hash, sweep_tx_hash, expires_at, settled_at, created_at
         FROM disposable_paylinks 
         WHERE recipient_address = $1 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [cleanAddress]
      );

      return res.json({ success: true, paylinks: rows });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[paylinks] Error fetching user paylinks:", err);
    return res.status(500).json({ error: "Failed to fetch user paylinks" });
  }
});

/**
 * POST /v1/paylinks/cancel/:slug
 * Cancels an active paylink so it will not accept or sweep payments.
 */
paylinksRouter.post("/cancel/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const client = await pool.connect();
    try {
      const { rowCount } = await client.query(
        `UPDATE disposable_paylinks 
         SET status = 'cancelled' 
         WHERE slug = $1 AND status = 'active'`,
        [slug]
      );

      if (rowCount === 0) {
        return res.status(400).json({ error: "Paylink not found or cannot be cancelled" });
      }

      return res.json({ success: true, message: "Paylink cancelled" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[paylinks] Error cancelling paylink:", err);
    return res.status(500).json({ error: "Failed to cancel paylink" });
  }
});
