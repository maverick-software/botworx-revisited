# SMTP Implementation Patterns Research

**Date:** August 24, 2025  
**Purpose:** Research SMTP implementation patterns, libraries, and best practices

## SMTP Fundamentals

### Protocol Overview
- **Port 587**: Recommended for secure email submission with TLS (STARTTLS)
- **Port 465**: SMTP over SSL (deprecated but still used)
- **Port 25**: Traditional SMTP relay (often blocked by ISPs)
- **Authentication**: Username/password, OAuth tokens, API keys
- **Encryption**: TLS/SSL for secure transmission

### Standard SMTP Configuration Fields
```typescript
interface SMTPConfiguration {
  // Server settings
  host: string;           // SMTP server hostname
  port: number;           // 587 (TLS), 465 (SSL), 25 (plain)
  secure: boolean;        // true for 465, false for other ports
  
  // Authentication
  auth: {
    user: string;         // Username or email
    pass: string;         // Password or API key
  };
  
  // Email defaults
  from: string;           // Default sender address
  replyTo?: string;       // Default reply-to address
  
  // Advanced options
  connectionTimeout?: number;  // Connection timeout (ms)
  greetingTimeout?: number;    // Greeting timeout (ms)
  socketTimeout?: number;      // Socket timeout (ms)
}
```

## Nodemailer Implementation Pattern

### Basic Setup
```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  },
  tls: {
    rejectUnauthorized: false // For self-signed certificates
  }
});
```

### Email Sending
```typescript
const mailOptions = {
  from: '"Sender Name" <sender@example.com>',
  to: 'recipient@example.com',
  cc: 'cc@example.com',
  bcc: 'bcc@example.com',
  subject: 'Email Subject',
  text: 'Plain text body',
  html: '<p>HTML body</p>',
  attachments: [
    {
      filename: 'document.pdf',
      content: buffer, // Buffer or stream
      contentType: 'application/pdf'
    }
  ]
};

await transporter.sendMail(mailOptions);
```

## Security Best Practices

### 1. Credential Management
- **Never store passwords in plain text**
- **Use Supabase Vault for encryption**
- **Support app-specific passwords for Gmail**
- **Validate SMTP credentials before saving**

### 2. Connection Security
- **Always use TLS/SSL when available**
- **Validate server certificates**
- **Implement connection timeouts**
- **Handle authentication failures gracefully**

### 3. Rate Limiting
- **Implement per-user/agent rate limits**
- **Track email sending quotas**
- **Prevent spam and abuse**
- **Log all operations for audit**

## Common SMTP Providers

### Gmail SMTP
```typescript
{
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'user@gmail.com',
    pass: 'app-specific-password' // Not regular password
  }
}
```

### Outlook/Hotmail SMTP
```typescript
{
  host: 'smtp-mail.outlook.com',
  port: 587,
  secure: false,
  auth: {
    user: 'user@outlook.com',
    pass: 'password'
  }
}
```

### Custom SMTP Server
```typescript
{
  host: 'mail.company.com',
  port: 587,
  secure: false,
  auth: {
    user: 'username',
    pass: 'password'
  }
}
```

## Error Handling Patterns

### Connection Testing
```typescript
async function testSMTPConnection(config: SMTPConfiguration): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransporter(config);
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('SMTP connection test failed:', error);
    return false;
  }
}
```

### Retry Logic
```typescript
async function sendEmailWithRetry(
  transporter: nodemailer.Transporter,
  mailOptions: any,
  maxRetries: number = 3
): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

## Integration with Agentopia Architecture

### Edge Function Pattern
```typescript
// supabase/functions/smtp-api/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import nodemailer from 'npm:nodemailer@6.9.8';

serve(async (req) => {
  const { action, agent_id, user_id, params } = await req.json();
  
  // 1. Validate authentication
  // 2. Get SMTP configuration for user
  // 3. Create transporter
  // 4. Execute action (send_email, test_connection)
  // 5. Log operation
  // 6. Return result
});
```

### Database Integration
```sql
-- SMTP configurations table
CREATE TABLE smtp_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  connection_name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT false,
  username TEXT NOT NULL,
  vault_password_id TEXT, -- Encrypted password in vault
  from_email TEXT NOT NULL,
  reply_to_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tool Definition
```typescript
const SMTP_TOOLS = {
  send_email: {
    name: 'send_email',
    description: 'Send an email via SMTP',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' },
        cc: { type: 'string', description: 'CC recipients (optional)' },
        bcc: { type: 'string', description: 'BCC recipients (optional)' },
        html: { type: 'boolean', description: 'Whether body is HTML' }
      },
      required: ['to', 'subject', 'body']
    }
  }
};
```

## Recommended Libraries

### For Deno (Edge Functions)
- **nodemailer**: `npm:nodemailer@6.9.8` - Most popular SMTP client
- **smtp**: `https://deno.land/x/smtp@v0.7.0` - Native Deno SMTP client

### For Node.js (if needed)
- **nodemailer**: Full-featured SMTP client
- **@sendgrid/mail**: SendGrid-specific client
- **mailgun-js**: Mailgun-specific client

## Testing Strategy

### Unit Tests
- Test SMTP configuration validation
- Test email formatting and validation
- Test error handling scenarios

### Integration Tests
- Test with real SMTP servers (using test accounts)
- Test connection failures and retries
- Test rate limiting and quotas

### Security Tests
- Test credential encryption/decryption
- Test authentication failures
- Test TLS/SSL connections

## Performance Considerations

### Connection Pooling
- Reuse SMTP connections when possible
- Implement connection pooling for high volume
- Handle connection timeouts gracefully

### Async Processing
- Use async/await for non-blocking operations
- Implement queue system for bulk emails
- Handle concurrent email sending

### Resource Management
- Close connections properly
- Implement timeouts for all operations
- Monitor memory usage for large attachments

## Next Steps for Implementation

1. **Create database schema** for SMTP configurations
2. **Implement edge function** with nodemailer
3. **Add frontend UI** for SMTP setup
4. **Integrate with function calling** system
5. **Add comprehensive testing**
6. **Implement audit logging**
7. **Add rate limiting and security measures**
