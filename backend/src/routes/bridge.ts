import { Router, type Request, type Response } from "express";
import { isAddress } from "viem";
import { pool, query } from "../db/index";
import {
  APP_FEE_BPS,
  BRIDGE_CHAIN_IDS,
  BRIDGE_CHAIN_NAMES,
  MIN_CLAIM_MICROS,
  NATIVE_CURRENCY,
  PRIV_ADDRESS,
  PRIV_DECIMALS,
  REBATE_BPS,
  SETTLEMENT_CHAIN_ID,
  calculateRebateMicros,
  extractSpreadMicros,
  resolvePrivPrice,
  fetchRelayQuote,
  fetchRelayStatus,
  isBridgeChainId,
  microsToPrivWei,
  microsToUsd,
} from "../relay";
import { getTreasuryStatus, processPendingPayouts } from "../treasury";

export const bridgeRouter = Router();

/**
 * Bridge rebates.
 *
 * Users bridging between Ethereum, Base, Arbitrum and Robinhood Chain earn a
 * share of the Relay relayer spread. Rebates accrue in micro-USD and are paid
 * out in PRIV on Robinhood Chain, since PRIV exists only there.
 *
 * The fee figures behind an accrual always come from the quote this service
 * issued, so a client cannot inflate its own rebate.
 */

/** Supported chains and current programme terms. */
bridgeRouter.get("/v1/bridge/chains", (_req: Request, res: Response) => {
  res.status(200).json({
    chains: BRIDGE_CHAIN_IDS.map((id) => ({ chainId: id, name: BRIDGE_CHAIN_NAMES[id] })),
    rebateBps: REBATE_BPS,
    rebateCurrency: { symbol: "PRIV", address: PRIV_ADDRESS, decimals: PRIV_DECIMALS },
    settlementChainId: SETTLEMENT_CHAIN_ID,
    minClaimUsd: microsToUsd(MIN_CLAIM_MICROS),
  });
});

/**
 * Quotes a bridge and records the rebate it would earn as a pending accrual.
 *
 * The accrual only becomes claimable once the bridge is confirmed settled via
 * POST /v1/bridge/rebates/confirm.
 */
bridgeRouter.post("/v1/bridge/quote", async (req: Request, res: Response): Promise<void> => {
  const {
    user,
    recipient,
    originChainId,
    destinationChainId,
    originCurrency,
    destinationCurrency,
    amount,
    tradeType,
  } = req.body ?? {};

  if (!user || !isAddress(user)) {
    res.status(400).json({ error: "A valid user address is required", code: "INVALID_USER" });
    return;
  }
  if (recipient && !isAddress(recipient)) {
    res.status(400).json({ error: "recipient must be a valid address", code: "INVALID_RECIPIENT" });
    return;
  }

  const origin = Number(originChainId);
  const destination = Number(destinationChainId);

  if (!isBridgeChainId(origin) || !isBridgeChainId(destination)) {
    res.status(400).json({
      error: `originChainId and destinationChainId must be one of: ${BRIDGE_CHAIN_IDS.join(", ")}`,
      code: "UNSUPPORTED_CHAIN",
    });
    return;
  }
  if (origin === destination) {
    res.status(400).json({
      error: "originChainId and destinationChainId must differ",
      code: "SAME_CHAIN",
    });
    return;
  }
  if (typeof amount !== "string" || !/^\d+$/.test(amount) || amount === "0") {
    res.status(400).json({
      error: "amount must be a positive integer string in the smallest unit",
      code: "INVALID_AMOUNT",
    });
    return;
  }

  try {
    const quote = await fetchRelayQuote({
      user,
      recipient,
      originChainId: origin,
      destinationChainId: destination,
      originCurrency,
      destinationCurrency,
      amount,
      tradeType,
    });

    const requestId = quote.steps?.[0]?.requestId || quote.requestId || null;
    const spreadMicros = extractSpreadMicros(quote);
    const rebateMicros = calculateRebateMicros(spreadMicros, REBATE_BPS);

    // Only record an accrual when Relay gave us a request to track it against.
    if (requestId && rebateMicros > 0n) {
      await query(
        `INSERT INTO bridge_rebates (
           request_id, user_address, origin_chain_id, destination_chain_id,
           origin_currency, destination_currency, amount_in,
           spread_micros_usd, rebate_micros_usd, rebate_bps, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
         ON CONFLICT (request_id) DO NOTHING`,
        [
          requestId,
          user.toLowerCase(),
          origin,
          destination,
          (originCurrency || NATIVE_CURRENCY).toLowerCase(),
          (destinationCurrency || NATIVE_CURRENCY).toLowerCase(),
          amount,
          spreadMicros.toString(),
          rebateMicros.toString(),
          REBATE_BPS,
        ]
      );
    }

    res.status(200).json({
      requestId,
      quote,
      rebate: {
        spreadUsd: microsToUsd(spreadMicros),
        rebateUsd: microsToUsd(rebateMicros),
        rebateBps: REBATE_BPS,
        rebateCurrency: "PRIV",
        settlementChainId: SETTLEMENT_CHAIN_ID,
        appFeeBps: APP_FEE_BPS,
      },
    });
  } catch (error) {
    console.error("[bridge] Quote error:", error);
    res.status(502).json({
      error: "Failed to fetch a bridge quote from Relay",
      code: "RELAY_UNAVAILABLE",
    });
  }
});

