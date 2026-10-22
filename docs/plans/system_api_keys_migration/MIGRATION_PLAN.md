# System API Keys Migration Plan
**Date**: October 14, 2025  
**Purpose**: Migrate user-level integrations to system-level API keys

## Overview

Convert the following integrations from user-managed to system-managed API keys:
1. **ClickSend SMS** - SMS/MMS messaging service
2. **Mistral AI** - AI model provider
3. **OCR.Space** - OCR document processing
4. **Serper API** - Web search provider
5. **SMTP.com** - Email relay service

These will follow the same pattern as OpenAI and Anthropic - single system-wide API keys that all users leverage.

## Current Architecture Analysis

### Existing System API Keys
- **Location**: `src/pages/admin/AdminSystemAPIKeysPage.tsx`
- **Database Table**: `system_api_keys`
- **Storage Method**: Supabase Vault (encrypted)
- **Current Providers**: OpenAI, Anthropic

### Current User-Level Integration Pattern
```
User → IntegrationsPage → service_providers → user_integration_credentials → 
agent_integration_permissions → Tool Execution
```

### Target System-Level Pattern
```
Admin → System API Keys → system_api_keys (Vault encrypted) → 
Global Tool Availability → Tool Execution
```

## Migration Steps

### Phase 1: Database Schema Updates

#### 1.1 Add New Providers to system_api_keys
```sql
-- Add new system API key providers
INSERT INTO system_api_keys (provider_name, display_name, is_active) VALUES
  ('clicksend_sms', 'ClickSend SMS', false),
  ('mistral_ai', 'Mistral AI', false),
  ('ocr_space', 'OCR.Space', false),
  ('serper_api', 'Serper API', false),
  ('smtp_com', 'SMTP.com', false);
```

#### 1.2 Data Migration Function
```sql
-- Function to migrate existing user API keys to admin notification
CREATE OR REPLACE FUNCTION migrate_user_api_keys_to_system()
RETURNS TABLE(
  user_email text,
  provider_name text,
  api_key_exists boolean
) AS $$
BEGIN
  -- Return list of users with existing API keys for migration
  RETURN QUERY
  SELECT 
    u.email,
    sp.name as provider_name,
    (uic.vault_access_token_id IS NOT NULL) as api_key_exists
  FROM user_integration_credentials uic
  JOIN service_providers sp ON sp.id = uic.service_provider_id
  JOIN auth.users u ON u.id = uic.user_id
  WHERE sp.name IN ('clicksend_sms', 'mistral_ai', 'ocr_space', 'serper_api', 'smtp_com')
    AND uic.connection_status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Phase 2: Frontend Updates

#### 2.1 Update AdminSystemAPIKeysPage.tsx
Add configurations for new providers:

```typescript
const NEW_API_KEY_CONFIGS: APIKeyConfig[] = [
  {
    provider: 'clicksend_sms',
    displayName: 'ClickSend SMS',
    keyPrefix: '', // No specific prefix
    description: 'Platform-wide ClickSend API key for SMS/MMS services',
    docsUrl: 'https://developers.clicksend.com/docs/rest/v3/',
    getKeyUrl: 'https://dashboard.clicksend.com/#/account/subaccounts'
  },
  {
    provider: 'mistral_ai',
    displayName: 'Mistral AI',
    keyPrefix: '', // Varies
    description: 'Platform-wide Mistral AI API key for AI models',
    docsUrl: 'https://docs.mistral.ai/',
    getKeyUrl: 'https://console.mistral.ai/api-keys'
  },
  {
    provider: 'ocr_space',
    displayName: 'OCR.Space',
    keyPrefix: '', // API keys vary
    description: 'Platform-wide OCR.Space API key for document processing',
    docsUrl: 'https://ocr.space/OCRAPI',
    getKeyUrl: 'https://ocr.space/ocrapi/freekey'
  },
  {
    provider: 'serper_api',
    displayName: 'Serper API',
    keyPrefix: '', // API keys vary
    description: 'Platform-wide Serper API key for web search',
    docsUrl: 'https://serper.dev/docs',
    getKeyUrl: 'https://serper.dev/api-key'
  },
  {
    provider: 'smtp_com',
    displayName: 'SMTP.com',
    keyPrefix: '', // API keys vary
    description: 'Platform-wide SMTP.com API key for email relay',
    docsUrl: 'https://www.smtp.com/resources/api-documentation/',
    getKeyUrl: 'https://app.smtp.com/api-keys'
  }
];
```

#### 2.2 Remove from User Integrations Page
- Remove these providers from `IntegrationsPage`
- Remove setup modals for these providers
- Update integration registry to mark as system-level

### Phase 3: Backend Edge Function Updates

#### 3.1 Update Edge Functions to Use System Keys ONLY

**Files to Update:**
- `supabase/functions/clicksend-api/index.ts`
- `supabase/functions/web-search-api/index.ts` (for Serper)
- `supabase/functions/smtp-api/index.ts`
- Create new: `supabase/functions/mistral-ai-api/index.ts`
- Create new: `supabase/functions/ocr-space-api/index.ts`

**Pattern for Each:**
```typescript
// REMOVE ALL USER-LEVEL API KEY LOGIC

