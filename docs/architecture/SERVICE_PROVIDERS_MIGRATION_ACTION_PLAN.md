# 🚀 SERVICE_PROVIDERS MIGRATION ACTION PLAN

**Date:** January 6, 2025  
**Migration:** `oauth_providers` → `service_providers` (Gradual Migration with Fallback Logging)  
**Status:** 📋 **PLANNING PHASE**

## 🎯 MIGRATION OBJECTIVES

### **Primary Goals:**
1. **Rename** `oauth_providers` → `service_providers` (semantically correct)
2. **Maintain** 100% system availability during migration
3. **Log** all fallback usage for monitoring
4. **Validate** data integrity throughout process
5. **Enable** easy rollback if issues occur

### **Success Criteria:**
- [ ] All 192 files updated to use `service_providers`
- [ ] Zero downtime during migration
- [ ] All fallback usage logged and monitored
- [ ] 100% data consistency maintained
- [ ] Complete rollback capability preserved

---

## 📋 PHASE-BY-PHASE ACTION PLAN

### **🔧 PHASE 1: FOUNDATION SETUP**
**Duration:** 1-2 hours  
**Risk Level:** 🟢 **LOW**

#### **Step 1.1: Create service_providers Table**
```sql
-- Migration: 20250106000001_create_service_providers_table.sql
CREATE TABLE public.service_providers (
  id uuid not null default gen_random_uuid(),
  name text not null,
  display_name text not null,
  authorization_endpoint text not null,
  token_endpoint text not null,
  revoke_endpoint text null,
  discovery_endpoint text null,
  scopes_supported jsonb not null default '[]'::jsonb,
  pkce_required boolean not null default true,
  client_credentials_location text not null default 'header'::text,
  is_enabled boolean not null default true,
  configuration_metadata jsonb null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint service_providers_pkey primary key (id),
  constraint service_providers_name_key unique (name)
) TABLESPACE pg_default;
```

#### **Step 1.2: Create Indexes and Triggers**
```sql
-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_providers_enabled 
  ON public.service_providers USING btree (name) 
  WHERE (is_enabled = true);

CREATE INDEX IF NOT EXISTS idx_service_providers_name 
  ON public.service_providers USING btree (name);

-- Triggers (reuse existing functions)
CREATE TRIGGER service_providers_deletion_cascade_trigger
  AFTER DELETE ON service_providers 
  FOR EACH ROW
  EXECUTE FUNCTION handle_integration_deletion_cascade();

CREATE TRIGGER update_service_providers_updated_at 
  BEFORE UPDATE ON service_providers 
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_providers_updated_at();
```

#### **Step 1.3: Data Migration**
```sql
-- Copy all data from oauth_providers to service_providers
INSERT INTO service_providers (
  id, name, display_name, authorization_endpoint, token_endpoint,
  revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
  client_credentials_location, is_enabled, configuration_metadata,
  created_at, updated_at
)
SELECT 
  id, name, display_name, authorization_endpoint, token_endpoint,
  revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
  client_credentials_location, is_enabled, configuration_metadata,
  created_at, updated_at
FROM oauth_providers;
```

