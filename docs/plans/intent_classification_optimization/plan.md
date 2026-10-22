# Intent Classification Optimization - Implementation Plan

**Project**: Tool-Aware Intent Classification System  
**Version**: 1.0  
**Date**: October 6, 2025  
**Status**: Planning Phase

---

## 📋 Executive Summary

### Problem Statement

The Agentopia chat system currently loads all MCP (Model Context Protocol) tools for every user request, regardless of whether tools are actually needed. This creates significant performance overhead:

- **665-910ms** unnecessary latency per request
- Database queries for tool permissions executed unconditionally
- Edge function calls to `get-agent-tools` on every message
- Tool schema normalization even when no tools are used

**Evidence from production logs:**
```
[FunctionCalling] 🔍 Getting MCP tools for agent e3267c64-f0a1-48cb-8aef-c699489f81b1
[FunctionCalling] ✅ Retrieved 2 MCP tools
[TextMessageHandler] LLM completion tool_calls count: 0
[TextMessageHandler] No tool calls in LLM response
[ToolExecutionOrchestrator] 🚀 STARTING executeToolCalls with 0 tool calls
[ToolExecutionOrchestrator] No tool calls to execute, returning empty result
```

### Proposed Solution

Implement an intelligent **intent classification system** using `gpt-4o-mini` to determine if a user message requires tool execution **before** loading any MCP tools. This approach:

- ✅ Uses fast, cost-effective classification model
- ✅ Implements aggressive caching to minimize classification overhead
- ✅ Includes fallback mechanism for false negatives
- ✅ Maintains 100% functionality with better performance

### Expected Benefits

| Metric | Current | After Optimization | Improvement |
|--------|---------|-------------------|-------------|
| Simple message latency | 2500-3500ms | 1800-2500ms | **-30%** |
| Tool loading overhead | 665-910ms | 0ms (skipped) | **-100%** |
| Classification overhead | 0ms | 200-400ms | +200-400ms |
| Net improvement | - | - | **~700ms faster** |
| Cost per non-tool message | $0.002 | $0.00085 | **-57%** |

**Assumptions:**
- 70% of messages don't require tools (greetings, questions, conversations)
- 30% of messages require tools (send email, search, actions)

---

## 🎯 Project Goals

### Primary Objectives

1. **Reduce latency** for simple conversational messages by 85-95%
2. **Maintain accuracy** of tool execution (>95% classification accuracy)
3. **Lower costs** by reducing unnecessary API calls
4. **Improve user experience** with faster response times

### Secondary Objectives

5. Re-enable tool caching for better performance
6. Add comprehensive metrics for monitoring and optimization
7. Create robust fallback mechanisms for edge cases
8. Document system behavior for future maintenance

### Success Criteria

- ✅ Classification accuracy > 95%
- ✅ False negative rate < 2% (missed tool needs)
- ✅ Average latency improvement > 500ms for non-tool messages
- ✅ Cache hit rate > 60% after 100 messages
- ✅ Zero production incidents during rollout
- ✅ User satisfaction maintained or improved

---

## 🏗️ Technical Architecture

### System Overview

```
User Message
    ↓
[Intent Classifier]
    ├─→ gpt-4o-mini classification (200-400ms)
    ├─→ Cache check (< 5ms if cached)
    └─→ Decision: Tools Needed? Yes/No
         ↓
    ┌────┴────┐
    │ No      │ Yes
    ↓         ↓
Skip Tool    Load MCP Tools
Loading      (500-900ms)
    ↓         ↓
LLM Call     LLM Call with Tools
(No tools)   (With tools)
    ↓         ↓
Response     Tool Execution
    ↓         ↓
[Fallback    Final Response
 Check]
```

### Components

#### 1. Intent Classifier
**File**: `supabase/functions/chat/processor/utils/intent-classifier.ts`

**Responsibilities:**
- Analyze user message intent using `gpt-4o-mini`
- Return structured classification result
- Manage classification cache
- Track metrics and performance

