-- Initial schema for PRIVATUM Co-Signer Service

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address VARCHAR(42) UNIQUE NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 4663, -- Robinhood Chain Mainnet
  shard_a_address VARCHAR(42) NOT NULL,
  shard_b_address VARCHAR(42) NOT NULL,
  shard_b_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted Shard B private key
  shard_c_address VARCHAR(42) NOT NULL, -- Recovery key address
  api_key_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of client auth token
  threshold INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS totp_recovery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) UNIQUE NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  totp_secret_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted base32 TOTP secret
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  shard_c_encrypted TEXT, -- Optional encrypted backup of Shard C
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cosign_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
  user_op_hash VARCHAR(66) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  shard_b_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_totp_wallet ON totp_recovery(wallet_address);
CREATE INDEX IF NOT EXISTS idx_cosign_audit_wallet ON cosign_audit(wallet_address);