#### **Step 1.4: Create Fallback View with Logging**
```sql
-- Create logging table for fallback usage
CREATE TABLE public.migration_fallback_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation_type text NOT NULL, -- 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
  user_id uuid,
  session_id text,
  query_info jsonb,
  stack_trace text,
  created_at timestamptz DEFAULT now()
);

-- Create logged fallback view
CREATE OR REPLACE VIEW oauth_providers AS
SELECT 
  id, name, display_name, authorization_endpoint, token_endpoint,
  revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
  client_credentials_location, is_enabled, configuration_metadata,
  created_at, updated_at
FROM service_providers;

-- Create trigger to log fallback usage
CREATE OR REPLACE FUNCTION log_oauth_providers_fallback()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the fallback usage
  INSERT INTO migration_fallback_logs (
    table_name, 
    operation_type, 
    user_id,
    session_id,
    query_info,
    stack_trace
  ) VALUES (
    'oauth_providers',
    TG_OP,
    auth.uid(),
    current_setting('application_name', true),
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'timestamp', now()
    ),
    current_setting('log.statement', true)
  );
  
  -- Handle the operation
  IF TG_OP = 'DELETE' THEN
    DELETE FROM service_providers WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE service_providers SET
      name = NEW.name,
      display_name = NEW.display_name,
      authorization_endpoint = NEW.authorization_endpoint,
      token_endpoint = NEW.token_endpoint,
      revoke_endpoint = NEW.revoke_endpoint,
      discovery_endpoint = NEW.discovery_endpoint,
      scopes_supported = NEW.scopes_supported,
      pkce_required = NEW.pkce_required,
      client_credentials_location = NEW.client_credentials_location,
      is_enabled = NEW.is_enabled,
      configuration_metadata = NEW.configuration_metadata,
      updated_at = now()
    WHERE id = NEW.id;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO service_providers (
      id, name, display_name, authorization_endpoint, token_endpoint,
      revoke_endpoint, discovery_endpoint, scopes_supported, pkce_required,
      client_credentials_location, is_enabled, configuration_metadata
    ) VALUES (
      NEW.id, NEW.name, NEW.display_name, NEW.authorization_endpoint, NEW.token_endpoint,
      NEW.revoke_endpoint, NEW.discovery_endpoint, NEW.scopes_supported, NEW.pkce_required,
      NEW.client_credentials_location, NEW.is_enabled, NEW.configuration_metadata
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to view
CREATE TRIGGER oauth_providers_fallback_trigger
  INSTEAD OF INSERT OR UPDATE OR DELETE ON oauth_providers
  FOR EACH ROW EXECUTE FUNCTION log_oauth_providers_fallback();
```

#### **Step 1.5: Create Monitoring Dashboard Query**
```sql
-- Query to monitor fallback usage
CREATE OR REPLACE FUNCTION get_migration_fallback_stats()
RETURNS TABLE (
  table_name text,
  operation_type text,
  usage_count bigint,
  last_used timestamptz,
  unique_sessions bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mfl.table_name,
    mfl.operation_type,
    COUNT(*) as usage_count,
    MAX(mfl.created_at) as last_used,
    COUNT(DISTINCT mfl.session_id) as unique_sessions
  FROM migration_fallback_logs mfl
  WHERE mfl.created_at >= now() - interval '24 hours'
  GROUP BY mfl.table_name, mfl.operation_type
  ORDER BY usage_count DESC;
END;
$$ LANGUAGE plpgsql;
```

---

### **🔄 PHASE 2: CORE FUNCTIONS MIGRATION**
**Duration:** 4-6 hours  
**Risk Level:** 🟡 **MEDIUM**

#### **Priority Order (Critical First):**

#### **Step 2.1: Edge Functions (CRITICAL - 10 files)**
**Files to Update:**
```
supabase/functions/get-agent-tools/index.ts
supabase/functions/gmail-api/index.ts
supabase/functions/gmail-oauth/index.ts
supabase/functions/smtp-api/index.ts
supabase/functions/web-search-api/index.ts
supabase/functions/media-library-api/index.ts
supabase/functions/get-agent-permissions/index.ts
supabase/functions/oauth-refresh/index.ts
supabase/functions/mailgun-service/index.ts
supabase/functions/create-agent/index.ts
```

**Migration Pattern:**
```typescript
// ❌ OLD: Query oauth_providers
const { data: providers } = await supabase
  .from('oauth_providers')
  .select('*');

// ✅ NEW: Query service_providers with fallback logging
const { data: providers } = await supabase
  .from('service_providers')
  .select('*');

// Add logging for successful migration
console.log(`[MIGRATION] Successfully queried service_providers in ${functionName}`);
```

#### **Step 2.2: Function Calling System (HIGH - 3 files)**
```
supabase/functions/chat/function_calling/base.ts
supabase/functions/chat/function_calling/gmail-provider.ts
supabase/functions/chat/function_calling/smtp-provider.ts
```

#### **Step 2.3: Memory & Graph Functions (MEDIUM - 3 files)**
```
supabase/functions/chat/core/memory/getzep_retrieval.ts
supabase/functions/chat/core/memory/memory_manager.ts
supabase/functions/graph-ingestion/index.ts
```

**Testing After Each Step:**
```bash
# Test edge function deployment
supabase functions deploy get-agent-tools
supabase functions deploy gmail-api
# ... test each function individually

# Verify no errors in logs
supabase functions logs get-agent-tools
```

---

### **🎨 PHASE 3: FRONTEND COMPONENTS MIGRATION**
**Duration:** 6-8 hours  
**Risk Level:** 🟡 **MEDIUM**

