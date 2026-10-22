# Delegated Access System - Implementation Plan
**Plan Created:** November 4, 2025  
**Project:** Agentopia Delegated Access Feature  
**Estimated Complexity:** High  
**Estimated Duration:** 3-5 development sessions

## Executive Summary

Implement a comprehensive delegated access system that allows Agentopia users to invite other users (existing or new) to view and use their AI agents. The system will mirror GoDaddy's delegated access pattern with secure invitation flows, granular permissions, and comprehensive access management.

## Goals

1. **Primary Goal:** Enable agent owners to delegate access to their agents to other users
2. **User Experience:** Seamless invitation and acceptance flow for both existing and new users
3. **Security:** Enterprise-grade security with proper RLS policies and audit trails
4. **Flexibility:** Multiple permission levels (View, Manage, Full Control)
5. **Visibility:** Clear visual indicators of delegated agents vs. owned agents

## Key Features

### 1. Invitation System
- **For Existing Users:**
  - Email invitation with secure token link
  - One-click acceptance flow
  - Clear permission level display
  
- **For New Users:**
  - Email invitation with account creation link
  - Token preserved through signup flow
  - Automatic delegation acceptance after account creation

### 2. Permission Levels

**View Only:**
- View agent profile and settings (read-only)
- View agent conversations (read-only)
- Cannot interact or modify anything

**Manage:**
- All View permissions
- Send messages and interact with agent
- Modify agent settings
- Manage integrations
- Cannot delete or transfer ownership

**Full Control:**
- All Manage permissions
- Delete agent
- Manage delegations (invite/revoke others)
- Transfer ownership
- Full administrative access

### 3. Delegation Management
- Dashboard to view all delegations (sent and received)
- Revoke access at any time
- Modify permission levels
- View delegation activity log

### 4. Visual Indicators
- Delegated agents show badge in agents list
- Permission level clearly displayed
- Owner information visible on delegated agents

## Technical Architecture

### Database Layer

**New Tables:**
1. `agent_delegations` - Core delegation relationships
2. `agent_delegation_permissions` - Fine-grained permissions
3. `agent_delegation_activity_log` - Audit trail

**Updated Policies:**
- Agents table RLS policies
- Chat messages access policies
- Agent settings access policies

### Backend Services

**New Edge Function:**
- `agent-delegation-manager` - Handles all delegation operations
  - Create invitation
  - Accept invitation
  - Decline invitation
  - Revoke delegation
  - Update permissions
  - Send invitation emails

**Modified Edge Functions:**
- `chat` - Add delegation permission checks
- `get-agent-tools` - Include delegated agents in tool discovery
- Various agent management functions - Add permission validation

### Frontend Components

**New Pages:**
- `AcceptDelegationPage.tsx` - Invitation acceptance landing page

**New Components:**
- `AgentDelegationModal.tsx` - Invite users dialog
- `DelegationManagementPanel.tsx` - View/manage delegations
- `DelegatedAgentBadge.tsx` - Visual indicator
- `PermissionLevelSelector.tsx` - Permission picker
- `DelegationActivityLog.tsx` - Audit trail display

**Modified Components:**
- `AgentsPage.tsx` - Show delegated + owned agents
- `AgentChatPage.tsx` - Permission-based actions
- `AgentEdit.tsx` - Permission-based editing
- `ChatHeader.tsx` - Show delegation status

### Email System

**Templates:**
- Existing user invitation email
- New user invitation email  
- Delegation accepted notification
- Delegation revoked notification

**Delivery:**
- Use existing SMTP/SendGrid/Mailgun infrastructure
- Configurable email service fallback
- Template management system

## Proposed File Structure

```
docs/plans/delegated_access/
├── plan.md (this file)
├── wbs_checklist.md
├── research/
│   ├── 01_database_schema_research.md
│   ├── 02_email_system_research.md
│   ├── 03_frontend_integration_research.md
│   ├── 04_security_considerations_research.md
│   └── 05_testing_strategy_research.md
├── implementation/
│   ├── 01_database_migration_implementation.md
│   ├── 02_edge_function_implementation.md
│   ├── 03_frontend_components_implementation.md
│   ├── 04_email_templates_implementation.md
│   ├── 05_rls_policies_implementation.md
│   └── 06_testing_implementation.md
└── backups/
    └── (backup files during implementation)

supabase/migrations/
└── 20251104000000_create_agent_delegations_system.sql

supabase/functions/
└── agent-delegation-manager/
    ├── index.ts
    ├── invitation-handler.ts
    ├── acceptance-handler.ts
    ├── permission-manager.ts
    └── email-service.ts

src/pages/
├── AcceptDelegationPage.tsx (NEW)
└── (modified existing pages)

src/components/delegations/
├── AgentDelegationModal.tsx (NEW - ~280 lines)
├── DelegationManagementPanel.tsx (NEW - ~320 lines)
├── DelegatedAgentBadge.tsx (NEW - ~80 lines)
├── PermissionLevelSelector.tsx (NEW - ~150 lines)
├── DelegationActivityLog.tsx (NEW - ~200 lines)
├── DelegationInviteForm.tsx (NEW - ~220 lines)
└── DelegationListItem.tsx (NEW - ~180 lines)

src/hooks/
├── useDelegations.ts (NEW - ~250 lines)
├── useAgentPermissions.ts (NEW - ~180 lines)
└── useDelegationManagement.ts (NEW - ~280 lines)

src/types/
└── delegations.ts (NEW - ~100 lines)
```

