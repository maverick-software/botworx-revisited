# Security Best Practices

## Overview

This document outlines security best practices for the MCP tool and credential management system, covering authentication, authorization, data protection, and compliance requirements.

## Authentication & Authorization

### Multi-Layer Authentication

```typescript
// 1. User Authentication (Supabase Auth)
const { data: { user } } = await supabase.auth.getUser();

// 2. Row Level Security (RLS)
-- Only users can see their own connections
CREATE POLICY "Users own connections" ON user_oauth_connections
  FOR ALL USING (auth.uid() = user_id);

// 3. Agent Permission Check
const hasPermission = await checkAgentPermission(agentId, connectionId);

// 4. API Key Validation (for external services)
const isValidApiKey = await validateApiKey(apiKey, provider);
```

### JWT Token Management

```typescript
// Secure token storage
const secureTokenStorage = {
  set: (token: string) => {
    // Use httpOnly cookies for web
    document.cookie = `token=${token}; Secure; HttpOnly; SameSite=Strict`;
    
    // Use secure storage for mobile
    if (window.SecureStorage) {
      window.SecureStorage.setItem('token', token);
    }
  },
  
  get: () => {
    // Extract from httpOnly cookie (server-side)
    return req.cookies.get('token');
  },
  
  clear: () => {
    document.cookie = 'token=; Max-Age=0';
  }
};
```

### Session Management

```typescript
// Implement session timeout
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

let sessionTimer: NodeJS.Timeout;

function resetSessionTimeout() {
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    supabase.auth.signOut();
    window.location.href = '/login';
  }, SESSION_TIMEOUT);
}

// Reset on user activity
document.addEventListener('click', resetSessionTimeout);
document.addEventListener('keypress', resetSessionTimeout);
```

## Data Protection

### Encryption at Rest

All sensitive data is encrypted using Supabase Vault:

```sql
-- Vault configuration
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Encrypt sensitive data
SELECT pgsodium.crypto_aead_ietf_encrypt(
  'sensitive-data'::bytea,
  'additional-data'::bytea,
  nonce,
  key_id
);
```

### Encryption in Transit

```typescript
// Always use HTTPS
if (window.location.protocol !== 'https:' && !isDevelopment) {
  window.location.protocol = 'https:';
}

// Validate SSL certificates
const https = require('https');
const agent = new https.Agent({
  rejectUnauthorized: true,
  ca: fs.readFileSync('ca-cert.pem')
});
```

### Secure Secret Storage

```typescript
// Never store secrets in code
const NEVER_DO_THIS = {
  apiKey: 'sk_live_abc123', // ❌ NEVER
  clientSecret: 'secret123'   // ❌ NEVER
};

// Use environment variables
const CORRECT_WAY = {
  apiKey: process.env.API_KEY,           // ✅
  clientSecret: Deno.env.get('SECRET')   // ✅
};

// Use Supabase Vault for user secrets
async function storeUserSecret(userId: string, secret: string) {
  const { data } = await supabase.rpc('vault_encrypt', {
    secret,
    key_id: `user_${userId}`
  });
  
  return data.vault_id;
}
```

## Input Validation & Sanitization

### SQL Injection Prevention

```typescript
// ❌ NEVER use string concatenation
const BAD = `SELECT * FROM users WHERE id = '${userId}'`;

// ✅ Use parameterized queries
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId);

// ✅ Or use prepared statements
const { data } = await supabase.rpc('get_user', {
  user_id: userId
});
```

### XSS Prevention

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize user input
function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

// React automatically escapes, but be careful with dangerouslySetInnerHTML
const SafeComponent = ({ userContent }) => {
  return (
    <div>
      {/* ✅ Safe - React escapes */}
      {userContent}
      
      {/* ❌ Dangerous - requires sanitization */}
      <div dangerouslySetInnerHTML={{ __html: userContent }} />
      
      {/* ✅ Safe with sanitization */}
      <div dangerouslySetInnerHTML={{ 
        __html: DOMPurify.sanitize(userContent) 
      }} />
    </div>
  );
};
```

### Request Validation

```typescript
// Validate all incoming requests
async function validateRequest(req: Request) {
  // Check content type
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error('Invalid content type');
  }
  
  // Parse and validate body
  const body = await req.json();
  
  // Validate required fields
  if (!body.connectionId || !isUUID(body.connectionId)) {
    throw new Error('Invalid connection ID');
  }
  
  // Validate against schema
  const schema = z.object({
    connectionId: z.string().uuid(),
    action: z.enum(['list', 'get', 'search']),
    params: z.object({
      query: z.string().max(1000).optional(),
      maxResults: z.number().min(1).max(100).optional()
    })
  });
  
  return schema.parse(body);
}
```

## Access Control

### Role-Based Access Control (RBAC)

```sql
-- Define roles
CREATE TYPE user_role AS ENUM ('user', 'admin', 'agent');

