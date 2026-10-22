-- Migration: Create Temporary Chat Performance Indexes
-- Description: Optimized indexes for temporary chat links and sessions for fast queries
-- Date: 2025-09-18

-- =============================================================================
-- TEMPORARY CHAT LINKS INDEXES
-- =============================================================================

-- Primary access patterns for temporary_chat_links
CREATE INDEX IF NOT EXISTS idx_temp_links_vault_token 
  ON temporary_chat_links(vault_link_token_id) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_temp_links_short_code 
  ON temporary_chat_links(short_code) 
  WHERE short_code IS NOT NULL AND is_active = TRUE;

-- Ownership and permission queries
CREATE INDEX IF NOT EXISTS idx_temp_links_agent 
  ON temporary_chat_links(agent_id) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_temp_links_user 
  ON temporary_chat_links(user_id);

CREATE INDEX IF NOT EXISTS idx_temp_links_user_agent 
  ON temporary_chat_links(user_id, agent_id) 
  WHERE is_active = TRUE;

-- Expiration and cleanup queries
CREATE INDEX IF NOT EXISTS idx_temp_links_expires 
  ON temporary_chat_links(expires_at) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_temp_links_cleanup 
  ON temporary_chat_links(expires_at, is_active) 
  WHERE is_active = FALSE;

CREATE INDEX IF NOT EXISTS idx_temp_links_expired 
  ON temporary_chat_links(is_active, expires_at) 
  WHERE is_active = FALSE;

