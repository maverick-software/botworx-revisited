# Intent Classification Optimization - WBS Checklist

**Project**: Tool-Aware Intent Classification System  
**Goal**: Reduce unnecessary MCP tool loading by 85-95% through intelligent intent detection  
**Start Date**: October 6, 2025  
**Status**: Planning Phase  
**Owner**: Development Team

---

## 📊 Project Overview

### Problem Statement
The chat system unconditionally loads all MCP tools for every request, causing 665-910ms of unnecessary overhead for simple conversations that don't require tool execution.

### Solution Approach
Implement a fast intent classification system using `gpt-4o-mini` to determine if a user message requires tool execution **before** loading any MCP tools.

### Expected Benefits
- **85-95% reduction** in latency for simple messages (no tools needed)
- **$0.001-0.005 cost savings** per non-tool message
- **20% overall performance improvement** (assuming 70% of messages don't need tools)
- **Better user experience** with faster response times

---

## Phase 1: Research & Design ✅ COMPLETED

### 1.1 Research Classification Approach
- [x] Research optimal models (gpt-4o-mini vs gpt-3.5-turbo)
- [x] Analyze cost-benefit tradeoff
- [x] Define classification categories
- [x] Design classification prompt structure
- [x] Document expected performance metrics

**Findings:**
- **Best Model**: `gpt-4o-mini` (fastest, most cost-effective)
- **Expected Latency**: 200-400ms per classification
- **Cost**: ~$0.00015 per classification
- **Target Accuracy**: >95%

**Completion Date**: October 6, 2025  
**Status**: ✅ COMPLETE

---

## Phase 2: Create Intent Classifier Utility

### 2.1 Create IntentClassifier Class
**File**: `supabase/functions/chat/processor/utils/intent-classifier.ts`

#### Sub-tasks:
- [ ] Create file structure and TypeScript interfaces
  - [ ] Define `IntentClassification` interface
  - [ ] Define `ClassificationCache` interface
  - [ ] Define `ClassificationMetrics` interface
- [ ] Implement core classification logic
  - [ ] Create `classifyIntent()` method
  - [ ] Integrate with OpenAI `gpt-4o-mini`
  - [ ] Parse and validate classification response
  - [ ] Add error handling and fallbacks
- [ ] Add structured output parsing
  - [ ] Parse JSON response from LLM
  - [ ] Validate confidence levels
  - [ ] Extract suggested tools (if applicable)
  - [ ] Handle malformed responses

**Estimated Time**: 2-3 hours  
**Dependencies**: None  
**Status**: ⏸️ PENDING

---

### 2.2 Design Classification Prompt
**File**: `supabase/functions/chat/processor/utils/intent-classifier.ts`

#### Sub-tasks:
- [ ] Write system prompt for classification
  - [ ] Define tool-required scenarios
  - [ ] Define no-tool scenarios
  - [ ] Specify JSON output format
  - [ ] Add example classifications
- [ ] Create prompt builder method
  - [ ] Include available tools context
  - [ ] Add agent-specific guidance
  - [ ] Handle edge cases
- [ ] Test prompt with sample messages
  - [ ] Test greetings (no tools)
  - [ ] Test action requests (tools needed)
  - [ ] Test ambiguous messages
  - [ ] Validate accuracy

**Estimated Time**: 1 hour  
**Dependencies**: 2.1  
**Status**: ⏸️ PENDING

---

### 2.3 Implement Classification Cache
**File**: `supabase/functions/chat/processor/utils/intent-classifier.ts`

#### Sub-tasks:
- [ ] Design cache key structure
  - [ ] Hash message content
  - [ ] Include agent_id in key
  - [ ] Add timestamp for TTL
- [ ] Implement in-memory cache
  - [ ] Use Map for storage
  - [ ] Implement LRU eviction
  - [ ] Set max size limit (1000 entries)
  - [ ] Set TTL (5 minutes)
- [ ] Add cache management methods
  - [ ] `getCachedClassification()`
  - [ ] `setCachedClassification()`
  - [ ] `clearExpiredCache()`
  - [ ] `getCacheStats()`
- [ ] Add cache hit/miss logging

**Estimated Time**: 1 hour  
**Dependencies**: 2.1  
**Status**: ⏸️ PENDING

---

## Phase 3: Integrate with TextMessageHandler

### 3.1 Modify TextMessageHandler.handle() Method
**File**: `supabase/functions/chat/processor/handlers.ts`

#### Sub-tasks:
- [ ] Import IntentClassifier class
- [ ] Add classification step before tool loading (line ~99)
  - [ ] Extract user message text
  - [ ] Call intent classifier
  - [ ] Log classification result
  - [ ] Add timing metrics
- [ ] Implement conditional tool loading
  - [ ] Load tools only if `requiresTools === true`
  - [ ] Skip tool loading if `requiresTools === false`
  - [ ] Handle classification errors gracefully
- [ ] Update tool guidance logic
  - [ ] Only add tool guidance if tools loaded
  - [ ] Preserve existing tool call instructions
- [ ] Add performance logging
  - [ ] Log time saved when skipping tools
  - [ ] Track classification accuracy
  - [ ] Monitor cache effectiveness

**Estimated Time**: 2 hours  
**Dependencies**: Phase 2 complete  
**Status**: ⏸️ PENDING

---

### 3.2 Add Fallback Mechanism
**File**: `supabase/functions/chat/processor/handlers.ts`

#### Sub-tasks:
- [ ] Create response analysis method
  - [ ] Detect tool hints in LLM response
  - [ ] Pattern matching for "I can't", "I need to"
  - [ ] Check for tool name references
- [ ] Implement fallback logic
  - [ ] Trigger on false negative detection
  - [ ] Load tools on-demand
  - [ ] Retry LLM call with tools
  - [ ] Log fallback event
- [ ] Add fallback metrics
  - [ ] Count fallback triggers
  - [ ] Track false negative rate
  - [ ] Alert on high fallback rate (>5%)
- [ ] Update classification accuracy
  - [ ] Mark false negatives
  - [ ] Feed back to metrics system

**Estimated Time**: 1.5 hours  
**Dependencies**: 3.1  
**Status**: ⏸️ PENDING

---

## Phase 4: Re-enable Tool Caching

### 4.1 Update FunctionCallingManager Cache Settings
**File**: `supabase/functions/chat/function_calling/manager.ts`

#### Sub-tasks:
- [ ] Modify cache threshold constants (lines 38-39)
  - [ ] Set `CACHE_MESSAGE_THRESHOLD = 15`
  - [ ] Set `CACHE_TIME_THRESHOLD = 600000` (10 min)
- [ ] Test cache effectiveness
  - [ ] Verify cache hits work correctly
  - [ ] Validate TTL expiration
  - [ ] Check cache eviction logic
- [ ] Add cache monitoring
  - [ ] Log cache hit/miss ratio
  - [ ] Track cache size over time
  - [ ] Monitor cache performance impact

**Estimated Time**: 30 minutes  
**Dependencies**: None (can run parallel)  
**Status**: ⏸️ PENDING

---

## Phase 5: Add Performance Metrics & Monitoring

### 5.1 Create Metrics Collection System
**File**: `supabase/functions/chat/processor/utils/classification-metrics.ts`

#### Sub-tasks:
- [ ] Define metrics data structure
  - [ ] Classification counts (required/not required)
  - [ ] Cache statistics (hits/misses)
  - [ ] Timing metrics (avg classification time)
  - [ ] Accuracy metrics (false positives/negatives)
- [ ] Implement metrics collection
  - [ ] Create `ClassificationMetrics` class
  - [ ] Add metric recording methods
  - [ ] Implement aggregation logic
  - [ ] Add export functionality
- [ ] Create metrics export endpoint
  - [ ] Add `/metrics/classification` route
  - [ ] Return JSON metrics summary
  - [ ] Include performance stats

**Estimated Time**: 1.5 hours  
**Dependencies**: Phase 3 complete  
**Status**: ⏸️ PENDING

---

### 5.2 Add Detailed Logging
**File**: Multiple locations

#### Sub-tasks:
- [ ] Add classification decision logging
  - [ ] Log intent, confidence, time
  - [ ] Log whether tools were loaded
  - [ ] Log cache hit/miss status
- [ ] Add time-saved calculations
  - [ ] Calculate time saved when skipping tools
  - [ ] Aggregate savings over time
  - [ ] Report daily/weekly savings
- [ ] Add fallback trigger logging
  - [ ] Log false negative events
  - [ ] Include message context
  - [ ] Track correction accuracy
- [ ] Create summary reports
  - [ ] Generate hourly summaries
  - [ ] Create daily performance reports
  - [ ] Export to monitoring system

**Estimated Time**: 1 hour  
**Dependencies**: 5.1  
**Status**: ⏸️ PENDING

---

## Phase 6: Testing & Validation

### 6.1 Unit Testing
**File**: `supabase/functions/tests/intent-classifier.test.ts`

#### Sub-tasks:
- [ ] Test classification accuracy
  - [ ] Test Case 1: Simple greetings (no tools)
    - Input: "Hi!", "Hello", "How are you?"
    - Expected: `requiresTools: false`
  - [ ] Test Case 2: Tool requests (tools needed)
    - Input: "Send email to john@example.com"
    - Expected: `requiresTools: true`
  - [ ] Test Case 3: Ambiguous messages
    - Input: "Can you help me?"
    - Expected: Appropriate confidence level
  - [ ] Test Case 4: Edge cases
    - Empty messages, very long messages, special characters
- [ ] Test cache functionality
  - [ ] Verify cache hits return cached results
  - [ ] Verify cache expiration works
  - [ ] Test cache size limits
  - [ ] Test cache key generation
- [ ] Test error handling
  - [ ] OpenAI API errors
  - [ ] Malformed responses
  - [ ] Network timeouts
  - [ ] Fallback to safe default

**Estimated Time**: 2 hours  
**Dependencies**: Phase 2, 3 complete  
**Status**: ⏸️ PENDING

---

### 6.2 Integration Testing
**File**: Manual testing + automated test script

#### Sub-tasks:
- [ ] Test end-to-end flow
  - [ ] Simple conversation without tools
  - [ ] Tool execution with classification
  - [ ] Fallback mechanism trigger
  - [ ] Cache effectiveness
- [ ] Performance testing
  - [ ] Measure classification latency (p50, p95, p99)
  - [ ] Measure overall request improvement
  - [ ] Test under load (concurrent requests)
  - [ ] Validate cache hit rates
- [ ] Accuracy validation
  - [ ] Run 100+ test messages
  - [ ] Calculate accuracy rate
  - [ ] Measure false positive/negative rates
  - [ ] Validate against success criteria
- [ ] Edge case testing
  - [ ] Multi-language messages
  - [ ] Code snippets in messages
  - [ ] Very long messages (>1000 chars)
  - [ ] Rapid-fire messages

**Success Criteria:**
- ✅ Classification accuracy > 95%
- ✅ Average latency improvement > 500ms for non-tool messages
- ✅ False negative rate < 2%
- ✅ Cache hit rate > 60% after 100 messages

**Estimated Time**: 2 hours  
**Dependencies**: 6.1  
**Status**: ⏸️ PENDING

---

## Phase 7: Deployment & Monitoring

### 7.1 Staged Rollout
**Timeline**: 2-3 weeks

#### Stage 1: Shadow Mode (Week 1)
- [ ] Deploy to development environment
  - [ ] Run classification but don't use results
  - [ ] Log predictions vs actual tool usage
  - [ ] Measure accuracy baseline
  - [ ] Collect metrics for tuning
- [ ] Analyze shadow mode results
  - [ ] Review accuracy metrics
  - [ ] Identify misclassifications
  - [ ] Tune classification prompt if needed
  - [ ] Adjust confidence thresholds
- [ ] Document findings
  - [ ] Create shadow mode report
  - [ ] List improvements needed
  - [ ] Update success criteria if needed

**Estimated Time**: 1 week  
**Dependencies**: Phase 6 complete  
**Status**: ⏸️ PENDING

---

#### Stage 2: Partial Rollout (Week 2)
- [ ] Deploy to production (25% traffic)
  - [ ] Enable classification for 25% of requests
  - [ ] Use A/B testing framework
  - [ ] Monitor error rates closely
  - [ ] Track user experience metrics
- [ ] Compare performance
  - [ ] Compare latency: with vs without classification
  - [ ] Analyze cost impact
  - [ ] Review user satisfaction scores
  - [ ] Check for regression issues
- [ ] Adjust and optimize
  - [ ] Fine-tune classification prompt
  - [ ] Adjust cache settings
  - [ ] Optimize fallback thresholds
  - [ ] Fix any issues found

**Estimated Time**: 1 week  
**Dependencies**: 7.1 Stage 1 complete  
**Status**: ⏸️ PENDING

---

#### Stage 3: Full Rollout (Week 3)
- [ ] Deploy to production (100% traffic)
  - [ ] Enable for all requests
  - [ ] Monitor rollout closely (first 24h)
  - [ ] Prepare rollback plan
  - [ ] Alert on-call team
- [ ] Validate success criteria
  - [ ] Verify latency improvements achieved
  - [ ] Confirm accuracy targets met
  - [ ] Validate cost savings realized
  - [ ] Check user satisfaction maintained
- [ ] Document production metrics
  - [ ] Create deployment report
  - [ ] Document lessons learned
  - [ ] Update runbooks
  - [ ] Share results with team

**Estimated Time**: 1 week  
**Dependencies**: 7.1 Stage 2 complete  
**Status**: ⏸️ PENDING

---

### 7.2 Setup Monitoring Dashboard
**File**: Monitoring system integration

#### Sub-tasks:
- [ ] Create classification metrics dashboard
  - [ ] Classification accuracy over time
  - [ ] Average response time (with/without tools)
  - [ ] Cache hit rate trends
  - [ ] Fallback trigger rate
- [ ] Setup alerts
  - [ ] Alert on accuracy drop below 90%
  - [ ] Alert on fallback rate > 5%
  - [ ] Alert on cache hit rate < 40%
  - [ ] Alert on classification latency > 1s
- [ ] Create automated reports
  - [ ] Daily performance summary
  - [ ] Weekly cost analysis
  - [ ] Monthly trends report
  - [ ] Quarterly review metrics
- [ ] Document monitoring procedures
  - [ ] Create runbook for monitoring
  - [ ] Document alert response procedures
  - [ ] Define escalation paths
  - [ ] Update on-call playbook

**Estimated Time**: 2 hours  
**Dependencies**: 7.1 Stage 3 complete  
**Status**: ⏸️ PENDING

---

## 📊 Success Metrics

### Performance Targets
- [x] Classification accuracy: **>95%** (Target)
- [ ] Average latency improvement: **>500ms** for non-tool messages
- [ ] False negative rate: **<2%**
- [ ] Cache hit rate: **>60%** after 100 messages
- [ ] Overall improvement: **20% faster** average response time

### Cost Targets
- [ ] Classification cost: **<$0.0002** per request
- [ ] Tool API cost savings: **$0.001-0.005** per non-tool message
- [ ] Net cost reduction: **>30%** for typical usage patterns

### Quality Targets
- [ ] Zero production incidents during rollout
- [ ] User satisfaction maintained or improved
- [ ] No increase in error rates
- [ ] Successful rollback plan tested

---

## 🚨 Risk Management

### Identified Risks

#### Risk 1: Classification Accuracy Too Low
**Probability**: Medium  
**Impact**: High  
**Mitigation**:
- Implement robust fallback mechanism
- Start with shadow mode for accuracy validation
- Tune prompt based on real-world data
- Consider ensemble classification if needed

#### Risk 2: Classification Adds Too Much Latency
**Probability**: Low  
**Impact**: Medium  
**Mitigation**:
- Use fastest model (gpt-4o-mini)
- Implement aggressive caching
- Set timeout limits (500ms max)
- Fallback to always-load-tools if timeout

#### Risk 3: False Negatives (Missed Tool Needs)
**Probability**: Medium  
**Impact**: High  
**Mitigation**:
- Implement fallback detection in responses
- Lower confidence threshold for tool loading
- Prefer false positives over false negatives
- Monitor and adjust continuously

#### Risk 4: Cache Invalidation Issues
**Probability**: Low  
**Impact**: Medium  
**Mitigation**:
- Conservative TTL settings
- Agent-specific cache keys
- Manual cache invalidation endpoint
- Monitor cache effectiveness

---

## 📝 Change Log

| Date | Phase | Change | Reason |
|------|-------|--------|--------|
| 2025-10-06 | Planning | Document created | Initial project planning |
| 2025-10-06 | Phase 1 | Research completed | Model selection finalized |

---

## 📞 Contacts & Resources

**Project Lead**: Development Team  
**Technical Contact**: Senior Full Stack Developer  
**Documentation**: `docs/plans/intent_classification_optimization/`

**Related Documents**:
- [Implementation Plan](plan.md)
- [Technical Architecture](technical_architecture.md)
- [Performance Analysis](performance_analysis.md)

---

**Last Updated**: October 6, 2025  
**Next Review**: After Phase 2 completion  
**Status**: In Planning - Ready to Start Phase 2