// ONLY USE SYSTEM API KEY
const { data: systemKey } = await supabase
  .from('system_api_keys')
  .select('vault_secret_id')
  .eq('provider_name', 'provider_name')
  .eq('is_active', true)
  .single();

if (!systemKey?.vault_secret_id) {
  return {
    success: false,
    error: 'System API key not configured. Please contact your administrator to set up this service.'
  };
}

// Decrypt from vault
const apiKey = await decryptFromVault(systemKey.vault_secret_id);
```

**Key Changes:**
- ❌ Remove all `user_integration_credentials` queries
- ❌ Remove all user API key fallback logic
- ✅ System keys are the ONLY source of API credentials
- ✅ Clear error message directing users to admin

### Phase 4: Tool Discovery Updates

#### 4.1 Update get-agent-tools Function
Modify `supabase/functions/get-agent-tools/index.ts`:

```typescript
// NEW: Check for system-level integrations
const { data: systemKeys } = await supabase
  .from('system_api_keys')
  .select('provider_name, is_active')
  .eq('is_active', true);

const systemProviders = new Set(systemKeys?.map(k => k.provider_name) || []);

// Add tools for system-level providers automatically
if (systemProviders.has('clicksend_sms')) {
  tools.push({
    name: 'send_sms',
    description: 'Send SMS messages via ClickSend',
    parameters: generateParametersForCapability('send_sms'),
    status: 'active',
    provider_name: 'ClickSend SMS',
    connection_name: 'System'
  });
}

// Repeat for other system providers
```

### Phase 5: Migration Script

#### 5.1 Create Migration Notification Script
```typescript
// scripts/notify_api_key_migration.ts
/**
 * Notify users that their API keys are being migrated to system-level
 * Generate report of users affected
 */
