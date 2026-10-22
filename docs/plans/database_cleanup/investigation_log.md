# Database Cleanup Investigation Log

**Started:** October 13, 2025  
**Status:** In Progress

---

## ✅ Completed Investigations

### Table #1: `admin_operation_logs`

**Decision:** ✅ **REMOVED**

**Reason:** Part of deprecated admin MCP management system

**Actions Taken:**
1. ✅ Archived related code to `archive/admin_mcp_system_20251013_122457/`:
   - `src/lib/services/adminMCPService.ts`
   - `src/pages/AdminMCPMarketplaceManagement.tsx`
   - `src/components/mcp/OneClickMCPDeployment.tsx`
2. ✅ Removed route `/admin/marketplace` from `routeConfig.tsx`
3. ✅ Commented out lazy import in `lazyComponents.ts`
4. ✅ Created migration: `20251013183000_drop_admin_operation_logs.sql`

**Migration Status:** ✅ **DEPLOYED**

---

## ✅ Completed Investigations (continued)

### Tables #2 & #3: `agent_droplet_tools` & `agent_droplets`

**Decision:** ✅ **REMOVED**

**Reason:** Replaced by account-level shared droplet architecture

**Evidence:**
1. System refactored from per-agent droplets to account-level shared droplets
2. New tables actively used: `account_tool_environments`, `account_tool_instances` (24 references in edge functions)
3. Old tables: Only in auto-generated TypeScript types, zero active code usage
4. Zero references in Supabase functions
5. Architecture shift: One droplet per agent → One shared droplet per account

**Actions Taken:**
1. ✅ Created migration: `20251013183100_drop_agent_droplet_tables.sql`
2. ✅ Drops both `agent_droplet_tools` and `agent_droplets` with CASCADE

**Migration Status:** ✅ **DEPLOYED**

---

### Table #4: `agent_email_addresses`

**Decision:** ❌ **KEEP - ACTIVELY USED**

**Reason:** Part of active SendGrid integration

**Evidence:**
1. Used in `sendgrid-inbound/index.ts` (line 228) - Resolves incoming emails to agents
2. Used in `sendgrid-api/index.ts` (line 685) - Creates agent email addresses
3. Critical for agent inbox functionality

**Actions Taken:**
- No action needed - table is in active use

---

## 🔄 In Progress

### Table #5: `agent_tool_capabilities`

**Status:** Investigating...

---

## 📋 Pending Investigations

### Tables to Remove (12 remaining)
- [ ] agent_email_addresses
- [ ] agent_tool_capabilities
- [ ] mcp_server_type_summary
- [ ] integrations_fallback
- [ ] oauth_providers_fallback
- [ ] tool_catalog
- [ ] user_ssh_keys
- [ ] user_web_search_keys

### Suspicious Tables (30 total)
- [ ] agent_group_access
- [ ] account_tool_instances
- [ ] agent_mailgun_permissions
- [ ] agent_memories
- [ ] agent_sendgrid_permissions
- [ ] email_change_audit_log
- [ ] email_logs
- [ ] gmail_operation_logs
- [ ] import_job_statistics
- [ ] mailgun_configurations
- [ ] media_processing_logs
- [ ] memory_consolidations
- [ ] manage_versions
- [ ] migration_fallback_logs
- [ ] mistral_ocr_connections
- [ ] reasoning_sessions
- [ ] reasoning_steps
- [ ] safe_agent_mcp_connections
- [ ] sendgrid_configurations
- [ ] smtp_operation_logs
- [ ] system_alerts
- [ ] system_health
- [ ] temp_secrets
- [ ] tool_execution_logs
- [ ] tool_user_input_requests
- [ ] user_integrations
- [ ] user_secrets
- [ ] web_search_operation_logs
- [ ] web_search_providers

### Organization Tables (4 total)
- [ ] organization_api_keys
- [ ] organization_invitations
- [ ] organization_memberships
- [ ] organizations

### Tables Needing RLS
- [ ] agent_permission_summary
- [ ] integrations

---

## 📊 Summary Statistics

- **Total Tables to Investigate:** 49
- **Completed:** 15 (from "tables to remove" section)
- **Remaining:** 34 (suspicious tables + organization tables)
- **Tables Removed:** 19
- **Tables Kept:** 1 (agent_email_addresses)
- **Code Archived:** 2 systems (admin MCP + toolbox)
- **Edge Functions Removed:** 5
- **Migrations Created:** 6
- **All Migrations:** ✅ DEPLOYED

