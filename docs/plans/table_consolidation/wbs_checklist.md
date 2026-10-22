# 📊 **Table Consolidation Plan - WBS Checklist**
## *Consolidating agent_oauth_permissions & user_oauth_connections → agent_integration_permissions*

---

## 📋 **Project Overview**

**Issue**: The codebase contains references to old table names that have been consolidated:
- `agent_oauth_permissions` (OLD) 
- `user_oauth_connections` (OLD)
- Should reference `agent_integration_permissions` & `user_integration_credentials` (NEW)

**Impact**: This causes channels modal to show incorrect data (e.g., Serper API appearing as Gmail)

**Files Affected**: 150+ files across the entire codebase

---

## 🎯 **Phase 1: Investigation & Backup**

### **1.1 Environment Setup**
- [ ] **Create backup** of current database state
- [ ] **Document current schema** for reference
- [ ] **Commit all pending changes** before starting consolidation

### **1.2 Table Mapping Analysis**  
- [ ] **Map old → new table relationships**:
  - `agent_oauth_permissions` → `agent_integration_permissions`
  - `user_oauth_connections` → `user_integration_credentials`
- [ ] **Document column mapping** between old and new schemas
- [ ] **Identify data migration requirements**

### **1.3 Categorize Affected Files**
- [ ] **Database Migrations** (25+ files)
- [ ] **Supabase Functions** (5+ functions)  
- [ ] **Frontend Integration Code** (10+ files)
- [ ] **Documentation** (30+ files)
- [ ] **Scripts & Tests** (80+ files)

---

## 🎯 **Phase 2: Database Layer Fixes**

### **2.1 Critical Supabase Functions** ⚡ HIGH PRIORITY
- [ ] **`supabase/functions/get-agent-permissions/index.ts`**
  - Update query to use `agent_integration_permissions`
  - Fix JOIN with `user_integration_credentials`
  - Test with channels modal
- [ ] **`supabase/functions/gmail-oauth/index.ts`**
  - Update OAuth connection storage logic
- [ ] **`supabase/functions/gmail-api/index.ts`**
  - Fix credential retrieval logic

### **2.2 Database Migrations Review**
- [ ] **Review active migrations** that reference old tables
- [ ] **Create migration** to clean up remaining old table references
- [ ] **Verify migration safety** before applying

---

## 🎯 **Phase 3: Frontend Integration Fixes**

### **3.1 Integration Services** ⚡ HIGH PRIORITY  
- [ ] **`src/integrations/_shared/services/connections.ts`**
  - Update connection service to use new tables
  - Fix queries and data retrieval
- [ ] **`src/integrations/digitalocean/hooks/useDigitalOceanIntegration.ts`**
  - Update hook to reference correct tables
- [ ] **`src/integrations/digitalocean/services/digitalocean-tools.ts`**
  - Fix service layer table references

### **3.2 Channels Modal Fix** ⚡ CRITICAL
- [ ] **Update channels modal data fetching**
  - Fix query in `useAgentIntegrationPermissions`
  - Ensure correct provider mapping
  - Test Serper API vs Gmail display

---

## 🎯 **Phase 4: Testing & Verification**

### **4.1 Data Integrity Tests**
- [ ] **Run corrected channels query**:
  ```sql
  SELECT aip.agent_id, aip.user_oauth_connection_id, 
         uic.connection_name, uic.provider_key,
         op.name as provider_name, op.display_name
  FROM agent_integration_permissions aip
  LEFT JOIN user_integration_credentials uic ON aip.user_oauth_connection_id = uic.id  
  LEFT JOIN oauth_providers op ON uic.oauth_provider_id = op.id
  ```
- [ ] **Verify channels modal** shows correct provider names
- [ ] **Test OAuth flows** still work properly

### **4.2 Integration Testing**
- [ ] **Gmail integration** - verify OAuth and API calls work
- [ ] **DigitalOcean integration** - verify API key management works  
- [ ] **Serper API integration** - verify web search tools work
- [ ] **All other integrations** - smoke test each one

---

## 🎯 **Phase 5: Documentation & Script Updates**

### **5.1 Documentation Updates** 
- [ ] **Update all `.md` files** with new table references
- [ ] **Update API documentation** 
- [ ] **Update developer guides**

### **5.2 Script & Test Updates**
- [ ] **Update diagnostic scripts** (80+ files)
- [ ] **Update test files**
- [ ] **Remove obsolete scripts** that reference old tables

---

## 🎯 **Phase 6: Clean-up & Validation**

### **6.1 Final Verification**
- [ ] **Run comprehensive test suite**
- [ ] **Verify all integrations functional** 
- [ ] **Check logs for any remaining errors**

### **6.2 Clean-up Tasks**
- [ ] **Remove old table references** from codebase
- [ ] **Update project documentation**
- [ ] **Archive old migration files** if needed

---

## ⚠️ **Critical Success Factors**

### **🔒 Safety Protocols**
1. **Database backups** before any changes
2. **Incremental testing** after each phase
3. **Rollback plan** documented and ready
4. **No changes to production** until fully tested

### **🎯 Priority Order**
1. **CRITICAL**: Channels modal fix (immediate user impact)
2. **HIGH**: Core Supabase functions (OAuth flows)  
3. **MEDIUM**: Frontend integration hooks
4. **LOW**: Documentation and utility scripts

### **✅ Validation Criteria**
- [ ] Channels modal shows correct provider names
- [ ] All OAuth integrations work properly
- [ ] No console errors or broken functionality
- [ ] All tests pass

---

## 📊 **Progress Tracking**

**Phase 1**: ✅ **COMPLETED** - Investigation & Backup  
**Phase 2**: ✅ **COMPLETED** - Database Layer Fixes  
**Phase 3**: ✅ **COMPLETED** - Frontend Integration Fixes  
**Phase 4**: 🔄 **IN PROGRESS** - Testing & Verification  
**Phase 5**: ⏳ Pending - Documentation & Script Updates  
**Phase 6**: ⏳ Pending - Clean-up & Validation  

**Overall Progress**: 60% Complete

---

## 🚨 **Immediate Next Steps**

1. **Create database backup**
2. **Run the corrected channels query** to verify data issue
3. **Fix `get-agent-permissions` function** (most critical)
4. **Test channels modal** with fix
5. **Proceed systematically through phases**

---

*This consolidation will resolve the Serper API → Gmail mapping issue and ensure data consistency across the entire platform.*
