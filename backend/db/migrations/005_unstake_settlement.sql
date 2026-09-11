-- Unstake settlement tracking.
--
-- Before this, an UNSTAKE event recorded a synthetic tx_hash ("unstake-<ms>")
-- and no PRIV ever left the pool: the ledger said unstaked while the chain had
-- not moved. Settlement is now tracked explicitly so an unstake that has not
-- been paid out is visible rather than silently complete.

ALTER TABLE staking_events
  -- pending  -> balance debited, transfer not yet broadcast
  -- settled  -> PRIV transfer confirmed on-chain
  -- failed   -> transfer failed; the stake has been restored
  -- n/a      -> events that do not move funds (STAKE, RENEW)
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(16) NOT NULL DEFAULT 'n/a',
  ADD COLUMN IF NOT EXISTS settlement_error TEXT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

ALTER TABLE staking_events DROP CONSTRAINT IF EXISTS staking_events_settlement_check;
ALTER TABLE staking_events ADD CONSTRAINT staking_events_settlement_check
  CHECK (settlement_status IN ('n/a', 'pending', 'settled', 'failed'));

CREATE INDEX IF NOT EXISTS idx_staking_events_unsettled
  ON staking_events(settlement_status, created_at)
  WHERE settlement_status = 'pending';

-- Historic UNSTAKE rows carry a synthetic hash rather than a real transaction.
-- Clear it and mark them unsettled so they surface for manual reconciliation
-- instead of masquerading as paid.
UPDATE staking_events
SET tx_hash = NULL,
    settlement_status = 'pending',
    settlement_error = 'Recorded before on-chain unstake settlement existed'
WHERE event_type = 'UNSTAKE'
  AND tx_hash IS NOT NULL
  AND tx_hash NOT LIKE '0x%';