-- Usage analytics and activity queries
CREATE INDEX IF NOT EXISTS idx_temp_links_activity 
  ON temporary_chat_links(last_accessed_at DESC) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_temp_links_created 
  ON temporary_chat_links(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_temp_links_usage_stats 
  ON temporary_chat_links(session_count, total_messages) 
  WHERE is_active = TRUE;

-- Metadata and search queries
CREATE INDEX IF NOT EXISTS idx_temp_links_metadata_gin 
  ON temporary_chat_links USING GIN(link_metadata);

CREATE INDEX IF NOT EXISTS idx_temp_links_ui_customization_gin 
  ON temporary_chat_links USING GIN(ui_customization);

-- Security and access control
CREATE INDEX IF NOT EXISTS idx_temp_links_domains_gin 
  ON temporary_chat_links USING GIN(allowed_domains) 
  WHERE allowed_domains IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_temp_links_ips_gin 
  ON temporary_chat_links USING GIN(allowed_ips) 
  WHERE allowed_ips IS NOT NULL;

-- =============================================================================
-- TEMPORARY CHAT SESSIONS INDEXES
-- =============================================================================

-- Primary session access patterns
CREATE INDEX IF NOT EXISTS idx_temp_sessions_vault_token 
  ON temporary_chat_sessions(vault_session_token_id) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_temp_sessions_link 
  ON temporary_chat_sessions(link_id);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_link_active 
  ON temporary_chat_sessions(link_id, status) 
  WHERE status = 'active';

-- Conversation integration
CREATE INDEX IF NOT EXISTS idx_temp_sessions_conversation 
  ON temporary_chat_sessions(conversation_id);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_conv_session 
  ON temporary_chat_sessions(conversation_session_id) 
  WHERE conversation_session_id IS NOT NULL;

-- Status and lifecycle queries
CREATE INDEX IF NOT EXISTS idx_temp_sessions_status 
  ON temporary_chat_sessions(status, last_activity_at);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_active 
  ON temporary_chat_sessions(status, started_at) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_temp_sessions_cleanup 
  ON temporary_chat_sessions(status, last_activity_at) 
  WHERE status = 'active';

-- Analytics and monitoring
CREATE INDEX IF NOT EXISTS idx_temp_sessions_activity 
  ON temporary_chat_sessions(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_created 
  ON temporary_chat_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_duration 
  ON temporary_chat_sessions(session_duration_seconds) 
  WHERE session_duration_seconds IS NOT NULL;

-- Security and monitoring
CREATE INDEX IF NOT EXISTS idx_temp_sessions_ip 
  ON temporary_chat_sessions(ip_address) 
  WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_temp_sessions_ip_status 
  ON temporary_chat_sessions(ip_address, status, created_at) 
  WHERE ip_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_temp_sessions_country 
  ON temporary_chat_sessions(country_code) 
  WHERE country_code IS NOT NULL;

-- Rate limiting and abuse detection
CREATE INDEX IF NOT EXISTS idx_temp_sessions_rate_limit 
  ON temporary_chat_sessions(vault_session_token_id, last_message_at) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_temp_sessions_violations 
  ON temporary_chat_sessions(rate_limit_violations, ip_address) 
  WHERE rate_limit_violations > 0;

CREATE INDEX IF NOT EXISTS idx_temp_sessions_abuse_detection 
  ON temporary_chat_sessions(ip_address, rate_limit_violations, created_at) 
  WHERE rate_limit_violations > 5;

-- Participant tracking (anonymous)
CREATE INDEX IF NOT EXISTS idx_temp_sessions_participant 
  ON temporary_chat_sessions(participant_identifier) 
  WHERE participant_identifier IS NOT NULL;

-- Quality and feedback
CREATE INDEX IF NOT EXISTS idx_temp_sessions_feedback 
  ON temporary_chat_sessions(satisfaction_rating) 
  WHERE satisfaction_rating IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_temp_sessions_quality 
  ON temporary_chat_sessions(satisfaction_rating, message_count) 
  WHERE satisfaction_rating IS NOT NULL;

-- Metadata searches
CREATE INDEX IF NOT EXISTS idx_temp_sessions_metadata_gin 
  ON temporary_chat_sessions USING GIN(session_metadata);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_participant_metadata_gin 
  ON temporary_chat_sessions USING GIN(participant_metadata);

-- =============================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- =============================================================================

-- Link analytics queries
CREATE INDEX IF NOT EXISTS idx_temp_links_analytics 
  ON temporary_chat_links(user_id, agent_id, created_at, is_active);

CREATE INDEX IF NOT EXISTS idx_temp_links_performance 
  ON temporary_chat_links(agent_id, session_count, total_messages, created_at) 
  WHERE is_active = TRUE;

-- Session analytics queries
CREATE INDEX IF NOT EXISTS idx_temp_sessions_analytics 
  ON temporary_chat_sessions(link_id, status, created_at, message_count);

CREATE INDEX IF NOT EXISTS idx_temp_sessions_performance 
  ON temporary_chat_sessions(link_id, started_at, ended_at, message_count, session_duration_seconds);

-- Cross-table analytics (for joins)
CREATE INDEX IF NOT EXISTS idx_temp_sessions_link_user 
  ON temporary_chat_sessions(link_id, created_at, status);

-- Security monitoring composite indexes
CREATE INDEX IF NOT EXISTS idx_temp_sessions_security_monitoring 
  ON temporary_chat_sessions(ip_address, user_agent, rate_limit_violations, created_at) 
  WHERE rate_limit_violations > 0 OR status = 'terminated';

-- =============================================================================
-- PARTIAL INDEXES FOR SPECIFIC USE CASES
-- =============================================================================

-- Only index active, non-expired links for public access
CREATE INDEX IF NOT EXISTS idx_temp_links_public_access 
  ON temporary_chat_links(vault_link_token_id, expires_at) 
  WHERE is_active = TRUE;

-- Only index recent sessions for real-time monitoring
CREATE INDEX IF NOT EXISTS idx_temp_sessions_recent_active 
  ON temporary_chat_sessions(vault_session_token_id, last_activity_at) 
  WHERE status = 'active';

-- Only index sessions with violations for security monitoring
CREATE INDEX IF NOT EXISTS idx_temp_sessions_security_alerts 
  ON temporary_chat_sessions(ip_address, rate_limit_violations, created_at) 
  WHERE rate_limit_violations >= 3;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON INDEX idx_temp_links_vault_token IS 'Primary access index for temporary chat link tokens via Vault';
COMMENT ON INDEX idx_temp_sessions_vault_token IS 'Primary access index for temporary chat session tokens via Vault';
COMMENT ON INDEX idx_temp_links_cleanup IS 'Optimized index for automatic cleanup of expired links';
COMMENT ON INDEX idx_temp_sessions_cleanup IS 'Optimized index for automatic cleanup of inactive sessions';
COMMENT ON INDEX idx_temp_sessions_rate_limit IS 'Rate limiting index for message frequency control';
COMMENT ON INDEX idx_temp_sessions_security_monitoring IS 'Composite index for security monitoring and abuse detection';

-- Log the migration with index count
DO $$
DECLARE
  links_index_count INTEGER;
  sessions_index_count INTEGER;
  total_indexes INTEGER;
BEGIN
  -- Count indexes on temporary_chat_links
  SELECT COUNT(*) INTO links_index_count
  FROM pg_indexes 
  WHERE tablename = 'temporary_chat_links' AND indexname LIKE 'idx_temp_links_%';
  
  -- Count indexes on temporary_chat_sessions  
  SELECT COUNT(*) INTO sessions_index_count
  FROM pg_indexes 
  WHERE tablename = 'temporary_chat_sessions' AND indexname LIKE 'idx_temp_sessions_%';
  
  total_indexes := links_index_count + sessions_index_count;
  
  RAISE NOTICE 'Migration completed: Created % indexes (% on links, % on sessions)', 
    total_indexes, links_index_count, sessions_index_count;
END $$;
