-- Migration: Create Sample Billing Plans
-- Purpose: Add comprehensive billing plans with personal and business tiers
-- Features: Delegated access for business plans, proper plan structure
-- File: 20250915000001_create_sample_billing_plans.sql

-- First, ensure billing_plans table has all needed columns
DO $$
BEGIN
    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_plans' AND column_name = 'plan_type') THEN
        ALTER TABLE billing_plans ADD COLUMN plan_type TEXT DEFAULT 'personal' CHECK (plan_type IN ('personal', 'business'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_plans' AND column_name = 'sort_order') THEN
        ALTER TABLE billing_plans ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_plans' AND column_name = 'is_featured') THEN
        ALTER TABLE billing_plans ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_plans' AND column_name = 'limits') THEN
        ALTER TABLE billing_plans ADD COLUMN limits JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Clear existing plans
DELETE FROM billing_plans;

-- Insert Personal Plans
INSERT INTO billing_plans (
    plan_name, display_name, description, stripe_price_id, amount, currency, 
    billing_interval, features, limits, plan_type, sort_order, is_featured, is_active
) VALUES 
-- Personal Free Plan
(
    'free',
    'Free',
    'Perfect for getting started with AI agents',
    'price_free', -- Placeholder - no actual Stripe price needed
    0,
    'usd',
    'month',
    '["3 AI agents", "Basic chat interface", "Community support", "1GB storage", "Basic integrations"]'::jsonb,
    '{"agents": 3, "storage_gb": 1, "monthly_messages": 100, "integrations": 5}'::jsonb,
    'personal',
    1,
    false,
    true
),
-- Personal Pro Plan  
(
    'pro',
    'Pro',
    'For individuals who want more power and flexibility',
    'price_1234567890abcdef', -- Replace with actual Stripe price ID
    2000, -- $20.00
    'usd',
    'month',
    '["Unlimited AI agents", "Advanced chat features", "Priority support", "50GB storage", "All integrations", "Custom agent personalities", "Advanced reasoning", "Web search capability"]'::jsonb,
    '{"agents": -1, "storage_gb": 50, "monthly_messages": 10000, "integrations": -1}'::jsonb,
    'personal',
    2,
    true,
    true
),
-- Personal Plus Plan
(
    'plus',
    'Plus',
    'Maximum power for AI enthusiasts and power users',
    'price_abcdef1234567890', -- Replace with actual Stripe price ID
    4000, -- $40.00
    'usd',
    'month',
    '["Everything in Pro", "Unlimited storage", "Advanced analytics", "Custom model training", "API access", "White-label options", "Premium reasoning models"]'::jsonb,
    '{"agents": -1, "storage_gb": -1, "monthly_messages": -1, "integrations": -1, "api_calls": 100000}'::jsonb,
    'personal',
    3,
    false,
    true
);

-- Insert Business Plans
INSERT INTO billing_plans (
    plan_name, display_name, description, stripe_price_id, amount, currency, 
    billing_interval, features, limits, plan_type, sort_order, is_featured, is_active
) VALUES 
-- Business Team Plan
(
    'team',
    'Team',
    'Perfect for small teams and growing businesses',
    'price_team1234567890', -- Replace with actual Stripe price ID
    8000, -- $80.00
    'usd',
    'month',
    '["Everything in Plus", "Team collaboration", "Delegated access control", "10 team members", "Advanced admin controls", "Team analytics", "Shared agent libraries", "Role-based permissions"]'::jsonb,
    '{"agents": -1, "storage_gb": -1, "monthly_messages": -1, "integrations": -1, "api_calls": 500000, "team_members": 10}'::jsonb,
    'business',
    4,
    true,
    true
),
-- Business Pro Plan
(
    'business',
    'Business',
    'For larger teams that need advanced collaboration',
    'price_business123456', -- Replace with actual Stripe price ID
    15000, -- $150.00
    'usd',
    'month',
    '["Everything in Team", "50 team members", "Advanced delegated access", "Department management", "Custom workflows", "Enterprise integrations", "Advanced security", "Audit logs", "Custom branding"]'::jsonb,
    '{"agents": -1, "storage_gb": -1, "monthly_messages": -1, "integrations": -1, "api_calls": 2000000, "team_members": 50}'::jsonb,
    'business',
    5,
    false,
    true
),
-- Business Enterprise Plan
(
    'enterprise',
    'Enterprise',
    'For large organizations with complex requirements',
    'price_enterprise1234', -- Replace with actual Stripe price ID
    30000, -- $300.00
    'usd',
    'month',
    '["Everything in Business", "Unlimited team members", "Full delegated access control", "Advanced compliance", "Dedicated support", "Custom development", "On-premise options", "SLA guarantees", "Advanced security auditing"]'::jsonb,
    '{"agents": -1, "storage_gb": -1, "monthly_messages": -1, "integrations": -1, "api_calls": -1, "team_members": -1}'::jsonb,
    'business',
    6,
    false,
    true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_plans_type_active ON billing_plans(plan_type, is_active);
CREATE INDEX IF NOT EXISTS idx_billing_plans_sort_order ON billing_plans(sort_order);

-- Add helpful comments
COMMENT ON COLUMN billing_plans.plan_type IS 'Type of plan: personal or business';
COMMENT ON COLUMN billing_plans.sort_order IS 'Order for displaying plans (lower numbers first)';
COMMENT ON COLUMN billing_plans.is_featured IS 'Whether this plan should be highlighted as featured/popular';
COMMENT ON COLUMN billing_plans.limits IS 'JSON object with plan limits (-1 means unlimited)';

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 20250915000001_create_sample_billing_plans completed successfully';
    RAISE NOTICE 'Created 6 billing plans: 3 personal (Free, Pro, Plus) and 3 business (Team, Business, Enterprise)';
    RAISE NOTICE 'Business plans include delegated access and team collaboration features';
END $$;
