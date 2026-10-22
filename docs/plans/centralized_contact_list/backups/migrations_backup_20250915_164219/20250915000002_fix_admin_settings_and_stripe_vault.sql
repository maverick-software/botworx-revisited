-- Migration: Fix Admin Settings RLS and Implement Proper Stripe Vault Integration
-- Date: 2025-09-15
-- Purpose: Fix 403/406 errors and implement proper vault storage for Stripe credentials

-- First, fix admin_settings RLS policies to allow proper admin access
DROP POLICY IF EXISTS "Admin only access to settings" ON admin_settings;

-- Create proper admin access policy that checks user roles
CREATE POLICY "Admin users can access settings" ON admin_settings
  FOR ALL USING (
    (SELECT user_has_role(auth.uid(), 'admin')) = true
  );

-- Also allow service role for system operations
CREATE POLICY "Service role can access settings" ON admin_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Create admin_integration_credentials table for secure admin credential storage
CREATE TABLE IF NOT EXISTS admin_integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_type TEXT NOT NULL, -- 'stripe', 'paypal', etc.
  credential_name TEXT NOT NULL, -- 'secret_key', 'webhook_secret', 'oauth_token'
  vault_secret_id TEXT NOT NULL, -- UUID from Supabase Vault
  connection_method TEXT DEFAULT 'manual', -- 'manual', 'oauth'
  connection_status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
  metadata JSONB DEFAULT '{}', -- Additional configuration data
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique credential names per integration type
  UNIQUE(integration_type, credential_name),
  
  -- Security constraint: vault_secret_id must be a valid UUID
  CONSTRAINT chk_vault_secret_uuid CHECK (
    vault_secret_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
);

-- Enable RLS on admin_integration_credentials
ALTER TABLE admin_integration_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_integration_credentials
CREATE POLICY "Admin users can manage admin credentials" ON admin_integration_credentials
  FOR ALL USING (
    (SELECT user_has_role(auth.uid(), 'admin')) = true
  );

CREATE POLICY "Service role can manage admin credentials" ON admin_integration_credentials
  FOR ALL USING (auth.role() = 'service_role');

-- Create trigger for updated_at
CREATE TRIGGER trigger_admin_integration_credentials_updated_at
  BEFORE UPDATE ON admin_integration_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_integration_credentials_type ON admin_integration_credentials(integration_type);
CREATE INDEX IF NOT EXISTS idx_admin_integration_credentials_status ON admin_integration_credentials(connection_status);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON admin_integration_credentials TO authenticated;
GRANT ALL ON admin_integration_credentials TO service_role;

-- Function to safely get admin credential from vault
CREATE OR REPLACE FUNCTION get_admin_credential(
  p_integration_type TEXT,
  p_credential_name TEXT
) RETURNS TEXT AS $$
DECLARE
  vault_id TEXT;
  credential_value TEXT;
BEGIN
  -- Only admins and service role can call this function
  IF auth.role() != 'service_role' AND NOT (SELECT user_has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Insufficient privileges to access admin credentials';
  END IF;

  -- Get vault secret ID
  SELECT vault_secret_id INTO vault_id
  FROM admin_integration_credentials
  WHERE integration_type = p_integration_type
    AND credential_name = p_credential_name
    AND connection_status = 'active';

  IF vault_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Decrypt from vault
  SELECT vault_decrypt(vault_id) INTO credential_value;
  
  RETURN credential_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely store admin credential in vault
CREATE OR REPLACE FUNCTION store_admin_credential(
  p_integration_type TEXT,
  p_credential_name TEXT,
  p_credential_value TEXT,
  p_connection_method TEXT DEFAULT 'manual'
) RETURNS UUID AS $$
DECLARE
  vault_id UUID;
  credential_id UUID;
  secret_name TEXT;
  secret_description TEXT;
BEGIN
  -- Only admins and service role can call this function
  IF auth.role() != 'service_role' AND NOT (SELECT user_has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Insufficient privileges to store admin credentials';
  END IF;

  -- Generate standardized secret name and description
  secret_name := p_integration_type || '_' || p_credential_name || '_admin_' || extract(epoch from now())::bigint;
  secret_description := p_integration_type || ' ' || p_credential_name || ' for admin - Created: ' || now()::text;

  -- Store in vault
  SELECT create_vault_secret(p_credential_value, secret_name, secret_description) INTO vault_id;

  -- Store credential reference
  INSERT INTO admin_integration_credentials (
    integration_type,
    credential_name,
    vault_secret_id,
    connection_method,
    created_by,
    updated_by
  ) VALUES (
    p_integration_type,
    p_credential_name,
    vault_id::text,
    p_connection_method,
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  )
  ON CONFLICT (integration_type, credential_name) 
  DO UPDATE SET
    vault_secret_id = vault_id::text,
    connection_method = p_connection_method,
    connection_status = 'active',
    updated_by = COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    updated_at = NOW()
  RETURNING id INTO credential_id;

  RETURN credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on the new functions
GRANT EXECUTE ON FUNCTION get_admin_credential(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION store_admin_credential(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Add helpful comments
COMMENT ON TABLE admin_integration_credentials IS 'Secure storage for admin integration credentials using Supabase Vault';
COMMENT ON FUNCTION get_admin_credential(TEXT, TEXT) IS 'Safely retrieve admin credentials from vault (admin/service role only)';
COMMENT ON FUNCTION store_admin_credential(TEXT, TEXT, TEXT, TEXT) IS 'Safely store admin credentials in vault (admin/service role only)';

-- Migrate existing Stripe configuration if it exists
DO $$
DECLARE
  existing_config JSONB;
  stripe_secret TEXT;
  stripe_webhook TEXT;
BEGIN
  -- Check if there's existing Stripe config in admin_settings
  SELECT setting_value INTO existing_config
  FROM admin_settings
  WHERE setting_key = 'stripe_config';

  IF existing_config IS NOT NULL THEN
    RAISE NOTICE 'Found existing Stripe configuration, migration may be needed';
    -- Note: Manual migration of secrets would be needed if they exist in plain text
  END IF;
END $$;

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250915000002_fix_admin_settings_and_stripe_vault completed successfully';
  RAISE NOTICE 'Admin settings RLS policies updated';
  RAISE NOTICE 'Admin integration credentials table created with vault storage';
  RAISE NOTICE 'Secure credential management functions created';
END $$;
