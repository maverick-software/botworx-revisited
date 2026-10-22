# Database Schema Research - Delegated Access System
**Research Date:** November 4, 2025  
**Purpose:** Understanding current database schema and designing new tables for delegated access

## Current Agent Ownership Model

### agents Table Structure
```sql
CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,  -- Current owner reference
    "name" text NOT NULL,
    "description" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    "system_instructions" text,
    "assistant_instructions" text,
    "active" boolean DEFAULT false,
    "personality" text,
    "avatar_url" text
);

ALTER TABLE ONLY "public"."agents" FORCE ROW LEVEL SECURITY;
```

**Key Findings:**
- Agents are owned by a single user via `user_id` foreign key
- RLS (Row Level Security) is enabled - security policies will need updates
- No current mechanism for shared access or delegation
- Current query pattern in AgentsPage.tsx: `.eq('user_id', user.id)`

### Related Tables
- **user_profiles**: Contains user information (id, username, full_name, avatar_url, role_id)
- **auth.users**: Standard Supabase authentication table
- **team_members**: Links agents to teams (currently for organizational purposes)
- **workspace_members**: Workspace collaboration (different from agent delegation)

## Proposed Database Schema

### 1. agent_delegations Table
**Purpose:** Track delegation relationships between users and agents

```sql
CREATE TABLE IF NOT EXISTS "public"."agent_delegations" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "agent_id" uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    "owner_user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "delegate_user_id" uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    "delegate_email" text NOT NULL,  -- Email for invitation (may not have account yet)
    "permission_level" text NOT NULL DEFAULT 'view',  -- 'view', 'manage', 'full_control'
    "status" text NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'declined', 'revoked'
    "invitation_token" text UNIQUE,  -- Secure token for email invitation link
    "token_expires_at" timestamp with time zone,  -- Expiration for invitation token
    "invited_at" timestamp with time zone DEFAULT now(),
    "accepted_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    
    -- Constraints
    CONSTRAINT "agent_delegations_permission_level_check" 
        CHECK (permission_level IN ('view', 'manage', 'full_control')),
    CONSTRAINT "agent_delegations_status_check" 
        CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
    CONSTRAINT "agent_delegations_unique_active" 
        UNIQUE (agent_id, delegate_email, status)
);

-- Indexes for performance
CREATE INDEX idx_agent_delegations_agent_id ON agent_delegations(agent_id);
CREATE INDEX idx_agent_delegations_owner_user_id ON agent_delegations(owner_user_id);
CREATE INDEX idx_agent_delegations_delegate_user_id ON agent_delegations(delegate_user_id);
CREATE INDEX idx_agent_delegations_delegate_email ON agent_delegations(delegate_email);
CREATE INDEX idx_agent_delegations_invitation_token ON agent_delegations(invitation_token);
CREATE INDEX idx_agent_delegations_status ON agent_delegations(status);

-- Comments
COMMENT ON TABLE "public"."agent_delegations" IS 'Tracks delegated access to agents from owners to other users';
COMMENT ON COLUMN "public"."agent_delegations"."permission_level" IS 'Level of access granted: view (read-only), manage (modify settings), full_control (all permissions)';
COMMENT ON COLUMN "public"."agent_delegations"."status" IS 'Current status of the delegation invitation';
COMMENT ON COLUMN "public"."agent_delegations"."invitation_token" IS 'Secure token used in invitation email link';
```

### 2. agent_delegation_permissions Table
**Purpose:** Fine-grained permissions for what delegates can do

```sql
CREATE TABLE IF NOT EXISTS "public"."agent_delegation_permissions" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "delegation_id" uuid NOT NULL REFERENCES agent_delegations(id) ON DELETE CASCADE,
    "permission_key" text NOT NULL,  -- e.g., 'chat', 'edit_profile', 'manage_integrations', 'view_conversations'
    "is_granted" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    
    CONSTRAINT "agent_delegation_permissions_unique" 
        UNIQUE (delegation_id, permission_key)
);

-- Index for lookups
CREATE INDEX idx_agent_delegation_permissions_delegation_id 
    ON agent_delegation_permissions(delegation_id);

COMMENT ON TABLE "public"."agent_delegation_permissions" IS 'Fine-grained permissions for delegated agent access';
```

