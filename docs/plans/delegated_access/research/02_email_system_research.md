# Email System Integration Research - Delegated Access
**Research Date:** November 4, 2025  
**Purpose:** Understanding email infrastructure for delegation invitation system

## Current Email Infrastructure

### Available Email Services

Agentopia has **four main email services** integrated:

#### 1. SMTP Service (`smtp-api`)
**File:** `supabase/functions/smtp-api/index.ts` (991 lines)

**Capabilities:**
- Universal SMTP server support (any provider)
- Connection pooling and management
- Retry logic with exponential backoff
- Secure credential handling via Supabase Vault

**Key Features:**
```typescript
class SMTPManager {
  async sendEmail(config, password, mailOptions, maxRetries = 3)
  async testConnection(config, password)
  async createTransporter(config, password)
}
```

**Configuration Requirements:**
- Host, port, secure flag
- Username and vault-encrypted password
- From email/name, reply-to email
- Connection/socket/greeting timeouts
- Rate limits (max emails per day, recipients per email)

**Best for:** Transactional emails, custom SMTP servers

#### 2. SendGrid Service (`sendgrid-api`)
**File:** `supabase/functions/sendgrid-api/index.ts` (730 lines)

**Capabilities:**
- Simple and bulk email sending
- Dynamic template support
- Template management (create, list, use)
- Analytics and tracking
- Agent email addresses (inbound)

**Template System:**
- Templates stored in `sendgrid_templates` table
- Dynamic variables support
- Subject templating
- Version management

**Database Tables:**
```sql
sendgrid_configurations
sendgrid_templates
agent_sendgrid_permissions
sendgrid_operation_logs
```

**Best for:** Marketing emails, templated communications, analytics

#### 3. Mailgun Service (`mailgun-service`)
**File:** `supabase/functions/mailgun-service/index.ts` (387 lines)

**Capabilities:**
- Email sending
- Email validation
- Statistics and analytics
- Suppression list management
- Webhook support

**Configuration:**
- Domain and API key
- Region (US/EU)
- Webhook signing key (optional)

**Best for:** Email validation, transactional emails, deliverability analytics

#### 4. Gmail API (`gmail-api`)
**File:** `supabase/functions/gmail-api/index.ts`

**Capabilities:**
- OAuth-based email sending
- Reading emails
- Searching emails

**Best for:** User-specific emails from their Gmail account (NOT transactional)

### Existing Email Patterns

#### Email Existence Check
**Function:** `check-email-exists`
**File:** `supabase/functions/check-email-exists/index.ts`

```typescript
// Already implemented!
const { data } = await supabaseAdmin.rpc('check_user_exists_by_email', {
  user_email: email
});

const userExists = data === true;
```

**Usage for Delegation:**
- Check if invitee email exists before sending invitation
- Determine whether to send "new user" or "existing user" email
- Return exists status to frontend

### Email Template Systems

#### SendGrid Template Pattern (Best Option)

