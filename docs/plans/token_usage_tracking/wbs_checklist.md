# Token Usage Tracking System - Work Breakdown Structure (WBS)

**Project**: Token Usage Tracking System  
**Created**: October 22, 2025  
**Last Updated**: October 22, 2025

---

## Phase 1: Research ⏳

### 1.1 Database Schema Research
- [ ] **Task**: Research optimal database schema for token usage storage
  - [ ] Investigate aggregation vs. raw storage strategies
  - [ ] Research time-series data best practices in PostgreSQL
  - [ ] Analyze existing `chat_messages_v2.metadata` structure
  - [ ] Determine optimal indexing strategy
  - [ ] Research partitioning strategies for large datasets
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 1.2 Chat Metadata Structure Research
- [ ] **Task**: Analyze how token data is currently stored in chat messages
  - [ ] Read `supabase/functions/chat/processor/types.ts`
  - [ ] Read `supabase/functions/chat/processor/builder.ts`
  - [ ] Read `supabase/functions/chat/processor/handlers.ts`
  - [ ] Verify token data is consistently captured
  - [ ] Document metadata structure format
  - [ ] Identify any edge cases or missing data scenarios
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 1.3 Admin UI Patterns Research
- [ ] **Task**: Study existing admin UI patterns for consistency
  - [ ] Read `src/pages/AdminUserManagement.tsx`
  - [ ] Read `src/components/modals/EditUserRolesModal.tsx`
  - [ ] Read `src/components/modals/LLMDebugModal.tsx` (for data display patterns)
  - [ ] Document modal structure and styling patterns
  - [ ] Research Shadcn/UI Dialog component capabilities
  - [ ] Identify reusable UI components
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 1.4 Edge Function Patterns Research
- [ ] **Task**: Analyze existing Edge Function patterns for admin operations
  - [ ] Read `supabase/functions/admin-get-users/index.ts`
  - [ ] Read `supabase/functions/admin-set-user-status/index.ts`
  - [ ] Document authentication and authorization patterns
  - [ ] Research RLS (Row Level Security) requirements
  - [ ] Identify error handling patterns
  - [ ] Document response structure standards
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 1.5 Aggregation Strategy Research
- [ ] **Task**: Determine optimal token aggregation strategy
  - [ ] Research real-time vs. batch aggregation trade-offs
  - [ ] Investigate Supabase Cron job capabilities
  - [ ] Research PostgreSQL materialized views for performance
  - [ ] Determine aggregation frequency (hourly, daily, weekly)
  - [ ] Plan historical backfill strategy
  - [ ] Research incremental aggregation patterns
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 1.6 Frontend Charting Research
- [ ] **Task**: Select and research charting library
  - [ ] Compare Recharts vs. Chart.js vs. other options
  - [ ] Research React integration patterns
  - [ ] Evaluate bundle size impact
  - [ ] Test responsiveness and accessibility
  - [ ] Document implementation examples
  - [ ] Verify TypeScript support
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

---

## Phase 2: Planning ⏳

### 2.1 Database Design Planning
- [ ] **Task**: Create detailed database schema design document
  - [ ] Finalize table structure with all columns
  - [ ] Design indexes and constraints
  - [ ] Plan RLS policies
  - [ ] Document relationships and foreign keys
  - [ ] Create migration SQL draft
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 2.2 API Design Planning
- [ ] **Task**: Design Edge Function API contracts
  - [ ] Define input/output interfaces
  - [ ] Document error responses
  - [ ] Plan authentication flow
  - [ ] Design rate limiting strategy
  - [ ] Document endpoint specifications
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 2.3 Frontend Component Planning
- [ ] **Task**: Design React component architecture
  - [ ] Create component hierarchy diagram
  - [ ] Define props and state management
  - [ ] Plan data flow and API integration
  - [ ] Design responsive layout breakpoints
  - [ ] Document user interactions
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 2.4 Aggregation System Planning
- [ ] **Task**: Design token aggregation workflow
  - [ ] Create aggregation algorithm pseudocode
  - [ ] Plan cron job schedule
  - [ ] Design failure recovery mechanism
  - [ ] Document backfill strategy
  - [ ] Plan monitoring and alerting
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

---

## Phase 3: Design ⏳

### 3.1 UI/UX Design
- [ ] **Task**: Create mockups and design specifications
  - [ ] Sketch modal layout and components
  - [ ] Define color scheme and typography
  - [ ] Design chart visualizations
  - [ ] Plan loading and error states
  - [ ] Create responsive design mockups
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 3.2 Database Schema Finalization
- [ ] **Task**: Finalize and review database schema
  - [ ] Review schema with constraints in mind
  - [ ] Validate indexes for query patterns
  - [ ] Verify RLS policies are secure
  - [ ] Test migration SQL locally
  - [ ] Document rollback procedure
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 3.3 TypeScript Interfaces Design
- [ ] **Task**: Define all TypeScript interfaces and types
  - [ ] Create frontend types for API responses
  - [ ] Define backend types for Edge Functions
  - [ ] Document shared types
  - [ ] Validate type safety
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

---

## Phase 4: Development ⏳

### 4.1 Database Implementation
- [ ] **Task 4.1.1**: Create migration file for `user_token_usage` table
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.1.2**: Create database function `calculate_user_token_usage`
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.1.3**: Create RLS policies for `user_token_usage`
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.1.4**: Push migration to cloud database
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

