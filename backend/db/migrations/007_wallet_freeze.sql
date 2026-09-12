-- Migration: 007_wallet_freeze.sql
-- Panic Freeze for PRIVATUM v0.1.11
--
-- A frozen wallet is one the co-signer refuses to sign for. Nothing here holds
-- key material: freezing withdraws Shard B's cooperation, it never grants the
-- power to move funds. The worst a stolen freeze credential can do is deny the
-- owner access, which the owner reverses with their authenticator.

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS frozen_until TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS frozen_source VARCHAR(16);

CREATE INDEX IF NOT EXISTS idx_wallets_frozen_until ON wallets(frozen_until);

-- Freeze and unfreeze are reachable without a session, so the 6-digit TOTP code
-- is the only secret standing in front of them. A million-value space with a
-- 30-second window is brute-forceable unless failures are counted and capped.
CREATE TABLE IF NOT EXISTS freeze_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL,
    action VARCHAR(16) NOT NULL,
    succeeded BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freeze_attempts_lookup
    ON freeze_attempts(wallet_address, attempted_at DESC);

-- Every freeze state change, for the owner's own audit trail after an incident.
CREATE TABLE IF NOT EXISTS freeze_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(42) NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
    action VARCHAR(16) NOT NULL,
    frozen_until TIMESTAMPTZ,
    source VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freeze_events_wallet
    ON freeze_events(wallet_address, created_at DESC);

-- A refused co-signing produces no signature, so the audit row must be able to
-- say so. The column was written when every audited request was an approval.
ALTER TABLE cosign_audit ALTER COLUMN shard_b_signature DROP NOT NULL;
