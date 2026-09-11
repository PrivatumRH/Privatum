-- Migration: 006_disposable_paylinks.sql
-- Disposable Payment Links ("Hide My Wallet") for PRIVATUM v0.1.9

CREATE TABLE IF NOT EXISTS disposable_paylinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(32) NOT NULL UNIQUE,
    recipient_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    token_symbol VARCHAR(16) NOT NULL DEFAULT 'USDG',
    expected_amount NUMERIC(36, 18),
    memo VARCHAR(255),
    deposit_address VARCHAR(42) NOT NULL UNIQUE,
    encrypted_burner_key TEXT NOT NULL,
    key_iv VARCHAR(32) NOT NULL,
    key_tag VARCHAR(32) NOT NULL,
    route_mode VARCHAR(16) NOT NULL DEFAULT 'direct',
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    received_amount NUMERIC(36, 18),
    swept_amount NUMERIC(36, 18),
    deposit_tx_hash VARCHAR(66),
    sweep_tx_hash VARCHAR(66),
    expires_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paylinks_slug ON disposable_paylinks(slug);
CREATE INDEX IF NOT EXISTS idx_paylinks_recipient ON disposable_paylinks(recipient_address);
CREATE INDEX IF NOT EXISTS idx_paylinks_deposit ON disposable_paylinks(deposit_address);
CREATE INDEX IF NOT EXISTS idx_paylinks_status ON disposable_paylinks(status);
