-- Migration: Create Stripe Invoices and Orders Tables
-- Purpose: Track Stripe invoices, payments, and one-time orders
-- Dependencies: stripe_customers, stripe_subscriptions tables
-- File: 20250909000003_create_stripe_invoices_orders.sql

-- Create stripe_invoices table
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_subscription_id TEXT REFERENCES stripe_subscriptions(stripe_subscription_id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Invoice details
  invoice_number TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'draft', 'open', 'paid', 'uncollectible', 'void'
  )),
  
  -- Amount information (in cents)
  amount_due INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  amount_remaining INTEGER NOT NULL DEFAULT 0,
  subtotal INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  tax INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  
  -- Dates (Stripe timestamps converted to TIMESTAMPTZ)
  invoice_created TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Invoice URLs and metadata
  invoice_pdf TEXT,
  hosted_invoice_url TEXT,
  billing_reason TEXT,
  description TEXT,
  invoice_metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_stripe_invoice_id 
    CHECK (stripe_invoice_id ~ '^in_[a-zA-Z0-9]+$'),
  CONSTRAINT valid_amounts CHECK (
    amount_due >= 0 AND amount_paid >= 0 AND amount_remaining >= 0 AND
    subtotal >= 0 AND total >= 0
  )
);

-- Create stripe_orders table for one-time payments
CREATE TABLE IF NOT EXISTS stripe_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_checkout_session_id TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL REFERENCES stripe_customers(stripe_customer_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Order details
  order_type TEXT NOT NULL DEFAULT 'one_time' CHECK (order_type IN ('one_time', 'token_purchase')),
  description TEXT,
  
  -- Amount information (in cents)
  amount_subtotal INTEGER NOT NULL,
  amount_total INTEGER NOT NULL,
  amount_tax INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'usd',
  
  -- Payment status
  payment_status TEXT NOT NULL CHECK (payment_status IN (
    'pending', 'processing', 'succeeded', 'canceled', 'failed'
  )),
  order_status TEXT DEFAULT 'pending' CHECK (order_status IN (
    'pending', 'completed', 'canceled', 'refunded', 'partially_refunded'
  )),
  
  -- Payment method information
  payment_method_type TEXT,
  payment_method_brand TEXT,
  payment_method_last4 TEXT,
  
  -- Fulfillment information
  fulfilled_at TIMESTAMPTZ,
  fulfillment_data JSONB DEFAULT '{}',
  
  -- Metadata and timestamps
  order_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_stripe_session_id 
    CHECK (stripe_checkout_session_id ~ '^cs_[a-zA-Z0-9]+$'),
  CONSTRAINT valid_stripe_payment_intent_id 
    CHECK (stripe_payment_intent_id ~ '^pi_[a-zA-Z0-9]+$'),
  CONSTRAINT valid_order_amounts CHECK (
    amount_subtotal >= 0 AND amount_total >= 0 AND amount_tax >= 0
  )
);