**Database Schema:**
```sql
CREATE TABLE sendgrid_templates (
    id UUID PRIMARY KEY,
    sendgrid_config_id UUID NOT NULL,
    sendgrid_template_id TEXT NOT NULL,
    template_name TEXT NOT NULL,
    subject_template TEXT,
    is_dynamic BOOLEAN DEFAULT true,
    variables JSONB DEFAULT '{}'::jsonb,
    agent_ids_allowed UUID[],
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Template Creation:**
```typescript
// Function already exists in sendgrid-api
async function createEmailTemplate(apiKey, params, configId) {
  const { name, subject, html_content, plain_content } = params;
  
  // Create template and version via SendGrid API
  // Returns template_id and version_id
}
```

**Template Usage:**
```typescript
// In email payload
{
  template_id: 'delegation_invite_existing',
  dynamic_template_data: {
    owner_name: 'John Doe',
    agent_name: 'Support Agent',
    permission_level: 'Manage',
    accept_link: 'https://app.agentopia.com/accept-delegation/TOKEN'
  }
}
```

#### Simple HTML Template Pattern (Alternative)

For SMTP/Mailgun without pre-stored templates:

```typescript
function generateInvitationEmail(params: {
  recipientName: string,
  ownerName: string,
  agentName: string,
  permissionLevel: string,
  acceptLink: string,
  isNewUser: boolean
}): { subject: string, html: string, text: string } {
  // Generate HTML and plain text versions
  // Return both for better deliverability
}
```

## Recommended Email Service for Delegations

### Primary: SMTP with Fallback

**Rationale:**
1. **Universal Compatibility**: Works with any email provider
2. **No External Dependencies**: No SendGrid/Mailgun account required
3. **User Control**: Users can configure their own SMTP server
4. **Fallback Support**: Can try SendGrid/Mailgun if SMTP fails

### Implementation Strategy

```typescript
async function sendDelegationEmail(params) {
  // Try user's configured email services in order:
  // 1. SMTP (if configured)
  // 2. SendGrid (if configured)
  // 3. Mailgun (if configured)
  // 4. System default (platform-wide SMTP)
  
  const emailServices = await getAvailableEmailServices(userId);
  
  for (const service of emailServices) {
    try {
      await sendViaService(service, emailTemplate);
      return { success: true, service: service.name };
    } catch (error) {
      console.warn(`Failed to send via ${service.name}:`, error);
      continue; // Try next service
    }
  }
  
  throw new Error('All email services failed');
}
```

## Email Templates Design

### Template 1: Existing User Invitation

**Subject:** `{owner_name} has invited you to access their agent: {agent_name}`

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; padding: 30px; text-align: center; }
    .content { background: #ffffff; padding: 30px; }
    .button { background: #667eea; color: white; padding: 12px 30px; 
              text-decoration: none; border-radius: 6px; display: inline-block; }
    .permission-badge { background: #e0e7ff; color: #4c1d95; 
                        padding: 4px 12px; border-radius: 12px; }
    .footer { color: #6b7280; font-size: 14px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Agent Access Invitation</h1>
    </div>
    <div class="content">
      <p>Hi {{recipient_name}},</p>
      
      <p><strong>{{owner_name}}</strong> has invited you to access their AI agent 
         "<strong>{{agent_name}}</strong>" on Agentopia.</p>
      
      <p><strong>Permission Level:</strong> 
         <span class="permission-badge">{{permission_level}}</span>
      </p>
      
      <p><strong>What you'll be able to do:</strong></p>
      <ul>
        {{#if is_view_only}}
        <li>View agent profile and settings</li>
        <li>View conversation history</li>
        {{/if}}
        {{#if is_manage}}
        <li>Chat with the agent</li>
        <li>Modify agent settings</li>
        <li>Manage integrations</li>
        {{/if}}
        {{#if is_full_control}}
        <li>Full administrative access</li>
        <li>Manage other delegations</li>
        <li>Delete or transfer the agent</li>
        {{/if}}
      </ul>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{accept_link}}" class="button">Accept Invitation</a>
      </p>
      
      <p class="footer">
        This invitation expires on {{expiration_date}}.<br>
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
```

**Plain Text Version:**
```text
Hi {{recipient_name}},

{{owner_name}} has invited you to access their AI agent "{{agent_name}}" on Agentopia.

Permission Level: {{permission_level}}

What you'll be able to do:
{{permission_description}}

To accept this invitation, click the link below:
{{accept_link}}

This invitation expires on {{expiration_date}}.

If you didn't expect this invitation, you can safely ignore this email.
```

### Template 2: New User Invitation

**Subject:** `{owner_name} has invited you to join Agentopia`

**HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    /* Same styles as above */
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Agentopia!</h1>
    </div>
    <div class="content">
      <p>Hi there,</p>
      
      <p><strong>{{owner_name}}</strong> has invited you to join Agentopia 
         to access their AI agent "<strong>{{agent_name}}</strong>".</p>
      
      <h3>What is Agentopia?</h3>
      <p>Agentopia is a platform for creating, managing, and collaborating with AI agents. 
         You'll be able to interact with {{owner_name}}'s agent and help manage it.</p>
      
      <p><strong>Permission Level:</strong> 
         <span class="permission-badge">{{permission_level}}</span>
      </p>
      
      <p><strong>What you'll be able to do:</strong></p>
      <ul>
        {{permission_bullets}}
      </ul>
      
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{signup_link}}" class="button">Create Account & Accept</a>
      </p>
      
      <p class="footer">
        This invitation expires on {{expiration_date}}.<br>
        Creating an account is free and takes less than a minute.
      </p>
    </div>
  </div>
</body>
</html>
```

### Template 3: Delegation Accepted Notification

**Subject:** `{delegate_name} accepted your invitation to {agent_name}`

**Content:**
```
Hi {{owner_name}},

{{delegate_name}} ({{delegate_email}}) has accepted your invitation to 
access "{{agent_name}}" with {{permission_level}} permissions.

They now have access to the agent and can:
{{permission_description}}

You can manage their access anytime from the agent settings page.

View Agent: {{agent_link}}
```

### Template 4: Delegation Revoked Notification

**Subject:** `Your access to {agent_name} has been revoked`

**Content:**
```
Hi {{delegate_name}},

{{owner_name}} has revoked your access to the agent "{{agent_name}}".

You will no longer be able to view or interact with this agent.