### 4.2 Edge Functions Implementation
- [ ] **Task 4.2.1**: Create `admin-get-user-token-usage` Edge Function
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.2.2**: Create `aggregate-token-usage` Edge Function
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.2.3**: Deploy Edge Functions to Supabase
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

### 4.3 Frontend Implementation
- [ ] **Task 4.3.1**: Create `TokenUsageModal.tsx` component
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: `src/pages/AdminUserManagement.tsx`
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.3.2**: Create chart components for token visualization
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.3.3**: Integrate modal into AdminUserManagement page
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.3.4**: Add "Token Usage" button to user table actions
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

### 4.4 Aggregation System Implementation
- [ ] **Task 4.4.1**: Set up Supabase Cron job for daily aggregation
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.4.2**: Create historical data backfill script
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

- [ ] **Task 4.4.3**: Run backfill for existing historical data
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]
  - **Actions Taken**: [To be documented after completion]
  - **Reversal Instructions**: [To be documented after completion]

---

## Phase 5: Testing ⏳

### 5.1 Database Testing
- [ ] **Task**: Test database functions and queries
  - [ ] Test `calculate_user_token_usage` function with sample data
  - [ ] Verify indexes improve query performance
  - [ ] Test RLS policies with different user roles
  - [ ] Validate data integrity and constraints
  - [ ] Test concurrent access scenarios
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 5.2 Edge Function Testing
- [ ] **Task**: Test Edge Functions thoroughly
  - [ ] Test `admin-get-user-token-usage` with various inputs
  - [ ] Test `aggregate-token-usage` with edge cases
  - [ ] Verify authentication and authorization
  - [ ] Test error handling and edge cases
  - [ ] Performance test with large datasets
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 5.3 Frontend Testing
- [ ] **Task**: Test UI components and interactions
  - [ ] Test modal opening/closing
  - [ ] Test data loading and error states
  - [ ] Test chart rendering with various data
  - [ ] Test responsive design on different screen sizes
  - [ ] Verify accessibility (keyboard navigation, screen readers)
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 5.4 Integration Testing
- [ ] **Task**: Test end-to-end workflows
  - [ ] Test full workflow from chat message to token display
  - [ ] Verify aggregation updates reflected in UI
  - [ ] Test multiple users and concurrent access
  - [ ] Verify data consistency across components
  - [ ] Test cron job execution
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

---

## Phase 6: Refinement ⏳

### 6.1 Performance Optimization
- [ ] **Task**: Optimize performance bottlenecks
  - [ ] Profile query performance
  - [ ] Optimize chart rendering
  - [ ] Add caching where appropriate
  - [ ] Minimize API calls
  - [ ] Optimize bundle size
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 6.2 UI/UX Polish
- [ ] **Task**: Polish user interface and experience
  - [ ] Refine visual design and spacing
  - [ ] Add loading animations
  - [ ] Improve error messages
  - [ ] Add helpful tooltips
  - [ ] Enhance mobile responsiveness
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 6.3 Code Quality
- [ ] **Task**: Improve code quality and maintainability
  - [ ] Add comprehensive TypeScript types
  - [ ] Add code comments and documentation
  - [ ] Refactor duplicated code
  - [ ] Follow established code patterns
  - [ ] Run linter and fix issues
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

---

## Phase 7: Cleanup ⏳

### 7.1 User Acceptance Testing
- [ ] **Task**: Prompt user to test the system
  - [ ] Guide user through testing scenarios
  - [ ] Collect feedback on UI/UX
  - [ ] Verify accuracy of token counts
  - [ ] Test with real production data
  - [ ] Document any issues or improvements
  - **REQUIRED READING BEFORE STARTING**: [To be created]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: [To be documented]

### 7.2 Archive Backups
- [ ] **Task**: Move backups to archive folder
  - [ ] Move `docs/plans/token_usage_tracking/backups/` to `/archive/token_usage_tracking_backups_YYYYMMDD/`
  - [ ] Verify archive folder is in .gitignore
  - [ ] Document backup locations in cleanup log
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: N/A (this is the backup archival step)

### 7.3 Update README
- [ ] **Task**: Update root README.md with new feature
  - [ ] Add token usage tracking to features list
  - [ ] Document admin capabilities
  - [ ] Update any relevant architecture sections
  - [ ] Verify links and formatting
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: `README.md`

### 7.4 Create Cleanup Log
- [ ] **Task**: Document implementation and cleanup
  - [ ] Create cleanup log in `/docs/logs/cleanup/token_usage_tracking/`
  - [ ] Document all changes made
  - [ ] Document lessons learned
  - [ ] Update `/docs/logs/README.md` cleanup table
  - [ ] Include references to this WBS
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: N/A

### 7.5 Final Summary
- [ ] **Task**: Provide user with project summary
  - [ ] Summarize all changes and additions
  - [ ] Highlight key features and capabilities
  - [ ] Document any known limitations
  - [ ] Provide usage instructions
  - [ ] Celebrate completion! 🎉
  - **REQUIRED READING BEFORE STARTING**: [To be documented]
  - **Plan Review & Alignment**: [To be documented]
  - **Future Intent**: [To be documented]
  - **Cautionary Notes**: [To be documented]
  - **Backups**: N/A

---

**Total Tasks**: 65  
**Completed**: 0  
**In Progress**: 0  
**Pending**: 65  

**Progress**: 0%