**Interface:**
```typescript
interface IntentClassification {
  requiresTools: boolean;
  confidence: 'high' | 'medium' | 'low';
  detectedIntent: string;
  suggestedTools?: string[];
  reasoning?: string;
  classificationTimeMs: number;
}

class IntentClassifier {
  async classifyIntent(
    message: string, 
    agentId: string
  ): Promise<IntentClassification>;
  
  getCacheStats(): ClassificationCacheStats;
  clearCache(): void;
}
```

#### 2. Classification Prompt
**Embedded in**: `IntentClassifier` class

**Design:**
```typescript
const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classifier for an AI agent chat system.

Your ONLY job is to determine if the user's message requires calling external tools/functions.

REQUIRES TOOLS if the message asks to:
- Send/compose emails or messages
- Search for information (contacts, emails, documents, web)
- Create/modify/delete data
- Get specific data from external systems
- Perform actions (schedule, remind, notify)
- Use integrations (Gmail, Outlook, calendar, etc.)

DOES NOT REQUIRE TOOLS if the message is:
- A greeting (hi, hello, how are you)
- General conversation
- Asking about the agent's capabilities
- Asking for explanations or advice
- Thanking or confirming
- Small talk

Respond in JSON format ONLY:
{
  "requiresTools": boolean,
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation",
  "suggestedTools": ["tool_name"] // if applicable
}`;
```

#### 3. Classification Cache
**Embedded in**: `IntentClassifier` class

**Cache Strategy:**
- **Key Format**: `${agentId}:${messageHash}`
- **Storage**: In-memory Map with LRU eviction
- **TTL**: 5 minutes
- **Max Size**: 1000 entries
- **Invalidation**: Automatic on expiry, manual endpoint available

**Benefits:**
- Repeated questions get instant cached response
- Reduces classification API costs
- Minimizes latency for common messages

#### 4. Fallback Mechanism
**File**: `supabase/functions/chat/processor/handlers.ts`

**Triggers:**
- LLM response contains phrases: "I would need to", "I can't", "require access"
- Response explicitly mentions available tool names
- Response indicates limitation without tools

**Action:**
- Load tools on-demand
- Retry LLM call with tools enabled
- Log false negative event
- Update accuracy metrics

---

## 📁 File Structure

```
supabase/functions/chat/
├── processor/
│   ├── handlers.ts                          # MODIFY - Add classification logic
│   └── utils/
│       ├── intent-classifier.ts             # NEW - Core classifier
│       ├── classification-metrics.ts        # NEW - Metrics tracking
│       └── ...existing files...
├── function_calling/
│   └── manager.ts                           # MODIFY - Re-enable cache
└── ...

docs/plans/intent_classification_optimization/
├── plan.md                                  # This file
├── wbs_checklist.md                        # Detailed task checklist
├── technical_architecture.md               # NEW - Architecture details
└── performance_analysis.md                 # NEW - Performance report
```

---

## 🔧 Implementation Details

### Phase 1: Intent Classifier Creation

#### Step 1.1: Create `intent-classifier.ts`

**Location**: `supabase/functions/chat/processor/utils/intent-classifier.ts`

**Core Implementation:**

```typescript
import OpenAI from 'npm:openai@6.1.0';

interface IntentClassification {
  requiresTools: boolean;
  confidence: 'high' | 'medium' | 'low';
  detectedIntent: string;
  suggestedTools?: string[];
  reasoning?: string;
  classificationTimeMs: number;
}

interface CachedClassification {
  classification: IntentClassification;
  timestamp: number;
  expiresAt: number;
}

export class IntentClassifier {
  private cache: Map<string, CachedClassification> = new Map();
  private readonly CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  
  constructor(private openai: OpenAI) {}
  
  async classifyIntent(
    message: string, 
    agentId: string
  ): Promise<IntentClassification> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.generateCacheKey(message, agentId);
    const cached = this.getCachedClassification(cacheKey);
    if (cached) {
      console.log(`[IntentClassifier] Cache hit for key ${cacheKey}`);
      return cached;
    }
    
    // Classify using gpt-4o-mini
    const classification = await this.performClassification(message);
    classification.classificationTimeMs = Date.now() - startTime;
    
