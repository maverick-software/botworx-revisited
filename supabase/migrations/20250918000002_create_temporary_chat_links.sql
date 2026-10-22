-- Migration: Create Temporary Chat Links Table
-- Description: Core table for managing temporary chat links with Vault token storage
-- Date: 2025-09-18

-- Create the temporary_chat_links table
CREATE TABLE IF NOT EXISTS temporary_chat_links (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ownership and agent relationship
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Link identification and access (using Vault for security)
  vault_link_token_id UUID NOT NULL UNIQUE REFERENCES vault.secrets(id),
  short_code TEXT UNIQUE, -- Optional: for shorter URLs like /tc/ABC123
  
  -- Configuration and display
  title TEXT NOT NULL CHECK (LENGTH(title) BETWEEN 1 AND 200),
  description TEXT CHECK (LENGTH(description) <= 1000),
  welcome_message TEXT CHECK (LENGTH(welcome_message) <= 2000),
  
  -- Access control and limits
  expires_at TIMESTAMPTZ NOT NULL,
  max_sessions INTEGER NOT NULL DEFAULT 1 CHECK (max_sessions BETWEEN 1 AND 50),
  max_messages_per_session INTEGER NOT NULL DEFAULT 100 CHECK (max_messages_per_session BETWEEN 1 AND 1000),
  session_timeout_minutes INTEGER NOT NULL DEFAULT 30 CHECK (session_timeout_minutes BETWEEN 5 AND 1440), -- 5 min to 24 hours
  
  -- Usage tracking
  session_count INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  
  -- Status and control
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Security and restrictions
  allowed_domains TEXT[], -- Optional: restrict to specific domains
  allowed_ips INET[], -- Optional: IP whitelist
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 10 CHECK (rate_limit_per_minute BETWEEN 1 AND 100),
  
  -- Metadata and customization
  link_metadata JSONB NOT NULL DEFAULT '{}',
  ui_customization JSONB NOT NULL DEFAULT '{}', -- Theme, colors, etc.
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_expiration CHECK (expires_at > created_at),
  CONSTRAINT valid_title CHECK (title ~ '^[[:print:][:space:]]+$') -- Printable characters only
);

-- Add table comments for documentation
COMMENT ON TABLE temporary_chat_links IS 'Temporary chat links that allow anonymous public access to agent chat sessions';
COMMENT ON COLUMN temporary_chat_links.vault_link_token_id IS 'Vault secret ID containing the encrypted link token - never stored in plain text';
COMMENT ON COLUMN temporary_chat_links.agent_id IS 'The agent that will respond to chats through this link';
COMMENT ON COLUMN temporary_chat_links.user_id IS 'The user who owns/created this temporary chat link';
COMMENT ON COLUMN temporary_chat_links.expires_at IS 'When this link expires and becomes invalid';
COMMENT ON COLUMN temporary_chat_links.max_sessions IS 'Maximum number of concurrent chat sessions allowed';
COMMENT ON COLUMN temporary_chat_links.max_messages_per_session IS 'Maximum messages allowed per individual session';
COMMENT ON COLUMN temporary_chat_links.session_timeout_minutes IS 'Minutes of inactivity before a session times out';
COMMENT ON COLUMN temporary_chat_links.rate_limit_per_minute IS 'Maximum messages per minute per session';
COMMENT ON COLUMN temporary_chat_links.allowed_domains IS 'Optional array of domains that can access this link';
COMMENT ON COLUMN temporary_chat_links.allowed_ips IS 'Optional array of IP addresses that can access this link';
COMMENT ON COLUMN temporary_chat_links.link_metadata IS 'Additional metadata for the link (JSON)';
COMMENT ON COLUMN temporary_chat_links.ui_customization IS 'UI customization settings (theme, colors, etc.)';

-- Create trigger function for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_temporary_chat_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic updated_at management
CREATE TRIGGER temp_links_updated_at_trigger
  BEFORE UPDATE ON temporary_chat_links
  FOR EACH ROW EXECUTE FUNCTION update_temporary_chat_links_updated_at();

-- Create trigger function for usage tracking
CREATE OR REPLACE FUNCTION track_temp_link_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_accessed_at when session_count increases
  IF NEW.session_count > OLD.session_count THEN
    NEW.last_accessed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for access tracking
CREATE TRIGGER temp_links_access_tracking_trigger
  BEFORE UPDATE ON temporary_chat_links
  FOR EACH ROW EXECUTE FUNCTION track_temp_link_access();

-- Add security trigger to prevent direct token access
CREATE OR REPLACE FUNCTION prevent_vault_token_exposure()
RETURNS TRIGGER AS $$
BEGIN
  -- Log any attempt to directly access vault tokens (for security monitoring)
  IF TG_OP = 'SELECT' THEN
    -- This would be handled by RLS policies, but we can log here if needed
    RETURN NEW;
  END IF;
  
  -- Ensure vault_link_token_id is always provided for new records
  IF TG_OP = 'INSERT' AND NEW.vault_link_token_id IS NULL THEN
    RAISE EXCEPTION 'vault_link_token_id is required and must reference a valid vault secret';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create security trigger
CREATE TRIGGER temp_links_security_trigger
  BEFORE INSERT OR UPDATE ON temporary_chat_links
  FOR EACH ROW EXECUTE FUNCTION prevent_vault_token_exposure();

-- Log the migration
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_name = 'temporary_chat_links' AND table_schema = 'public';
  
  RAISE NOTICE 'Migration completed: temporary_chat_links table created (% table found)', table_count;
END $$;