/**
 * Confirms a bridge settled and makes its rebate claimable.
 *
 * Status is read from Relay, not from the request body, so replaying this is
 * harmless: a bridge that did not succeed can never flip to `confirmed`.
 */
bridgeRouter.post("/v1/bridge/rebates/confirm", async (req: Request, res: Response): Promise<void> => {
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  if (!requestId) {
    res.status(400).json({ error: "requestId is required", code: "MISSING_REQUEST_ID" });
    return;
  }

  try {
    const existing = await query(
      "SELECT id, status, user_address, rebate_micros_usd FROM bridge_rebates WHERE request_id = $1",
      [requestId]
    );
    if (existing.rows.length === 0) {
      res.status(404).json({ error: "No rebate accrual for that request", code: "NOT_FOUND" });
      return;
    }

    const row = existing.rows[0];
    if (row.status !== "pending") {
      res.status(200).json({
        requestId,
        status: row.status,
        rebateUsd: microsToUsd(BigInt(row.rebate_micros_usd)),
      });
      return;
    }

    const relayStatus = await fetchRelayStatus(requestId);

    if (relayStatus.status === "success") {
      await query(
        `UPDATE bridge_rebates
         SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
         WHERE request_id = $1 AND status = 'pending'`,
        [requestId]
      );
      res.status(200).json({
        requestId,
        status: "confirmed",
        rebateUsd: microsToUsd(BigInt(row.rebate_micros_usd)),
      });
      return;
    }

    if (relayStatus.status === "failure" || relayStatus.status === "refund") {
      await query(
        `UPDATE bridge_rebates
         SET status = 'void', updated_at = NOW()
         WHERE request_id = $1 AND status = 'pending'`,
        [requestId]
      );
      res.status(200).json({ requestId, status: "void", relayStatus: relayStatus.status });
      return;
    }

    res.status(202).json({ requestId, status: "pending", relayStatus: relayStatus.status });
  } catch (error) {
    console.error("[bridge] Confirm error:", error);
    res.status(502).json({ error: "Failed to confirm bridge status", code: "RELAY_UNAVAILABLE" });
  }
});

