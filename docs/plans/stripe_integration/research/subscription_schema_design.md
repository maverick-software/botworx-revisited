# Subscription Schema Design - Subscription Management Tables
## Research Document for WBS Task 3.1.2

### **CONTEXT & PURPOSE**
Design comprehensive subscription management tables that track Stripe subscriptions, handle plan changes, and integrate with Agentopia's existing organization system. Must support multiple subscription models and billing cycles.

### **EXISTING SYSTEM INTEGRATION**
- **Organizations Table**: Has `subscription_tier` field (free, pro, enterprise)
- **User Profiles**: Need to link subscriptions to users and organizations
- **Role System**: Subscription status should affect role permissions
- **Billing Email**: Organizations have billing_email field for invoices

### **STRIPE SUBSCRIPTION REQUIREMENTS**
- **Subscription Lifecycle**: Track creation, updates, cancellation
- **Plan Management**: Support multiple plans with different features
- **Billing Cycles**: Monthly, yearly, and custom billing periods
- **Proration**: Handle mid-cycle plan changes
- **Trial Periods**: Support free trials and grace periods
- **Payment Status**: Track payment success/failure states

### **PROPOSED SUBSCRIPTION TABLE**
```sql
CREATE TABLE stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  
  -- Plan Information
  stripe_price_id TEXT NOT NULL,
  plan_name TEXT NOT NULL, -- 'free', 'pro', 'enterprise'
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  billing_amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'usd',
  
  -- Subscription Status
  status TEXT NOT NULL CHECK (status IN (
    'incomplete', 'incomplete_expired', 'trialing', 'active', 
    'past_due', 'canceled', 'unpaid', 'paused'
  )),
  
  -- Billing Periods
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Payment Method
  default_payment_method TEXT,
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  
  -- Metadata
  subscription_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_stripe_subscription_id 
    CHECK (stripe_subscription_id ~ '^sub_[a-zA-Z0-9]+$')
);
```

### **SUBSCRIPTION PLANS TABLE**
```sql
CREATE TABLE billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  stripe_price_id TEXT UNIQUE NOT NULL,
  
  -- Pricing
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'usd',
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('month', 'year')),
  trial_period_days INTEGER DEFAULT 0,
  
  -- Features
  features JSONB NOT NULL DEFAULT '[]', -- Array of feature names
  limits JSONB NOT NULL DEFAULT '{}', -- Usage limits (agents, workspaces, etc.)
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **SUBSCRIPTION HISTORY TABLE**
```sql
CREATE TABLE subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES stripe_subscriptions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Change Details
  change_type TEXT NOT NULL CHECK (change_type IN (
    'created', 'updated', 'canceled', 'reactivated', 'plan_changed'
  )),
  old_status TEXT,
  new_status TEXT,
  old_plan_name TEXT,
  new_plan_name TEXT,
  
  -- Reason and Context
  change_reason TEXT,
  changed_by_user_id UUID REFERENCES auth.users(id),
  stripe_event_id TEXT,
  
  -- Metadata
  change_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **INDEXING STRATEGY**
```sql
-- Primary lookups
CREATE INDEX idx_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX idx_subscriptions_org_id ON stripe_subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe_id ON stripe_subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_customer_id ON stripe_subscriptions(stripe_customer_id);

-- Status and plan queries
CREATE INDEX idx_subscriptions_status ON stripe_subscriptions(status);
CREATE INDEX idx_subscriptions_plan ON stripe_subscriptions(plan_name);
CREATE INDEX idx_subscriptions_period_end ON stripe_subscriptions(current_period_end);

-- History lookups
CREATE INDEX idx_subscription_history_subscription ON subscription_history(subscription_id);
CREATE INDEX idx_subscription_history_user ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_type ON subscription_history(change_type);
```

### **ROW LEVEL SECURITY POLICIES**
```sql
-- Subscriptions - Users can view their own
CREATE POLICY "Users view own subscriptions" 
ON stripe_subscriptions FOR SELECT 
USING (auth.uid() = user_id);

-- Subscriptions - Service role manages all
CREATE POLICY "Service role manages subscriptions" 
ON stripe_subscriptions FOR ALL 
USING (auth.role() = 'service_role');

-- Plans - Public read access
CREATE POLICY "Public read billing plans" 
ON billing_plans FOR SELECT 
TO public USING (is_active = TRUE);

-- History - Users view own history
CREATE POLICY "Users view own history" 
ON subscription_history FOR SELECT 
USING (auth.uid() = user_id);
```

