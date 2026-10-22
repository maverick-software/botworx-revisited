-- Migration: Create Admin Billing Functions and Views
-- Purpose: Provide comprehensive billing data for admin interfaces
-- Dependencies: All previous Stripe tables
-- File: 20250909000004_create_admin_billing_functions.sql

-- Create admin_settings table for storing configuration
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for admin_settings
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can access admin settings (simplified for now)
CREATE POLICY "Admin only access to settings" 
  ON admin_settings FOR ALL 
  USING (auth.role() = 'service_role');

-- Function to get comprehensive user billing overview
CREATE OR REPLACE FUNCTION get_user_billing_overview()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ,
  subscription JSONB,
  customer JSONB,
  total_paid BIGINT,
  invoice_count BIGINT,
  last_payment TIMESTAMPTZ,
  payment_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    p.full_name,
    u.created_at,
    
    -- Subscription data as JSON
    CASE 
      WHEN ss.id IS NOT NULL THEN 
        jsonb_build_object(
          'id', ss.id,
          'plan_name', ss.plan_name,
          'status', ss.status,
          'billing_amount', ss.billing_amount,
          'billing_interval', ss.billing_interval,
          'current_period_end', ss.current_period_end,
          'cancel_at_period_end', ss.cancel_at_period_end
        )
      ELSE NULL
    END as subscription,
    
    -- Customer data as JSON
    CASE 
      WHEN sc.id IS NOT NULL THEN 
        jsonb_build_object(
          'stripe_customer_id', sc.stripe_customer_id,
          'customer_email', sc.customer_email
        )
      ELSE NULL
    END as customer,
    
    -- Total amount paid
    COALESCE(SUM(si.amount_paid), 0) as total_paid,
    
    -- Invoice count
    COUNT(si.id) as invoice_count,
    
    -- Last payment date
    MAX(si.paid_at) as last_payment,
    
    -- Payment status
    CASE 
      WHEN ss.status = 'active' THEN 'current'
      WHEN ss.status = 'past_due' THEN 'past_due'
      WHEN ss.status = 'canceled' THEN 'canceled'
      ELSE 'none'
    END as payment_status
    
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  LEFT JOIN stripe_customers sc ON u.id = sc.user_id
  LEFT JOIN stripe_subscriptions ss ON u.id = ss.user_id AND ss.status IN ('active', 'past_due', 'canceled')
  LEFT JOIN stripe_invoices si ON u.id = si.user_id AND si.status = 'paid'
  GROUP BY u.id, u.email, p.full_name, u.created_at, ss.id, ss.plan_name, ss.status, 
           ss.billing_amount, ss.billing_interval, ss.current_period_end, ss.cancel_at_period_end,
           sc.id, sc.stripe_customer_id, sc.customer_email
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get billing statistics
CREATE OR REPLACE FUNCTION get_billing_statistics()
RETURNS TABLE (
  total_users BIGINT,
  active_subscriptions BIGINT,
  past_due_count BIGINT,
  monthly_revenue BIGINT,
  churn_rate NUMERIC
) AS $$
DECLARE
  v_total_users BIGINT;
  v_active_subs BIGINT;
  v_past_due BIGINT;
  v_monthly_revenue BIGINT;
  v_churn_rate NUMERIC;
BEGIN
  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM auth.users;
  
  -- Active subscriptions
  SELECT COUNT(*) INTO v_active_subs 
  FROM stripe_subscriptions 
  WHERE status = 'active';
  
  -- Past due subscriptions
  SELECT COUNT(*) INTO v_past_due 
  FROM stripe_subscriptions 
  WHERE status = 'past_due';
  
  -- Monthly revenue (sum of active subscription amounts)
  SELECT COALESCE(SUM(billing_amount), 0) INTO v_monthly_revenue
  FROM stripe_subscriptions 
  WHERE status = 'active' AND billing_interval = 'month';
  
  -- Simple churn rate calculation (canceled this month / total active)
  SELECT 
    CASE 
      WHEN v_active_subs > 0 THEN 
        (SELECT COUNT(*)::NUMERIC FROM stripe_subscriptions 
         WHERE status = 'canceled' 
         AND canceled_at >= date_trunc('month', CURRENT_DATE)) / v_active_subs * 100
      ELSE 0
    END INTO v_churn_rate;
  
  RETURN QUERY SELECT v_total_users, v_active_subs, v_past_due, v_monthly_revenue, v_churn_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user subscription details
