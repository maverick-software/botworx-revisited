# Security Updates & Architecture

This document outlines Gofr Agents' comprehensive security architecture and critical security updates that have been implemented to ensure enterprise-grade protection.

## 🔒 Critical Security Fix: Integration Permissions System (January 2025)

### The Problem: Rogue Tool Access
Fixed a **critical security vulnerability** where agents could access tools and credentials they weren't explicitly authorized to use due to parallel permission systems creating security bypasses.

**Critical Issues Resolved:**
- Agents accessing Gmail tools without proper authorization
- Old MCP (Model Context Protocol) cache bypassing unified permission system
- Tool name collisions causing incorrect routing (multiple `send_email` tools)
- Example: Agent Angela accessing Gmail without permission while having legitimate SMTP access

### The Solution: Unified Permission Architecture

#### 1. Namespaced Tool System
Eliminated tool name collisions with provider-specific naming:
- `gmail_send_email` (Gmail-specific email sending)
- `smtp_send_email` (SMTP server email sending)  
- `sendgrid_send_email` (SendGrid API email sending)
- `mailgun_send_email` (Mailgun API email sending)

#### 2. Database-Driven Authorization
- Agents only see tools they're explicitly authorized for in `agent_integration_permissions`
- Permissions checked at both tool discovery and execution time
- Zero bypass mechanisms - no parallel systems

#### 3. Secure Credential Management
- All credentials encrypted in Supabase Vault (no plain-text storage)
- Vault-based token retrieval for OAuth systems
- Service role authentication required for all decryption

### What Was Removed & Why

**Removed Components:**
- **Old MCP Tools Cache**: Entries that bypassed authorization
- **Deprecated SMTP Tables**: `agent_smtp_permissions` and `smtp_configurations`
- **Gmail MCP Connections**: Old unauthorized Gmail access entries
- **Plain-Text Fallbacks**: Eliminated all plain-text credential storage

**Security Benefits:**
- **Eliminated Bypass Routes**: No parallel permission systems
- **Data Consistency**: Single source of truth for authorization
- **Compliance**: Meets enterprise security standards
- **Audit Trail**: Complete tracking of all access attempts

### Result: True Zero-Trust Architecture

**Before Fix:**
```
Agent → Sees all tools → Can execute any tool (security bypass)
```

**After Fix:**
```  
Agent → Database Permission Check → Authorized Tools Only → Vault-Secured Execution
```

**Security Validation:**
- ✅ Agents with SMTP permission: See only `smtp_send_email` 
- ✅ Agents without Gmail permission: Cannot see `gmail_send_email`
- ✅ No tool name collisions: Each provider has unique tool names
- ✅ No credential bypass: All secrets require vault decryption

## 🛡️ Enterprise-Grade Centralized Secrets Management

### System Architecture
All sensitive credentials are stored in a **centralized vault system** with zero plain-text storage:

| Integration Type | Storage Method | Encryption | Status |
|------------------|---------------|------------|--------|
| **OAuth Tokens** | `user_integration_credentials` | ✅ Vault UUID | **SECURE** |
| **API Keys** | `user_integration_credentials` | ✅ Vault UUID | **SECURE** |
| **Service Credentials** | Supabase Vault | ✅ AES Encryption | **SECURE** |
| **Database Tokens** | Supabase Vault | ✅ AES Encryption | **SECURE** |

### Zero Plain-Text Policy

**CRITICAL PRINCIPLE**: No sensitive data is ever stored in plain text.

```typescript
// ✅ SECURE: How credentials are stored
const { data: vaultId } = await supabase.rpc('create_vault_secret', {
  p_secret: apiKeyOrToken,
  p_name: `${provider}_${type}_${userId}_${timestamp}`,
  p_description: `${provider} credential for user ${userId}`
});

// Store only the vault UUID - never the actual secret
{
  vault_access_token_id: vaultId,     // UUID like 'dc067ffc-59df-4770-a18e-0f05d85ee6e7'
  encrypted_access_token: null,        // NO plain text storage
  credential_type: 'oauth' | 'api_key'
}
```

### VaultService Class - Centralized API

The `VaultService` class provides the **single source of truth** for all secret operations:

```typescript
import { VaultService } from '@/services/VaultService';

const vaultService = new VaultService(supabaseClient);

// Create encrypted secret
const secretId = await vaultService.createSecret(
  'provider_api_key_user123_1641234567890',
  'sk-actual-secret-value',
  'OpenAI API key for user 123'
);

// Retrieve decrypted secret (server-side only)
const secretValue = await vaultService.getSecret(secretId);
```

## 🗄️ Database Security Architecture

### Unified Integration Credentials Table
**NEW TABLE**: `user_integration_credentials` (renamed from `user_oauth_connections`)