-- Create payment_events table for detailed payment tracking
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'payment_created', 'payment_succeeded', 'payment_failed', 
    'payment_canceled', 'refund_created', 'refund_succeeded'
  )),
  
  -- Related records
  stripe_invoice_id TEXT REFERENCES stripe_invoices(stripe_invoice_id),
  stripe_order_id UUID REFERENCES stripe_orders(id),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event details
  stripe_event_id TEXT,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  payment_method_type TEXT,
  failure_reason TEXT,
  
  -- Metadata
  event_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_customer_id ON stripe_invoices(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_subscription_id ON stripe_invoices(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_user_id ON stripe_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_created ON stripe_invoices(invoice_created);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_due_date ON stripe_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_stripe_orders_customer_id ON stripe_orders(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_user_id ON stripe_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_payment_status ON stripe_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_order_status ON stripe_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_stripe_orders_created ON stripe_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type ON payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_invoice ON payment_events(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(stripe_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON payment_events(created_at);

-- Enable Row Level Security
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stripe_invoices
CREATE POLICY "Users view own invoices" 
  ON stripe_invoices FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages invoices" 
  ON stripe_invoices FOR ALL 
  USING (auth.role() = 'service_role');

-- RLS Policies for stripe_orders
CREATE POLICY "Users view own orders" 
  ON stripe_orders FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages orders" 
  ON stripe_orders FOR ALL 
  USING (auth.role() = 'service_role');

-- RLS Policies for payment_events
CREATE POLICY "Users view own payment events" 
  ON payment_events FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages payment events" 
  ON payment_events FOR ALL 
  USING (auth.role() = 'service_role');

-- Create updated_at triggers
CREATE TRIGGER trigger_stripe_invoices_updated_at
  BEFORE UPDATE ON stripe_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_stripe_orders_updated_at
  BEFORE UPDATE ON stripe_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to handle invoice webhook events
CREATE OR REPLACE FUNCTION handle_invoice_webhook(
  p_stripe_invoice_id TEXT,
  p_stripe_customer_id TEXT,
  p_status TEXT,
  p_amount_due INTEGER,
  p_amount_paid INTEGER,
  p_total INTEGER,
  p_invoice_created BIGINT,
  p_stripe_subscription_id TEXT DEFAULT NULL,
  p_period_start BIGINT DEFAULT NULL,
  p_period_end BIGINT DEFAULT NULL,
  p_paid_at BIGINT DEFAULT NULL,
  p_invoice_pdf TEXT DEFAULT NULL,
  p_hosted_invoice_url TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user_id from customer
  SELECT user_id INTO v_user_id
  FROM stripe_customers
  WHERE stripe_customer_id = p_stripe_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_stripe_customer_id;
  END IF;
  
  -- Upsert invoice record
  INSERT INTO stripe_invoices (
    stripe_invoice_id,
    stripe_customer_id,
    stripe_subscription_id,
    user_id,
    status,
    amount_due,
    amount_paid,
    amount_remaining,
    total,
    invoice_created,
    period_start,
    period_end,
    paid_at,
    invoice_pdf,
    hosted_invoice_url
  ) VALUES (
    p_stripe_invoice_id,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    v_user_id,
    p_status,
    p_amount_due,
    p_amount_paid,
    p_amount_due - p_amount_paid,
    p_total,
    to_timestamp(p_invoice_created),
    CASE WHEN p_period_start IS NOT NULL THEN to_timestamp(p_period_start) ELSE NULL END,
    CASE WHEN p_period_end IS NOT NULL THEN to_timestamp(p_period_end) ELSE NULL END,
    CASE WHEN p_paid_at IS NOT NULL THEN to_timestamp(p_paid_at) ELSE NULL END,
    p_invoice_pdf,
    p_hosted_invoice_url
  )
  ON CONFLICT (stripe_invoice_id) DO UPDATE SET
    status = EXCLUDED.status,
    amount_due = EXCLUDED.amount_due,
    amount_paid = EXCLUDED.amount_paid,
    amount_remaining = EXCLUDED.amount_remaining,
    paid_at = EXCLUDED.paid_at,
    invoice_pdf = EXCLUDED.invoice_pdf,
    hosted_invoice_url = EXCLUDED.hosted_invoice_url,
    updated_at = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle order completion
CREATE OR REPLACE FUNCTION complete_stripe_order(
  p_checkout_session_id TEXT,
  p_payment_intent_id TEXT,
  p_customer_id TEXT,
  p_amount_total INTEGER,
  p_payment_status TEXT DEFAULT 'succeeded'
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_order_id UUID;
BEGIN
  -- Get user_id from customer
  SELECT user_id INTO v_user_id
  FROM stripe_customers
  WHERE stripe_customer_id = p_customer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found: %', p_customer_id;
  END IF;
  
  -- Create or update order
  INSERT INTO stripe_orders (
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_customer_id,
    user_id,
    amount_subtotal,
    amount_total,
    payment_status,
    order_status
  ) VALUES (
    p_checkout_session_id,
    p_payment_intent_id,
    p_customer_id,
    v_user_id,
    p_amount_total,
    p_amount_total,
    p_payment_status,
    CASE WHEN p_payment_status = 'succeeded' THEN 'completed' ELSE 'pending' END
  )
  ON CONFLICT (stripe_checkout_session_id) DO UPDATE SET
    payment_status = EXCLUDED.payment_status,
    order_status = EXCLUDED.order_status,
    updated_at = NOW()
  RETURNING id INTO v_order_id;
  
  -- Log payment event
  INSERT INTO payment_events (
    event_type,
    stripe_order_id,
    user_id,
    amount,
    payment_method_type
  ) VALUES (
    CASE WHEN p_payment_status = 'succeeded' THEN 'payment_succeeded' ELSE 'payment_created' END,
    v_order_id,
    v_user_id,
    p_amount_total,
    'card'
  );
  
  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON stripe_invoices, stripe_orders, payment_events TO authenticated;
GRANT ALL ON stripe_invoices, stripe_orders, payment_events TO service_role;

-- Add helpful comments
COMMENT ON TABLE stripe_invoices IS 'Tracks Stripe invoices for subscriptions and billing';
COMMENT ON TABLE stripe_orders IS 'Tracks one-time payments and orders through Stripe';
COMMENT ON TABLE payment_events IS 'Detailed log of all payment-related events';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250909000003_create_stripe_invoices_orders completed successfully';
END $$;