    // Cache result
    this.setCachedClassification(cacheKey, classification);
    
    console.log(`[IntentClassifier] Classification result: ${classification.requiresTools ? 'TOOLS NEEDED' : 'NO TOOLS'} (confidence: ${classification.confidence}, ${classification.classificationTimeMs}ms)`);
    
    return classification;
  }
  
  private async performClassification(
    message: string
  ): Promise<IntentClassification> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: CLASSIFICATION_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: `Classify this message: "${message}"`
        }
      ],
      temperature: 0.3, // Low temperature for consistent classification
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });
    
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);
    
    return {
      requiresTools: parsed.requiresTools,
      confidence: parsed.confidence || 'medium',
      detectedIntent: parsed.reasoning || 'Unknown',
      suggestedTools: parsed.suggestedTools,
      reasoning: parsed.reasoning,
      classificationTimeMs: 0 // Will be set by caller
    };
  }
  
  private generateCacheKey(message: string, agentId: string): string {
    // Simple hash function for cache key
    const hash = this.hashString(message.toLowerCase().trim());
    return `${agentId}:${hash}`;
  }
  
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
  
  private getCachedClassification(key: string): IntentClassification | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.classification;
  }
  
  private setCachedClassification(
    key: string, 
    classification: IntentClassification
  ): void {
    // LRU eviction if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    const now = Date.now();
    this.cache.set(key, {
      classification,
      timestamp: now,
      expiresAt: now + this.CACHE_TTL
    });
  }
  
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttlMs: this.CACHE_TTL
    };
  }
  
  clearCache(): void {
    this.cache.clear();
    console.log('[IntentClassifier] Cache cleared');
  }
}

const CLASSIFICATION_SYSTEM_PROMPT = `...`; // Defined above
```

---

### Phase 2: Integration with TextMessageHandler

#### Step 2.1: Modify `handlers.ts`

**Location**: `supabase/functions/chat/processor/handlers.ts`  
**Lines to modify**: ~99-123

**Changes:**

```typescript
// BEFORE (current code at line 99-106):
const authToken = (context as any)?.request_options?.auth?.token || '';
console.log(`[FunctionCalling] Auth token available: ${!!authToken}`);
console.log(`[FunctionCalling] Context - agent_id: ${context.agent_id}, user_id: ${context.user_id}`);
const fcm = new FunctionCallingManager(this.supabase as any, authToken);
const availableTools = (context.agent_id && context.user_id)
  ? await fcm.getAvailableTools(context.agent_id, context.user_id)
  : [];

// AFTER (with intent classification):
// Step 1: Classify user intent using fast model
const userMessage = (message as any).content?.text || '';
const intentClassifier = new IntentClassifier(this.openai);
const classification = await intentClassifier.classifyIntent(
  userMessage,
  context.agent_id || 'unknown'
);

console.log(`[IntentClassifier] Result: ${classification.requiresTools ? 'TOOLS NEEDED' : 'NO TOOLS'} (confidence: ${classification.confidence}, ${classification.classificationTimeMs}ms)`);

// Step 2: Conditionally load tools only if needed
const authToken = (context as any)?.request_options?.auth?.token || '';
let availableTools: OpenAIFunction[] = [];
let fcm: FunctionCallingManager;

