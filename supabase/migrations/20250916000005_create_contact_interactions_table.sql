-- Migration: Create Contact Interactions Table
-- Purpose: Track all communication interactions with contacts
-- Dependencies: contacts, agents, contact_communication_channels tables
-- File: 20250916000005_create_contact_interactions_table.sql

-- Create contact interactions table
CREATE TABLE IF NOT EXISTS contact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Interaction details
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'message_sent', 'message_received', 'call_made', 'call_received', 
    'meeting_scheduled', 'meeting_completed', 'email_sent', 'email_received',
    'note_added', 'status_changed', 'contact_created', 'contact_updated',
    'whatsapp_sent', 'whatsapp_received', 'telegram_sent', 'telegram_received',
    'slack_sent', 'slack_received', 'discord_sent', 'discord_received',
    'sms_sent', 'sms_received', 'voice_call', 'video_call'
  )),
  
  -- Communication channel information
  channel_type TEXT CHECK (channel_type IN (
    'email', 'phone', 'mobile', 'whatsapp', 'telegram', 
    'slack', 'discord', 'teams', 'sms', 'voice', 'video', 'in_person'
  )),
  channel_identifier TEXT, -- Specific channel used (email address, phone number, etc.)
  
  -- Content and metadata
  interaction_summary TEXT,
  full_content_vault_id TEXT, -- Supabase Vault ID for encrypted full content
  interaction_metadata JSONB DEFAULT '{}',
  
  -- External system references
  external_message_id TEXT, -- ID from external communication system
  external_thread_id TEXT, -- Thread/conversation ID from external system
  external_platform_data JSONB DEFAULT '{}', -- Platform-specific metadata
  
  -- Message/content details
  subject TEXT, -- For emails, meeting titles, etc.
  message_preview TEXT, -- First 200 chars for quick display
  content_type TEXT DEFAULT 'text' CHECK (content_type IN (
    'text', 'html', 'markdown', 'rich_text', 'attachment', 'voice', 'video', 'image'
  )),
  
  -- Attachments and media
  has_attachments BOOLEAN DEFAULT FALSE,
  attachment_count INTEGER DEFAULT 0,
  attachment_metadata JSONB DEFAULT '{}',
  
  -- Status tracking
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN (
    'pending', 'sent', 'delivered', 'read', 'failed', 'bounced', 'blocked'
  )),
  read_receipt BOOLEAN DEFAULT FALSE,
  
  -- Interaction direction and context
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  interaction_context TEXT CHECK (interaction_context IN (
    'manual', 'automated', 'scheduled', 'response', 'follow_up', 'broadcast'
  )),
  
  -- Timing information
  interaction_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  response_requested BOOLEAN DEFAULT FALSE,
  response_deadline TIMESTAMPTZ,
  
  -- Quality and engagement metrics
  engagement_score INTEGER CHECK (engagement_score BETWEEN 1 AND 10),
  sentiment_score DECIMAL(3,2) CHECK (sentiment_score BETWEEN -1.00 AND 1.00),
  importance_level TEXT DEFAULT 'normal' CHECK (importance_level IN (
    'low', 'normal', 'high', 'urgent'
  )),
  
  -- Follow-up and task management
  requires_follow_up BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMPTZ,
  follow_up_notes TEXT,
  is_follow_up_to UUID REFERENCES contact_interactions(id),
  
  -- Privacy and compliance
  is_gdpr_relevant BOOLEAN DEFAULT TRUE,
  retention_date TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_interaction_summary CHECK (
    interaction_summary IS NULL OR LENGTH(interaction_summary) <= 1000
  ),
  CONSTRAINT valid_subject CHECK (
    subject IS NULL OR LENGTH(subject) <= 500
  ),
  CONSTRAINT valid_message_preview CHECK (
    message_preview IS NULL OR LENGTH(message_preview) <= 200
  ),
  CONSTRAINT valid_follow_up_notes CHECK (
    follow_up_notes IS NULL OR LENGTH(follow_up_notes) <= 2000
  ),
  CONSTRAINT valid_attachment_count CHECK (
    attachment_count >= 0
  ),
  CONSTRAINT channel_consistency CHECK (
    (channel_type IS NOT NULL AND channel_identifier IS NOT NULL) OR
    (channel_type IS NULL AND channel_identifier IS NULL)
  ),
  CONSTRAINT delivery_timing_consistency CHECK (
    (delivery_status IN ('delivered', 'read') AND delivered_at IS NOT NULL) OR
    (delivery_status NOT IN ('delivered', 'read'))
  ),
  CONSTRAINT read_timing_consistency CHECK (
    (delivery_status = 'read' AND read_at IS NOT NULL) OR
    (delivery_status != 'read')
  )
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_agent ON contact_interactions(agent_id);
CREATE INDEX IF NOT EXISTS idx_interactions_user ON contact_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON contact_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_interactions_channel ON contact_interactions(channel_type);
CREATE INDEX IF NOT EXISTS idx_interactions_direction ON contact_interactions(direction);
CREATE INDEX IF NOT EXISTS idx_interactions_delivery ON contact_interactions(delivery_status);
CREATE INDEX IF NOT EXISTS idx_interactions_date ON contact_interactions(interaction_at);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON contact_interactions(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_interactions_contact_date ON contact_interactions(contact_id, interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_agent_date ON contact_interactions(agent_id, interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_user_date ON contact_interactions(user_id, interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_contact_type ON contact_interactions(contact_id, interaction_type);

-- Partial indexes for specific scenarios
CREATE INDEX IF NOT EXISTS idx_interactions_pending ON contact_interactions(contact_id, interaction_at) 
  WHERE delivery_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_interactions_failed ON contact_interactions(contact_id, interaction_at) 
  WHERE delivery_status IN ('failed', 'bounced');
CREATE INDEX IF NOT EXISTS idx_interactions_follow_up ON contact_interactions(follow_up_date) 
  WHERE requires_follow_up = TRUE;
CREATE INDEX IF NOT EXISTS idx_interactions_attachments ON contact_interactions(contact_id) 
  WHERE has_attachments = TRUE;

-- JSONB indexes for metadata searches
CREATE INDEX IF NOT EXISTS idx_interactions_metadata ON contact_interactions USING GIN(interaction_metadata);
CREATE INDEX IF NOT EXISTS idx_interactions_platform_data ON contact_interactions USING GIN(external_platform_data);
CREATE INDEX IF NOT EXISTS idx_interactions_attachment_meta ON contact_interactions USING GIN(attachment_metadata);

-- Text search index for content
CREATE INDEX IF NOT EXISTS idx_interactions_content_search ON contact_interactions USING GIN(
  to_tsvector('english', 
    COALESCE(interaction_summary, '') || ' ' || 
    COALESCE(subject, '') || ' ' || 
    COALESCE(message_preview, '') || ' ' ||
    COALESCE(follow_up_notes, '')
  )
);

-- External ID indexes for integration lookups
CREATE INDEX IF NOT EXISTS idx_interactions_external_message ON contact_interactions(external_message_id) 
  WHERE external_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interactions_external_thread ON contact_interactions(external_thread_id) 
  WHERE external_thread_id IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_interactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_interactions_updated_at
  BEFORE UPDATE ON contact_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_interactions_updated_at();

-- Function to update contact's last_contacted_at when interaction is created
CREATE OR REPLACE FUNCTION update_contact_last_contacted()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the contact's last contacted timestamp
  UPDATE contacts 
  SET last_contacted_at = NEW.interaction_at
  WHERE id = NEW.contact_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contact_last_contacted
  AFTER INSERT ON contact_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_last_contacted();

-- Function to create interaction record
CREATE OR REPLACE FUNCTION create_contact_interaction(
  p_contact_id UUID,
  p_agent_id UUID,
  p_user_id UUID,
  p_interaction_type TEXT,
  p_channel_type TEXT DEFAULT NULL,
  p_channel_identifier TEXT DEFAULT NULL,
  p_direction TEXT DEFAULT 'outbound',
  p_summary TEXT DEFAULT NULL,
  p_full_content TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  interaction_id UUID;
  vault_id TEXT;
BEGIN
  -- Validate inputs
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Encrypt full content if provided
  IF p_full_content IS NOT NULL THEN
    -- This would use Supabase Vault in real implementation
    -- vault_id := vault.create_secret(p_full_content);
    vault_id := 'vault_' || gen_random_uuid()::text; -- Placeholder
  END IF;
  
  -- Insert interaction record
  INSERT INTO contact_interactions (
    contact_id,
    agent_id,
    user_id,
    interaction_type,
    channel_type,
    channel_identifier,
    direction,
    interaction_summary,
    full_content_vault_id,
    interaction_metadata,
    message_preview
  ) VALUES (
    p_contact_id,
    p_agent_id,
    p_user_id,
    p_interaction_type,
    p_channel_type,
    p_channel_identifier,
    p_direction,
    p_summary,
    vault_id,
    p_metadata,
    LEFT(COALESCE(p_summary, p_full_content, ''), 200)
  ) RETURNING id INTO interaction_id;
  
  RETURN interaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get interaction statistics for a contact
CREATE OR REPLACE FUNCTION get_contact_interaction_stats(
  p_contact_id UUID,
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
) RETURNS TABLE (
  total_interactions BIGINT,
  sent_messages BIGINT,
  received_messages BIGINT,
  failed_deliveries BIGINT,
  avg_response_time INTERVAL,
  last_interaction TIMESTAMPTZ,
  most_used_channel TEXT,
  engagement_score DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_interactions,
    COUNT(*) FILTER (WHERE direction = 'outbound') as sent_messages,
    COUNT(*) FILTER (WHERE direction = 'inbound') as received_messages,
    COUNT(*) FILTER (WHERE delivery_status IN ('failed', 'bounced')) as failed_deliveries,
    AVG(read_at - interaction_at) FILTER (WHERE read_at IS NOT NULL) as avg_response_time,
    MAX(interaction_at) as last_interaction,
    MODE() WITHIN GROUP (ORDER BY channel_type) as most_used_channel,
    AVG(ci.engagement_score) as engagement_score
  FROM contact_interactions ci
  WHERE ci.contact_id = p_contact_id 
    AND ci.user_id = p_user_id
    AND ci.interaction_at >= NOW() - INTERVAL '1 day' * p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent interactions for a contact
CREATE OR REPLACE FUNCTION get_recent_contact_interactions(
  p_contact_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id UUID,
  interaction_type TEXT,
  channel_type TEXT,
  direction TEXT,
  interaction_summary TEXT,
  interaction_at TIMESTAMPTZ,
  delivery_status TEXT,
  agent_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.interaction_type,
    ci.channel_type,
    ci.direction,
    ci.interaction_summary,
    ci.interaction_at,
    ci.delivery_status,
    a.name as agent_name
  FROM contact_interactions ci
  INNER JOIN agents a ON ci.agent_id = a.id
  WHERE ci.contact_id = p_contact_id 
    AND ci.user_id = p_user_id
  ORDER BY ci.interaction_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add table comments
COMMENT ON TABLE contact_interactions IS 'Comprehensive log of all contact interactions across communication channels';
COMMENT ON COLUMN contact_interactions.full_content_vault_id IS 'Supabase Vault ID for encrypted full message content';
COMMENT ON COLUMN contact_interactions.external_message_id IS 'Reference ID from external communication platform';
COMMENT ON COLUMN contact_interactions.engagement_score IS 'Subjective engagement quality score (1-10)';
COMMENT ON COLUMN contact_interactions.sentiment_score IS 'Automated sentiment analysis score (-1.0 to 1.0)';
COMMENT ON COLUMN contact_interactions.retention_date IS 'Date when interaction should be deleted for compliance';

-- Create view for interaction summary
CREATE OR REPLACE VIEW contact_interaction_summary AS
SELECT 
  ci.contact_id,
  c.display_name as contact_name,
  ci.user_id,
  COUNT(*) as total_interactions,
  COUNT(*) FILTER (WHERE ci.direction = 'outbound') as outbound_count,
  COUNT(*) FILTER (WHERE ci.direction = 'inbound') as inbound_count,
  COUNT(DISTINCT ci.channel_type) as channels_used,
  MAX(ci.interaction_at) as last_interaction,
  MIN(ci.interaction_at) as first_interaction,
  AVG(ci.engagement_score) as avg_engagement,
  COUNT(*) FILTER (WHERE ci.requires_follow_up = TRUE) as pending_follow_ups
FROM contact_interactions ci
INNER JOIN contacts c ON ci.contact_id = c.id
GROUP BY ci.contact_id, c.display_name, ci.user_id;

COMMENT ON VIEW contact_interaction_summary IS 'Summary statistics for contact interactions';