CREATE OR REPLACE FUNCTION get_user_subscription_details(p_user_id UUID)
RETURNS TABLE (
  subscription_info JSONB,
  invoice_history JSONB,
  payment_methods JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Subscription information
    CASE 
      WHEN ss.id IS NOT NULL THEN 
        jsonb_build_object(
          'id', ss.id,
          'stripe_subscription_id', ss.stripe_subscription_id,
          'plan_name', ss.plan_name,
          'status', ss.status,
          'billing_amount', ss.billing_amount,
          'billing_interval', ss.billing_interval,
          'current_period_start', ss.current_period_start,
          'current_period_end', ss.current_period_end,
          'cancel_at_period_end', ss.cancel_at_period_end,
          'canceled_at', ss.canceled_at,
          'payment_method_brand', ss.payment_method_brand,
          'payment_method_last4', ss.payment_method_last4
        )
      ELSE NULL
    END as subscription_info,
    
    -- Invoice history
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', si.id,
          'stripe_invoice_id', si.stripe_invoice_id,
          'status', si.status,
          'amount_due', si.amount_due,
          'amount_paid', si.amount_paid,
          'total', si.total,
          'invoice_created', si.invoice_created,
          'paid_at', si.paid_at,
          'invoice_pdf', si.invoice_pdf
        ) ORDER BY si.invoice_created DESC
      ) FILTER (WHERE si.id IS NOT NULL),
      '[]'::jsonb
    ) as invoice_history,
    
    -- Payment methods (from customer)
    CASE 
      WHEN sc.id IS NOT NULL THEN 
        jsonb_build_object(
          'default_payment_method', sc.default_payment_method,
          'customer_metadata', sc.customer_metadata
        )
      ELSE NULL
    END as payment_methods
    
  FROM auth.users u
  LEFT JOIN stripe_customers sc ON u.id = sc.user_id
  LEFT JOIN stripe_subscriptions ss ON u.id = ss.user_id
  LEFT JOIN stripe_invoices si ON u.id = si.user_id
  WHERE u.id = p_user_id
  GROUP BY u.id, ss.id, ss.stripe_subscription_id, ss.plan_name, ss.status, 
           ss.billing_amount, ss.billing_interval, ss.current_period_start, 
           ss.current_period_end, ss.cancel_at_period_end, ss.canceled_at,
           ss.payment_method_brand, ss.payment_method_last4,
           sc.id, sc.default_payment_method, sc.customer_metadata;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get revenue analytics
CREATE OR REPLACE FUNCTION get_revenue_analytics(p_start_date DATE DEFAULT NULL, p_end_date DATE DEFAULT NULL)
RETURNS TABLE (
  period_date DATE,
  daily_revenue BIGINT,
  new_subscriptions BIGINT,
  canceled_subscriptions BIGINT,
  active_subscriptions BIGINT
) AS $$
DECLARE
  v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
  v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(v_start_date, v_end_date, '1 day'::interval)::date as period_date
  ),
  daily_stats AS (
    SELECT 
      d.period_date,
      
      -- Daily revenue from paid invoices
      COALESCE(SUM(si.amount_paid) FILTER (WHERE si.paid_at::date = d.period_date), 0) as daily_revenue,
      
      -- New subscriptions
      COUNT(ss.id) FILTER (WHERE ss.created_at::date = d.period_date) as new_subscriptions,
      
      -- Canceled subscriptions
      COUNT(ss.id) FILTER (WHERE ss.canceled_at::date = d.period_date) as canceled_subscriptions,
      
      -- Active subscriptions at end of day
      COUNT(ss.id) FILTER (WHERE 
        ss.created_at::date <= d.period_date 
        AND (ss.canceled_at IS NULL OR ss.canceled_at::date > d.period_date)
        AND ss.status = 'active'
      ) as active_subscriptions
      
    FROM date_series d
    LEFT JOIN stripe_invoices si ON si.paid_at::date = d.period_date
    LEFT JOIN stripe_subscriptions ss ON TRUE
    GROUP BY d.period_date
  )
  SELECT * FROM daily_stats ORDER BY period_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_created ON stripe_subscriptions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_paid_at ON stripe_invoices(paid_at) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_canceled_at ON stripe_subscriptions(canceled_at) WHERE canceled_at IS NOT NULL;

-- Grant permissions to service role
GRANT ALL ON admin_settings TO service_role;
GRANT EXECUTE ON FUNCTION get_user_billing_overview() TO service_role;
GRANT EXECUTE ON FUNCTION get_billing_statistics() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_subscription_details(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_revenue_analytics(DATE, DATE) TO service_role;

-- Create trigger for admin_settings updated_at
CREATE TRIGGER trigger_admin_settings_updated_at
  BEFORE UPDATE ON admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE admin_settings IS 'Stores admin configuration settings including Stripe config';
COMMENT ON FUNCTION get_user_billing_overview() IS 'Returns comprehensive billing overview for all users';
COMMENT ON FUNCTION get_billing_statistics() IS 'Returns key billing metrics and statistics';
COMMENT ON FUNCTION get_user_subscription_details(UUID) IS 'Returns detailed subscription info for a specific user';
COMMENT ON FUNCTION get_revenue_analytics(DATE, DATE) IS 'Returns daily revenue and subscription analytics';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250909000004_create_admin_billing_functions completed successfully';
END $$;