-- Add role to users
ALTER TABLE users ADD COLUMN role user_role DEFAULT 'user';

-- Role-based policies
CREATE POLICY "Admins can view all connections" 
ON user_oauth_connections
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  )
);
```

### Principle of Least Privilege

```typescript
// Grant minimal permissions
const DEFAULT_PERMISSIONS = {
  gmail: {
    read_emails: true,
    send_emails: false,      // Disabled by default
    delete_emails: false,    // Disabled by default
    max_results: 10,         // Limited by default
    allowed_labels: ['INBOX'] // Restricted by default
  },
  web_search: {
    enabled: true,
    max_queries_per_day: 10,  // Limited by default
    safe_search: true         // Enabled by default
  }
};
```

### Dynamic Permission Checks

```typescript
async function checkDynamicPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  // Check user permissions
  const { data: permission } = await supabase
    .from('user_permissions')
    .select('allowed')
    .eq('user_id', userId)
    .eq('resource', resource)
    .eq('action', action)
    .single();
  
  if (!permission?.allowed) return false;
  
  // Check rate limits
  const rateLimitOk = await checkRateLimit(userId, action);
  if (!rateLimitOk) return false;
  
  // Check time-based restrictions
  const timeRestrictionOk = checkTimeRestriction(permission);
  if (!timeRestrictionOk) return false;
  
  return true;
}
```

## API Security

### Rate Limiting

```typescript
import { RateLimiter } from 'rate-limiter-flexible';

const rateLimiter = new RateLimiter({
  points: 100,        // Number of requests
  duration: 60,       // Per 60 seconds
  blockDuration: 60   // Block for 60 seconds
});

async function enforceRateLimit(userId: string) {
  try {
    await rateLimiter.consume(userId);
  } catch (rejRes) {
    throw new Error(`Rate limit exceeded. Try again in ${rejRes.msBeforeNext}ms`);
  }
}
```

### API Key Management

```typescript
// Rotate API keys periodically
async function rotateApiKey(connectionId: string) {
  // Generate new key
  const newKey = crypto.randomBytes(32).toString('hex');
  
  // Store in Vault
  const { data: vaultData } = await supabase.rpc('vault_encrypt', {
    secret: newKey
  });
  
  // Update connection
  await supabase
    .from('user_oauth_connections')
    .update({
      vault_access_token_id: vaultData.vault_id,
      last_rotation: new Date().toISOString()
    })
    .eq('id', connectionId);
  
  // Revoke old key (provider-specific)
  await revokeOldKey(connectionId);
  
  return newKey;
}
```

### CORS Configuration

```typescript
// Strict CORS policy
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://app.yourdomain.com',
      'https://staging.yourdomain.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};
```

## Audit & Monitoring

### Audit Logging

```typescript
interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  action: string;
  resource: string;
  details: any;
  ip_address: string;
  user_agent: string;
  success: boolean;
}

async function logAuditEvent(event: Partial<AuditLog>) {
  await supabase.from('audit_logs').insert({
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ip_address: req.headers.get('x-forwarded-for') || req.ip,
    user_agent: req.headers.get('user-agent')
  });
}

// Log sensitive operations
await logAuditEvent({
  user_id: user.id,
  action: 'credential.revoked',
  resource: `connection:${connectionId}`,
  success: true
});
```

### Security Monitoring

```typescript
// Monitor for suspicious activity
async function detectSuspiciousActivity(userId: string) {
  const recentLogs = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
    .order('timestamp', { ascending: false });
  
  // Check for patterns
  const suspiciousPatterns = [
    // Multiple failed auth attempts
    (logs) => logs.filter(l => 
      l.action === 'auth.failed'
    ).length > 5,
    
    // Rapid API calls
    (logs) => logs.filter(l => 
      l.action.startsWith('api.')
    ).length > 100,
    
    // Access from multiple IPs
    (logs) => new Set(
      logs.map(l => l.ip_address)
    ).size > 10
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern(recentLogs.data)) {
      await alertSecurityTeam(userId, 'Suspicious activity detected');
      return true;
    }
  }
  
  return false;
}
```

### Error Tracking

```typescript
import * as Sentry from '@sentry/node';

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Remove sensitive data
    delete event.request?.cookies;
    delete event.request?.headers?.authorization;
    return event;
  }
});