### 3. agent_delegation_activity_log Table
**Purpose:** Audit trail of delegation actions

```sql
CREATE TABLE IF NOT EXISTS "public"."agent_delegation_activity_log" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "delegation_id" uuid NOT NULL REFERENCES agent_delegations(id) ON DELETE CASCADE,
    "action_type" text NOT NULL,  -- 'invited', 'accepted', 'declined', 'revoked', 'permission_changed'
    "performed_by_user_id" uuid REFERENCES auth.users(id),
    "action_details" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for audit queries
CREATE INDEX idx_agent_delegation_activity_log_delegation_id 
    ON agent_delegation_activity_log(delegation_id);
CREATE INDEX idx_agent_delegation_activity_log_created_at 
    ON agent_delegation_activity_log(created_at);

COMMENT ON TABLE "public"."agent_delegation_activity_log" IS 'Audit log of all delegation-related actions';
```

## Permission Levels Breakdown

### View Only ('view')
- View agent profile and details
- View agent conversations (read-only)
- View agent settings (read-only)
- Cannot modify anything
- Cannot send messages as the agent

### Manage ('manage')
- All 'view' permissions
- Send messages and interact with agent
- Modify agent settings (instructions, personality)
- Manage agent integrations
- Assign agent to teams
- Cannot delete agent
- Cannot transfer ownership
- Cannot revoke other delegations

### Full Control ('full_control')
- All 'manage' permissions
- Delete agent (with confirmation)
- Manage all delegations (invite, revoke others)
- Transfer ownership capabilities
- Full administrative access

## Security Considerations

### Row Level Security (RLS) Policies

**For agents table:**
```sql
-- Users can see their own agents
CREATE POLICY "Users can view their own agents"
    ON agents FOR SELECT
    USING (auth.uid() = user_id);

-- Users can see agents delegated to them (NEW)
CREATE POLICY "Users can view delegated agents"
    ON agents FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agent_delegations
            WHERE agent_delegations.agent_id = agents.id
            AND agent_delegations.delegate_user_id = auth.uid()
            AND agent_delegations.status = 'accepted'
        )
    );

-- Users can update their own agents
CREATE POLICY "Users can update their own agents"
    ON agents FOR UPDATE
    USING (auth.uid() = user_id);

-- Users with 'manage' or 'full_control' can update delegated agents (NEW)
CREATE POLICY "Delegates with manage permission can update agents"
    ON agents FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM agent_delegations
            WHERE agent_delegations.agent_id = agents.id
            AND agent_delegations.delegate_user_id = auth.uid()
            AND agent_delegations.status = 'accepted'
            AND agent_delegations.permission_level IN ('manage', 'full_control')
        )
    );

-- Similar policies for DELETE with full_control check
```

**For agent_delegations table:**
```sql
-- Owners can view all delegations for their agents
CREATE POLICY "Owners can view agent delegations"
    ON agent_delegations FOR SELECT
    USING (auth.uid() = owner_user_id);

-- Delegates can view their own delegations
CREATE POLICY "Delegates can view their delegations"
    ON agent_delegations FOR SELECT
    USING (auth.uid() = delegate_user_id);

-- Only owners can create delegations
CREATE POLICY "Owners can create delegations"
    ON agent_delegations FOR INSERT
    WITH CHECK (
        auth.uid() = owner_user_id AND
        EXISTS (
            SELECT 1 FROM agents
            WHERE agents.id = agent_delegations.agent_id
            AND agents.user_id = auth.uid()
        )
    );

-- Owners and full_control delegates can update delegations
CREATE POLICY "Owners and delegates can update delegations"
    ON agent_delegations FOR UPDATE
    USING (
        auth.uid() = owner_user_id OR
        (
            auth.uid() = delegate_user_id AND
            permission_level = 'full_control'
        )
    );
```

### Invitation Token Security
- Tokens should be cryptographically secure (use `gen_random_uuid()` or similar)
- Tokens should expire (30 days recommended)
- Tokens should be single-use (invalidate after acceptance/declination)
- Store hashed version for additional security (optional enhancement)

