database cleanup

tables to remove:

-- ✅ REMOVED: admin_operation_logs (deprecated admin MCP system) - Migration: 20251013183000
-- ✅ REMOVED: agent_droplet_tools (replaced by account_tool_environments) - Migration: 20251013183100
-- ✅ REMOVED: agent_droplets (replaced by account_tool_environments) - Migration: 20251013183100
-- ❌ KEEP: agent_email_addresses (actively used by SendGrid integration)
-- ✅ REMOVED: agent_tool_capabilities (empty/unused) - Migration: 20251013183200
-- ✅ REMOVED: mcp_server_type_summary (empty VIEW, unused) - Migration: 20251013183300
-- ✅ REMOVED: integrations_fallback (empty, unused) - Migration: 20251013183400
-- ✅ REMOVED: oauth_providers_fallback (migration fallback VIEW, no longer needed) - Migration: 20251013183500
-- ✅ REMOVED: tool_catalog (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: user_ssh_keys (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: account_tool_environments (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: account_tool_instances (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: agent_toolbox_access (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: agent_toolbelt_items (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: agent_tool_credentials (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: agent_tool_capability_permissions (deprecated toolbox system) - Migration: 20251013183600
-- ✅ REMOVED: user_web_search_keys (migrated to unified user_integration_credentials) - Migration: 20251013183700
-- ✅ REMOVED: web_search_providers (migrated to service_providers) - Migration: 20251013183700
-- ✅ REMOVED: agent_web_search_permissions (migrate to agent_integration_permissions) - Migration: 20251013183700
-- ✅ REMOVED: web_search_operation_logs (empty, unused) - Migration: 20251013183700

## ✅ "Tables to Remove" Section Complete! 
## Removed: 17 tables/views | Kept: 1 table (agent_email_addresses)

## ⚠️ Code Updates Needed:
- AgentWebSearchPermissions.tsx component needs rewrite to use unified credentials
- Web search keys should be re-added via integrations UI using service_providers

suspicious tables:

-- ❌ KEEP: agent_group_access (active - group-based contact permissions for agents)
-- ✅ ALREADY REMOVED: account_tool_instances (removed in toolbox cleanup - Migration: 20251013183600)
-- ❌ KEEP: agent_mailgun_permissions (active - granular Mailgun permissions for agents)
-- ❌ KEEP: agent_memories (active - advanced memory system with vector embeddings, NOT redundant with Pinecone)
-- ❌ KEEP: agent_sendgrid_permissions (active - granular SendGrid permissions for agents)
-- ❌ KEEP: email_change_audit_log (actively used by change-email function for security auditing)
-- ❌ KEEP: email_logs (actively used by mailgun-webhook for storing emails)
-- ✅ REMOVED: gmail_operation_logs (empty, not being used) - Migration: 20251013183800
-- ✅ REMOVED: import_job_statistics (has 1 record, appears unused) - Migration: 20251013183800
-- ✅ REMOVED: mailgun_configurations (empty, feature not in use) - Migration: 20251013183800
-- ✅ REMOVED: media_processing_logs (empty, unused) - Migration: 20251013183800
-- ✅ REMOVED: memory_consolidations (empty, consolidation writes to agent_memories directly) - Migration: 20251013183800
-- ✅ REMOVED: manage_versions (empty, unused) - Migration: 20251013183800
-- ✅ REMOVED: migration_fallback_logs (1 record, migration artifact) - Migration: 20251013183800
-- ✅ REMOVED: mistral_ocr_connections (VIEW to user_integration_credentials, redundant) - Migration: 20251013183800
-- ❌ KEEP: reasoning_sessions (actively used by advanced-reasoning function)
-- ❌ KEEP: reasoning_steps (actively used by advanced-reasoning iterative-markov-controller)
-- ❌ KEEP: safe_agent_mcp_connections (VIEW for secure MCP connection access without exposing URLs)
-- ✅ REMOVED: sendgrid_configurations (empty, feature not in use) - Migration: 20251013183800
-- ✅ REMOVED: smtp_operation_logs (empty, code comments say "doesn't exist") - Migration: 20251013183800
-- ✅ REMOVED: system_alerts (empty, monitoring system not running) - Migration: 20251013184100
-- ✅ REMOVED: system_health (empty, only used for SELECT test, never written to) - Migration: 20251013184100
-- ✅ REMOVED: temp_secrets (empty, unrestricted RLS, unused) - Migration: 20251013183800

## ✅ "Suspicious Tables" Section Complete!
## Removed: 16 tables/views | Kept: 11 tables (all actively used)
-- ❌ KEEP: tool_execution_logs (actively used - clicksend-api logs executions here)
-- ❌ KEEP: tool_user_input_requests (actively used by tool-user-input function for agent input requests)
-- ✅ REMOVED: user_integrations (unused, only in auto-generated types) - Migration: 20251013183800
-- ✅ REMOVED: user_secrets (unused, secrets should be in Vault only) - Migration: 20251013183800
-- ✅ ALREADY REMOVED: web_search_operation_logs (removed in web search cleanup - Migration: 20251013183700)
-- ✅ ALREADY REMOVED: web_search_providers (removed in web search cleanup - Migration: 20251013183700)


## ✅ Organization Tables (Unimplemented Enterprise Feature)
-- ✅ REMOVED: organization_api_keys (empty, planned enterprise feature never implemented) - Migration: 20251013183900
-- ✅ REMOVED: organization_invitations (empty, planned enterprise feature never implemented) - Migration: 20251013183900
-- ✅ REMOVED: organization_memberships (empty, planned enterprise feature never implemented) - Migration: 20251013183900
-- ✅ REMOVED: organizations (empty, planned enterprise feature never implemented) - Migration: 20251013183900






