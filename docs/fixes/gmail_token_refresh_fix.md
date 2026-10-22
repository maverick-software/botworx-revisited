# Gmail Token Refresh Issue - Complete Fix

## 🚨 **Issue Summary**

Gmail token refresh was failing with the error:
```
Token has been expired or revoked.
```

## 🔍 **Root Cause Analysis**

### **Primary Issue: Incorrect Token Handling**
The `oauth-refresh` function was sending **vault UUIDs directly** to Google's OAuth API instead of **decrypting the actual refresh tokens** first.

**The Problem:**
```typescript
// WRONG - This was sending a UUID instead of the actual token
refresh_token: connection.vault_refresh_token_id,
```

### **Secondary Issue: Expired Refresh Tokens**
Through diagnostic analysis, we discovered:
- **Token expired**: 285 hours ago (almost 12 days)
- **Google's Policy**: Refresh tokens expire after 7 days of inactivity for unverified apps
- **Last Refresh**: Never attempted
- **Connection Age**: Created on 7/11/2025, making it susceptible to expiration

## ✅ **Complete Solution Implemented**

### **1. Fixed Token Decryption Logic**

**File:** `supabase/functions/oauth-refresh/index.ts`

```typescript
// CRITICAL FIX: Decrypt the refresh token from vault or use directly if it's plain text
let actualRefreshToken: string;

// Check if vault_refresh_token_id is a UUID (vault reference) or plain text token
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connection.vault_refresh_token_id);

if (isUuid) {
  // It's a vault reference, decrypt it
  console.log('Decrypting refresh token from vault...');
  const { data: decryptedToken, error: decryptError } = await supabase.rpc(
    'vault_decrypt',
    { vault_id: connection.vault_refresh_token_id }
  );
  
  if (decryptError || !decryptedToken) {
    throw new Error(`Failed to decrypt refresh token: ${decryptError?.message || 'Decryption failed'}`);
  }
  
  actualRefreshToken = decryptedToken;
} else {
  // It's stored as plain text (legacy format)
  console.log('Using refresh token stored as plain text...');
  actualRefreshToken = connection.vault_refresh_token_id;
}
```

### **2. Enhanced Error Handling**

Added intelligent error handling for expired refresh tokens:

```typescript
if (errorDetails.error === 'invalid_grant') {
  // Update connection status to indicate re-authentication is needed
  await supabase
    .from('user_oauth_connections')
    .update({
      connection_status: 'expired',
      updated_at: new Date().toISOString()
    })
    .eq('id', connectionId)
    .eq('user_id', userId);
  
  throw new Error(
    'Your Gmail connection has expired and needs to be renewed. ' +
    'This happens when tokens are unused for more than 7 days. ' +
    'Please disconnect and reconnect your Gmail account to restore access.'
  );
}
```

### **3. Fixed Authentication Flow**

Updated the function to properly handle user authentication:

```typescript
// Create Supabase client with user context for authentication
const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { 
    autoRefreshToken: false,
    persistSession: false 
  },
  global: {
    headers: { Authorization: req.headers.get('Authorization') ?? '' }
  }
});
```

### **4. Enhanced Token Storage**

Added proper tracking of token refresh operations:

```typescript
const updateData: any = {
  vault_access_token_id: newTokens.access_token,
  token_expires_at: expiresAt,
  last_token_refresh: new Date().toISOString(), // NEW: Track refresh time
  updated_at: new Date().toISOString()
};
```

## 🧪 **Verification Status**

✅ **Function Deployed**: Enhanced `oauth-refresh` function successfully deployed
✅ **Token Detection**: Function correctly identifies UUID vs plain text tokens
✅ **Error Handling**: Provides helpful error messages for expired tokens
✅ **Status Updates**: Updates connection status to 'expired' when tokens are invalid

## 📋 **User Resolution Steps**

For users experiencing this issue:

### **Immediate Solution (Required)**
1. **Navigate to Credentials Page** in the Agentopia UI
2. **Find the Gmail connection** (will show as expired/error status)
3. **Click "Disconnect"** to remove the expired connection
4. **Click "Connect with OAuth"** to create a new connection
5. **Complete Google OAuth flow** to get fresh tokens

### **Prevention**
- Use Gmail integration regularly (at least once per week)
- Monitor token expiry dates in the Credentials page
- Set up automated refresh if tokens are approaching expiry

## 🔧 **Technical Details**

### **Environment Configuration**
✅ **Google OAuth Credentials**: Properly configured in Supabase secrets
- `GOOGLE_CLIENT_ID`: ✅ Configured
- `GOOGLE_CLIENT_SECRET`: ✅ Configured

### **Database Schema**
The `user_oauth_connections` table supports both:
- **Vault UUID references**: For encrypted token storage
- **Plain text tokens**: For legacy compatibility

### **Google OAuth Policy**
- **Refresh Token Expiry**: 7 days for unverified apps
- **Access Token Expiry**: 1 hour (refreshable)
- **Inactivity Policy**: Tokens revoked after extended periods of non-use

## 🎯 **Future Improvements**

### **Recommended Enhancements**
1. **Automated Token Refresh**: Background job to refresh tokens before expiry
2. **User Notifications**: Email alerts when tokens are approaching expiry
3. **Connection Health Monitoring**: Dashboard showing token status
4. **Google App Verification**: Submit app for verification to extend token lifetime

### **Monitoring**
- Track token refresh success/failure rates
- Monitor connection health across all users
- Alert on bulk token expirations

## 📊 **Impact Assessment**

### **Before Fix**
- ❌ All Gmail token refreshes failing
- ❌ Users unable to use Gmail features
- ❌ Confusing error messages
- ❌ No clear resolution path

### **After Fix**
- ✅ Token refresh logic works for valid tokens
- ✅ Clear error messages for expired tokens
- ✅ Automatic status updates
- ✅ Clear user guidance for resolution
- ✅ Supports both vault and plain text token storage

## 🔗 **Related Documentation**

- [Gmail Integration Setup](../setup/gmail_oauth_setup.md)
- [Google OAuth Credentials Configuration](../setup/configure_google_oauth_credentials.md)
- [Supabase Vault Token Management](../plans/gmail_integration/README.md)

---

**Status**: ✅ **RESOLVED**  
**Date**: August 10, 2025  
**Impact**: All users with expired Gmail tokens now have clear resolution path
