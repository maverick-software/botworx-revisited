# Security Best Practices for WebSocket Voice Server

## Current Security Issues ⚠️

1. **Plain text `.env` file** - API keys stored unencrypted on disk
2. **Root access** - Server running as root user
3. **No secret rotation** - Keys never expire or rotate
4. **Git exposure risk** - `.env` could accidentally be committed

## Recommended Security Solutions

### 🔒 Option 1: Environment Variables Only (Quick Fix)

Store secrets as PM2 environment variables instead of `.env` file:

```bash
# Set secrets directly in PM2 (more secure than .env)
pm2 delete voice-ws-server
pm2 start index.js --name voice-ws-server \
  --env NODE_ENV=production \
  --env PORT=8080 \
  --env SUPABASE_URL="https://txhscptzjrrudnqwavcb.supabase.co" \
  --env SUPABASE_SERVICE_ROLE_KEY="your-key-here" \
  --env ADMIN_USERNAME="admin" \
  --env ADMIN_PASSWORD="secure-password-here"

pm2 save

# Remove the .env file
rm .env
```

**Pros:** 
- Secrets not in plain text files
- Can't accidentally commit to git
- Easy to implement

**Cons:**
- Still visible in `pm2 env` command
- Not enterprise-grade

---

### 🔐 Option 2: DigitalOcean Secrets (Recommended)

Use DigitalOcean's built-in secrets management:

**Steps:**
1. Go to DigitalOcean Dashboard → Settings → Security
2. Create a new "Secret"
3. Add your keys:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
4. Reference in your app

**Implementation:**
```bash
# Install DigitalOcean metadata service client
npm install @digitalocean/droplet-metadata

# Update server to fetch secrets from metadata service
# (requires code changes)
```

---

### 🛡️ Option 3: HashiCorp Vault (Enterprise)

For production-grade security:

**Benefits:**
- Automatic key rotation
- Audit logging
- Dynamic secrets
- Encryption at rest

**Setup:**
```bash
# Install Vault
apt install vault -y

# Initialize Vault
vault operator init

# Store secrets
vault kv put secret/voice-server \
  supabase_key="..." \
  admin_password="..."
```

---

### 🔑 Option 4: Supabase Vault Integration (Best for Agentopia)

Since you already use Supabase, leverage **Supabase Vault**:

**Why this is best:**
- Already integrated with your stack
- Zero additional infrastructure
- Encrypted at rest
- Access control via RLS
- Free on all plans

**Implementation:**

1. Store secrets in Supabase Vault (via Supabase Dashboard or SQL):
```sql
-- Store in Supabase Vault
SELECT vault.create_secret('voice_server_supabase_key', 'your-key-here');
SELECT vault.create_secret('voice_server_admin_password', 'your-password');
```

2. Update server to fetch from Vault:
```javascript
// Fetch secrets on startup
const { data: supabaseKey } = await supabase.rpc('get_vault_secret', { 
  secret_name: 'voice_server_supabase_key' 
});
```

---

## Immediate Actions You Should Take NOW

### 1. Remove `.env` from server
```bash
cd /opt/agentopia-voice-ws
rm .env  # Remove plain text secrets
```

### 2. Use PM2 environment variables instead
```bash
pm2 delete voice-ws-server
pm2 start index.js --name voice-ws-server \
  --env SUPABASE_URL="https://txhscptzjrrudnqwavcb.supabase.co" \
  --env SUPABASE_SERVICE_ROLE_KEY="$(cat /root/.secrets/supabase_key)" \
  --env ADMIN_PASSWORD="$(openssl rand -base64 32)"
pm2 save
```

### 3. Restrict file permissions
```bash
chmod 600 /root/.secrets/*  # Only root can read
```

### 4. Enable firewall rules
```bash
ufw allow 443/tcp   # HTTPS only
ufw allow 22/tcp    # SSH only
ufw enable
```

### 5. Rotate keys regularly
- Generate new Supabase service role key every 90 days
- Update admin password monthly

---

## Long-term Security Roadmap

### Phase 1: Immediate (Today)
- ✅ Remove `.env` file
- ✅ Use PM2 env vars
- ✅ Strong admin password
- ✅ Enable firewall

### Phase 2: This Week
- 🔄 Implement Supabase Vault integration
- 🔄 Add secret rotation script
- 🔄 Setup monitoring/alerts

### Phase 3: Production Ready
- 🔄 Audit logging
- 🔄 Intrusion detection
- 🔄 Regular security scans
- 🔄 Backup/disaster recovery

---

## Monitoring & Alerts

### Setup log monitoring for security events:
```bash
# Monitor for unauthorized access attempts
pm2 logs voice-ws-server | grep "Unauthorized"

# Alert on high connection rates (potential DDoS)
pm2 monit
```

### Install fail2ban for SSH protection:
```bash
apt install fail2ban -y
systemctl enable fail2ban
```

---

## Questions to Consider

1. **Who needs access to these secrets?**
   - Just the server (best)
   - DevOps team (okay with vault)
   - Never developers directly

2. **What if keys are compromised?**
   - Have rotation plan ready
   - Can you detect compromise?
   - How fast can you rotate?

3. **Compliance requirements?**
   - GDPR? (encrypt at rest)
   - HIPAA? (need audit logs)
   - SOC 2? (access controls)

---

## Recommended Implementation

For Agentopia, I recommend **Option 4 (Supabase Vault)** because:

✅ No new infrastructure  
✅ Already part of your stack  
✅ Encrypted and audited  
✅ Easy to implement  
✅ Free  

Would you like me to implement Supabase Vault integration for the WebSocket server?

