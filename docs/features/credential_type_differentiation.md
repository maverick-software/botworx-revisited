# Credential Type Differentiation Implementation

**Date:** August 3, 2025  
**Purpose:** Differentiate between API keys and OAuth tokens in the integrations and credentialing system

## Overview

This feature implements proper differentiation between API keys and OAuth tokens throughout the Agentopia platform, providing users with appropriate UI interfaces and backend handling for each credential type.

## Key Differences

### API Keys
- **Long-lived credentials** that don't expire automatically
- **Cannot be refreshed** - must be manually updated when they expire or are revoked
- **Simpler authentication** - just need the key value
- **Used for:** Web search providers (Serper, SerpAPI, Brave Search)

### OAuth Tokens
- **Short-lived credentials** with automatic expiration
- **Can be refreshed** using refresh tokens
- **Complex authentication flow** with user consent
- **Used for:** Gmail, Slack, GitHub, Microsoft integrations

## Implementation Details

### 1. Database Schema Changes

**New Enum:**
```sql
CREATE TYPE "public"."connection_credential_type_enum" AS ENUM (
    'oauth', 
    'api_key'
);
```

**Table Updates:**
- Added `credential_type` column to `user_oauth_connections` table
- Updated constraints to handle different credential types appropriately
- Updated `get_user_oauth_connections` function to include credential type

### 2. Backend Service Updates

**Files Modified:**
- `supabase/functions/web-search-api/index.ts` - Filter by `credential_type = 'api_key'`
- `supabase/functions/chat/function_calling.ts` - Updated Gmail and web search tool queries
- `supabase/functions/oauth-refresh/index.ts` - Added credential type validation

**Key Changes:**
- OAuth refresh now rejects API key connections with clear error messages
- Web search queries specifically filter for API key connections
- Gmail queries specifically filter for OAuth connections

### 3. Frontend UI Changes

**CredentialsPage.tsx:**
- Added credential type badges (OAuth/API Key) with color coding
- Conditional display of "Refresh Token" button (OAuth only)
- Different status indicators for API keys vs OAuth tokens
- Updated token expiry display logic

**Visual Improvements:**
- OAuth connections: Blue badges and Shield icons
- API Key connections: Yellow badges and Key icons
- API keys show "Long-lived credential (no expiry)" instead of expiry date
- Refresh token button only appears for active OAuth connections

### 4. Integration Setup Updates

**Files Modified:**
- `src/components/integrations/IntegrationSetupModal.tsx`
- `src/components/integrations/WebSearchIntegrationCard.tsx`

**Changes:**
- API key integrations now properly set `credential_type: 'api_key'`
- Existing OAuth integrations maintain `credential_type: 'oauth'` (via migration defaults)

## Migration Strategy

The migration (`20250803000001_add_credential_type_differentiation.sql`) automatically:

1. **Sets existing connections** to correct credential types based on provider:
   - Web search providers → `api_key`
   - OAuth providers (Gmail, GitHub, etc.) → `oauth`

2. **Handles invalid states** by setting connections with missing tokens to 'error' status

3. **Updates constraints** to allow API keys without refresh tokens

## User Experience Improvements

### Before
- All credentials showed "Refresh Token" button regardless of type
- No visual distinction between API keys and OAuth tokens
- Confusing UX when users tried to refresh API keys

### After
- **API Keys:** Show "API Key Active" status with key icon
- **OAuth Tokens:** Show "Refresh Token" button with refresh functionality
- **Clear visual coding:** Blue for OAuth, Yellow for API keys
- **Appropriate actions:** Only show refresh for OAuth connections

## Testing Scenarios

1. **API Key Connections:**
   - ✅ No refresh token button shown
   - ✅ Shows "API Key Active" status
   - ✅ Shows "Long-lived credential (no expiry)"
   - ✅ Yellow badge with "API Key" label

2. **OAuth Connections:**
   - ✅ Refresh token button available for active connections
   - ✅ Shows token expiry information
   - ✅ Blue badge with "OAuth" label
   - ✅ Proper refresh functionality

3. **Backend Validation:**
   - ✅ API key refresh attempts return appropriate error
   - ✅ Web search tools only query API key connections
   - ✅ Gmail tools only query OAuth connections

## Error Handling

- **API Key Refresh Attempts:** Clear error message stating "API keys cannot be refreshed"
- **Missing Tokens:** Invalid connections marked as 'error' status
- **Type Mismatches:** Proper filtering prevents type confusion

## Future Considerations

1. **Additional OAuth Providers:** New OAuth integrations will automatically use `credential_type: 'oauth'`
2. **Additional API Key Providers:** Set `credential_type: 'api_key'` during integration setup
3. **Hybrid Providers:** Could support both credential types with provider-specific logic

## Files Modified

### Database
- `supabase/migrations/20250803000001_add_credential_type_differentiation.sql`

### Backend Functions
- `supabase/functions/web-search-api/index.ts`
- `supabase/functions/chat/function_calling.ts`
- `supabase/functions/oauth-refresh/index.ts`

### Frontend Components
- `src/pages/CredentialsPage.tsx`
- `src/components/integrations/IntegrationSetupModal.tsx`
- `src/components/integrations/WebSearchIntegrationCard.tsx`

## Conclusion

This implementation provides a solid foundation for properly handling different credential types throughout the Agentopia platform, improving user experience and preventing confusion between API keys and OAuth tokens.