#### **Step 3.1: Core UI Components (HIGH - 6 files)**
```
src/components/modals/EnhancedToolsModal.tsx
src/components/modals/tools/useToolSetupHandlers.ts
src/components/modals/agent-settings/ChannelsTab.tsx
src/components/modals/agent-settings/ToolsTab.tsx
src/components/modals/channels/EnhancedChannelsModalRefactored.tsx
src/components/modals/EnhancedChannelsModal.tsx
```

**Migration Pattern:**
```typescript
// ❌ OLD: Reference oauth_providers
const { data: providers } = await supabase
  .from('oauth_providers')
  .select('*')
  .eq('is_enabled', true);

// ✅ NEW: Reference service_providers
const { data: providers } = await supabase
  .from('service_providers')
  .select('*')
  .eq('is_enabled', true);

// Add migration logging
console.log(`[MIGRATION] ${componentName} now using service_providers`);
```

#### **Step 3.2: Integration Services (MEDIUM - 8 files)**
```
src/integrations/_shared/services/connections.ts
src/integrations/digitalocean/hooks/useDigitalOceanIntegration.ts
src/integrations/gmail/hooks/useGmailIntegration.ts
src/integrations/smtp/services/smtp-tools.ts
src/integrations/web-search/hooks/useWebSearchIntegration.ts
src/integrations/gmail/services/gmail-tools.ts
src/integrations/email-providers/mailgun/useMailgunIntegration.ts
src/lib/mcp/tool-registry.ts
```

#### **Step 3.3: Setup Modals (LOW - 10 files)**
```
src/integrations/email-relay/components/EmailRelaySetupModal.tsx
src/integrations/smtp/components/SMTPSetupModalNew.tsx
src/integrations/mailgun/components/MailgunSetupModalNew.tsx
src/integrations/sendgrid/components/SendGridSetupModalNew.tsx
src/integrations/digitalocean/components/DigitalOceanSetupModal.tsx
src/integrations/web-search/components/WebSearchSetupModal.tsx
src/integrations/sendgrid/components/SendGridSetupModal.tsx
src/integrations/mailgun/components/MailgunSetupModal.tsx
src/integrations/discord/components/DiscordSetupModal.tsx
src/integrations/digitalocean/components/DigitalOceanIntegrationCard.tsx
```

**Testing After Each Step:**
```bash
# Test UI components
npm run dev
# Navigate to integrations page
# Test setup flows
# Verify no console errors
```

---

### **📊 PHASE 4: MONITORING & VALIDATION**
**Duration:** 2-3 hours  
**Risk Level:** 🟢 **LOW**

#### **Step 4.1: Monitor Fallback Usage**
```sql
-- Check fallback usage every hour
SELECT * FROM get_migration_fallback_stats();

-- Alert if fallback usage detected
SELECT 
  table_name,
  COUNT(*) as fallback_count,
  array_agg(DISTINCT session_id) as sessions_using_fallback
FROM migration_fallback_logs 
WHERE created_at >= now() - interval '1 hour'
GROUP BY table_name;
```

#### **Step 4.2: Data Integrity Validation**
```sql
-- Verify data consistency
SELECT 
  'oauth_providers' as source_table,
  COUNT(*) as record_count,
  MAX(updated_at) as last_updated
FROM oauth_providers
UNION ALL
SELECT 
  'service_providers' as source_table,
  COUNT(*) as record_count,
  MAX(updated_at) as last_updated
FROM service_providers;

-- Check for data drift
SELECT 
  op.name,
  op.updated_at as oauth_updated,
  sp.updated_at as service_updated,
  CASE 
    WHEN op.updated_at != sp.updated_at THEN 'DRIFT_DETECTED'
    ELSE 'OK'
  END as status
FROM oauth_providers op
FULL OUTER JOIN service_providers sp ON op.id = sp.id
WHERE op.updated_at != sp.updated_at OR op.id IS NULL OR sp.id IS NULL;
```

#### **Step 4.3: Performance Monitoring**
```sql
-- Monitor query performance
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch
FROM pg_stat_user_tables 
WHERE tablename IN ('oauth_providers', 'service_providers');
```

---

### **🧹 PHASE 5: CLEANUP & FINALIZATION**
**Duration:** 1-2 hours  
**Risk Level:** 🟢 **LOW**