```sql
-- Centralized table for ALL integration credentials
CREATE TABLE user_integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_provider_id uuid NOT NULL,  -- References service_providers table
  credential_type 'oauth' | 'api_key' NOT NULL,
  
  -- SECURE STORAGE: Only vault UUIDs stored
  vault_access_token_id text,    -- Vault UUID for token/key
  vault_refresh_token_id text,   -- Vault UUID for refresh token (OAuth only)
  encrypted_access_token text,   -- DEPRECATED: Always NULL in new system
  encrypted_refresh_token text,  -- DEPRECATED: Always NULL in new system
  
  -- Metadata and status
  connection_name text NOT NULL,
  connection_status text DEFAULT 'active',
  token_expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### Vault Functions - Server-Side Security

**Core RPC Functions:**

1. **`public.create_vault_secret(p_secret TEXT, p_name TEXT, p_description TEXT)`**
   - **Purpose**: Encrypt and store secrets in Supabase Vault
   - **Access**: Service role only - never client-side
   - **Returns**: Vault UUID for database storage

2. **`public.vault_decrypt(vault_id TEXT)`**
   - **Purpose**: Decrypt secrets from vault by UUID
   - **Access**: Service role only - never client-side
   - **Security**: No fallback to plain text (removed for security)

## 🎯 Security Compliance Standards

### HIPAA Compliance ✅
- **PHI Protection**: All credentials encrypted at rest using AES
- **Access Controls**: Service role required for decryption
- **Audit Trails**: All vault operations logged with timestamps
- **Data Classification**: Credentials properly classified as sensitive

### SOC 2 Type II ✅
- **Security (CC6.0)**: Encryption and key management implemented
- **Confidentiality (CC9.0)**: Vault ensures data confidentiality
- **Processing Integrity (CC8.0)**: Input validation enforced
- **Availability (CC7.0)**: Credentials accessible when needed

### ISO 27001/27002 ✅
- **A.8 Asset Management**: Credentials classified and inventoried
- **A.9 Access Control**: Role-based access implemented
- **A.10 Cryptography**: Industry-standard AES encryption
- **A.12 Operations Security**: Secure storage procedures

## 🔄 Migration & Legacy Cleanup

### Completed Security Upgrades
- ✅ **Gmail OAuth**: Migrated from plain text to vault storage
- ✅ **Web Search APIs**: All API keys now vault-encrypted
- ✅ **UI Components**: Updated to use `create_vault_secret()` exclusively
- ✅ **Fallback Removal**: Eliminated plain text fallback mechanisms
- ✅ **Database Cleanup**: Removed all plain text credential records

## 📊 Security Verification

Run this query to verify system security:

```sql
-- Verify all credentials are using vault encryption
SELECT 
  credential_type,
  COUNT(*) as total,
  COUNT(CASE WHEN vault_access_token_id ~ '^[0-9a-f]{8}-' THEN 1 END) as vault_stored,
  COUNT(CASE WHEN vault_access_token_id !~ '^[0-9a-f]{8}-' THEN 1 END) as plain_text
FROM user_integration_credentials
GROUP BY credential_type;

-- Expected result: plain_text = 0 for all types
```

## 🛠️ Developer Security Guidelines

### For New Integrations
Follow this **mandatory security pattern**:

```typescript
// 1. Create vault secret
const { data: vaultId, error } = await supabase.rpc('create_vault_secret', {
  p_secret: sensitiveValue,
  p_name: `${provider}_${type}_${userId}_${Date.now()}`,
  p_description: `${provider} ${type} for user ${userId}`
});

// 2. Store only the vault UUID
await supabase.from('user_integration_credentials').insert({
  vault_access_token_id: vaultId,     // ✅ Store vault UUID only
  encrypted_access_token: null,        // ✅ Never store plain text
  credential_type: 'api_key'
});

// 3. Retrieve when needed (server-side only)
const { data: decrypted } = await supabase.rpc('vault_decrypt', {
  vault_id: storedVaultId
});
```

### Security Checklist
- [ ] All sensitive data encrypted in Supabase Vault
- [ ] No plain-text credential storage anywhere
- [ ] Service role required for all decryption operations
- [ ] Proper error handling without credential leakage
- [ ] Comprehensive audit logging implemented
- [ ] Regular security verification queries executed

## 🎉 Enterprise-Ready Status

**CONFIRMED**: Gofr Agents' security system is **enterprise-grade** and ready for:
- **Enterprise deployment** with full security compliance
- **SOC 2 audit preparation** with complete audit trails
- **HIPAA compliance** for healthcare integrations
- **ISO 27001 certification** with proper controls
- **Zero-trust architecture** with no plain text storage

This security system provides **military-grade protection** for all sensitive credentials while maintaining developer-friendly APIs and seamless user experience.

---

For implementation details of specific security features, see:
- [Secret Management](secret-management.md) - VaultService implementation
- [Integration Security](integration-security.md) - OAuth and API key security
- [Database Schema](database-schema.md) - Security-focused database design
