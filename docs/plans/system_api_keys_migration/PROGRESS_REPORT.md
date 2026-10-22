# System API Keys Migration - Progress Report

**Date:** October 13, 2025  
**Status:** Phase 1 & 2 Partially Complete

## ✅ Completed Work

### Phase 1: Frontend Admin Panel (COMPLETE)
- ✅ Added 5 new integrations to `AdminSystemAPIKeysPage.tsx`:
  - ClickSend SMS
  - Mistral AI
  - OCR.Space
  - Serper API
  - SMTP.com
- ✅ Updated validation logic to handle keys without specific prefixes
- ✅ Updated UI text to reflect "AI models, communication services, and integrations"
- ✅ All 7 system integrations now manageable from Admin Settings

### Phase 2: Backend Edge Functions (PARTIALLY COMPLETE)

#### ✅ ClickSend SMS - COMPLETE
**File:** `supabase/functions/clicksend-api/index.ts`
- ✅ Backed up original file
- ✅ Removed all user-level permission checks
- ✅ Removed agent_integration_permissions queries
- ✅ Implemented system-level API key retrieval from `system_api_keys` table
- ✅ Handles username:apikey format parsing
- ✅ Provides clear error messages directing users to admin
- ✅ No lint errors

**Key Changes:**
```typescript
// OLD: User-level credentials
const { data: agentPermissions } = await supabase
  .from('agent_integration_permissions')
  .select(/* complex join */)
  .eq('user_id', user.id)
  .eq('service_providers.name', 'clicksend_sms')

// NEW: System-level credentials
const { data: systemKey } = await supabase
  .from('system_api_keys')
  .select('vault_secret_id, is_active')
  .eq('provider_name', 'clicksend_sms')
  .eq('is_active', true)
  .single();
```

#### ✅ Serper API (Web Search) - COMPLETE
**File:** `supabase/functions/web-search-api/index.ts`
- ✅ Backed up original file
- ✅ Implemented HYBRID approach:
  - System-level key for Serper API (primary)
  - User-level fallback for SerpAPI and Brave Search
- ✅ Provider preference: Serper (system) → Brave (user) → SerpAPI (user)
- ✅ Clear logging for system vs user key usage
- ✅ No lint errors

**Key Changes:**
```typescript
// Check for system-level Serper API key first
const { data: systemSerperKey } = await supabase
  .from('system_api_keys')
  .select('vault_secret_id, is_active')
  .eq('provider_name', 'serper_api')
  .eq('is_active', true)
  .maybeSingle();

// Use system key when available, fall back to user keys for other providers
if (providerName === 'serper_api' && hasSystemSerper) {
  apiKey = await decryptSystemKey(systemSerperKey.vault_secret_id);
} else {
  apiKey = await getUserLevelKey(providerName);
}
```

---

## 🚧 In Progress / TODO

### Phase 2: Backend Edge Functions (REMAINING)

#### ⏳ SMTP.com API - NOT STARTED
**File:** `supabase/functions/smtp-api/index.ts`
**Status:** Needs system key integration (972 lines, complex)
**Complexity:** HIGH - Handles multiple SMTP configs, connection pooling

**Required Changes:**
1. Add system-level SMTP.com API check
2. Support both system (SMTP.com) and user-level (custom SMTP) configs
3. Update auto-discovery logic to check system keys first
4. Handle SMTP.com-specific configuration format

#### ⏳ Mistral AI - NEEDS NEW EDGE FUNCTION
**Status:** No existing edge function
**Required:**
- Create `supabase/functions/mistral-ai-api/index.ts`
- Follow OpenAI/Anthropic pattern
- System-level API key only
- Support chat completions
- Proper error handling

#### ⏳ OCR.Space - NEEDS NEW EDGE FUNCTION  
**Status:** No existing edge function
**Required:**
- Create `supabase/functions/ocr-space-api/index.ts`
- System-level API key only
- Support image URL and base64 input
- Return structured OCR results

### Phase 3: Tool Discovery (NOT STARTED)
**File:** `supabase/functions/get-agent-tools/index.ts` (likely)
**Required:**
- Update tool availability checks to look for system keys
- Remove tool hiding when user doesn't have personal API keys
- For migrated services, show tools if system key is configured

