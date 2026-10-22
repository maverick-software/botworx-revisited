# Email Change Investigation Report
**Date**: October 9, 2025  
**Topic**: Allowing Users to Change Email Addresses Without Breaking OAuth/Supabase Systems

---

## Executive Summary

Allowing users to change their email address is **POSSIBLE** but requires **CAREFUL IMPLEMENTATION** due to multiple system dependencies. The email address is deeply integrated into:
1. Supabase Auth system (`auth.users`)
2. OAuth connections (Gmail, etc.)
3. Vault token storage
4. Profile system
5. Stripe customer records

**Recommendation**: Implement a **two-step verification process** with clear warnings and OAuth re-authentication requirements.

---

## Current System Architecture

### 1. Email Storage Locations

| Location | Purpose | Update Method |
|----------|---------|---------------|
| `auth.users.email` | Primary authentication identifier | Supabase Auth API |
| `profiles.` (no email column) | User profile data | N/A - references auth.users |
| `user_integration_credentials.external_username` | OAuth connection identifier (e.g., Gmail) | Manual update after re-auth |
| `user_integration_credentials.connection_name` | Display name for OAuth connections | Manual update |
| `stripe_customers.customer_email` | Billing email | Stripe API + database |

### 2. OAuth System Dependencies

**Gmail OAuth Flow**:
```typescript
// From supabase/functions/gmail-oauth/index.ts:186-188
{
  external_username: userInfo.email,  // Google account email
  connection_name: userInfo.email,     // Display name
  // ... vault tokens stored with this email reference
}
```

**Key Insight**: OAuth connections are **tied to the external email** (e.g., Gmail account), NOT the user's Agentopia auth email. These are **separate identities**.

---

## Potential Breaking Points

### ⚠️ Critical Issues

1. **OAuth Token Validity**
   - **Risk**: Vault-stored tokens are associated with `user_id`, not email
   - **Impact**: **SAFE** - Tokens remain valid after email change
   - **Reasoning**: Vault keys use `user_id` as the identifier, not email

2. **Gmail Connection Display**
   - **Risk**: `external_username` and `connection_name` show the Gmail email, not auth email
   - **Impact**: **SAFE** - These should remain as the Gmail account email
   - **Reasoning**: These represent the connected Gmail account, not the Agentopia account

3. **Supabase Auth Session**
   - **Risk**: Active sessions may become invalid
   - **Impact**: **MEDIUM** - User needs to re-login
   - **Mitigation**: Force logout after email change

4. **Email-Based Lookups**
   - **Risk**: Any code that searches by email may fail
   - **Impact**: **LOW** - Most queries use `user_id`
   - **Mitigation**: Audit codebase for email-based queries

5. **Stripe Customer Records**
   - **Risk**: Billing email mismatch
   - **Impact**: **MEDIUM** - Invoices sent to old email
   - **Mitigation**: Update Stripe customer email via API

### ✅ Safe Components

1. **Vault Tokens**: Use `user_id` as key, not email
2. **OAuth Connections**: Represent external account emails (Gmail), not auth email
3. **Database Relations**: All use `user_id` (UUID) as foreign key
4. **RLS Policies**: Use `auth.uid()`, not email

---

## Implementation Strategy

### Recommended Approach: Two-Step Email Change with Verification

#### Step 1: Email Change Request
```typescript
// User requests email change
async function requestEmailChange(newEmail: string) {
  // 1. Validate new email format
  // 2. Check if email is already in use
  // 3. Send verification email to NEW address
  // 4. Send notification to OLD address
  // 5. Store pending change in database with token
}
```

#### Step 2: Email Change Confirmation
```typescript
// User clicks verification link in new email
async function confirmEmailChange(token: string) {
  // 1. Verify token validity
  // 2. Update auth.users email via Supabase Admin API
  // 3. Update Stripe customer email
  // 4. Invalidate all user sessions (force re-login)
  // 5. Send confirmation to both emails
  // 6. Log security event
}
```

### Required Database Changes

```sql
-- Create email_change_requests table
CREATE TABLE email_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  verification_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_new_email CHECK (new_email ~ '^[^@]+@[^@]+\.[^@]+$')
);

CREATE INDEX idx_email_change_requests_token ON email_change_requests(verification_token);
CREATE INDEX idx_email_change_requests_user_id ON email_change_requests(user_id);
```

### Required Edge Function

```typescript
// supabase/functions/change-email/index.ts
import { createClient } from '@supabase/supabase-js'

export async function changeUserEmail(userId: string, newEmail: string) {
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  
  // 1. Update auth.users via admin API
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { email: newEmail }
  )
  
  if (authError) throw authError
  
  // 2. Update Stripe customer (if exists)
  const { data: stripeCustomer } = await supabaseAdmin
    .from('stripe_customers')
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .single()
  
  if (stripeCustomer) {
    // Call Stripe API to update customer email
    await updateStripeCustomerEmail(stripeCustomer.stripe_customer_id, newEmail)
    
    // Update local cache
    await supabaseAdmin
      .from('stripe_customers')
      .update({ customer_email: newEmail })
      .eq('user_id', userId)
  }
  
  // 3. Revoke all user sessions (force re-login)
  await supabaseAdmin.auth.admin.signOut(userId, 'global')
  
  return { success: true }
}
```

