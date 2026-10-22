# MCP Logging Optimization - WBS Checklist

**Project**: Remove excessive logging and redundant operations from MCP tool execution system  
**Start Date**: October 6, 2025  
**Target Completion**: October 9, 2025  
**Owner**: Development Team  

---

## 📊 Project Overview

**Goal**: Reduce MCP system log volume by 70% (34 → 10 messages per tool call) while maintaining full functionality  
**Status**: 🟡 Planning  
**Progress**: 0/10 Phases Complete

---

## Phase 1: Log Level Infrastructure ⏳ NOT STARTED

**Goal**: Add log level support without changing existing logs  
**Duration**: 2 hours  
**Status**: ⏳ Not Started  
**Priority**: High  
**Dependencies**: None

### Tasks
- [ ] 1.1 Create `LogLevel` enum (DEBUG, INFO, WARN, ERROR)
  - File: `supabase/functions/shared/utils/logger.ts` (NEW)
  - Define enum with numeric values
  - Export for use across codebase

- [ ] 1.2 Create `Logger` utility class
  - File: `supabase/functions/shared/utils/logger.ts`
  - Implement `debug()`, `info()`, `warn()`, `error()` methods
  - Add level filtering based on environment variable
  - Add timestamp formatting
  - Add context/prefix support

- [ ] 1.3 Add `LOG_LEVEL` environment variable support
  - Default to `INFO` in production
  - Parse from `Deno.env.get('LOG_LEVEL')`
  - Validate and fallback to INFO if invalid

- [ ] 1.4 Create logging helper functions
  - `createLogger(context: string)` factory function
  - Consistent formatting across all logs
  - Performance-optimized (lazy evaluation)

- [ ] 1.5 Add documentation for log levels
  - Document when to use each level
  - Provide examples
  - Update README with LOG_LEVEL usage

- [ ] 1.6 Import logger in main chat index
  - File: `supabase/functions/chat/index.ts`
  - Set up global logger instance
  - Test logger initialization

### Acceptance Criteria
- ✅ Logger utility created and exported
- ✅ LOG_LEVEL environment variable functional
- ✅ All log levels work correctly
- ✅ Documentation complete
- ✅ No breaking changes to existing code

### Testing
- [ ] Test with LOG_LEVEL=DEBUG (all logs visible)
- [ ] Test with LOG_LEVEL=INFO (reduced logs)
- [ ] Test with LOG_LEVEL=ERROR (minimal logs)
- [ ] Test with invalid LOG_LEVEL (fallback to INFO)

---

## Phase 2: Fix Critical Bug - Character-by-Character Parameters ⏳ NOT STARTED

**Goal**: Fix parameter spreading bug causing 195-line log output  
**Duration**: 30 minutes  
**Status**: ⏳ Not Started  
**Priority**: Critical  
**Dependencies**: None

### Tasks
- [ ] 2.1 Locate parameter logging in `universal-tool-executor.ts`
  - File: `supabase/functions/chat/function_calling/universal-tool-executor.ts`
  - Find line ~295 with character-by-character logging
  - Identify root cause (string spreading)

- [ ] 2.2 Fix object spreading bug
  - Change from: `{ ...params }` (when params is string)
  - Change to: `params` (direct logging)
  - Ensure proper JSON parsing before logging

- [ ] 2.3 Add defensive parameter handling
  - Check if params is string vs object
  - Parse JSON strings before logging
  - Handle edge cases (null, undefined, etc.)

- [ ] 2.4 Test with various parameter types
  - Test with string parameters
  - Test with object parameters
  - Test with nested objects
  - Test with arrays

### Acceptance Criteria
- ✅ No character-by-character parameter logs
- ✅ Parameters logged as readable JSON
- ✅ All parameter types handled correctly
- ✅ No breaking changes to tool execution

### Testing
- [ ] Test ClickSend SMS tool (string params)
- [ ] Test Contact search tool (object params)
- [ ] Test Outlook email tool (complex params)
- [ ] Verify logs are readable

---

## Phase 3: Optimize Parameter Logging ⏳ NOT STARTED

**Goal**: Log parameters once at entry point only  
**Duration**: 1 hour  
**Status**: ⏳ Not Started  
**Priority**: High  
**Dependencies**: Phase 1 (Logger)

### Tasks
- [ ] 3.1 Update `TextMessageHandler` parameter logs
  - File: `supabase/functions/chat/processor/handlers.ts`
  - Lines ~309-314 (initial tool calls)
  - Lines ~455-460 (retry tool calls)
  - Convert to DEBUG level
  - Keep for debugging purposes

