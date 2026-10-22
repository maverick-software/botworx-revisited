-- Implement Secure OAuth Token Storage using Supabase Vault
-- Migration: 20250119000001_enable_vault_oauth_security.sql
-- Purpose: Set up secure OAuth token storage using existing Supabase Vault integration

-- PHASE 1: Verify Vault is Available
-- Note: Vault is already installed as an integration - no need to create extension

-- Test vault functionality to ensure it's working
DO $$
DECLARE
    test_secret_id UUID;
BEGIN
    -- Test vault functionality using the correct function signature
    test_secret_id := vault.create_secret('test_secret_value', 'test_vault_functionality', 'Test secret for vault verification');
    
    -- Clean up test secret
    DELETE FROM vault.secrets WHERE id = test_secret_id;
    
    RAISE NOTICE 'Vault integration verified and functional';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Vault test failed with error: %', SQLERRM;
    RAISE NOTICE 'Please ensure Vault integration is enabled in your Supabase dashboard';
END $$;

-- PHASE 2: Create Secure OAuth Token Metadata Table
CREATE TABLE IF NOT EXISTS public.user_oauth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider TEXT NOT NULL, -- 'gmail', 'github', etc.
    vault_access_token_id UUID NOT NULL,
    vault_refresh_token_id UUID,
    expires_at TIMESTAMPTZ,
    scopes_granted JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    
    -- Constraints
    UNIQUE(user_id, provider, created_at),
    CHECK (vault_access_token_id IS NOT NULL)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_id ON public.user_oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_provider ON public.user_oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_active ON public.user_oauth_tokens(user_id, provider) WHERE revoked_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.user_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for secure access
CREATE POLICY "Service role can manage OAuth tokens" ON public.user_oauth_tokens
    FOR ALL TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- Block access from other roles
CREATE POLICY "Block public access to OAuth tokens" ON public.user_oauth_tokens
    FOR ALL TO PUBLIC
    USING (FALSE);

-- Add comments for documentation
COMMENT ON TABLE public.user_oauth_tokens IS 'Secure OAuth token storage metadata using Supabase Vault references';
COMMENT ON COLUMN public.user_oauth_tokens.vault_access_token_id IS 'Reference to encrypted access token in vault.secrets';
COMMENT ON COLUMN public.user_oauth_tokens.vault_refresh_token_id IS 'Reference to encrypted refresh token in vault.secrets';

-- PHASE 3: Vault Security Notes
-- Note: Vault schema security is managed by Supabase - we don't need to modify it
-- The vault.secrets table and vault.decrypted_secrets view have appropriate security
-- Our secure wrapper functions will handle access control

DO $$
BEGIN
    RAISE NOTICE 'Vault OAuth security infrastructure created successfully';
END $$; 