### **INTEGRATION WITH ORGANIZATIONS**
```sql
-- Function to sync subscription status to organization
CREATE OR REPLACE FUNCTION sync_organization_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Update organization subscription_tier based on subscription
  UPDATE organizations 
  SET subscription_tier = NEW.plan_name,
      updated_at = NOW()
  WHERE id = NEW.organization_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-sync on subscription changes
CREATE TRIGGER trigger_sync_org_subscription
  AFTER INSERT OR UPDATE ON stripe_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_organization_subscription();
```

### **DEFAULT BILLING PLANS DATA**
```sql
-- Insert default plans
INSERT INTO billing_plans (plan_name, display_name, description, stripe_price_id, amount, billing_interval, features, limits) VALUES
('free', 'Free Plan', 'Basic features for getting started', 'price_free', 0, 'month', 
 '["basic_agents", "workspace_access"]', 
 '{"max_agents": 2, "max_workspaces": 1, "max_storage_mb": 100}'),
 
('pro', 'Pro Plan', 'Advanced features for professionals', 'price_pro_monthly', 2900, 'month',
 '["unlimited_agents", "advanced_memory", "integrations", "priority_support"]',
 '{"max_agents": 50, "max_workspaces": 10, "max_storage_mb": 10000}'),
 
('enterprise', 'Enterprise Plan', 'Full features for organizations', 'price_enterprise_monthly', 9900, 'month',
 '["unlimited_everything", "custom_integrations", "dedicated_support", "sso"]',
 '{"max_agents": -1, "max_workspaces": -1, "max_storage_mb": -1}');
```

### **WEBHOOK INTEGRATION FUNCTIONS**
```sql
-- Function to handle subscription updates from webhooks
CREATE OR REPLACE FUNCTION handle_subscription_webhook(
  p_stripe_subscription_id TEXT,
  p_status TEXT,
  p_current_period_start BIGINT,
  p_current_period_end BIGINT,
  p_cancel_at_period_end BOOLEAN DEFAULT FALSE
) RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
BEGIN
  -- Update subscription status
  UPDATE stripe_subscriptions 
  SET 
    status = p_status,
    current_period_start = to_timestamp(p_current_period_start),
    current_period_end = to_timestamp(p_current_period_end),
    cancel_at_period_end = p_cancel_at_period_end,
    updated_at = NOW()
  WHERE stripe_subscription_id = p_stripe_subscription_id
  RETURNING id INTO v_subscription_id;
  
  -- Log the change
  INSERT INTO subscription_history (
    subscription_id, user_id, change_type, new_status, change_reason
  )
  SELECT 
    v_subscription_id, user_id, 'updated', p_status, 'webhook_update'
  FROM stripe_subscriptions 
  WHERE id = v_subscription_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **PERFORMANCE CONSIDERATIONS**
- **Indexes**: Strategic indexing for common queries
- **Partitioning**: Consider partitioning history table by date
- **Archiving**: Archive old subscription history periodically
- **Caching**: Cache active subscriptions in application layer

### **SECURITY CONSIDERATIONS**
- **RLS Policies**: Prevent unauthorized subscription access
- **Service Role**: Only backend functions modify subscriptions
- **Audit Trail**: Complete history of all subscription changes
- **Data Validation**: Constraints prevent invalid data

### **BACKUP INSTRUCTIONS**
Before implementing:
1. **Schema Backup**: `pg_dump --schema-only > pre_subscriptions_backup.sql`
2. **Data Backup**: Export organizations table data
3. **Store**: `docs/plans/stripe_integration/backups/pre_subscriptions/`
4. **Test Restore**: Verify backup can be restored

### **TESTING REQUIREMENTS**
- **Subscription Creation**: Test new subscription flow
- **Plan Changes**: Test upgrades and downgrades
- **Cancellation**: Test subscription cancellation
- **History Tracking**: Verify all changes are logged
- **Organization Sync**: Test subscription_tier updates
- **RLS Policies**: Verify access control
- **Webhook Functions**: Test with mock webhook data

### **DEPENDENCIES**
- **Stripe Customers Table**: Must exist first
- **Organizations Table**: Must have subscription_tier field
- **Stripe Account**: Plans must be configured in Stripe
- **Service Role**: Required for webhook functions

### **ROLLBACK PLAN**
1. **Drop Triggers**: `DROP TRIGGER trigger_sync_org_subscription;`
2. **Drop Functions**: `DROP FUNCTION sync_organization_subscription();`
3. **Drop Tables**: `DROP TABLE subscription_history, billing_plans, stripe_subscriptions CASCADE;`
4. **Restore Schema**: Restore from backup if needed

### **IMPLEMENTATION NOTES**
- **File Size**: Keep each migration under 250 lines
- **Transaction Safety**: Wrap all changes in transactions
- **Error Handling**: Include proper error handling in functions
- **Documentation**: Add comprehensive comments
- **Validation**: Include data validation functions