If you have questions, please contact {{owner_name}} directly at {{owner_email}}.
```

## Email Service Configuration

### System-Wide Default SMTP

For users without configured email services, provide a system-wide SMTP configuration:

**Environment Variables:**
```
SYSTEM_SMTP_HOST=smtp.sendgrid.net
SYSTEM_SMTP_PORT=587
SYSTEM_SMTP_SECURE=true
SYSTEM_SMTP_USERNAME=apikey
SYSTEM_SMTP_PASSWORD=<vault_id>
SYSTEM_FROM_EMAIL=notifications@agentopia.com
SYSTEM_FROM_NAME=Agentopia
```

**Database Configuration:**
```sql
-- System-wide SMTP configuration
INSERT INTO smtp_configurations (
  user_id, -- NULL for system config
  connection_name,
  host,
  port,
  secure,
  username,
  vault_password_id,
  from_email,
  from_name,
  is_active,
  is_system_default
) VALUES (
  NULL,
  'System Default SMTP',
  'smtp.sendgrid.net',
  587,
  true,
  'apikey',
  '<vault_secret_id>',
  'notifications@agentopia.com',
  'Agentopia',
  true,
  true
);
```

## Email Delivery Workflow

### Full Delegation Email Flow

```typescript
// 1. Create delegation invitation
async function createDelegationInvitation(params: {
  agentId: string,
  ownerId: string,
  delegateEmail: string,
  permissionLevel: string
}) {
  // Generate secure token
  const token = crypto.randomUUID();
  
  // Check if email exists
  const userExists = await checkEmailExists(delegateEmail);
  
  // Create delegation record
  const delegation = await supabase
    .from('agent_delegations')
    .insert({
      agent_id: agentId,
      owner_user_id: ownerId,
      delegate_email: delegateEmail,
      permission_level: permissionLevel,
      invitation_token: token,
      token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: 'pending'
    });
  
  // Send email
  await sendDelegationInvitationEmail({
    delegation,
    isNewUser: !userExists
  });
  
  // Log activity
  await logDelegationActivity({
    delegation_id: delegation.id,
    action_type: 'invited',
    performed_by_user_id: ownerId
  });
  
  return delegation;
}

// 2. Send invitation email
async function sendDelegationInvitationEmail(params: {
  delegation: Delegation,
  isNewUser: boolean
}) {
  // Get owner and agent details
  const owner = await getUser(delegation.owner_user_id);
  const agent = await getAgent(delegation.agent_id);
  
  // Choose template
  const template = params.isNewUser 
    ? 'new_user_invitation' 
    : 'existing_user_invitation';
  
  // Generate accept link
  const acceptLink = `${FRONTEND_URL}/accept-delegation/${delegation.invitation_token}`;
  
  // Prepare email data
  const emailData = {
    to: delegation.delegate_email,
    template: template,
    variables: {
      recipient_name: params.isNewUser ? 'there' : delegation.delegate_email,
      owner_name: owner.full_name || owner.email,
      agent_name: agent.name,
      permission_level: delegation.permission_level,
      permission_description: getPermissionDescription(delegation.permission_level),
      accept_link: acceptLink,
      signup_link: params.isNewUser ? `${FRONTEND_URL}/register?token=${delegation.invitation_token}` : acceptLink,
      expiration_date: formatDate(delegation.token_expires_at),
      is_view_only: delegation.permission_level === 'view',
      is_manage: delegation.permission_level === 'manage',
      is_full_control: delegation.permission_level === 'full_control'
    }
  };
  
  // Try email services in order
  await sendEmailWithFallback(delegation.owner_user_id, emailData);
}