/** Rebate balance and history for a wallet. */
bridgeRouter.get("/v1/bridge/rebates/:address", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  try {
    const totals = await query(
      `SELECT status, COALESCE(SUM(rebate_micros_usd), 0)::TEXT AS total, COUNT(*)::INT AS count
       FROM bridge_rebates WHERE user_address = $1 GROUP BY status`,
      [address]
    );

    const byStatus: Record<string, { micros: bigint; count: number }> = {};
    for (const row of totals.rows) {
      byStatus[row.status] = { micros: BigInt(row.total), count: row.count };
    }

    const claimable = byStatus.confirmed?.micros ?? 0n;
    const privPrice = (await resolvePrivPrice()).price;

    const history = await query(
      `SELECT request_id, origin_chain_id, destination_chain_id, amount_in,
              spread_micros_usd, rebate_micros_usd, rebate_bps, status, created_at, confirmed_at
       FROM bridge_rebates WHERE user_address = $1
       ORDER BY created_at DESC LIMIT 50`,
      [address]
    );

    res.status(200).json({
      address,
      claimableUsd: microsToUsd(claimable),
      claimablePriv:
        Number(privPrice) > 0 ? microsToPrivWei(claimable, privPrice).toString() : null,
      privUsdPrice: Number(privPrice) > 0 ? privPrice : null,
      pendingUsd: microsToUsd(byStatus.pending?.micros ?? 0n),
      claimedUsd: microsToUsd(byStatus.claimed?.micros ?? 0n),
      minClaimUsd: microsToUsd(MIN_CLAIM_MICROS),
      settlementChainId: SETTLEMENT_CHAIN_ID,
      bridgeCount: Object.values(byStatus).reduce((sum, entry) => sum + entry.count, 0),
      history: history.rows.map((row) => ({
        requestId: row.request_id,
        originChainId: row.origin_chain_id,
        destinationChainId: row.destination_chain_id,
        amountIn: row.amount_in,
        spreadUsd: microsToUsd(BigInt(row.spread_micros_usd)),
        rebateUsd: microsToUsd(BigInt(row.rebate_micros_usd)),
        rebateBps: row.rebate_bps,
        status: row.status,
        createdAt: row.created_at,
        confirmedAt: row.confirmed_at,
      })),
    });
  } catch (error) {
    console.error("[bridge] Balance error:", error);
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

/**
 * Claims all confirmed rebates for a wallet.
 *
 * Creates the ledger entry and attaches the accruals atomically, fixing the PRIV
 * amount at the current price. Broadcasting the payout is a separate, explicitly
 * funded step - this endpoint never moves funds itself.
 */
bridgeRouter.post("/v1/bridge/rebates/:address/claim", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const priced = await resolvePrivPrice();
  if (priced.rejection || !(Number(priced.price) > 0)) {
    res.status(503).json({
      error: priced.rejection || "PRIV price is unavailable, so a claim cannot be priced right now",
      code: "PRICE_UNAVAILABLE",
      spotPrice: priced.spotPrice,
      referencePrice: priced.referencePrice || null,
      deviationBps: priced.deviationBps,
    });
    return;
  }
  const privPrice = priced.price;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock the confirmed rows so two concurrent claims cannot both take them.
    const confirmed = await client.query(
      `SELECT id, rebate_micros_usd FROM bridge_rebates
       WHERE user_address = $1 AND status = 'confirmed'
       FOR UPDATE`,
      [address]
    );

    if (confirmed.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No confirmed rebates to claim", code: "NOTHING_TO_CLAIM" });
      return;
    }

    const totalMicros = confirmed.rows.reduce(
      (sum: bigint, row: { rebate_micros_usd: string }) => sum + BigInt(row.rebate_micros_usd),
      0n
    );

    if (totalMicros < MIN_CLAIM_MICROS) {
      await client.query("ROLLBACK");
      res.status(400).json({
        error: `Claimable balance is below the ${microsToUsd(MIN_CLAIM_MICROS)} USD minimum`,
        code: "BELOW_MINIMUM",
        claimableUsd: microsToUsd(totalMicros),
        minClaimUsd: microsToUsd(MIN_CLAIM_MICROS),
      });
      return;
    }

    const privWei = microsToPrivWei(totalMicros, privPrice);
    const claim = await client.query(
      `INSERT INTO rebate_claims (
         user_address, amount_micros_usd, priv_wei, priv_usd_price, settlement_chain_id,
         priv_price_source, priv_reference_price, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING id, created_at`,
      [
        address,
        totalMicros.toString(),
        privWei.toString(),
        privPrice,
        SETTLEMENT_CHAIN_ID,
        priced.source,
        priced.referencePrice || null,
      ]
    );

    const claimId = claim.rows[0].id;
    await client.query(
      `UPDATE bridge_rebates
       SET status = 'claimed', claim_id = $1, updated_at = NOW()
       WHERE id = ANY($2::uuid[])`,
      [claimId, confirmed.rows.map((row: { id: string }) => row.id)]
    );

    await client.query("COMMIT");

    res.status(201).json({
      claimId,
      address,
      amountUsd: microsToUsd(totalMicros),
      privWei: privWei.toString(),
      privUsdPrice: privPrice,
      privPriceSource: priced.source,
      privToken: { symbol: "PRIV", address: PRIV_ADDRESS, decimals: PRIV_DECIMALS },
      settlementChainId: SETTLEMENT_CHAIN_ID,
      accrualCount: confirmed.rows.length,
      status: "pending",
      createdAt: claim.rows[0].created_at,
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("[bridge] Claim error:", error);
    res.status(500).json({ error: "Internal server error during claim", code: "INTERNAL_ERROR" });
  } finally {
    client.release();
  }
});

/** Claim history for a wallet. */
bridgeRouter.get("/v1/bridge/claims/:address", async (req: Request, res: Response): Promise<void> => {
  const address = req.params.address?.toLowerCase();
  if (!address || !isAddress(address)) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  try {
    const result = await query(
      `SELECT id, amount_micros_usd, priv_wei, priv_usd_price, status, tx_hash,
              settlement_chain_id, created_at, paid_at
       FROM rebate_claims WHERE user_address = $1
       ORDER BY created_at DESC LIMIT 50`,
      [address]
    );

    res.status(200).json({
      address,
      claims: result.rows.map((row) => ({
        claimId: row.id,
        amountUsd: microsToUsd(BigInt(row.amount_micros_usd)),
        privWei: row.priv_wei,
        privUsdPrice: row.priv_usd_price,
        status: row.status,
        txHash: row.tx_hash,
        settlementChainId: row.settlement_chain_id,
        createdAt: row.created_at,
        paidAt: row.paid_at,
      })),
    });
  } catch (error) {
    console.error("[bridge] Claims error:", error);
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});
/**
 * Treasury health: PRIV on hand versus PRIV already promised.
 *
 * `underfunded` going true means claims have been priced that the treasury
 * cannot currently cover - worth alerting on.
 */
bridgeRouter.get("/v1/bridge/treasury", async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json(await getTreasuryStatus());
  } catch (error) {
    console.error("[bridge] Treasury status error:", error);
    res.status(500).json({ error: "Internal server error", code: "INTERNAL_ERROR" });
  }
});

/**
 * Runs the payout worker over pending claims.
 *
 * Guarded by REBATE_ADMIN_TOKEN. Simulates unless REBATE_PAYOUTS_ENABLED is
 * true; pass `dryRun: true` to force a simulation even when payouts are live.
 */
bridgeRouter.post("/v1/bridge/payouts/run", async (req: Request, res: Response): Promise<void> => {
  const adminToken = process.env.REBATE_ADMIN_TOKEN?.trim();
  if (!adminToken) {
    res.status(503).json({
      error: "Payout runs are disabled until REBATE_ADMIN_TOKEN is configured",
      code: "ADMIN_DISABLED",
    });
    return;
  }

  const provided = req.headers.authorization?.replace(/^Bearer /i, "").trim();
  if (!provided || provided !== adminToken) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  try {
    const results = await processPendingPayouts({
      limit: typeof req.body?.limit === "number" ? req.body.limit : undefined,
      dryRun: req.body?.dryRun === true ? true : undefined,
    });

    res.status(200).json({
      processed: results.length,
      dryRun: results.every((r) => r.outcome === "dry_run"),
      results,
    });
  } catch (error) {
    console.error("[bridge] Payout run error:", error);
    res.status(500).json({
      error: (error as Error).message?.slice(0, 300) || "Payout run failed",
      code: "PAYOUT_FAILED",
    });
  }
});
