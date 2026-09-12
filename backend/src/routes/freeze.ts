import { Router, type Request, type Response } from "express";
import { isAddress } from "viem";
import { query } from "../db/index";
import { hashApiKey } from "../crypto";
import {
  ATTEMPT_WINDOW_MINUTES,
  freezeWallet,
  getFreezeState,
  isLockedOut,
  unfreezeWallet,
  verifyFreezeCode,
  type FreezeSource,
} from "../freeze";

export const freezeRouter = Router();

/**
 * These endpoints take no session. A session is the one thing a thief holding
 * the device already has, so requiring one would defeat the feature. The
 * authenticator code is the credential, and it authorises a state flag rather
 * than any movement of funds.
 */

const LOCKED_OUT = {
  error: `Too many attempts. Try again in ${ATTEMPT_WINDOW_MINUTES} minutes.`,
  code: "RATE_LIMITED",
};

/** Deliberately identical for a wrong code, an unknown wallet and un-enrolled TOTP. */
const REJECTED = { error: "Verification failed", code: "VERIFICATION_FAILED" };

function parseAddress(req: Request): string | null {
  const address = req.params.address?.toLowerCase();
  return address && isAddress(address) ? address : null;
}

/** An authenticated client may also freeze, for the second-device case. */
async function hasValidSession(address: string, req: Request): Promise<boolean> {
  const apiKey = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) return false;
  const { rows } = await query("SELECT api_key_hash FROM wallets WHERE address = $1", [address]);
  return rows.length > 0 && rows[0].api_key_hash === hashApiKey(apiKey);
}

/**
 * Public freeze state, so the page can render before anyone types a code.
 *
 * An unknown address reports an unfrozen wallet rather than a 404: the reply is
 * the same shape whether or not the wallet exists, and freeze state is not a
 * secret worth protecting for one that does.
 */
freezeRouter.get("/v1/wallets/:address/freeze", async (req: Request, res: Response): Promise<void> => {
  const address = parseAddress(req);
  if (!address) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  try {
    res.status(200).json(await getFreezeState(address));
  } catch (error) {
    console.error("[freeze] state lookup error:", error);
    res.status(500).json({ error: "Freeze service error", code: "FREEZE_ERROR" });
  }
});

freezeRouter.post("/v1/wallets/:address/freeze", async (req: Request, res: Response): Promise<void> => {
  const address = parseAddress(req);
  if (!address) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const { code, hours } = req.body ?? {};
  const duration: number | null =
    hours === null || hours === undefined ? null : Number(hours);
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > 8760)) {
    res.status(400).json({ error: "hours must be between 1 and 8760, or null", code: "INVALID_DURATION" });
    return;
  }

  try {
    if (await isLockedOut(address)) {
      res.status(429).json(LOCKED_OUT);
      return;
    }

    let source: FreezeSource | null = null;
    if (await hasValidSession(address, req)) {
      source = "session";
    } else if (typeof code === "string" && (await verifyFreezeCode(address, code, "freeze"))) {
      source = "totp";
    }

    if (!source) {
      res.status(401).json(REJECTED);
      return;
    }

    // Only reached with a verified caller, so an unknown address is a no-op
    // rather than a disclosure.
    const state = await freezeWallet(address, duration, source);
    res.status(200).json({ ...state, message: "Wallet frozen. The co-signer will refuse to sign." });
  } catch (error) {
    console.error("[freeze] freeze error:", error);
    res.status(500).json({ error: "Freeze service error", code: "FREEZE_ERROR" });
  }
});

/** Unfreezing always needs the authenticator, even from an authenticated client. */
freezeRouter.post("/v1/wallets/:address/unfreeze", async (req: Request, res: Response): Promise<void> => {
  const address = parseAddress(req);
  if (!address) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  const { code } = req.body ?? {};
  if (typeof code !== "string") {
    res.status(400).json({ error: "A 6-digit code is required", code: "INVALID_CODE" });
    return;
  }

  try {
    if (await isLockedOut(address)) {
      res.status(429).json(LOCKED_OUT);
      return;
    }
    if (!(await verifyFreezeCode(address, code, "unfreeze"))) {
      res.status(401).json(REJECTED);
      return;
    }

    const state = await unfreezeWallet(address, "totp");
    res.status(200).json({ ...state, message: "Wallet unfrozen." });
  } catch (error) {
    console.error("[freeze] unfreeze error:", error);
    res.status(500).json({ error: "Freeze service error", code: "FREEZE_ERROR" });
  }
});

/** The owner's incident trail: what was attempted, and when. */
freezeRouter.get("/v1/wallets/:address/freeze/events", async (req: Request, res: Response): Promise<void> => {
  const address = parseAddress(req);
  if (!address) {
    res.status(400).json({ error: "Invalid wallet address", code: "INVALID_ADDRESS" });
    return;
  }

  try {
    if (!(await hasValidSession(address, req))) {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }
    const { rows } = await query(
      `SELECT action, frozen_until, source, created_at
         FROM freeze_events WHERE wallet_address = $1
        ORDER BY created_at DESC LIMIT 50`,
      [address]
    );
    res.status(200).json({ events: rows });
  } catch (error) {
    console.error("[freeze] events error:", error);
    res.status(500).json({ error: "Freeze service error", code: "FREEZE_ERROR" });
  }
});