// Track errors
try {
  // Risky operation
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'credential-manager',
      severity: 'high'
    },
    extra: {
      userId: user.id,
      connectionId
    }
  });
}
```

## Compliance

### GDPR Compliance

```typescript
// Right to be forgotten
async function deleteUserData(userId: string) {
  // Delete connections
  await supabase
    .from('user_oauth_connections')
    .delete()
    .eq('user_id', userId);
  
  // Delete permissions
  await supabase
    .from('agent_oauth_permissions')
    .delete()
    .in('agent_id', 
      supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
    );
  
  // Delete from Vault
  await supabase.rpc('vault_delete_user_secrets', {
    user_id: userId
  });
  
  // Delete audit logs after retention period
  await scheduleAuditLogDeletion(userId);
}

// Data portability
async function exportUserData(userId: string) {
  const data = {
    connections: await getUserConnections(userId),
    permissions: await getUserPermissions(userId),
    audit_logs: await getUserAuditLogs(userId)
  };
  
  return JSON.stringify(data, null, 2);
}
```

### SOC 2 Compliance

```typescript
// Access control documentation
const accessControlPolicy = {
  authentication: 'Multi-factor authentication required',
  authorization: 'Role-based access control',
  audit: 'All access logged and monitored',
  encryption: 'AES-256 at rest, TLS 1.3 in transit',
  retention: '90 days for logs, 7 years for audit trails'
};

// Change management
async function documentChange(change: any) {
  await supabase.from('change_log').insert({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    author: change.author,
    description: change.description,
    approval: change.approval,
    rollback_plan: change.rollbackPlan
  });
}
```

## Security Headers

```typescript
// Set security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://*.supabase.co"
  );
  
  // HSTS
  res.setHeader('Strict-Transport-Security', 
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=()'
  );
  
  next();
});
```

## Incident Response

### Response Plan

```typescript
enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

async function handleSecurityIncident(incident: SecurityIncident) {
  // 1. Assess severity
  const severity = assessSeverity(incident);
  
  // 2. Immediate containment
  if (severity === IncidentSeverity.CRITICAL) {
    await emergencyShutdown(incident.affectedSystems);
  }
  
  // 3. Notify stakeholders
  await notifySecurityTeam(incident);
  if (severity >= IncidentSeverity.HIGH) {
    await notifyManagement(incident);
  }
  
  // 4. Investigate
  const investigation = await investigateIncident(incident);
  
  // 5. Remediate
  await remediateVulnerability(investigation.findings);
  
  // 6. Document
  await documentIncident(incident, investigation);
  
  // 7. Post-mortem
  await schedulePostMortem(incident);
}
```

### Backup & Recovery

```typescript
// Regular backups
async function backupCredentials() {
  const backup = {
    timestamp: new Date().toISOString(),
    connections: await getAllConnections(),
    providers: await getAllProviders(),
    checksum: null
  };
  
  // Calculate checksum
  backup.checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(backup))
    .digest('hex');
  
  // Store encrypted backup
  await storeEncryptedBackup(backup);
}

// Recovery procedure
async function recoverFromBackup(backupId: string) {
  const backup = await getBackup(backupId);
  
  // Verify integrity
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...backup, checksum: null }))
    .digest('hex');
  
  if (checksum !== backup.checksum) {
    throw new Error('Backup integrity check failed');
  }
  
  // Restore data
  await restoreConnections(backup.connections);
  await restoreProviders(backup.providers);
}
```

## Security Checklist

### Development

- [ ] All dependencies up to date
- [ ] Security linting enabled (ESLint security plugin)
- [ ] Secrets scanning in CI/CD
- [ ] SAST/DAST tools configured
- [ ] Dependency vulnerability scanning

### Deployment

- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] WAF configured
- [ ] DDoS protection enabled

### Operations

- [ ] Regular security audits
- [ ] Penetration testing
- [ ] Vulnerability scanning
- [ ] Log monitoring
- [ ] Incident response plan tested

### Compliance

- [ ] GDPR compliance verified
- [ ] Data retention policies implemented
- [ ] Privacy policy updated
- [ ] Terms of service reviewed
- [ ] Security documentation maintained