- [ ] 3.2 Remove duplicate logs in `UniversalToolExecutor`
  - File: `supabase/functions/chat/function_calling/universal-tool-executor.ts`
  - Remove "Parameters received" log
  - Remove "Edge function params" log (after Phase 2 fix)
  - Keep routing information only

- [ ] 3.3 Remove duplicate logs in `BasicToolExecutor`
  - File: `supabase/functions/chat/processor/utils/basic-tool-executor.ts`
  - Remove parameter parsing logs
  - Keep error logs only

- [ ] 3.4 Add single consolidated log at orchestrator
  - File: `supabase/functions/chat/processor/utils/tool-executor.ts`
  - Add INFO-level log: "Executing {count} tools: {names}"
  - Include basic parameter summary (not full params)

### Acceptance Criteria
- ✅ Parameters logged once at DEBUG level
- ✅ No duplicate parameter logs
- ✅ Orchestrator has single INFO-level summary
- ✅ Debugging still possible with LOG_LEVEL=DEBUG

### Testing
- [ ] Test with LOG_LEVEL=INFO (no parameter details)
- [ ] Test with LOG_LEVEL=DEBUG (full parameter details)
- [ ] Verify no duplicate logs
- [ ] Verify tool execution unchanged

---

## Phase 4: Consolidate Execution Announcements ⏳ NOT STARTED

**Goal**: Single execution announcement at orchestrator level  
**Duration**: 1 hour  
**Status**: ⏳ Not Started  
**Priority**: High  
**Dependencies**: Phase 1 (Logger)

### Tasks
- [ ] 4.1 Keep orchestrator-level announcement
  - File: `supabase/functions/chat/processor/utils/tool-executor.ts`
  - Keep: "🚀 Executing {count} tool calls: {names}"
  - Set to INFO level
  - Add timing information

- [ ] 4.2 Remove/convert `BasicToolExecutor` announcements
  - File: `supabase/functions/chat/processor/utils/basic-tool-executor.ts`
  - Remove: "Executing 1 tool calls"
  - Convert internal steps to DEBUG

- [ ] 4.3 Remove/convert `FunctionCallingManager` announcements
  - File: `supabase/functions/chat/function_calling/manager.ts`
  - Remove: "Executing function X for agent Y"
  - Remove: "Loaded universal tool executor with support for..."
  - Convert to DEBUG level

- [ ] 4.4 Remove duplicate orchestrator logs
  - File: `supabase/functions/chat/processor/utils/tool-executor.ts`
  - Remove: "Tool calls: {names}" (duplicate)
  - Keep single announcement only

### Acceptance Criteria
- ✅ Single execution announcement at INFO level
- ✅ No duplicate announcements
- ✅ Internal steps available at DEBUG level
- ✅ Tool execution unchanged

### Testing
- [ ] Test single tool execution
- [ ] Test multiple tool execution
- [ ] Verify single announcement per execution
- [ ] Verify DEBUG shows all steps

---

## Phase 5: Optimize Result Formatting Logs ⏳ NOT STARTED

**Goal**: Reduce formatting logs from 8 to 2  
**Duration**: 1.5 hours  
**Status**: ⏳ Not Started  
**Priority**: Medium  
**Dependencies**: Phase 1 (Logger)

### Tasks
- [ ] 5.1 Audit `FunctionCallingManager.formatResult()`
  - File: `supabase/functions/chat/function_calling/manager.ts`
  - Lines ~493-608
  - Identify all log statements
  - Categorize as entry/exit/intermediate

- [ ] 5.2 Keep entry/exit logs at DEBUG level
  - Keep: "formatResult called for {tool_name}"
  - Keep: "✅ Result formatted ({length} chars)"
  - Convert to DEBUG level

- [ ] 5.3 Remove intermediate step logs
  - Remove: "result.success: true, has data: true"
  - Remove: "🎯 Using special contact formatting!"
  - Remove: "Contacts array length: X"
  - Remove: "Formatting X contact(s)"
  - Remove: "Preview: ..." (200 char preview)

- [ ] 5.4 Remove duplicate preview in `ConversationHandler`
  - File: `supabase/functions/chat/processor/utils/conversation-handler.ts`
  - Lines ~40-64
  - Remove: "Content preview: ..."
  - Keep: "📨 Adding tool result" (DEBUG)
  - Keep: "✅ Tool result added" (DEBUG)

- [ ] 5.5 Optimize special formatting logs
  - Keep special formatting detection at DEBUG
  - Remove step-by-step formatting logs
  - Keep final result log only