## Email System Integration

### Current Email Infrastructure
**Available Email Services:**
1. **SMTP** - Universal SMTP server support (`smtp-api` edge function)
2. **SendGrid** - API-based email service (`sendgrid-api` edge function)
3. **Mailgun** - Complete API integration (`mailgun-service` edge function)
4. **Gmail** - OAuth-based (primarily for receiving, not ideal for transactional)
5. **Outlook** - Microsoft Graph API (similar to Gmail)

**Recommended Approach:**
- Use **SMTP** with a dedicated transactional email service (SendGrid, Mailgun, or SMTP.com)
- Fall back to other services if SMTP not configured
- Store email templates in database or configuration files

### Email Template Requirements

**Invitation Email for Existing Users:**
```
Subject: [Owner Name] has invited you to access their agent: [Agent Name]

Hi [Recipient Name],

[Owner Name] has invited you to access their AI agent "[Agent Name]" on Agentopia.

Permission Level: [Permission Level Description]

Click the link below to accept this invitation:
[Accept Link with Token]

This invitation expires on [Expiration Date].

If you didn't expect this invitation, you can safely ignore this email.
```

**Invitation Email for New Users:**
```
Subject: [Owner Name] has invited you to join Agentopia

Hi,

[Owner Name] has invited you to join Agentopia to access their AI agent "[Agent Name]".

What is Agentopia?
Agentopia is a platform for creating, managing, and collaborating with AI agents.

Permission Level: [Permission Level Description]

Click the link below to create your account and accept the invitation:
[Sign Up Link with Token]

This invitation expires on [Expiration Date].
```

## Migration Strategy

### Database Migration File
- Create new migration: `20251104_create_agent_delegations_system.sql`
- Include all three tables
- Add RLS policies
- Add indexes
- Include rollback script

### Data Migration Considerations
- No existing data to migrate (new feature)
- Ensure backward compatibility with existing agent queries
- Test RLS policies thoroughly before deployment

## Dependencies and Related Files

### Files to Modify:
1. **Frontend:**
   - `src/pages/AgentsPage.tsx` - Display delegated agents alongside owned agents
   - `src/pages/AgentChatPage.tsx` - Check delegation permissions for actions
   - `src/pages/AgentEdit.tsx` - Restrict editing based on permission level
   - Create new components for delegation management UI

2. **Backend:**
   - `supabase/functions/get-agent-tools/index.ts` - Include delegated agents in tool discovery
   - `supabase/functions/chat/index.ts` - Verify delegation permissions for chat
   - Create new edge function: `agent-delegation-manager` for invitation/acceptance logic

3. **Database:**
   - New migration file
   - Updated RLS policies
   - New database functions for delegation management

### New Components Needed:
- `AgentDelegationModal.tsx` - UI for inviting users
- `DelegationManagementPanel.tsx` - View/manage existing delegations
- `AcceptDelegationPage.tsx` - Landing page for invitation acceptance
- `DelegatedAgentBadge.tsx` - Visual indicator for delegated agents

## Testing Considerations

### Unit Tests:
- RLS policy tests
- Permission level validation
- Token generation and validation
- Email sending

### Integration Tests:
- Full invitation flow (existing user)
- Full invitation flow (new user)
- Permission enforcement across different levels
- Revocation and declination flows
- Token expiration handling

### Edge Cases:
- User deletes account while delegations exist
- Owner deletes agent with active delegations
- Multiple invitations to same email
- Expired token handling
- Cross-workspace delegation conflicts

## Next Steps

1. Create WBS checklist for implementation
2. Design UI mockups for delegation management
3. Create email templates
4. Implement database migration
5. Build edge function for delegation management
6. Implement frontend components
7. Add comprehensive tests
8. Deploy and monitor

## References

- GoDaddy Delegated Access Pattern: https://www.godaddy.com/help/delegate-access
- Current Agents Table: `database/schema/current_schema.sql:3051-3071`
- AgentsPage Implementation: `src/pages/AgentsPage.tsx:52-145`
- Email Infrastructure: `supabase/functions/smtp-api/index.ts`, `sendgrid-api/index.ts`, `mailgun-service/index.ts`