#### **Step 5.1: Verify Zero Fallback Usage**
```sql
-- Ensure no recent fallback usage
SELECT COUNT(*) as recent_fallbacks
FROM migration_fallback_logs 
WHERE created_at >= now() - interval '24 hours';

-- Should return 0 before proceeding
```

#### **Step 5.2: Remove Fallback Infrastructure**
```sql
-- Drop the fallback view and triggers
DROP TRIGGER IF EXISTS oauth_providers_fallback_trigger ON oauth_providers;
DROP VIEW IF EXISTS oauth_providers;
DROP FUNCTION IF EXISTS log_oauth_providers_fallback();

-- Archive fallback logs
CREATE TABLE migration_fallback_logs_archive AS 
SELECT * FROM migration_fallback_logs;

DROP TABLE migration_fallback_logs;
```

#### **Step 5.3: Drop Original Table**
```sql
-- Final step: Drop oauth_providers table
-- ⚠️ ONLY after 100% confidence in migration
DROP TABLE IF EXISTS oauth_providers CASCADE;
```

---

## 📋 DETAILED FILE MIGRATION CHECKLIST

### **🔴 CRITICAL FILES (Must Update First)**

#### **Edge Functions:**
- [ ] `supabase/functions/get-agent-tools/index.ts`
- [ ] `supabase/functions/gmail-api/index.ts`
- [ ] `supabase/functions/gmail-oauth/index.ts`
- [ ] `supabase/functions/smtp-api/index.ts`
- [ ] `supabase/functions/web-search-api/index.ts`
- [ ] `supabase/functions/media-library-api/index.ts`
- [ ] `supabase/functions/get-agent-permissions/index.ts`
- [ ] `supabase/functions/oauth-refresh/index.ts`
- [ ] `supabase/functions/mailgun-service/index.ts`
- [ ] `supabase/functions/create-agent/index.ts`

#### **Function Calling System:**
- [ ] `supabase/functions/chat/function_calling/base.ts`
- [ ] `supabase/functions/chat/function_calling/gmail-provider.ts`
- [ ] `supabase/functions/chat/function_calling/smtp-provider.ts`

### **🟡 HIGH PRIORITY FILES**

#### **Core UI Components:**
- [ ] `src/components/modals/EnhancedToolsModal.tsx`
- [ ] `src/components/modals/tools/useToolSetupHandlers.ts`
- [ ] `src/components/modals/agent-settings/ChannelsTab.tsx`
- [ ] `src/components/modals/agent-settings/ToolsTab.tsx`
- [ ] `src/components/modals/channels/EnhancedChannelsModalRefactored.tsx`
- [ ] `src/components/modals/EnhancedChannelsModal.tsx`

#### **Integration Services:**
- [ ] `src/integrations/_shared/services/connections.ts`
- [ ] `src/integrations/digitalocean/hooks/useDigitalOceanIntegration.ts`
- [ ] `src/integrations/gmail/hooks/useGmailIntegration.ts`
- [ ] `src/integrations/smtp/services/smtp-tools.ts`
- [ ] `src/integrations/web-search/hooks/useWebSearchIntegration.ts`
- [ ] `src/integrations/gmail/services/gmail-tools.ts`

### **🟢 MEDIUM PRIORITY FILES**

#### **Setup Components:**
- [ ] `src/integrations/email-relay/components/EmailRelaySetupModal.tsx`
- [ ] `src/integrations/smtp/components/SMTPSetupModalNew.tsx`
- [ ] `src/integrations/mailgun/components/MailgunSetupModalNew.tsx`
- [ ] `src/integrations/sendgrid/components/SendGridSetupModalNew.tsx`
- [ ] `src/integrations/digitalocean/components/DigitalOceanSetupModal.tsx`
- [ ] `src/integrations/web-search/components/WebSearchSetupModal.tsx`

#### **Memory & Graph Functions:**
- [ ] `supabase/functions/chat/core/memory/getzep_retrieval.ts`
- [ ] `supabase/functions/chat/core/memory/memory_manager.ts`
- [ ] `supabase/functions/graph-ingestion/index.ts`

### **🔵 LOW PRIORITY FILES**

#### **Additional Setup Components:**
- [ ] `src/integrations/sendgrid/components/SendGridSetupModal.tsx`
- [ ] `src/integrations/mailgun/components/MailgunSetupModal.tsx`
- [ ] `src/integrations/discord/components/DiscordSetupModal.tsx`
- [ ] `src/integrations/digitalocean/components/DigitalOceanIntegrationCard.tsx`
- [ ] `src/integrations/web-search/components/WebSearchIntegrationCard.tsx`

