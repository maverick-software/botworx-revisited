# Work Breakdown Structure - LLM Integration Fix

## Phase 1: Research ✅

### 1.1 Root Cause Analysis ✅
- [x] Analyze error logs
- [x] Identify message sequence violation
- [x] Document current flow
- [x] Determine impact scope
- [x] Investigate OpenAI Responses API vs Chat Completions API
- [x] Research MCP Protocol specifications
- [x] Analyze message format differences
- [x] Map current message flow through system

**RESEARCH COMPLETE:** `docs/plans/llm_integration_fix/research/02_comprehensive_findings.md`

## Phase 2: Planning ✅

### 2.1 Solution Design ✅
- [x] Evaluate solution options
- [x] Choose recommended approach (Option 1: Clean Messages)
- [x] Document implementation strategy
- [x] Identify affected files (handlers.ts line 202-211)
- [x] Design message cleaning logic
- [x] Plan testing strategy

**PLAN COMPLETE:** All documented in findings

## Phase 3: Design ✅

### 3.1 Message Cleaning Function Design ✅
- [x] Design message cleaning utility
- [x] Define input/output interfaces
- [x] Document edge cases
- [x] Plan test cases

**DESIGN:** Simple inline cleaning function that:
1. Filters out all `role: 'tool'` messages
2. Removes `tool_calls` property from assistant messages
3. Keeps system and user messages intact

### 3.2 Integration Point Analysis ✅
- [x] Identify all LLM call sites
- [x] Map message flow through handlers
- [x] Document current message transformations
- [x] Plan integration points for cleaning

**INTEGRATION POINT:** `supabase/functions/chat/processor/handlers.ts`, line 204 (before final synthesis call)

## Phase 4: Development

### 4.1 Implement Message Cleaning Utility
- [ ] Create utility function to strip tool_calls
- [ ] Add validation logic
- [ ] Add comprehensive logging
- [ ] Handle edge cases

**REQUIRED READING BEFORE STARTING:** `docs/plans/llm_integration_fix/research/04_01_implementation_plan.md`
**Backups:** `docs/plans/llm_integration_fix/backups/handlers.ts.backup`

### 4.2 Integrate into Final Synthesis Call
- [ ] Apply cleaning before final LLM call in handlers.ts
- [ ] Verify message sequence validity
- [ ] Add debug logging
- [ ] Test with sample messages

**REQUIRED READING BEFORE STARTING:** `docs/plans/llm_integration_fix/research/04_02_integration_implementation.md`
**Backups:** `docs/plans/llm_integration_fix/backups/handlers.ts.backup`

### 4.3 Review MCP Retry Loop
- [ ] Verify MCP retry loop message handling
- [ ] Ensure tool responses are properly added
- [ ] Check message cleaning in retry loop
- [ ] Verify no side effects

**REQUIRED READING BEFORE STARTING:** `docs/plans/llm_integration_fix/research/04_03_mcp_loop_review.md`
**Backups:** `docs/plans/llm_integration_fix/backups/mcp-retry-loop.ts.backup`

## Phase 5: Testing

### 5.1 Unit Testing
- [ ] Test message cleaning function
- [ ] Test with various message types
- [ ] Test edge cases (empty arrays, missing properties)
- [ ] Verify no data loss

### 5.2 Integration Testing
- [ ] Test with QuickBooks tool execution
- [ ] Test with multiple retry scenarios
- [ ] Test final synthesis after successful tool execution
- [ ] Test final synthesis after failed tool execution

### 5.3 End-to-End Testing
- [ ] Test complete user flow
- [ ] Verify user receives correct responses
- [ ] Check all error scenarios
- [ ] Validate message persistence

## Phase 6: Deployment

### 6.1 Deploy to Supabase
- [ ] Deploy chat edge function
- [ ] Monitor deployment logs
- [ ] Verify no errors in production
- [ ] Test with real user request

### 6.2 Validation
- [ ] Monitor error rates
- [ ] Check for any regressions
- [ ] Validate tool execution success rate
- [ ] Confirm user experience improvement

## Phase 7: Cleanup

### 7.1 Code Cleanup
- [ ] Remove debug logging (if excessive)
- [ ] Add inline documentation
- [ ] Update function signatures if needed
- [ ] Run linter and fix issues

### 7.2 Documentation
- [ ] Update README with fix details
- [ ] Document message cleaning utility
- [ ] Add troubleshooting guide
- [ ] Create completion summary

### 7.3 Archive
- [ ] Move backups to /archive folder
- [ ] Update cleanup logs
- [ ] Create final report
- [ ] Update README.md in /docs/logs/cleanup/

---

## Notes

- Each checkbox represents a discrete, testable task
- All tasks must be completed in order within each phase
- Research documents must be created before implementation
- Backups must be created before any file modifications
- All changes must be tested before marking complete

