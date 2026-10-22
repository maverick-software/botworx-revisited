-- SendGrid Inbound Email Tables
-- Date: August 4, 2025
-- Purpose: Create tables for handling inbound emails and routing rules

-- Create sendgrid_inbound_emails table
CREATE TABLE IF NOT EXISTS sendgrid_inbound_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    agent_id UUID,  -- Agent that received the email (null for general inbox)
    
    -- Email identification
    message_id TEXT NOT NULL,        -- Generated unique message ID
    sendgrid_message_id TEXT,        -- SendGrid's message ID if available
    
    -- Email addresses
    from_email TEXT NOT NULL,
    from_name TEXT,
    to_emails TEXT[] NOT NULL,
    cc_emails TEXT[],
    bcc_emails TEXT[],
    reply_to_email TEXT,
    
    -- Content
    subject TEXT,
    text_body TEXT,
    html_body TEXT,
    headers JSONB DEFAULT '{}'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    /* Attachment format:
    [
        {
            "filename": "document.pdf",
            "content_type": "application/pdf",
            "size": 12345,
            "storage_url": "path/to/stored/file",
            "content_id": "optional-cid-for-inline"
        }
    ]
    */
    
    -- Processing
    routing_rules_applied UUID[],    -- IDs of rules that matched this email
    processed_at TIMESTAMPTZ DEFAULT now(),
    processing_status TEXT DEFAULT 'processed' CHECK (processing_status IN ('processed', 'failed', 'pending', 'quarantined')),
    processing_errors JSONB DEFAULT '{}'::jsonb,
    
    -- Email metadata
    spam_score FLOAT,
    spf_check TEXT,
    dkim_check TEXT,
    envelope JSONB DEFAULT '{}'::jsonb,     -- SMTP envelope data
    charsets JSONB DEFAULT '{}'::jsonb,     -- Character encoding info
    raw_webhook_data JSONB,                 -- Original webhook payload (for debugging)
    
    -- Threading
    in_reply_to TEXT,                -- Message-ID this is replying to
    message_references TEXT[],       -- Chain of message IDs for threading
    
    -- Tags and categorization
    tags TEXT[] DEFAULT '{}',
    categories TEXT[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sendgrid_inbound_routing_rules table
CREATE TABLE IF NOT EXISTS sendgrid_inbound_routing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sendgrid_config_id UUID NOT NULL REFERENCES sendgrid_configurations(id) ON DELETE CASCADE,
    agent_id UUID,  -- Agent this rule applies to (null for global rules)
    
    -- Rule identification
    name TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 0,  -- Lower numbers = higher priority
    is_active BOOLEAN DEFAULT true,
    
    -- Conditions (all must match for rule to trigger)
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Condition format:
    {
        "from_pattern": ".*@example.com",
        "subject_pattern": "urgent|important",
        "to_pattern": "support@.*",
        "body_contains": "password reset",
        "has_attachments": true,
        "spam_score_threshold": 5.0
    }
    */
    
    -- Actions to take when rule matches
    action JSONB NOT NULL DEFAULT '{}'::jsonb,
    /* Action format:
    {
        "type": "forward|auto_reply|tag|webhook|notify",
        "config": {
            // Type-specific configuration
            "forward_to": "admin@example.com",
            "template_id": "uuid",
            "webhook_url": "https://...",
            "tags": ["urgent", "customer-service"]
        }
    }
    */
    
    -- Control flow
    stop_processing BOOLEAN DEFAULT false,  -- Stop processing other rules if this matches
    
    -- Statistics
    match_count INTEGER DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID NOT NULL,  -- User who created the rule
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create sendgrid_inbound_routing_logs table (for debugging and analytics)
CREATE TABLE IF NOT EXISTS sendgrid_inbound_routing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_id UUID NOT NULL REFERENCES sendgrid_inbound_emails(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES sendgrid_inbound_routing_rules(id) ON DELETE SET NULL,
    
    -- Log details
    event_type TEXT NOT NULL, -- 'rule_matched', 'rule_skipped', 'action_executed', 'action_failed'
    event_details JSONB DEFAULT '{}'::jsonb,
    execution_time_ms INTEGER,
    
    -- Status
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbound_emails_config ON sendgrid_inbound_emails(sendgrid_config_id);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_agent ON sendgrid_inbound_emails(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbound_emails_from ON sendgrid_inbound_emails(from_email);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_subject ON sendgrid_inbound_emails USING gin(to_tsvector('english', subject));
CREATE INDEX IF NOT EXISTS idx_inbound_emails_processed_at ON sendgrid_inbound_emails(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_status ON sendgrid_inbound_emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_inbound_emails_message_id ON sendgrid_inbound_emails(message_id);

CREATE INDEX IF NOT EXISTS idx_routing_rules_config ON sendgrid_inbound_routing_rules(sendgrid_config_id);
CREATE INDEX IF NOT EXISTS idx_routing_rules_agent ON sendgrid_inbound_routing_rules(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_routing_rules_active ON sendgrid_inbound_routing_rules(is_active, priority) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_routing_logs_email ON sendgrid_inbound_routing_logs(email_id);
CREATE INDEX IF NOT EXISTS idx_routing_logs_rule ON sendgrid_inbound_routing_logs(rule_id) WHERE rule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_routing_logs_created_at ON sendgrid_inbound_routing_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE sendgrid_inbound_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendgrid_inbound_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sendgrid_inbound_routing_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sendgrid_inbound_emails
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_inbound_emails' 
        AND policyname = 'Users can view their inbound emails'
    ) THEN
        CREATE POLICY "Users can view their inbound emails" ON sendgrid_inbound_emails
            FOR SELECT USING (
                sendgrid_config_id IN (
                    SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_inbound_emails' 
        AND policyname = 'Service can manage inbound emails'
    ) THEN
        CREATE POLICY "Service can manage inbound emails" ON sendgrid_inbound_emails
            FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- RLS Policies for sendgrid_inbound_routing_rules
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_inbound_routing_rules' 
        AND policyname = 'Users can manage their routing rules'
    ) THEN
        CREATE POLICY "Users can manage their routing rules" ON sendgrid_inbound_routing_rules
            FOR ALL USING (
                sendgrid_config_id IN (
                    SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- RLS Policies for sendgrid_inbound_routing_logs
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_inbound_routing_logs' 
        AND policyname = 'Users can view their routing logs'
    ) THEN
        CREATE POLICY "Users can view their routing logs" ON sendgrid_inbound_routing_logs
            FOR SELECT USING (
                email_id IN (
                    SELECT id FROM sendgrid_inbound_emails 
                    WHERE sendgrid_config_id IN (
                        SELECT id FROM sendgrid_configurations WHERE user_id = auth.uid()
                    )
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'sendgrid_inbound_routing_logs' 
        AND policyname = 'Service can manage routing logs'
    ) THEN
        CREATE POLICY "Service can manage routing logs" ON sendgrid_inbound_routing_logs
            FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
    END IF;
END $$;

-- Update timestamp triggers
DROP TRIGGER IF EXISTS update_sendgrid_inbound_emails_updated_at ON sendgrid_inbound_emails;
CREATE TRIGGER update_sendgrid_inbound_emails_updated_at
    BEFORE UPDATE ON sendgrid_inbound_emails
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

DROP TRIGGER IF EXISTS update_sendgrid_inbound_routing_rules_updated_at ON sendgrid_inbound_routing_rules;
CREATE TRIGGER update_sendgrid_inbound_routing_rules_updated_at
    BEFORE UPDATE ON sendgrid_inbound_routing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_sendgrid_updated_at();

-- Function to get inbound emails for a user
CREATE OR REPLACE FUNCTION get_user_inbound_emails(
    p_user_id UUID DEFAULT auth.uid(),
    p_agent_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    email_id UUID,
    from_email TEXT,
    from_name TEXT,
    subject TEXT,
    processed_at TIMESTAMPTZ,
    has_attachments BOOLEAN,
    agent_id UUID,
    routing_rules_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ie.id as email_id,
        ie.from_email,
        ie.from_name,
        ie.subject,
        ie.processed_at,
        (jsonb_array_length(ie.attachments) > 0) as has_attachments,
        ie.agent_id,
        COALESCE(array_length(ie.routing_rules_applied, 1), 0) as routing_rules_count
    FROM sendgrid_inbound_emails ie
    JOIN sendgrid_configurations sc ON sc.id = ie.sendgrid_config_id
    WHERE sc.user_id = p_user_id
    AND (p_agent_id IS NULL OR ie.agent_id = p_agent_id)
    ORDER BY ie.processed_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a routing rule
CREATE OR REPLACE FUNCTION create_routing_rule(
    p_name TEXT,
    p_description TEXT,
    p_agent_id UUID,
    p_conditions JSONB,
    p_action JSONB,
    p_priority INTEGER DEFAULT 0,
    p_stop_processing BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_config_id UUID;
    v_rule_id UUID;
BEGIN
    -- Get user's SendGrid config
    SELECT id INTO v_config_id
    FROM sendgrid_configurations
    WHERE user_id = auth.uid()
    AND is_active = true;
    
    IF v_config_id IS NULL THEN
        RAISE EXCEPTION 'No active SendGrid configuration found for user';
    END IF;
    
    -- Insert the routing rule
    INSERT INTO sendgrid_inbound_routing_rules (
        sendgrid_config_id,
        agent_id,
        name,
        description,
        priority,
        conditions,
        action,
        stop_processing,
        created_by
    ) VALUES (
        v_config_id,
        p_agent_id,
        p_name,
        p_description,
        p_priority,
        p_conditions,
        p_action,
        p_stop_processing,
        auth.uid()
    ) RETURNING id INTO v_rule_id;
    
    RETURN v_rule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment rule match count
CREATE OR REPLACE FUNCTION increment_rule_match_count(p_rule_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE sendgrid_inbound_routing_rules
    SET match_count = match_count + 1,
        last_matched_at = now()
    WHERE id = p_rule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for full-text search of inbound emails
CREATE OR REPLACE FUNCTION search_inbound_emails(
    p_search_query TEXT,
    p_user_id UUID DEFAULT auth.uid(),
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
    email_id UUID,
    from_email TEXT,
    subject TEXT,
    processed_at TIMESTAMPTZ,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ie.id as email_id,
        ie.from_email,
        ie.subject,
        ie.processed_at,
        ts_rank(
            to_tsvector('english', COALESCE(ie.subject, '') || ' ' || COALESCE(ie.text_body, '') || ' ' || COALESCE(ie.from_email, '')),
            websearch_to_tsquery('english', p_search_query)
        ) as rank
    FROM sendgrid_inbound_emails ie
    JOIN sendgrid_configurations sc ON sc.id = ie.sendgrid_config_id
    WHERE sc.user_id = p_user_id
    AND (
        to_tsvector('english', COALESCE(ie.subject, '') || ' ' || COALESCE(ie.text_body, '') || ' ' || COALESCE(ie.from_email, ''))
        @@ websearch_to_tsquery('english', p_search_query)
    )
    ORDER BY rank DESC, ie.processed_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON sendgrid_inbound_emails TO anon, authenticated;
GRANT SELECT ON sendgrid_inbound_routing_rules TO anon, authenticated;
GRANT SELECT ON sendgrid_inbound_routing_logs TO anon, authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_inbound_emails(UUID, UUID, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_routing_rule(TEXT, TEXT, UUID, JSONB, JSONB, INTEGER, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_rule_match_count(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_inbound_emails(TEXT, UUID, INTEGER) TO anon, authenticated;

-- Create storage bucket for email attachments
DO $$
BEGIN
    -- This would typically be done via Supabase dashboard or CLI
    -- INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false);
    -- For now, just document the requirement
END $$;

-- Add comments for documentation
COMMENT ON TABLE sendgrid_inbound_emails IS 'Storage for inbound emails received via SendGrid Inbound Parse webhook';
COMMENT ON TABLE sendgrid_inbound_routing_rules IS 'Rules for automatically processing inbound emails based on conditions';
COMMENT ON TABLE sendgrid_inbound_routing_logs IS 'Audit log for routing rule execution and debugging';

COMMENT ON COLUMN sendgrid_inbound_emails.routing_rules_applied IS 'Array of routing rule IDs that were applied to this email';
COMMENT ON COLUMN sendgrid_inbound_emails.raw_webhook_data IS 'Original webhook payload for debugging';
COMMENT ON COLUMN sendgrid_inbound_routing_rules.conditions IS 'JSON object with conditions that must match for rule to trigger';
COMMENT ON COLUMN sendgrid_inbound_routing_rules.action IS 'JSON object defining the action to take when rule matches';
