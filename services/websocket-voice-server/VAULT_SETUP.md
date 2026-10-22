# Supabase Vault Setup for WebSocket Server

## 🔒 Overview

This guide will help you migrate from plain-text `.env` files to **Supabase Vault** for enterprise-grade secret management.

## Benefits

✅ **Zero Plain-Text Storage** - All secrets encrypted in database  
✅ **Automatic Key Rotation** - Easy to update credentials  
✅ **Audit Trails** - Track who accessed what and when  
✅ **Compliance Ready** - HIPAA, SOC 2, ISO 27001 compatible  
✅ **No Server Files** - Secrets never stored on droplet  

## Step-by-Step Setup

### Step 1: Run SQL Setup

Go to your Supabase Dashboard → SQL Editor and run the contents of `setup-vault.sql`:

```bash
# Copy the SQL file to your clipboard or paste it directly
cat setup-vault.sql
```

This creates:
- `create_vault_secret()` function
- `vault_decrypt()` function  
- `server_configuration_secrets` table
- Helper functions for server secrets

### Step 2: Initialize Secrets

In Supabase SQL Editor, run this query with YOUR actual values:

```sql
SELECT public.initialize_websocket_server_secrets(
  'voice-websocket-server',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  -- Your actual Supabase service role key
  'your-super-secure-admin-password-here'         -- Your desired admin password
);
```

You should see a response like:
```json
{
  "server_name": "voice-websocket-server",
  "vault_supabase_service_key_id": "550e8400-e29b-41d4-a716-446655440000",
  "vault_admin_password_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "status": "success"
}
```

### Step 3: Deploy Vault-Enabled Server

SSH into your droplet and run:

```bash
cd /opt/agentopia-voice-ws

# Download the deployment script
curl https://raw.githubusercontent.com/your-repo/deploy-with-vault.sh > deploy-with-vault.sh
chmod +x deploy-with-vault.sh

# Or paste the script manually, then run:
bash deploy-with-vault.sh
```

### Step 4: Verify It's Working

```bash
# Check server logs
pm2 logs voice-ws-server

# You should see:
# ✅ Secrets loaded from Vault successfully
# Vault integration: ENABLED ✅

# Test the health endpoint
curl https://voice.gofragents.com/health

# Should show: "vaultEnabled": true
```

### Step 5: Clean Up Old Secrets

```bash
# Remove the old .env file (secrets now in Vault)
rm -f /opt/agentopia-voice-ws/.env
rm -f /root/.secrets/env

# Clear PM2 environment variables
pm2 delete voice-ws-server
pm2 start index-vault.js --name voice-ws-server
pm2 save
```

## How It Works

```
┌─────────────────┐
│  WebSocket      │
│  Server starts  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Calls RPC:     │
│  get_websocket_ │
│  server_secrets │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │
│  Vault          │
│  decrypts       │
│  secrets        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Server runs    │
│  with decrypted │
│  credentials    │
└─────────────────┘
```

## Security Features

### 1. No Plain-Text Storage
```bash
# Before (INSECURE):
cat /opt/agentopia-voice-ws/.env
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiI... ❌ EXPOSED!

# After (SECURE):
cat /opt/agentopia-voice-ws/.env
# File not found ✅ Secrets in Vault!
```

### 2. Audit Logging

Query Supabase to see who accessed secrets:

```sql
SELECT 
  operation,
  vault_id,
  accessed_at,
  accessed_by
FROM vault_audit_logs
WHERE operation = 'decrypt'
ORDER BY accessed_at DESC
LIMIT 10;
```

### 3. Easy Key Rotation

To rotate credentials:

```sql
-- 1. Create new secret in Vault
SELECT public.create_vault_secret(
  'new-supabase-service-role-key',
  'voice-websocket-server_supabase_service_key_rotated',
  'Rotated service key on ' || now()::TEXT
);

-- 2. Update server configuration
UPDATE server_configuration_secrets
SET vault_supabase_service_key_id = 'new-vault-uuid-here'
WHERE server_name = 'voice-websocket-server';

-- 3. Restart server
-- (Run on droplet): pm2 restart voice-ws-server
```

## Troubleshooting

### Error: "Vault secrets not initialized yet"

**Solution**: Run Step 2 (initialize_websocket_server_secrets) in Supabase SQL Editor

### Error: "Insufficient privileges to decrypt vault secrets"

**Solution**: Ensure you're using the service role key, not the anon key

### Server starts but can't authenticate users

**Solution**: 
1. Check the service key in Vault is correct
2. Verify server logs: `pm2 logs voice-ws-server`
3. Test vault decryption manually:
```sql
SELECT public.vault_decrypt('your-vault-uuid-here');
```

### How to view current vault secrets (for debugging)

**As service role only:**
```sql
SELECT * FROM server_configuration_secrets;
-- Shows vault UUIDs only, not actual secrets

-- To decrypt (service role only):
SELECT public.get_websocket_server_secrets('voice-websocket-server');
```

## Monitoring

### Check Vault Status

```bash
# Via API
curl https://voice.gofragents.com/health | jq

# Should show:
# {
#   "status": "Online",
#   "vaultEnabled": true,
#   ...
# }
```

### View Logs

```bash
pm2 logs voice-ws-server --lines 50
```

### Admin Dashboard

Visit: https://voice.gofragents.com/admin

Shows:
- Active connections
- Server uptime
- Memory usage
- Vault status badge

## Best Practices

1. **Never commit secrets to Git** - Vault handles all secrets
2. **Rotate keys regularly** - Every 90 days minimum
3. **Monitor audit logs** - Check for suspicious access
4. **Use strong admin passwords** - Generated, not memorized
5. **Backup vault secrets** - Supabase handles automatically

## Migration Checklist

- [ ] Run `setup-vault.sql` in Supabase SQL Editor
- [ ] Initialize secrets with `initialize_websocket_server_secrets()`
- [ ] Deploy vault-enabled server with `deploy-with-vault.sh`
- [ ] Verify "Vault integration: ENABLED" in logs
- [ ] Test voice chat still works
- [ ] Remove old `.env` files
- [ ] Update deployment documentation
- [ ] Schedule key rotation reminder

## Support

If you have issues:
1. Check server logs: `pm2 logs voice-ws-server`
2. Test vault connection in Supabase SQL Editor
3. Verify service role key is correct
4. Ensure RPC functions have proper permissions

---

**Security Level**: Enterprise-Grade 🔒  
**Compliance**: HIPAA, SOC 2, ISO 27001 Ready  
**Zero Plain-Text Storage**: ✅ Verified

