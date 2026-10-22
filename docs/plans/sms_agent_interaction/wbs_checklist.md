# SMS Agent Interaction - Work Breakdown Structure Checklist

## Project: Enable Two-Way SMS Communication Between Users and Agents

### Phase 1: Research ✅
- [✅] 1.1 Analyze current codebase conversation tracking system
- [✅] 1.2 Research ClickSend inbound SMS API and webhook capabilities  
- [✅] 1.3 Review existing ChannelsTab implementation for SMS integration
- [✅] 1.4 Analyze database schema for SMS conversation mapping requirements

### Phase 2: Planning ✅
- [✅] 2.1 Create comprehensive implementation plan with file structure
- [✅] 2.2 Design database schema for SMS conversation tracking
- [✅] 2.3 Design technical architecture and message flow
- [✅] 2.4 Create Work Breakdown Structure with detailed tasks
- [✅] 2.5 Research conversation tracking approach (phone number-based mapping)

### Phase 3: Design
- [🚧] 3.1 Database Schema Design
  - **Status**: In Progress
  - **Estimated Time**: 2 hours
  - **Dependencies**: Research phase completion
  - **REQUIRED READING BEFORE STARTING**: docs/plans/sms_agent_interaction/research/3.1_database_schema_research.md
  - **Plan Review & Alignment**: Follows existing migration patterns, uses standard RLS policies, integrates with current conversation system
  - **Future Intent**: Create sms_conversations and agent_sms_settings tables with proper indexing and constraints
  - **Cautionary Notes**: Ensure phone number validation regex is correct, test RLS policies thoroughly, backup schema before changes
  - **Backups**: Database schema dump, existing migration files
  - **Key Finding**: Use phone number + agent_id mapping instead of URL parameters for conversation tracking
  
- [ ] 3.2 Webhook API Design
  - **Status**: Pending  
  - **Estimated Time**: 3 hours
  - **Dependencies**: Database schema design
  - **REQUIRED READING BEFORE STARTING**: docs/plans/sms_agent_interaction/research/3.2_webhook_implementation_research.md
  - **Plan Review & Alignment**: Follows existing edge function patterns, uses standard CORS headers, implements proper error handling
  - **Future Intent**: Create clicksend-inbound-webhook edge function with validation, rate limiting, and message processing
  - **Cautionary Notes**: Test webhook validation thoroughly, implement proper IP filtering, ensure response time < 500ms
  - **Backups**: Existing edge function files, webhook configuration
  
- [ ] 3.3 Frontend UI/UX Design
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: Understanding current ChannelsTab structure
  - **REQUIRED READING BEFORE STARTING**: docs/plans/sms_agent_interaction/research/3.3_frontend_ui_research.md
  - **Plan Review & Alignment**: Extends existing ChannelsTab patterns, uses consistent UI components, follows established modal patterns
  - **Future Intent**: Add SMS interaction toggle, create settings modal, implement conversation management UI
  - **Cautionary Notes**: Maintain UI consistency with existing channels, ensure responsive design, test all interactive elements
  - **Backups**: ChannelsTab.tsx, related UI components
  
- [ ] 3.4 Security and Validation Design
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: Webhook API design

### Phase 4: Development

#### 4.1 Database Implementation
- [ ] 4.1.1 Create SMS conversation mapping tables
  - **Status**: Pending
  - **Estimated Time**: 1 hour
  - **Files**: `supabase/migrations/20250915000001_create_sms_interaction_tables.sql`
  
- [ ] 4.1.2 Create agent SMS settings table
  - **Status**: Pending
  - **Estimated Time**: 1 hour
  - **Files**: `supabase/migrations/20250915000002_add_sms_settings_to_agents.sql`
  
- [ ] 4.1.3 Add RLS policies for SMS tables
  - **Status**: Pending
  - **Estimated Time**: 1 hour
  - **Dependencies**: 4.1.1, 4.1.2

#### 4.2 Backend Webhook Implementation
- [ ] 4.2.1 Create webhook endpoint structure
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Files**: `supabase/functions/clicksend-inbound-webhook/index.ts`
  
- [ ] 4.2.2 Implement request validation and security
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Files**: `supabase/functions/clicksend-inbound-webhook/validation.ts`
  
- [ ] 4.2.3 Create SMS message processor
  - **Status**: Pending
  - **Estimated Time**: 3 hours
  - **Files**: `supabase/functions/clicksend-inbound-webhook/message-processor.ts`
  
- [ ] 4.2.4 Implement phone number utilities
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Files**: `supabase/functions/clicksend-inbound-webhook/phone-utils.ts`

