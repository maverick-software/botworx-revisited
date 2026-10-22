-- Migration: Add unique constraint to gmail_configurations table
-- Date: January 31, 2025
-- Purpose: Fix ON CONFLICT error in gmail-oauth function by adding unique constraint on user_oauth_connection_id

BEGIN;

-- Add unique constraint on user_oauth_connection_id to support upsert operations
ALTER TABLE public.gmail_configurations 
ADD CONSTRAINT gmail_configurations_user_oauth_connection_id_key 
UNIQUE (user_oauth_connection_id);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT gmail_configurations_user_oauth_connection_id_key ON public.gmail_configurations 
IS 'Ensures one Gmail configuration per OAuth connection, enables upsert operations';

COMMIT;
