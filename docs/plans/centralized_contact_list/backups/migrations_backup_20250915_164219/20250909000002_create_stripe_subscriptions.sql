-- Migration: Create Stripe Subscriptions and Related Tables
-- Purpose: Comprehensive subscription management with plan definitions
-- Dependencies: stripe_customers table, organizations table
-- File: 20250909000002_create_stripe_subscriptions.sql

-- Create billing_plans table first (referenced by subscriptions)
CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  stripe_price_id TEXT UNIQUE NOT NULL,
  
  -- Pricing information
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'usd',
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  trial_period_days INTEGER DEFAULT 0,
  
  -- Plan features and limits
  features JSONB NOT NULL DEFAULT '[]', -- Array of feature names
  limits JSONB NOT NULL DEFAULT '{}', -- Usage limits (agents, workspaces, etc.)
  
  -- Plan status and ordering
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create stripe_subscriptions table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  -- Plan information
  stripe_price_id TEXT NOT NULL,
  plan_name TEXT NOT NULL REFERENCES billing_plans(plan_name),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  billing_amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'usd',
  
  -- Subscription status
  status TEXT NOT NULL CHECK (status IN (
    'incomplete', 'incomplete_expired', 'trialing', 'active', 
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  
  -- Billing periods
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Cancellation information
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Payment method information
  default_payment_method TEXT,
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  
  -- Metadata and timestamps
  subscription_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_stripe_subscription_id 
    CHECK (stripe_subscription_id ~ '^sub_[a-zA-Z0-9]+$'),
  CONSTRAINT valid_billing_amount CHECK (billing_amount >= 0)
);

-- Create subscription_history table for audit trail
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES stripe_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Change details
  change_type TEXT NOT NULL CHECK (change_type IN (
    'created', 'updated', 'canceled', 'reactivated', 'plan_changed', 'payment_failed'
  )),
  old_status TEXT,
  new_status TEXT,
  old_plan_name TEXT,
  new_plan_name TEXT,
  
  -- Context and metadata
  change_reason TEXT,
  changed_by_user_id UUID REFERENCES auth.users(id),
  stripe_event_id TEXT,
  change_metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_plans_name ON billing_plans(plan_name);
CREATE INDEX IF NOT EXISTS idx_billing_plans_active ON billing_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_billing_plans_sort ON billing_plans(sort_order);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org_id ON stripe_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON stripe_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON stripe_subscriptions(plan_name);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON stripe_subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_type ON subscription_history(change_type);

-- Enable Row Level Security
ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for billing_plans (public read for active plans)
CREATE POLICY "Public read active billing plans" 
  ON billing_plans FOR SELECT 
  TO public USING (is_active = TRUE);

CREATE POLICY "Service role manages billing plans" 
  ON billing_plans FOR ALL 
  USING (auth.role() = 'service_role');

-- RLS Policies for stripe_subscriptions
CREATE POLICY "Users view own subscriptions" 
  ON stripe_subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions" 
  ON stripe_subscriptions FOR ALL 
  USING (auth.role() = 'service_role');

-- RLS Policies for subscription_history
CREATE POLICY "Users view own subscription history" 
  ON subscription_history FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscription history" 
  ON subscription_history FOR ALL 
  USING (auth.role() = 'service_role');

-- Create updated_at triggers
CREATE TRIGGER trigger_billing_plans_updated_at
  BEFORE UPDATE ON billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_stripe_subscriptions_updated_at
  BEFORE UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to sync subscription status to organization
CREATE OR REPLACE FUNCTION sync_organization_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Update organization subscription_tier based on subscription
  IF NEW.organization_id IS NOT NULL THEN
    UPDATE organizations 
    SET subscription_tier = NEW.plan_name,
        updated_at = NOW()
    WHERE id = NEW.organization_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-sync subscription changes to organization
CREATE TRIGGER trigger_sync_org_subscription
  AFTER INSERT OR UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_organization_subscription();

-- Function to handle subscription updates from webhooks
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_stripe_subscription_id TEXT,
  p_status TEXT,
  p_current_period_start BIGINT,
  p_current_period_end BIGINT,
  p_cancel_at_period_end BOOLEAN DEFAULT FALSE,
  p_stripe_event_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
  v_user_id UUID;
  v_old_status TEXT;
BEGIN
  -- Get current subscription info
  SELECT id, user_id, status INTO v_subscription_id, v_user_id, v_old_status
  FROM stripe_subscriptions 
  WHERE stripe_subscription_id = p_stripe_subscription_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Update subscription status
  UPDATE stripe_subscriptions 
  SET 
    status = p_status,
    current_period_start = to_timestamp(p_current_period_start),
    current_period_end = to_timestamp(p_current_period_end),
    cancel_at_period_end = p_cancel_at_period_end,
    updated_at = NOW()
  WHERE stripe_subscription_id = p_stripe_subscription_id;
  
  -- Log the change in history
  INSERT INTO subscription_history (
    subscription_id, 
    user_id, 
    change_type, 
    old_status,
    new_status, 
    change_reason,
    stripe_event_id
  ) VALUES (
    v_subscription_id, 
    v_user_id, 
    'updated',
    v_old_status,
    p_status, 
    'webhook_update',
    p_stripe_event_id
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default billing plans
INSERT INTO billing_plans (plan_name, display_name, description, stripe_price_id, amount, billing_interval, features, limits, sort_order, is_featured) VALUES
('free', 'Free', 'Intelligence for everyday tasks', 'price_free', 0, 'month', 
 '["Access to GPT-4", "2 AI agents", "1 workspace", "Basic integrations", "Community support"]', 
 '{"max_agents": 2, "max_workspaces": 1, "max_storage_mb": 100}', 1, false),
 
('pro', 'Pro', 'Advanced features for power users', 'price_pro_monthly', 2900, 'month',
 '["Everything in Free", "Unlimited agents", "10 workspaces", "Advanced memory", "Priority integrations", "Email support"]',
 '{"max_agents": 50, "max_workspaces": 10, "max_storage_mb": 10000}', 2, true),
 
('team', 'Team', 'Collaboration for small teams', 'price_team_monthly', 5900, 'month',
 '["Everything in Pro", "Team workspaces", "User management", "Advanced analytics", "SSO integration", "Priority support"]',
 '{"max_agents": 100, "max_workspaces": 25, "max_storage_mb": 50000}', 3, false),
 
('enterprise', 'Enterprise', 'Full features for organizations', 'price_enterprise_monthly', 19900, 'month',
 '["Everything in Team", "Unlimited everything", "Custom integrations", "Dedicated support", "SLA guarantee", "Custom contracts"]',
 '{"max_agents": -1, "max_workspaces": -1, "max_storage_mb": -1}', 4, false)
ON CONFLICT (plan_name) DO NOTHING;

-- Grant permissions
GRANT SELECT ON billing_plans TO authenticated;
GRANT SELECT ON stripe_subscriptions TO authenticated;
GRANT SELECT ON subscription_history TO authenticated;
GRANT ALL ON billing_plans, stripe_subscriptions, subscription_history TO service_role;

-- Add helpful comments
COMMENT ON TABLE billing_plans IS 'Defines available subscription plans with features and limits';
COMMENT ON TABLE stripe_subscriptions IS 'Tracks active Stripe subscriptions for users';
COMMENT ON TABLE subscription_history IS 'Audit trail of all subscription changes';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250909000002_create_stripe_subscriptions completed successfully';
END $$;
