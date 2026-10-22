-- Migration: Create Stripe Customers Table
-- Purpose: Link Agentopia users to Stripe customer records
-- Dependencies: auth.users table must exist
-- File: 20250909000001_create_stripe_customers.sql

-- Create stripe_customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  default_payment_method TEXT, -- Stripe payment method ID
  customer_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_user_customer UNIQUE(user_id),
  CONSTRAINT valid_stripe_id CHECK (stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$'),
  CONSTRAINT valid_email CHECK (customer_email ~ '^[^@]+@[^@]+\.[^@]+$')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id 
  ON stripe_customers(user_id);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id 
  ON stripe_customers(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_email 
  ON stripe_customers(customer_email);

-- Enable Row Level Security
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own customer data
CREATE POLICY "Users can view own customer data" 
  ON stripe_customers FOR SELECT 
  USING (auth.uid() = user_id);

-- RLS Policy: Service role can manage all customer data
CREATE POLICY "Service role manages customer data" 
  ON stripe_customers FOR ALL 
  USING (auth.role() = 'service_role');

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to get or create Stripe customer
CREATE OR REPLACE FUNCTION get_or_create_stripe_customer(
  p_user_id UUID,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL
) RETURNS stripe_customers AS $$
DECLARE
  v_customer stripe_customers;
  v_profile RECORD;
BEGIN
  -- Try to find existing customer
  SELECT * INTO v_customer 
  FROM stripe_customers 
  WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN v_customer;
  END IF;
  
  -- Get user profile if customer data not provided
  IF p_customer_email IS NULL OR p_customer_name IS NULL THEN
    SELECT email, full_name INTO v_profile
    FROM auth.users u
    LEFT JOIN profiles p ON u.id = p.id
    WHERE u.id = p_user_id;
  END IF;
  
  -- Create new customer record
  INSERT INTO stripe_customers (
    user_id,
    stripe_customer_id,
    customer_email,
    customer_name
  ) VALUES (
    p_user_id,
    p_stripe_customer_id,
    COALESCE(p_customer_email, v_profile.email),
    COALESCE(p_customer_name, v_profile.full_name)
  ) RETURNING * INTO v_customer;
  
  RETURN v_customer;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON stripe_customers TO authenticated;
GRANT ALL ON stripe_customers TO service_role;

-- Add helpful comments
COMMENT ON TABLE stripe_customers IS 'Links Agentopia users to Stripe customer records for billing';
COMMENT ON COLUMN stripe_customers.stripe_customer_id IS 'Stripe customer ID (cus_...)';
COMMENT ON COLUMN stripe_customers.customer_metadata IS 'Additional Stripe customer metadata';
COMMENT ON COLUMN stripe_customers.default_payment_method IS 'Default Stripe payment method ID';

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250909000001_create_stripe_customers completed successfully';
END $$;
