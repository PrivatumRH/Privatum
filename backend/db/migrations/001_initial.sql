-- Initial schema for PRIVATUM Co-Signer Service

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address VARCHAR(42) UNIQUE NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 4663, -- Robinhood Chain Mainnet
  shard_a_pubkey VARCHAR(132) NOT NULL,
  shard_b_encrypted TEXT NOT NULL, -- AES-256-GCM encrypted Shard B
  shard_c_passkey_pubkey TEXT NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spending_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) REFERENCES wallets(address) ON DELETE CASCADE,
  max_single_tx_usdg NUMERIC(28, 6) NOT NULL DEFAULT 1000.000000,
  max_daily_tx_usdg NUMERIC(28, 6) NOT NULL DEFAULT 5000.000000,
  max_single_tx_eth NUMERIC(28, 18) NOT NULL DEFAULT 0.500000000000000000,
  max_daily_tx_eth NUMERIC(28, 18) NOT NULL DEFAULT 2.000000000000000000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cosign_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address VARCHAR(42) NOT NULL,
  asset VARCHAR(10) NOT NULL CHECK (asset IN ('USDG', 'ETH')),
  recipient VARCHAR(42) NOT NULL,
  amount NUMERIC(28, 18) NOT NULL,
  user_op_hash VARCHAR(66) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SETTLED')),
  policy_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
  shard_b_partial_signature TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_cosign_wallet ON cosign_requests(wallet_address);