---

## Security Considerations

### 1. Verification Requirements
- ✅ **Two-factor verification**: Verify both old and new email
- ✅ **Time-limited tokens**: 24-hour expiration
- ✅ **Rate limiting**: Max 3 attempts per day
- ✅ **Password confirmation**: Require current password

### 2. Audit Trail
```sql
CREATE TABLE email_change_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3. Notifications
- Send email to OLD address: "Your email address has been changed"
- Send email to NEW address: "Welcome to your new email"
- Include rollback instructions for 7 days

---

## OAuth Connections: No Action Required

**Important**: OAuth connections (Gmail, etc.) should **NOT** be updated when the user changes their Agentopia email.

### Why?
- `external_username`: Represents the **Gmail account email**, not Agentopia email
- `connection_name`: Display name for the connected Gmail account
- Vault tokens: Associated with the Gmail account, not Agentopia auth

### Example Scenario:
```
User's Agentopia email: john@example.com
User's connected Gmail: john.work@gmail.com

If user changes Agentopia email to: john.new@example.com
↓
Gmail connection should still show: john.work@gmail.com
```

**These are separate identities and should remain independent.**

---

## Implementation Checklist

### Phase 1: Database Setup
- [ ] Create `email_change_requests` table
- [ ] Create `email_change_audit_log` table
- [ ] Add indexes for performance
- [ ] Enable RLS policies

### Phase 2: Backend Implementation
- [ ] Create `change-email` Edge Function
- [ ] Implement verification token generation
- [ ] Add Stripe customer email update logic
- [ ] Implement session revocation
- [ ] Add rate limiting

### Phase 3: Frontend Implementation
- [ ] Add "Change Email" button to UserProfileModal
- [ ] Create email change request modal
- [ ] Create email verification page
- [ ] Add confirmation dialogs with warnings
- [ ] Implement error handling

### Phase 4: Communication
- [ ] Create email templates (verification, notification, confirmation)
- [ ] Add in-app notifications
- [ ] Create help documentation

### Phase 5: Testing
- [ ] Test email validation
- [ ] Test token expiration
- [ ] Test Stripe integration
- [ ] Test OAuth connections (verify they remain intact)
- [ ] Test session revocation
- [ ] Test edge cases (duplicate emails, expired tokens, etc.)

---

## Recommended UI Flow

### 1. User Initiates Change
```
[Current Email: john@example.com]
[Change Email] button
↓
Modal: "Change Your Email Address"
- Current Email: john@example.com (read-only)
- New Email: ___________
- Password: ___________ (for verification)
[⚠️ Warning: You'll need to verify the new email and re-login]
[Cancel] [Request Change]
```

### 2. Verification Sent
```
✉️ "Verification Email Sent"
We've sent a verification link to:
new.email@example.com

Please check your inbox and click the link to complete the change.

⏰ This link expires in 24 hours.
```

### 3. User Clicks Verification Link
```
✅ "Email Address Updated"
Your email has been successfully changed to:
new.email@example.com

For security, you've been logged out of all devices.
Please log in again with your new email.

[Log In]
```

---

## Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| User locks themselves out | HIGH | Require password confirmation |
| Email typo | MEDIUM | Send verification to new email |
| Malicious actor steals account | HIGH | Notify old email, allow rollback |
| OAuth connections break | LOW | Keep separate from auth email |
| Stripe billing disruption | MEDIUM | Auto-update Stripe customer |
| Lost access to old email | HIGH | Provide account recovery flow |

---

## Conclusion

**Allowing email changes is SAFE with proper implementation**.

### Key Takeaways:
1. ✅ **Vault tokens will continue working** (tied to `user_id`, not email)
2. ✅ **OAuth connections will remain intact** (represent external accounts)
3. ⚠️ **Force re-login required** for security
4. ⚠️ **Stripe email must be updated** to prevent billing issues
5. ✅ **Two-step verification** provides security
6. ✅ **Audit logging** enables rollback if needed

### Next Steps:
1. Review and approve this implementation plan
2. Create database migrations for `email_change_requests` table
3. Implement `change-email` Edge Function
4. Update UserProfileModal UI
5. Test thoroughly before deployment

---

## References

- Supabase Auth Admin API: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- Stripe Update Customer API: https://stripe.com/docs/api/customers/update
- OAuth Token Storage: `supabase/functions/gmail-oauth/index.ts`
- Profile System: `supabase/migrations/20251009102739_consolidate_profiles_tables.sql`

