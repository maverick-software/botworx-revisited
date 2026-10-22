-- Migration: 20250720170000_create_gmail_configurations_table.sql
-- Purpose: Create the gmail_configurations table and apply RLS policies.

-- Create the table
CREATE TABLE IF NOT EXISTS public.gmail_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_oauth_connection_id UUID NOT NULL REFERENCES public.user_oauth_connections(id) ON DELETE CASCADE,
    security_settings JSONB,
    rate_limit_settings JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on the table
ALTER TABLE public.gmail_configurations ENABLE ROW LEVEL SECURITY;

-- Create the policy
CREATE POLICY "Allow users to manage their own gmail configurations"
ON public.gmail_configurations
FOR ALL
USING (
  auth.uid() = (
    SELECT user_id
    FROM user_oauth_connections
    WHERE id = user_oauth_connection_id
  )
);

-- Add comments for documentation
COMMENT ON TABLE public.gmail_configurations IS 'Stores user-specific configurations for the Gmail integration.';
COMMENT ON POLICY "Allow users to manage their own gmail configurations" ON public.gmail_configurations 
IS 'Users can manage their own Gmail configurations based on the ownership of the related OAuth connection.'; 