// 3. Email service fallback logic
async function sendEmailWithFallback(userId: string, emailData: any) {
  const services = [
    { type: 'smtp', configTable: 'smtp_configurations' },
    { type: 'sendgrid', configTable: 'sendgrid_configurations' },
    { type: 'mailgun', configTable: 'mailgun_configurations' },
    { type: 'system_default', configTable: 'smtp_configurations' }
  ];
  
  for (const service of services) {
    try {
      const config = await getServiceConfig(service, userId);
      if (!config) continue;
      
      await sendViaService(service.type, config, emailData);
      console.log(`Email sent via ${service.type}`);
      return { success: true, service: service.type };
      
    } catch (error) {
      console.warn(`Failed to send via ${service.type}:`, error);
      continue;
    }
  }
  
  throw new Error('All email services failed to send invitation');
}
```

## Rate Limiting & Abuse Prevention

### Invitation Rate Limits

```sql
-- Add rate limiting to agent_delegations table check
CREATE OR REPLACE FUNCTION check_invitation_rate_limit(
  p_owner_user_id UUID,
  p_agent_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  recent_invitations INTEGER;
BEGIN
  -- Count invitations in last hour
  SELECT COUNT(*) INTO recent_invitations
  FROM agent_delegations
  WHERE owner_user_id = p_owner_user_id
    AND agent_id = p_agent_id
    AND invited_at > NOW() - INTERVAL '1 hour';
  
  -- Allow max 10 invitations per hour per agent
  RETURN recent_invitations < 10;
END;
$$ LANGUAGE plpgsql;
```

### Email Validation

```typescript
// Validate email format before sending
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check for disposable email domains
const disposableDomains = ['tempmail.com', '10minutemail.com', 'guerrillamail.com'];
function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1];
  return disposableDomains.includes(domain);
}
```

## Database Functions for Email Support

### check_user_exists_by_email (Already Exists!)

```sql
-- This function already exists!
CREATE OR REPLACE FUNCTION check_user_exists_by_email(user_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE email = user_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### New Functions Needed

```sql
-- Get user's available email services
CREATE OR REPLACE FUNCTION get_user_email_services(p_user_id UUID)
RETURNS TABLE (
  service_type TEXT,
  config_id UUID,
  from_email TEXT,
  is_active BOOLEAN,
  priority INTEGER
) AS $$
BEGIN
  -- Return SMTP configs
  RETURN QUERY
  SELECT 'smtp'::TEXT, id, from_email, is_active, 1
  FROM smtp_configurations
  WHERE user_id = p_user_id AND is_active = true
  
  UNION ALL
  
  -- Return SendGrid configs
  SELECT 'sendgrid'::TEXT, id, from_email, is_active, 2
  FROM sendgrid_configurations
  WHERE user_id = p_user_id AND is_active = true
  
  UNION ALL
  
  -- Return Mailgun configs
  SELECT 'mailgun'::TEXT, id, domain AS from_email, is_active, 3
  FROM mailgun_configurations
  WHERE user_id = p_user_id AND is_active = true
  
  ORDER BY priority ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get system default email service
CREATE OR REPLACE FUNCTION get_system_default_email_service()
RETURNS TABLE (
  service_type TEXT,
  config_id UUID,
  from_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'smtp'::TEXT, id, from_email
  FROM smtp_configurations
  WHERE is_system_default = true AND is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Testing Strategy

### Email Testing Checklist

1. **Template Rendering:**
   - [ ] Test HTML template rendering
   - [ ] Test plain text fallback
   - [ ] Test variable substitution
   - [ ] Test conditional sections

2. **Service Integration:**
   - [ ] Test SMTP sending
   - [ ] Test SendGrid sending
   - [ ] Test Mailgun sending
   - [ ] Test fallback mechanism

3. **User Scenarios:**
   - [ ] Test existing user invitation
   - [ ] Test new user invitation
   - [ ] Test acceptance notification
   - [ ] Test revocation notification

4. **Error Handling:**
   - [ ] Test invalid email format
   - [ ] Test email service failures
   - [ ] Test rate limiting
   - [ ] Test expired tokens

5. **Deliverability:**
   - [ ] Test spam score
   - [ ] Test email client rendering (Gmail, Outlook, etc.)
   - [ ] Test mobile rendering
   - [ ] Test plain text version

## Implementation Notes

### Files to Create

1. **`supabase/functions/agent-delegation-manager/email-service.ts`** (~300 lines)
   - Email template generation
   - Service fallback logic
   - Email sending with retry

2. **Email Templates** (store as constants or in database)
   - Existing user invitation (HTML + text)
   - New user invitation (HTML + text)
   - Acceptance notification (HTML + text)
   - Revocation notification (HTML + text)

### Files to Modify

1. **`database/schema/current_schema.sql`**
   - Add `is_system_default` to smtp_configurations
   - Add email rate limiting functions

2. **Leverage Existing:**
   - `check-email-exists` function (already exists!)
   - SMTP/SendGrid/Mailgun edge functions (already exist!)
   - VaultService for credential management

## Security Considerations

1. **Email Validation:**
   - Validate email format
   - Check for disposable email domains
   - Rate limit invitations per agent/user

2. **Link Security:**
   - Use cryptographically secure tokens (UUID v4)
   - Single-use tokens (invalidate after acceptance)
   - Time-limited tokens (30 days expiration)
   - HTTPS-only accept links

3. **Privacy:**
   - Don't reveal agent details until acceptance
   - Don't expose owner's email in delegation emails
   - Log email sending for audit trail

4. **Spam Prevention:**
   - Rate limiting (10 invitations/hour/agent)
   - CAPTCHA on invitation form (future enhancement)
   - Monitor bounce rates and complaints

## Next Steps

1. Design email templates (HTML + plain text)
2. Implement email-service.ts module
3. Add template constants or database storage
4. Test email rendering and delivery
5. Implement rate limiting
6. Add comprehensive error handling

## References

- SMTP API: `supabase/functions/smtp-api/index.ts`
- SendGrid API: `supabase/functions/sendgrid-api/index.ts`
- Mailgun Service: `supabase/functions/mailgun-service/index.ts`
- Email Check Function: `supabase/functions/check-email-exists/index.ts`
- SendGrid Templates: `supabase/migrations/20250803142627_sendgrid_core_tables.sql`

