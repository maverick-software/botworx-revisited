-- Migration: Add agent classification to integrations
-- Purpose: Classify integrations as 'tool' or 'channel' for agent usage

-- Add agent_classification column to integrations table
ALTER TABLE integrations 
ADD COLUMN IF NOT EXISTS agent_classification TEXT DEFAULT 'tool';

-- Create enum for agent classification (optional, for better type safety)
DO $$ BEGIN
    CREATE TYPE integration_agent_classification_enum AS ENUM ('tool', 'channel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- First, drop the default value to avoid casting issues
ALTER TABLE integrations 
ALTER COLUMN agent_classification DROP DEFAULT;

-- Update the column to use the enum
ALTER TABLE integrations 
ALTER COLUMN agent_classification TYPE integration_agent_classification_enum 
USING agent_classification::integration_agent_classification_enum;

-- Set the new default value with the enum type
ALTER TABLE integrations 
ALTER COLUMN agent_classification SET DEFAULT 'tool'::integration_agent_classification_enum;

-- Set NOT NULL constraint
ALTER TABLE integrations 
ALTER COLUMN agent_classification SET NOT NULL;

-- Update existing integrations to classify them properly
UPDATE integrations 
SET agent_classification = 'channel'::integration_agent_classification_enum
WHERE name IN ('Gmail', 'Slack', 'Discord', 'Email');

-- All other integrations remain classified as 'tool' (default)
-- This includes: REST API, GraphQL, Webhooks, PostgreSQL, MongoDB, MySQL, 
-- OAuth 2.0, JWT Tokens, SAML, AWS, Azure, Google Cloud, Zapier, GitHub Actions, Scheduled Tasks

-- Add index for better performance when filtering by classification
CREATE INDEX IF NOT EXISTS idx_integrations_agent_classification ON integrations(agent_classification);

-- Add comment for documentation
COMMENT ON COLUMN integrations.agent_classification IS 'Classification for agent usage: tool (functional/utility) or channel (communication)'; 