### Acceptance Criteria
- ✅ Entry/exit logs at DEBUG level
- ✅ No intermediate step logs at INFO
- ✅ No duplicate previews
- ✅ Special formatting still works
- ✅ Result formatting unchanged

### Testing
- [ ] Test contact search (special formatting)
- [ ] Test generic tool results
- [ ] Test error results
- [ ] Verify formatting logic unchanged

---

## Phase 6: Optimize Retry System ⏳ NOT STARTED

**Goal**: Skip retry checks when all tools succeed  
**Duration**: 2 hours  
**Status**: ⏳ Not Started  
**Priority**: Medium  
**Dependencies**: Phase 1 (Logger)

### Tasks
- [ ] 6.1 Add early exit in `ToolExecutionOrchestrator`
  - File: `supabase/functions/chat/processor/utils/tool-executor.ts`
  - Add check: `if (failedTools.length === 0) return;`
  - Skip retry processing entirely
  - Add DEBUG log: "All tools succeeded, skipping retry checks"

- [ ] 6.2 Skip `RetryCoordinator` when no failures
  - File: `supabase/functions/chat/processor/utils/retry-coordinator.ts`
  - Add guard at entry: `if (toolDetails.every(t => t.success)) return;`
  - Remove: "🔍 Checking for tools needing retry: 0 found"

- [ ] 6.3 Remove "Processing retries" log when 0 failures
  - File: `supabase/functions/chat/processor/utils/tool-executor.ts`
  - Only log when `failedTools.length > 0`
  - Convert to DEBUG level

- [ ] 6.4 Only log retry stats when retries occur
  - Remove: "Successful retries: 0"
  - Remove: "Failed retries: 0"
  - Only log when `retryAttempts > 0`

- [ ] 6.5 Convert retry detection to DEBUG level
  - File: `supabase/functions/chat/processor/utils/basic-tool-executor.ts`
  - Convert: "Error message for retry detection: ..."
  - Convert: "Tool X - success: true, explicit_retry: false, ..."
  - Keep at DEBUG for troubleshooting

### Acceptance Criteria
- ✅ No retry logs when all tools succeed
- ✅ Retry logic still works for failures
- ✅ Performance improvement measurable
- ✅ No breaking changes to retry mechanism

### Testing
- [ ] Test successful tool execution (no retry logs)
- [ ] Test failed tool execution (retry logs appear)
- [ ] Test MCP interactive errors (retry works)
- [ ] Verify retry logic unchanged
- [ ] Measure performance improvement

---

## Phase 7: Consolidate Tool Discovery Logs ⏳ NOT STARTED

**Goal**: Reduce tool discovery logs from 7 to 2  
**Duration**: 1 hour  
**Status**: ⏳ Not Started  
**Priority**: Low  
**Dependencies**: Phase 1 (Logger)

### Tasks
- [ ] 7.1 Consolidate `FunctionCallingManager` tool loading
  - File: `supabase/functions/chat/function_calling/manager.ts`
  - Keep: "✅ Loaded {count} tools from {providers} providers" (INFO)
  - Remove: "✅ Retrieved {count} MCP tools for agent..."
  - Remove: "✅ Retrieved {count} tools from {providers} providers via edge function"

- [ ] 7.2 Move tool name listings to DEBUG
  - Move: "MCP tool names: [...]" → DEBUG
  - Move: "Providers: X, Tools: ..." → DEBUG
  - Keep for troubleshooting

- [ ] 7.3 Update `IntentClassifier` tool loading
  - File: `supabase/functions/chat/processor/utils/intent-classifier.ts`
  - Keep: "Loading tools..." (INFO)
  - Keep: "✅ Loaded {count} tools" (INFO)
  - Remove duplicate messages

- [ ] 7.4 Remove redundant "Retrieved" messages
  - Consolidate into single success message
  - Include count and provider info
  - Keep tool names at DEBUG level

### Acceptance Criteria
- ✅ 2 INFO-level logs for tool discovery
- ✅ Tool names available at DEBUG level
- ✅ No duplicate "Retrieved" messages
- ✅ Tool loading unchanged

### Testing
- [ ] Test tool discovery on first message
- [ ] Test cached tool loading
- [ ] Verify tool count correct
- [ ] Verify DEBUG shows tool names

---

## Phase 8: Consolidate Execution Summary ⏳ NOT STARTED

**Goal**: Single summary log instead of 5 separate messages  
**Duration**: 30 minutes  
**Status**: ⏳ Not Started  
**Priority**: Low  
**Dependencies**: Phase 1 (Logger)

