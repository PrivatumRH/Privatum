-- Migration: 002_staking_gasless.sql
-- Description: Adds tables for PRIV staking, manual monthly renewal, and gas sponsorship audit

CREATE TABLE IF NOT EXISTS staking_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  staked_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tier VARCHAR(30) NOT NULL DEFAULT 'NONE',
  monthly_quota INTEGER NOT NULL DEFAULT 0, -- -1 represents unlimited
  quota_used INTEGER NOT NULL DEFAULT 0,
  staked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_renewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'EXPIRED', 'UNSTAKED'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL, -- 'STAKE', 'UNSTAKE', 'RENEW'
  amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tx_hash VARCHAR(66) UNIQUE, -- Unique to prevent replay attacks
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sponsored_tx_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  user_op_hash VARCHAR(66) NOT NULL,
  tx_hash VARCHAR(66),
  gas_fee_eth NUMERIC(18, 8) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'SPONSORED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staking_wallet ON staking_records(wallet_address);
CREATE INDEX IF NOT EXISTS idx_staking_events_wallet ON staking_events(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sponsored_audit_wallet ON sponsored_tx_audit(wallet_address);