if (classification.requiresTools) {
  console.log(`[IntentClassifier] Loading tools based on classification...`);
  fcm = new FunctionCallingManager(this.supabase as any, authToken);
  availableTools = (context.agent_id && context.user_id)
    ? await fcm.getAvailableTools(context.agent_id, context.user_id)
    : [];
  
  const toolsLoadTime = Date.now();
  console.log(`[FunctionCalling] Loaded ${availableTools.length} tools`);
} else {
  console.log(`[IntentClassifier] Skipping tool loading - simple conversation detected`);
  console.log(`[IntentClassifier] Estimated time saved: ~750ms`);
  fcm = new FunctionCallingManager(this.supabase as any, authToken); // Still needed for potential fallback
}
```

---

### Phase 3: Fallback Mechanism

#### Step 3.1: Add Response Analysis

**Location**: `supabase/functions/chat/processor/handlers.ts`  
**After initial LLM completion** (around line 236)

```typescript
// After initial completion without tools
if (!classification.requiresTools && toolCalls.length === 0) {
  // Check if LLM response suggests tools would help
  const responseText = completion.choices?.[0]?.message?.content || '';
  const needsToolsAfterAll = this.detectToolHintInResponse(
    responseText, 
    availableTools.map(t => t.name)
  );
  
  if (needsToolsAfterAll) {
    console.log(`[IntentClassifier] ⚠️ Fallback triggered: LLM response suggests tools needed`);
    console.log(`[IntentClassifier] False negative detected - loading tools and retrying...`);
    
    // Load tools now
    availableTools = await fcm.getAvailableTools(context.agent_id!, context.user_id!);
    
    // Retry completion with tools
    const normalized = this.normalizeTools(availableTools);
    const retryCompletion = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: msgs,
      temperature: 0.7,
      max_tokens: 1200,
      tools: normalized.map(fn => ({ type: 'function', function: fn })),
      tool_choice: 'auto',
    });
    
    completion = retryCompletion;
    
    // Log fallback event for metrics
    console.log(`[IntentClassifier] Fallback completed - continuing with tool-enabled response`);
  }
}