### Phase 4: User UI Removal (NOT STARTED)
**Files to Update:**
- `src/pages/IntegrationsPage.tsx` (or similar)
- Integration setup modals for:
  - ClickSend SMS
  - Mistral AI
  - OCR.Space
  - Serper API
  - SMTP.com
- Remove/hide setup UI for these services
- Add notice: "This service is managed by your administrator"

### Phase 5: Database Cleanup (NOT STARTED)
**Required:**
1. Create migration script to archive user credentials
2. Archive user API keys for the 5 services
3. Update `service_providers` table to mark as system-only
4. Test data cleanup doesn't break existing functionality

### Phase 6: Testing (NOT STARTED)
- [ ] Admin can add/update/delete system API keys
- [ ] ClickSend SMS works with system key
- [ ] Serper web search works with system key
- [ ] SMTP.com works with system key
- [ ] Mistral AI works with system key
- [ ] OCR.Space works with system key
- [ ] User-level keys for other services still work
- [ ] Error messages are clear and helpful
- [ ] Vault encryption/decryption works properly

### Phase 7: Deployment (NOT STARTED)
- [ ] Deploy edge functions to Supabase
- [ ] Run database migration scripts
- [ ] Update environment variables if needed
- [ ] Monitor error logs
- [ ] Communicate changes to users

---

## 📊 Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Admin Panel | ✅ Complete | 100% |
| Phase 2: Edge Functions | 🟡 In Progress | 40% (2/5) |
| Phase 3: Tool Discovery | ⏳ Not Started | 0% |
| Phase 4: User UI Removal | ⏳ Not Started | 0% |
| Phase 5: Database Cleanup | ⏳ Not Started | 0% |
| Phase 6: Testing | ⏳ Not Started | 0% |
| Phase 7: Deployment | ⏳ Not Started | 0% |
| **Overall** | 🟡 **In Progress** | **~25%** |

---

## 🎯 Next Steps (Priority Order)

1. **Create Mistral AI edge function** (HIGH PRIORITY)
2. **Create OCR.Space edge function** (HIGH PRIORITY)
3. **Update SMTP-API for system keys** (MEDIUM PRIORITY)
4. **Update tool discovery system** (MEDIUM PRIORITY)
5. **Remove user integration UI** (MEDIUM PRIORITY)
6. **Test all system integrations** (HIGH PRIORITY)
7. **Deploy and monitor** (CRITICAL)

---

## 📝 Notes & Considerations

### Design Decisions Made:
1. **ClickSend**: System-only, no user keys
2. **Serper**: System-first, allows user fallback to other providers (SerpAPI, Brave)
3. **Credential Format**: ClickSend uses `username:apikey` format in single vault entry

### Potential Issues:
1. **SMTP Complexity**: The SMTP edge function is very complex (972 lines) and handles both SMTP.com and custom SMTP servers. May need careful refactoring.
2. **Tool Discovery**: Need to ensure agents can still discover/use tools when system keys are configured but user doesn't have personal connection.
3. **Backwards Compatibility**: During transition, some agents may have existing user-level credentials that need to be handled gracefully.

### Questions for User:
1. Should we support a "grace period" where both user and system keys work?
   - **ANSWER:** No, complete removal of user keys
2. What should happen to agents currently using user-level keys for these services?
   - **ANSWER:** They switch to system keys, no fallback
3. Should we notify users before removing their API keys?
   - **ANSWER:** Yes, 2 weeks advance notice recommended

---

## 🔗 Related Files

- Migration Plan: `docs/plans/system_api_keys_migration/MIGRATION_PLAN.md`
- Backup Directory: `archive/edge_functions_user_keys_backup_20251013_171604/`
- Admin Panel: `src/pages/admin/AdminSystemAPIKeysPage.tsx`
- Edge Functions:
  - `supabase/functions/clicksend-api/index.ts` ✅
  - `supabase/functions/web-search-api/index.ts` ✅
  - `supabase/functions/smtp-api/index.ts` ⏳
  - `supabase/functions/mistral-ai-api/index.ts` ❌ (doesn't exist)
  - `supabase/functions/ocr-space-api/index.ts` ❌ (doesn't exist)

---

**Last Updated:** October 13, 2025, 5:16 PM  
**Updated By:** AI Assistant (Claude Sonnet 4.5)

