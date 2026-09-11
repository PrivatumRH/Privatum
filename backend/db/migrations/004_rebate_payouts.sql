-- Payout broadcasting for bridge rebates, plus the price-guard audit trail.
--
-- PRIV has thin liquidity (~$4.8k), which makes spot price cheap to move. A
-- claim is therefore priced against a reference, and the figures behind that
-- decision are recorded so a disputed payout can be reconstructed.

ALTER TABLE rebate_claims
  ADD COLUMN IF NOT EXISTS priv_price_source VARCHAR(24) NOT NULL DEFAULT 'configured',
  ADD COLUMN IF NOT EXISTS priv_reference_price NUMERIC(38, 18),
  ADD COLUMN IF NOT EXISTS payout_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  -- Set when a payout transaction has been broadcast. Unique so a claim can
  -- never be paid twice even if two workers race.
  ADD COLUMN IF NOT EXISTS payout_nonce BIGINT;

-- A claim may only carry one payout transaction.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rebate_claims_tx_hash
  ON rebate_claims(tx_hash) WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rebate_claims_pending
  ON rebate_claims(status, created_at) WHERE status = 'pending';

-- Every broadcast attempt, successful or not. Append-only.
CREATE TABLE IF NOT EXISTS rebate_payout_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES rebate_claims(id) ON DELETE CASCADE,
  treasury_address VARCHAR(42) NOT NULL,
  priv_wei NUMERIC(78, 0) NOT NULL,
  tx_hash VARCHAR(66),
  -- dry_run -> simulated only, nothing broadcast
  -- sent    -> transaction broadcast, not yet confirmed
  -- success -> confirmed on Robinhood Chain
  -- failed  -> reverted or broadcast error
  outcome VARCHAR(16) NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rebate_payout_outcome_check
    CHECK (outcome IN ('dry_run', 'sent', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_payout_attempts_claim ON rebate_payout_attempts(claim_id);

-- 'paying' is the in-flight lock a payout worker takes before broadcasting, so
-- a crash mid-send leaves the claim visibly stuck rather than silently retryable.
ALTER TABLE rebate_claims DROP CONSTRAINT IF EXISTS rebate_claims_status_check;
ALTER TABLE rebate_claims ADD CONSTRAINT rebate_claims_status_check
  CHECK (status IN ('pending', 'paying', 'paid', 'failed'));
