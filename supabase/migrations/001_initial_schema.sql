-- Migration: Initial schema for UK Travel History migration to Supabase
-- Date: 2025-12-23
-- Description: Creates tables for purchase intents, users, and webhook events

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Purchase Intents Table
-- Tracks payment intents and their provisioning status
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL CHECK (status IN ('created', 'checkout_created', 'paid', 'provisioned')),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  email TEXT NOT NULL,
  price_id TEXT,
  product_id TEXT,
  clerk_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for purchase_intents
CREATE INDEX IF NOT EXISTS idx_purchase_intents_status ON purchase_intents(status);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_email ON purchase_intents(email);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_clerk_user_id ON purchase_intents(clerk_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_intents_stripe_checkout ON purchase_intents(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

-- ============================================================================
-- Users Table
-- Stores app users created after successful payment
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  passkey_enrolled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_passkey_enrolled ON users(passkey_enrolled);

-- ============================================================================
-- Webhook Events Table
-- Stores Stripe webhook events for idempotency and auditing
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for webhook_events
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);

-- ============================================================================
-- Functions
-- ============================================================================

-- Keepalive function to prevent Supabase Free tier inactivity pause
CREATE OR REPLACE FUNCTION keepalive()
RETURNS INTEGER AS $$
BEGIN
  RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on purchase_intents
CREATE TRIGGER update_purchase_intents_updated_at
  BEFORE UPDATE ON purchase_intents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE purchase_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes with service key)
-- No user-facing policies needed since all access is server-side via service role

-- Grant necessary permissions to authenticated role (for future use)
GRANT SELECT, INSERT, UPDATE ON purchase_intents TO authenticated;
GRANT SELECT ON users TO authenticated;
GRANT SELECT ON webhook_events TO authenticated;

-- Grant necessary permissions to service role (full access)
GRANT ALL ON purchase_intents TO service_role;
GRANT ALL ON users TO service_role;
GRANT ALL ON webhook_events TO service_role;
