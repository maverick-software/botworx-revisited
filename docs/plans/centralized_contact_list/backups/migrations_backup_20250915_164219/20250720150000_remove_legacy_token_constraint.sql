-- Migration: 20250720150000_remove_legacy_token_constraint.sql
-- Purpose: Remove the legacy chk_oauth_token_consistency constraint from the user_oauth_connections table.
-- This constraint is no longer valid as tokens are now stored in the new user_oauth_tokens table
-- and Supabase Vault, making the old check obsolete and causing errors during the new connection flow.

ALTER TABLE public.user_oauth_connections
DROP CONSTRAINT IF EXISTS chk_oauth_token_consistency;

COMMENT ON TABLE public.user_oauth_connections IS 'Legacy token consistency check removed to support the new Vault-based token storage system.'; 