async function generateMigrationReport() {
  const { data } = await supabase.rpc('migrate_user_api_keys_to_system');
  
  // Generate CSV report
  // Send email notifications to affected users
  // Log migration for audit trail
}
```

#### 5.2 Migration Timeline
- **Week 1**: Add system API keys to admin panel, notify users of upcoming change
- **Week 2**: Remove user integration setup UI, update edge functions to use ONLY system keys
- **Week 3**: Archive/delete user API keys from database
- **Week 4**: Monitor usage and ensure smooth operation

### Phase 6: Documentation Updates

#### 6.1 Update User Documentation
- Remove user setup instructions for these integrations
- Add note: "These services are now system-wide. Contact your administrator."

#### 6.2 Update Admin Documentation
- Add system API key setup guide
- Document where to obtain each API key
- Explain cost implications and usage monitoring

## Breaking Changes ⚠️

### For Users
- ❌ **BREAKING**: Users can NO LONGER configure their own API keys for these 5 services
- ❌ **BREAKING**: All existing user API keys for these services will be DELETED
- ✅ **BENEFIT**: No need to manage API keys individually
- ⚠️ **REQUIRED ACTION**: Users must coordinate with admin to ensure services remain available

### For Agents
- ⚠️ **POTENTIALLY BREAKING**: Tools become unavailable if admin hasn't configured system key
- ✅ **NON-BREAKING**: If system key configured, agents work without any changes
- ℹ️ **MIGRATION**: No agent configuration changes needed, but admin action required

### Communication Plan
1. **2 weeks before**: Email all users about the change
2. **1 week before**: In-app banner notification
3. **Day of**: Clear error messages directing to admin
4. **After**: Admin guide for setting up system keys

## Data Cleanup

### User API Key Removal Process
1. **Export existing user keys** for backup/audit purposes
2. **Archive user credentials** for these 5 providers:
   ```sql
   -- Archive user credentials before deletion
   INSERT INTO user_integration_credentials_archive
   SELECT * FROM user_integration_credentials
   WHERE service_provider_id IN (
     SELECT id FROM service_providers 
     WHERE name IN ('clicksend_sms', 'mistral_ai', 'ocr_space', 'serper_api', 'smtp_com')
   );
   
   -- Delete user credentials for migrated providers
   DELETE FROM user_integration_credentials
   WHERE service_provider_id IN (
     SELECT id FROM service_providers 
     WHERE name IN ('clicksend_sms', 'mistral_ai', 'ocr_space', 'serper_api', 'smtp_com')
   );
   ```
3. **Remove setup UI components** completely
4. **Update service_providers** to mark as system-only:
   ```sql
   UPDATE service_providers 
   SET configuration_metadata = jsonb_set(
     COALESCE(configuration_metadata, '{}'::jsonb),
     '{system_level_only}',
     'true'::jsonb
   )
   WHERE name IN ('clicksend_sms', 'mistral_ai', 'ocr_space', 'serper_api', 'smtp_com');
   ```

### No Rollback - Migration is Permanent
This is a **breaking change** that removes user-level API key functionality completely. Users will be notified in advance and must accept that these services will be system-managed going forward.

## Testing Checklist

- [ ] System API key can be added via admin panel
- [ ] System API key is encrypted in Vault
- [ ] System API key can be retrieved and decrypted
- [ ] Edge functions use system key correctly
- [ ] Tools appear in agent tool list when system key active
- [ ] Tools work correctly with system key
- [ ] Error messages are clear when system key missing
- [ ] User keys are properly deprecated
- [ ] No data loss during migration
- [ ] Rollback procedure works

## Cost & Usage Monitoring

### Admin Dashboard Enhancements Needed
- Add usage tracking per system API key
- Show API call volume by provider
- Alert when approaching rate limits
- Display cost estimates based on usage

### Recommended Monitoring
```sql
-- Track API usage by provider
CREATE TABLE system_api_key_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_name TEXT NOT NULL,
  endpoint TEXT,
  user_id UUID REFERENCES auth.users(id),
  agent_id UUID REFERENCES agents(id),
  tokens_used INTEGER,
  cost_estimate DECIMAL(10,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Security Considerations

### Access Control
- ✅ Only admin users can view/edit system API keys
- ✅ Keys stored in Supabase Vault (AES-256 encryption)
- ✅ All access logged for audit trail
- ✅ Keys never exposed to frontend

### Rate Limiting
- Implement per-user rate limits even with system keys
- Prevent abuse from single user consuming quota
- Track and alert on unusual usage patterns

## Implementation Order

1. ✅ **Create Migration Plan** (This document)
2. ⏳ **Database Schema** - Add new providers to system_api_keys
3. ⏳ **Frontend Admin Panel** - Add UI for new providers
4. ⏳ **Backend Edge Functions** - Update to use system keys
5. ⏳ **Tool Discovery** - Update agent tool availability
6. ⏳ **Remove User UI** - Deprecate user-level setup
7. ⏳ **Testing** - Comprehensive testing
8. ⏳ **Documentation** - Update all docs
9. ⏳ **Migration** - Execute migration
10. ⏳ **Monitoring** - Track usage and costs

## Success Criteria

- All 5 integrations working with system API keys
- Zero user-facing API key management for these services
- Admin panel successfully managing all system keys
- Clear error messages when keys not configured
- All existing agent functionality preserved
- Documentation complete and accurate

## Questions to Resolve

1. **Cost Allocation**: How to track which users/agents consume most API credits?
2. **Rate Limits**: Should there be per-user limits on system API usage?
3. ~~**Fallback**: Should we keep user keys as fallback or hard cutover?~~ ✅ **RESOLVED**: Complete removal, no fallback
4. **Notification**: How to notify users of the change? (Email + in-app)
5. **Granularity**: Should system keys be tenant-specific or truly global?
6. **Migration Date**: When should we execute this breaking change?

---

**Next Steps**: Review and approve plan, then proceed with Phase 1 implementation.