#### 4.3 Conversation Management API
- [ ] 4.3.1 Create SMS conversation management endpoint
  - **Status**: Pending
  - **Estimated Time**: 3 hours
  - **Files**: `supabase/functions/sms-conversation-manager/index.ts`
  
- [ ] 4.3.2 Implement conversation lookup and creation logic
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: 4.3.1

#### 4.4 Frontend Implementation
- [ ] 4.4.1 Enhance ChannelsTab with SMS interaction toggle
  - **Status**: Pending
  - **Estimated Time**: 3 hours
  - **Files**: `src/components/modals/agent-settings/ChannelsTab.tsx`
  
- [ ] 4.4.2 Create SMS interaction settings component
  - **Status**: Pending
  - **Estimated Time**: 4 hours
  - **Files**: `src/components/modals/agent-settings/sms/SmsInteractionSettings.tsx`
  
- [ ] 4.4.3 Create SMS conversation list component
  - **Status**: Pending
  - **Estimated Time**: 3 hours
  - **Files**: `src/components/modals/agent-settings/sms/SmsConversationList.tsx`
  
- [ ] 4.4.4 Add SMS channel indicators to chat interface
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Files**: `src/components/chat/SmsChannelIndicator.tsx`

#### 4.5 Hooks and Services
- [ ] 4.5.1 Create SMS conversation management hook
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Files**: `src/hooks/useSmsConversations.ts`
  
- [ ] 4.5.2 Create SMS settings management hook
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Files**: `src/hooks/useSmsSettings.ts`
  
- [ ] 4.5.3 Create SMS service for API interactions
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Files**: `src/services/smsService.ts`

### Phase 5: Testing
- [ ] 5.1 Unit Testing
  - **Status**: Pending
  - **Estimated Time**: 4 hours
  - **Dependencies**: Core development completion
  
- [ ] 5.2 Integration Testing
  - **Status**: Pending
  - **Estimated Time**: 3 hours
  - **Dependencies**: 5.1
  
- [ ] 5.3 End-to-End SMS Flow Testing
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: 5.2
  
- [ ] 5.4 Webhook Performance Testing
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: Backend implementation

### Phase 6: Refinement
- [ ] 6.1 Error Handling Enhancement
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: Testing phase
  
- [ ] 6.2 Security Audit and Hardening
  - **Status**: Pending
  - **Estimated Time**: 3 hours
  - **Dependencies**: Core implementation
  
- [ ] 6.3 Performance Optimization
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: Performance testing
  
- [ ] 6.4 Documentation and Code Comments
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: Implementation completion

### Phase 7: Deployment and Cleanup
- [ ] 7.1 ClickSend Webhook Configuration
  - **Status**: Pending
  - **Estimated Time**: 1 hour
  - **Dependencies**: Webhook implementation
  
- [ ] 7.2 Production Deployment
  - **Status**: Pending
  - **Estimated Time**: 1 hour
  - **Dependencies**: All testing complete
  
- [ ] 7.3 User Acceptance Testing
  - **Status**: Pending
  - **Estimated Time**: 2 hours
  - **Dependencies**: Production deployment
  
- [ ] 7.4 Move backup files to archive
  - **Status**: Pending
  - **Estimated Time**: 0.5 hours
  - **Dependencies**: User acceptance
  
- [ ] 7.5 Update README.md with SMS interaction features
  - **Status**: Pending
  - **Estimated Time**: 1 hour
  - **Dependencies**: 7.4
  
- [ ] 7.6 Create cleanup documentation
  - **Status**: Pending
  - **Estimated Time**: 1 hour
  - **Dependencies**: Project completion

## Total Estimated Time: 64.5 hours
## Estimated Timeline: 3-4 weeks (assuming 16-20 hours per week)

## Critical Path:
Research → Planning → Database Schema → Webhook Implementation → Frontend Integration → Testing → Deployment

## Risk Factors:
- ClickSend webhook configuration complexity
- Phone number validation and international format handling
- Conversation context persistence across SMS messages
- Rate limiting and spam prevention implementation
- Integration with existing chat message system

## Success Metrics:
- [ ] Users can send SMS messages to agents
- [ ] Agents receive SMS messages in their chat interface
- [ ] Agents can respond to SMS messages through the chat interface
- [ ] Conversation context is maintained across SMS interactions
- [ ] SMS interaction can be toggled on/off per agent
- [ ] System handles multiple concurrent SMS conversations
- [ ] Proper error handling and security measures in place
