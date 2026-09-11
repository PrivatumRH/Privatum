-- Cross-chain bridge rebates: users earn a share of the Relay relayer spread,
-- accrued in micro-USD and paid out in PRIV on Robinhood Chain.

CREATE TABLE IF NOT EXISTS bridge_rebates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Relay request id. Unique so a settled bridge can only ever accrue once.
  request_id VARCHAR(128) UNIQUE NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  origin_chain_id INTEGER NOT NULL,
  destination_chain_id INTEGER NOT NULL,
  origin_currency VARCHAR(42) NOT NULL,
  destination_currency VARCHAR(42) NOT NULL,
  amount_in NUMERIC(78, 0) NOT NULL,

  -- Fee figures are captured server-side from the quote Privatum itself issued,
  -- never supplied by the client.
  spread_micros_usd BIGINT NOT NULL,
  rebate_micros_usd BIGINT NOT NULL,
  rebate_bps INTEGER NOT NULL,

  -- pending  -> quote issued, bridge not yet confirmed settled
  -- confirmed-> Relay reports the request succeeded; rebate is claimable
  -- void     -> bridge failed, refunded, or the quote expired unused
  -- claimed  -> included in a settled payout
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  claim_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bridge_rebates_status_check
    CHECK (status IN ('pending', 'confirmed', 'void', 'claimed')),
  CONSTRAINT bridge_rebates_non_negative
    CHECK (spread_micros_usd >= 0 AND rebate_micros_usd >= 0)
);

CREATE TABLE IF NOT EXISTS rebate_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address VARCHAR(42) NOT NULL,
  -- Total USD value claimed, summed from the accruals attached to this claim.
  amount_micros_usd BIGINT NOT NULL,
  -- PRIV owed, fixed at claim time using the price below.
  priv_wei NUMERIC(78, 0) NOT NULL,
  priv_usd_price NUMERIC(38, 18) NOT NULL,
  settlement_chain_id INTEGER NOT NULL DEFAULT 4663,

  -- pending -> ledger entry created, payout not yet broadcast
  -- paid    -> payout transaction confirmed on Robinhood Chain
  -- failed  -> payout failed; attached accruals are released back to confirmed
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  tx_hash VARCHAR(66),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT rebate_claims_status_check CHECK (status IN ('pending', 'paid', 'failed')),
  CONSTRAINT rebate_claims_positive CHECK (amount_micros_usd > 0 AND priv_wei > 0)
);

ALTER TABLE bridge_rebates
  DROP CONSTRAINT IF EXISTS bridge_rebates_claim_fk;
ALTER TABLE bridge_rebates
  ADD CONSTRAINT bridge_rebates_claim_fk
  FOREIGN KEY (claim_id) REFERENCES rebate_claims(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bridge_rebates_user ON bridge_rebates(user_address);
CREATE INDEX IF NOT EXISTS idx_bridge_rebates_status ON bridge_rebates(user_address, status);
CREATE INDEX IF NOT EXISTS idx_bridge_rebates_request ON bridge_rebates(request_id);
CREATE INDEX IF NOT EXISTS idx_rebate_claims_user ON rebate_claims(user_address);