**File Size Compliance:**
All planned files are designed to be under 500 lines, following Philosophy #1. Complex components are broken into smaller sub-components.

## Security Considerations

### Authentication & Authorization
- Secure token generation (UUID v4)
- Token expiration (30 days)
- Single-use tokens
- RLS policies for all data access
- Permission-based action validation

### Audit Trail
- All delegation actions logged
- Activity viewable by owner and delegates
- Timestamps and actor tracking
- Immutable log entries

### Data Privacy
- Delegates only see what permissions allow
- Conversation history respects delegation permissions
- No access to owner's other agents
- Clear permission boundaries

## User Experience Flow

### Invitation Flow (Existing User)
```
1. Owner clicks "Share Agent" button
2. Owner enters email and selects permission level
3. System validates email exists
4. Secure invitation email sent
5. Recipient clicks link in email
6. Recipient sees agent details and permissions
7. Recipient clicks "Accept"
8. Agent appears in recipient's agent list
9. Owner receives acceptance notification
```

### Invitation Flow (New User)
```
1. Owner clicks "Share Agent" button
2. Owner enters email and selects permission level
3. System validates email doesn't exist
4. Secure invitation email sent
5. Recipient clicks link in email
6. Recipient taken to signup page (token preserved)
7. Recipient creates account
8. After signup, auto-redirect to accept page
9. Recipient sees agent details and permissions
10. Recipient clicks "Accept"
11. Agent appears in recipient's agent list
12. Owner receives acceptance notification
```

### Delegation Management Flow
```
1. Owner navigates to Agent Settings > Delegations
2. View list of all delegations
3. See status (Pending/Accepted/Declined/Revoked)
4. Click "Revoke" to remove access
5. Click "Modify" to change permission level
6. View activity log of delegation actions
```

## Testing Strategy

### Unit Tests
- Database functions
- RLS policy enforcement
- Token generation/validation
- Permission level checking

### Integration Tests
- Full invitation flows
- Email delivery
- Permission enforcement
- Revocation flows

### End-to-End Tests
- Complete user journeys
- Cross-browser testing
- Mobile responsiveness
- Error handling

## Rollout Plan

### Phase 1: Database & Backend (Session 1)
- Create database migration
- Implement RLS policies
- Create edge function
- Basic testing

### Phase 2: Email System (Session 1-2)
- Create email templates
- Integrate with existing email services
- Test email delivery
- Template management

### Phase 3: Frontend Components (Session 2-3)
- Build delegation management UI
- Create invitation modal
- Add acceptance page
- Update agents page

### Phase 4: Integration & Testing (Session 3-4)
- Integration testing
- Permission enforcement testing
- User acceptance testing
- Bug fixes

### Phase 5: Documentation & Deployment (Session 4-5)
- Update user documentation
- Create admin documentation
- Deploy to production
- Monitor and iterate

## Success Criteria

1. ✅ Users can invite others to their agents
2. ✅ New users can accept invitations after signup
3. ✅ Existing users can accept invitations
4. ✅ Permission levels work correctly
5. ✅ Owners can revoke access
6. ✅ Delegated agents appear in agents list
7. ✅ All actions are audited
8. ✅ Email notifications work
9. ✅ Security policies are enforced
10. ✅ No performance degradation

## Dependencies

### External Services
- Email service (SMTP/SendGrid/Mailgun)
- Supabase Vault (for token security)

### Internal Systems
- Agents system
- Chat system
- Authentication system
- RLS policies

### Browser Requirements
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Android)

## Risks & Mitigation

### Risk 1: Performance Impact
**Mitigation:** Optimize RLS queries, add appropriate indexes, cache delegation status

### Risk 2: Security Vulnerabilities
**Mitigation:** Security audit, penetration testing, rate limiting on invitations

### Risk 3: Email Delivery Issues
**Mitigation:** Multiple email service fallbacks, delivery tracking, retry logic

### Risk 4: User Confusion
**Mitigation:** Clear UI/UX, in-app tutorials, comprehensive documentation

## Future Enhancements

1. **Bulk Invitations:** Invite multiple users at once
2. **Delegation Templates:** Save permission presets
3. **Time-Limited Access:** Auto-revoke after date
4. **Team Delegations:** Share with entire teams
5. **Advanced Analytics:** Track delegation usage
6. **API Access:** Programmatic delegation management

## References

- GoDaddy Delegated Access: https://www.godaddy.com/help/delegate-access
- Database Schema Research: `docs/plans/delegated_access/research/01_database_schema_research.md`
- Current Agents Implementation: `src/pages/AgentsPage.tsx`
- Email System: `supabase/functions/smtp-api/index.ts`