#### **Utility & Support:**
- [ ] `src/integrations/email-providers/mailgun/useMailgunIntegration.ts`
- [ ] `src/lib/mcp/tool-registry.ts`
- [ ] `src/lib/services/graph/GraphServiceFactory.ts`

---

## ⚠️ RISK MITIGATION STRATEGIES

### **🔴 HIGH RISKS & Mitigation:**

#### **Risk: Authentication Failures**
- **Mitigation:** Test OAuth flows after each edge function update
- **Rollback:** Fallback view maintains functionality
- **Monitoring:** Log all authentication attempts

#### **Risk: Agent Tool Discovery Breaks**
- **Mitigation:** Update `get-agent-tools` function first
- **Rollback:** Fallback view ensures continuity
- **Monitoring:** Track tool discovery success rates

#### **Risk: Data Inconsistency**
- **Mitigation:** Real-time sync between tables during migration
- **Rollback:** Keep both tables in sync until cleanup
- **Monitoring:** Automated data drift detection

### **🟡 MEDIUM RISKS & Mitigation:**

#### **Risk: UI Integration Breaks**
- **Mitigation:** Update components incrementally
- **Rollback:** Feature flags for component rollback
- **Monitoring:** Frontend error tracking

#### **Risk: Performance Degradation**
- **Mitigation:** Monitor query performance continuously
- **Rollback:** Optimize indexes if needed
- **Monitoring:** Database performance metrics

---

## 📊 SUCCESS METRICS

### **Migration Progress Tracking:**
- [ ] **Phase 1:** Foundation setup (Database tables, views, logging)
- [ ] **Phase 2:** Core functions migrated (13 critical files)
- [ ] **Phase 3:** Frontend components migrated (24 UI files)
- [ ] **Phase 4:** Monitoring & validation complete
- [ ] **Phase 5:** Cleanup & finalization

### **Quality Metrics:**
- [ ] **Zero Downtime:** No service interruptions during migration
- [ ] **Data Integrity:** 100% data consistency maintained
- [ ] **Performance:** No degradation in query performance
- [ ] **Fallback Usage:** Tracked and minimized to zero
- [ ] **Error Rate:** No increase in application errors

### **Rollback Readiness:**
- [ ] **Fallback View:** Functional throughout migration
- [ ] **Data Sync:** Real-time synchronization maintained
- [ ] **Monitoring:** Complete visibility into migration progress
- [ ] **Testing:** Each phase validated before proceeding

---

## 🚀 EXECUTION TIMELINE

### **Day 1: Foundation (Phase 1)**
- **Morning:** Create service_providers table and migration infrastructure
- **Afternoon:** Set up fallback logging and monitoring

### **Day 2: Core Functions (Phase 2)**
- **Morning:** Migrate critical edge functions
- **Afternoon:** Update function calling system and test

### **Day 3: Frontend (Phase 3)**
- **Morning:** Update core UI components
- **Afternoon:** Migrate integration services and setup components

### **Day 4: Validation (Phase 4)**
- **Morning:** Monitor fallback usage and validate data integrity
- **Afternoon:** Performance testing and optimization

### **Day 5: Cleanup (Phase 5)**
- **Morning:** Final validation and cleanup
- **Afternoon:** Remove fallback infrastructure and archive logs

---

## 📞 APPROVAL CHECKPOINTS

### **Before Starting:**
- [ ] **Schema Review:** Confirm service_providers table structure
- [ ] **Timeline Approval:** Confirm 5-day migration timeline
- [ ] **Risk Assessment:** Review and approve mitigation strategies

### **After Each Phase:**
- [ ] **Phase Completion:** Verify all files in phase updated successfully
- [ ] **Quality Check:** Confirm no errors or performance issues
- [ ] **Fallback Status:** Review fallback usage logs
- [ ] **Go/No-Go Decision:** Approve proceeding to next phase

### **Before Cleanup:**
- [ ] **Zero Fallbacks:** Confirm no fallback usage in 24 hours
- [ ] **Data Validation:** Verify 100% data consistency
- [ ] **Performance Check:** Confirm no performance degradation
- [ ] **Final Approval:** Authorization to drop oauth_providers table

---

**This plan ensures a safe, monitored, and reversible migration from `oauth_providers` to `service_providers` while maintaining 100% system availability.**