### Tasks
- [ ] 8.1 Create consolidated summary format
  - File: `supabase/functions/chat/processor/utils/tool-executor.ts`
  - Format: "📊 Summary: {successful}/{total} succeeded, {failed} failed, {retryAttempts} retries"
  - Include timing: "({duration}ms)"

- [ ] 8.2 Replace 5 separate logs with single log
  - Remove: "Total tools: X"
  - Remove: "Successful: X"
  - Remove: "Failed: X"
  - Remove: "Retry attempts: X"
  - Remove: "📊 EXECUTION SUMMARY:"
  - Replace with single consolidated log

- [ ] 8.3 Only log when tools were executed
  - Add guard: `if (toolCalls.length === 0) return;`
  - Skip summary for no-tool executions

- [ ] 8.4 Include timing information
  - Add execution duration
  - Add per-tool average time
  - Keep at INFO level

### Acceptance Criteria
- ✅ Single summary log with all stats
- ✅ No separate stat logs
- ✅ Timing information included
- ✅ Only logs when tools executed

### Testing
- [ ] Test single tool execution
- [ ] Test multiple tool execution
- [ ] Test no tool execution (no summary)
- [ ] Verify stats are accurate

---

## Phase 9: Optimize Working Memory Logs ⏳ NOT STARTED

**Goal**: Reduce working memory fallback logs from 3 to 1  
**Duration**: 30 minutes  
**Status**: ⏳ Not Started  
**Priority**: Low  
**Dependencies**: Phase 1 (Logger)

### Tasks
- [ ] 9.1 Consolidate working memory logs in `TextMessageHandler`
  - File: `supabase/functions/chat/processor/handlers.ts`
  - Lines ~120-180
  - Combine: "Fetching context" + "No summary found" + "Using recent messages"
  - Single log: "ℹ️ No summary available, using {count} recent messages"

- [ ] 9.2 Move internal operations to DEBUG
  - File: `supabase/functions/chat/core/context/working_memory_manager.ts`
  - Move: "Fetching context for conversation..." → DEBUG
  - Move: "No summary board found..." → DEBUG
  - Keep fallback notification at INFO

- [ ] 9.3 Keep important state changes at INFO
  - Keep: "✅ Added working memory context ({facts} facts, {messages} messages)"
  - Keep: Token savings information
  - These are valuable metrics

### Acceptance Criteria
- ✅ Single INFO-level log for fallback
- ✅ Internal operations at DEBUG
- ✅ Important metrics still logged
- ✅ Working memory unchanged

### Testing
- [ ] Test new conversation (no summary)
- [ ] Test existing conversation (with summary)
- [ ] Verify fallback works
- [ ] Verify summary loading works

---

## Phase 10: Testing & Validation ⏳ NOT STARTED

**Goal**: Ensure no functionality broken, measure improvements  
**Duration**: 3 hours  
**Status**: ⏳ Not Started  
**Priority**: Critical  
**Dependencies**: Phases 1-9 (All)

### Tasks
- [ ] 10.1 Run full test suite
  - Run all existing unit tests
  - Run integration tests
  - Verify 100% pass rate

- [ ] 10.2 Manual chat functionality testing
  - Test simple message (no tools)
  - Test tool-requiring message
  - Test multiple tool calls
  - Test conversation flow

- [ ] 10.3 Test tool execution (successful case)
  - Test ClickSend SMS
  - Test Contact search
  - Test Outlook email
  - Test document search
  - Verify all work correctly

- [ ] 10.4 Test tool execution (failure + retry case)
  - Test with invalid parameters
  - Verify retry mechanism works
  - Verify error handling works
  - Test MCP interactive errors

- [ ] 10.5 Test with LOG_LEVEL=DEBUG
  - Set environment variable
  - Verify all logs still available
  - Verify debugging still possible
  - Document what's available at DEBUG

- [ ] 10.6 Test with LOG_LEVEL=INFO
  - Set environment variable
  - Verify reduced log volume
  - Count logs per tool call
  - Verify ≤10 logs per successful call

- [ ] 10.7 Measure performance improvement
  - Baseline: Time 10 tool calls before changes
  - After: Time 10 tool calls after changes
  - Calculate average improvement
  - Verify ≥50ms improvement

- [ ] 10.8 Document new logging patterns
  - Create logging guidelines
  - Document when to use each level
  - Provide examples
  - Update developer documentation

### Acceptance Criteria
- ✅ All tests pass
- ✅ Chat functionality identical
- ✅ Tool execution identical
- ✅ Retry mechanism identical
- ✅ Log volume reduced ≥70%
- ✅ Performance improved ≥50ms
- ✅ Documentation complete