// Helper method (add to class)
private detectToolHintInResponse(
  responseText: string, 
  availableToolNames: string[]
): boolean {
  const lowerResponse = responseText.toLowerCase();
  
  // Pattern 1: LLM indicates inability
  const inabilityPatterns = [
    'i would need to',
    'i can\'t',
    'i cannot',
    'i don\'t have access',
    'i need permission',
    'i require',
    'unable to',
    'not able to'
  ];
  
  for (const pattern of inabilityPatterns) {
    if (lowerResponse.includes(pattern)) {
      return true;
    }
  }
  
  // Pattern 2: LLM mentions available tool names
  for (const toolName of availableToolNames) {
    if (lowerResponse.includes(toolName.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}
```

---

### Phase 4: Re-enable Tool Caching

#### Step 4.1: Update Cache Thresholds

**Location**: `supabase/functions/chat/function_calling/manager.ts`  
**Lines**: 38-39

```typescript
// BEFORE:
private readonly CACHE_MESSAGE_THRESHOLD = 0; // Revalidate immediately (caching disabled)
private readonly CACHE_TIME_THRESHOLD = 0; // Revalidate immediately (caching disabled)

// AFTER:
private readonly CACHE_MESSAGE_THRESHOLD = 15; // Revalidate after 15 messages
private readonly CACHE_TIME_THRESHOLD = 600000; // 10 minutes
```

**Rationale:**
- With intent classification, tool loading is less frequent
- Cache effectiveness increases significantly
- Reduces repeated database queries
- Improves overall system performance

---

## 📊 Performance Analysis

### Current Performance Baseline

**Simple Message (No Tools Needed):**
```
Total: 2500-3500ms
├─ Tool Discovery: 500-900ms
│  ├─ get-agent-tools edge function: 400-700ms
│  ├─ Database queries: 100-200ms
│  └─ Schema normalization: 10-50ms
├─ LLM Call (with tools): 1500-2000ms
└─ Overhead: 500-600ms
```

**Tool-Required Message:**
```
Total: 3500-5000ms
├─ Tool Discovery: 500-900ms
├─ LLM Call (with tools): 1500-2000ms
├─ Tool Execution: 500-1500ms
└─ Final LLM Call: 1000-1500ms
```

### Expected Performance After Optimization

**Simple Message (No Tools Needed):**
```
Total: 1800-2500ms (30% faster)
├─ Intent Classification: 200-400ms
│  ├─ gpt-4o-mini call: 200-350ms
│  └─ Cache overhead: 10-50ms
├─ Tool Discovery: 0ms (SKIPPED!)
├─ LLM Call (no tools): 1500-2000ms
└─ Overhead: 100-100ms

Time saved: ~700ms per request
```

**Tool-Required Message:**
```
Total: 3700-5400ms (7% slower)
├─ Intent Classification: 200-400ms
├─ Tool Discovery: 500-900ms
├─ LLM Call (with tools): 1500-2000ms
├─ Tool Execution: 500-1500ms
└─ Final LLM Call: 1000-1500ms

Time added: ~300ms per request (classification overhead)
```

### Net Performance Impact

**Assumptions:**
- 70% of messages are simple (no tools)
- 30% of messages require tools

**Calculation:**
```
Average improvement = (0.7 × -700ms) + (0.3 × +300ms)
                    = -490ms + 90ms
                    = -400ms (20% faster overall)
```

### Cost Analysis

**Current Costs (per 1000 messages):**
```
Tool Discovery: 1000 × $0.001 = $1.00
LLM Calls: 1000 × $0.002 = $2.00
Total: $3.00
```

**After Optimization (per 1000 messages):**
```
Classification: 1000 × $0.00015 = $0.15
Tool Discovery: 300 × $0.001 = $0.30 (only 30%)
LLM Calls: 1000 × $0.002 = $2.00
Total: $2.45

Savings: $0.55 per 1000 messages (18% reduction)
```

---

## 📅 Implementation Timeline

| Phase | Tasks | Duration | Start Date | End Date |
|-------|-------|----------|------------|----------|
| **Phase 1: Research** | ✅ Model selection, prompt design | 2 hours | Oct 6 | Oct 6 |
| **Phase 2: Classifier** | Create intent classifier utility | 3 hours | TBD | TBD |
| **Phase 3: Integration** | Modify handlers.ts, add fallback | 3 hours | TBD | TBD |
| **Phase 4: Caching** | Re-enable tool cache | 0.5 hours | TBD | TBD |
| **Phase 5: Metrics** | Add monitoring and logging | 2 hours | TBD | TBD |
| **Phase 6: Testing** | Unit and integration tests | 4 hours | TBD | TBD |
| **Phase 7: Deployment** | Staged rollout, monitoring | 2-3 weeks | TBD | TBD |
| **TOTAL** | | **14.5 hours + 2-3 weeks** | | |

---

## 🧪 Testing Strategy

### Unit Tests

**File**: `supabase/functions/tests/intent-classifier.test.ts`

**Test Cases:**

1. **Simple Greetings (No Tools)**
   - Input: "Hi!", "Hello", "How are you?"
   - Expected: `requiresTools: false`, confidence: `high`

2. **Tool Requests (Tools Needed)**
   - Input: "Send email to john@example.com", "Search my contacts"
   - Expected: `requiresTools: true`, confidence: `high`

3. **Ambiguous Messages**
   - Input: "Can you help me?", "What can you do?"
   - Expected: Appropriate confidence level, correct decision

4. **Edge Cases**
   - Empty messages, very long messages, special characters
   - Expected: Graceful handling, safe defaults

### Integration Tests

**Scenarios:**

1. **End-to-End Simple Conversation**
   - Send greeting → Verify tools not loaded → Verify fast response

2. **End-to-End Tool Execution**
   - Send tool request → Verify classification → Verify tools loaded → Verify execution

3. **Fallback Mechanism**
   - Send ambiguous message → Verify classification → Verify fallback triggers if needed

4. **Cache Effectiveness**
   - Send same message twice → Verify cache hit → Verify fast response

### Performance Tests

**Metrics to Measure:**
- Classification latency (p50, p95, p99)
- Overall request latency improvement
- Classification accuracy rate
- False positive/negative rates
- Cache hit rate over time

---

## 🚀 Deployment Strategy

### Stage 1: Shadow Mode (Week 1)

**Objective**: Validate accuracy without impacting production

**Actions:**
- Deploy classification logic
- Run classification but don't use results
- Log predictions vs actual tool usage
- Measure accuracy baseline
- Tune prompt if needed

**Success Criteria:**
- Classification accuracy > 95%
- False negative rate < 2%
- No production impact

### Stage 2: Partial Rollout (Week 2)

**Objective**: Validate performance improvement with real traffic

**Actions:**
- Enable for 25% of traffic using A/B testing
- Monitor error rates closely
- Track latency improvements
- Collect user feedback

**Success Criteria:**
- No increase in error rates
- Measurable latency improvement
- No user complaints

### Stage 3: Full Rollout (Week 3)

**Objective**: Enable for all production traffic

**Actions:**
- Enable for 100% of traffic
- Monitor closely for 24-48 hours
- Validate all success metrics achieved
- Document results

**Success Criteria:**
- All success metrics met
- Stable performance
- Positive user feedback

---

## 📈 Monitoring & Alerts

### Key Metrics to Track

1. **Classification Accuracy**
   - Track: Predictions vs actual tool usage
   - Alert: If accuracy drops below 90%

2. **False Negative Rate**
   - Track: Missed tool needs (fallback triggers)
   - Alert: If rate exceeds 5%

3. **Response Time**
   - Track: p50, p95, p99 latencies
   - Alert: If p95 exceeds baseline + 20%

4. **Cache Hit Rate**
   - Track: Cache hits vs misses
   - Alert: If hit rate drops below 40%

5. **Cost Metrics**
   - Track: Classification API costs
   - Track: Tool loading cost savings
   - Alert: If net costs increase

### Monitoring Dashboard

**Panels:**
- Classification decisions over time (tools vs no-tools)
- Average response time trend
- Cache effectiveness trend
- Fallback trigger rate
- Cost analysis (savings vs overhead)

---

## 🔄 Rollback Plan

### Rollback Triggers

- Classification accuracy drops below 85%
- Error rate increases by >10%
- User complaints increase significantly
- Critical production incident

### Rollback Procedure

1. **Immediate**: Set feature flag to disable classification
2. **Revert**: Load tools unconditionally (original behavior)
3. **Monitor**: Verify system stability restored
4. **Investigate**: Analyze root cause
5. **Fix**: Address issues before re-deployment

### Feature Flag

```typescript
const USE_INTENT_CLASSIFICATION = Deno.env.get('USE_INTENT_CLASSIFICATION') === 'true';

if (USE_INTENT_CLASSIFICATION) {
  // Use classification logic
} else {
  // Always load tools (original behavior)
}
```

---

## 📚 Documentation

### Documents to Create/Update

1. **Technical Architecture** (`technical_architecture.md`)
   - Detailed component diagrams
   - Data flow diagrams
   - API specifications

2. **Performance Analysis** (`performance_analysis.md`)
   - Detailed performance metrics
   - Cost analysis
   - Optimization recommendations

3. **Runbook** (`runbook.md`)
   - Monitoring procedures
   - Alert response procedures
   - Troubleshooting guide

4. **API Documentation** (Update existing)
   - New classification endpoint
   - Cache management endpoints
   - Metrics endpoints

---

## 🤝 Stakeholder Communication

### Progress Updates

**Weekly Reports:**
- Progress against timeline
- Key achievements
- Blockers and risks
- Next week's priorities

### Demo Sessions

**After Each Phase:**
- Demo functionality
- Show performance metrics
- Gather feedback
- Address concerns

---

## ✅ Success Validation

### Pre-Launch Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance tests meet criteria
- [ ] Documentation complete
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Rollback plan tested
- [ ] Stakeholders informed

### Post-Launch Validation

**Week 1:**
- [ ] Monitor metrics daily
- [ ] Review classification accuracy
- [ ] Check for issues
- [ ] Gather user feedback

**Week 2-3:**
- [ ] Analyze performance improvements
- [ ] Validate cost savings
- [ ] Document lessons learned
- [ ] Plan further optimizations

---

## 📞 Support & Resources

**Project Lead**: Development Team  
**Technical Contact**: Senior Full Stack Developer

**Resources:**
- [WBS Checklist](wbs_checklist.md)
- [Technical Architecture](technical_architecture.md)
- [Performance Analysis](performance_analysis.md)
- [Intent Classifier Code](../../supabase/functions/chat/processor/utils/intent-classifier.ts)

---

**Document Version**: 1.0  
**Last Updated**: October 6, 2025  
**Next Review**: After Phase 2 completion