### Testing Checklist
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing complete
- [ ] Performance benchmarks complete
- [ ] LOG_LEVEL=DEBUG tested
- [ ] LOG_LEVEL=INFO tested
- [ ] LOG_LEVEL=ERROR tested
- [ ] Documentation updated

---

## 📊 Progress Tracking

### Overall Progress
- **Phases Complete**: 0/10 (0%)
- **Tasks Complete**: 0/80 (0%)
- **Estimated Time Remaining**: 13 hours
- **Status**: 🟡 Planning

### Phase Status Summary
| Phase | Status | Progress | Priority | Duration |
|-------|--------|----------|----------|----------|
| 1. Log Level Infrastructure | ⏳ Not Started | 0/6 | High | 2h |
| 2. Fix Character Bug | ⏳ Not Started | 0/4 | Critical | 30m |
| 3. Parameter Logging | ⏳ Not Started | 0/4 | High | 1h |
| 4. Execution Announcements | ⏳ Not Started | 0/4 | High | 1h |
| 5. Result Formatting | ⏳ Not Started | 0/5 | Medium | 1.5h |
| 6. Retry System | ⏳ Not Started | 0/5 | Medium | 2h |
| 7. Tool Discovery | ⏳ Not Started | 0/4 | Low | 1h |
| 8. Execution Summary | ⏳ Not Started | 0/4 | Low | 30m |
| 9. Working Memory | ⏳ Not Started | 0/3 | Low | 30m |
| 10. Testing & Validation | ⏳ Not Started | 0/8 | Critical | 3h |

---

## 🎯 Success Metrics

### Target Metrics
- **Log Volume Reduction**: ≥70% (34 → ≤10 logs per successful tool call)
- **Performance Improvement**: ≥50ms per tool call
- **Test Pass Rate**: 100%
- **Zero Breaking Changes**: All functionality identical
- **Documentation Complete**: Logging guidelines published

### Current Metrics (Baseline)
- **Successful Tool Call**: 34 log messages
- **Failed Tool Call (1 retry)**: 50+ log messages
- **Tool Discovery**: 7 log messages
- **Average Execution Time**: TBD (measure in Phase 10)

### Target Metrics (After Optimization)
- **Successful Tool Call**: ≤10 log messages
- **Failed Tool Call (1 retry)**: ≤18 log messages
- **Tool Discovery**: 2 log messages
- **Average Execution Time**: Baseline - 50ms

---

## 📝 Notes & Decisions

### Key Decisions
1. **Use log levels instead of deleting logs** - Preserves debugging capability
2. **Implement early exits for retry system** - Performance improvement
3. **Fix character-by-character bug as Phase 2** - Critical, independent fix
4. **Keep special formatting for contacts** - Improves LLM comprehension

### Risks & Mitigations
- **Risk**: Breaking retry logic → **Mitigation**: Comprehensive testing, early exits only
- **Risk**: Losing debug info → **Mitigation**: Move to DEBUG level, don't delete
- **Risk**: Performance regression → **Mitigation**: Measure before/after, monitor production

### Open Questions
- [ ] Should we add LOG_LEVEL to .env.example?
- [ ] Should we create a logging best practices document?
- [ ] Should we add log level to deployment checklist?

---

## 🚀 Deployment Plan

### Pre-Deployment
- [ ] Complete all 10 phases
- [ ] Pass all tests
- [ ] Measure performance improvements
- [ ] Update documentation
- [ ] Code review approved

### Deployment Steps
1. Deploy Phase 1-2 (Logger + Critical Bug Fix)
2. Monitor for 24 hours
3. Deploy Phase 3-5 (Parameter/Execution/Formatting)
4. Monitor for 24 hours
5. Deploy Phase 6 (Retry Optimization)
6. Monitor for 48 hours (higher risk)
7. Deploy Phase 7-9 (Remaining Optimizations)
8. Final validation

### Post-Deployment
- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Collect developer feedback
- [ ] Update logging guidelines
- [ ] Close project

---

## ✅ Final Acceptance

### Project Complete When:
- [x] All 10 phases complete
- [x] All 80 tasks complete
- [x] All tests passing
- [x] Log volume reduced ≥70%
- [x] Performance improved ≥50ms
- [x] Zero breaking changes
- [x] Documentation complete
- [x] Deployed to production
- [x] Monitoring shows no issues

**Sign-off**: _________________________  
**Date**: _________________________

---

**Last Updated**: October 6, 2025  
**Next Review**: After Phase 2 completion
