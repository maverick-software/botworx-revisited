nted access# MCP Advanced Reasoning System - Detailed Implementation Plan

## 1. System Overview

### Purpose
Transform the existing Markov reasoning chain into an MCP-style tool system that provides iterative, recursive chain-of-thought reasoning with proper LLM integration.

### Key Features
- **Multiple Reasoning Types**: Inductive, Deductive, Abductive, Analogical, Causal, Probabilistic
- **Iterative Processing**: Recursive reasoning until confidence threshold reached
- **Memory Integration**: Leverages episodic and semantic memory
- **Context Accumulation**: Each step builds upon previous conclusions
- **Safety Controls**: Max iteration limits and manual override switch
- **LLM Integration**: Reasoning conclusions directly influence final response

## 2. Architecture Components

### 2.1 Edge Function: `advanced-reasoning`
```typescript
// Location: supabase/functions/advanced-reasoning/index.ts
interface ReasoningRequest {
  action: 'analyze_complexity' | 'execute_chain' | '[reasoning_type]';
  query: string;
  context: {
    messages: Message[];
    semantic_memory: Memory[];
    episodic_memory: Memory[];
    previous_steps: ReasoningStep[];
    confidence_threshold: number;
    max_iterations: number;
    current_confidence: number;
  };
  agent_id: string;
  user_id: string;
}
```

### 2.2 Tool Registration in UniversalToolExecutor
```typescript
// Add to TOOL_ROUTING_MAP in universal-tool-executor.ts
'reasoning_': {
  edgeFunction: 'advanced-reasoning',
  actionMapping: (toolName: string) => {
    // Map reasoning_[type] to action
    return toolName.replace('reasoning_', '');
  },
  parameterMapping: (params: Record<string, any>, context: any) => ({
    action: context.toolName.replace('reasoning_', ''),
    query: params.query || params.question || params.text,
    context: params.context || {},
    agent_id: context.agentId,
    user_id: context.userId
  })
}
```

### 2.3 Iterative Markov Chain Controller
```typescript
// Location: supabase/functions/advanced-reasoning/reasoning/markov-controller.ts
export class MarkovReasoningController {
  private confidenceThreshold: number = 0.85;
  private maxIterations: number = 10;
  private currentIteration: number = 0;
  private accumulatedContext: ReasoningContext = {};
  
  async executeIterativeChain(request: ReasoningRequest): Promise<ReasoningResult> {
    let confidence = 0;
    let reasoningType = await this.determineInitialType(request.query);
    
    while (confidence < this.confidenceThreshold && 
           this.currentIteration < this.maxIterations) {
      
      // Execute reasoning step
      const step = await this.executeReasoningStep(
        reasoningType, 
        request.query,
        this.accumulatedContext
      );
      
      // Accumulate context
      this.accumulatedContext = this.mergeContext(
        this.accumulatedContext, 
        step
      );
      
      // Update confidence
      confidence = this.calculateConfidence(this.accumulatedContext);
      
      // Determine next reasoning type based on Markov transitions
      reasoningType = this.determineNextType(
        reasoningType, 
        confidence,
        step.insights
      );
      
      this.currentIteration++;
    }
    
    return this.buildFinalResult(this.accumulatedContext, confidence);
  }
}
```

### 2.4 Individual Reasoning Engines

#### Inductive Reasoner
```typescript
// Location: supabase/functions/advanced-reasoning/reasoning/inductive.ts
export class InductiveReasoner {
  async reason(input: ReasoningInput): Promise<ReasoningOutput> {
    // 1. Identify patterns in observations
    const patterns = await this.identifyPatterns(input.observations);
    
    // 2. Generalize from patterns
    const generalizations = await this.generalize(patterns);
    
    // 3. Test generalizations against memory
    const validated = await this.validateWithMemory(
      generalizations,
      input.memories
    );
    
    // 4. Build conclusion
    return {
      conclusion: this.formulateConclusion(validated),
      confidence: this.calculateConfidence(validated),
      insights: this.extractInsights(patterns, generalizations),
      memory_connections: validated.memoryMatches
    };
  }
}
```

#### Deductive Reasoner
```typescript
// Location: supabase/functions/advanced-reasoning/reasoning/deductive.ts
export class DeductiveReasoner {
  async reason(input: ReasoningInput): Promise<ReasoningOutput> {
    // 1. Identify premises
    const premises = await this.extractPremises(input.context);
    
    // 2. Apply logical rules
    const inferences = await this.applyLogicalRules(premises);
    
    // 3. Validate chain of logic
    const validated = await this.validateLogicChain(inferences);
    
    // 4. Derive conclusion
    return {
      conclusion: this.deriveConclusion(validated),
      confidence: this.assessLogicalCertainty(validated),
      insights: this.extractLogicalInsights(inferences)
    };
  }
}
```

#### Abductive Reasoner
```typescript
// Location: supabase/functions/advanced-reasoning/reasoning/abductive.ts
export class AbductiveReasoner {
  async reason(input: ReasoningInput): Promise<ReasoningOutput> {
    // 1. Identify surprising observations
    const anomalies = await this.identifyAnomalies(input.observations);
    
    // 2. Generate hypotheses
    const hypotheses = await this.generateHypotheses(anomalies);
    
    // 3. Evaluate plausibility
    const evaluated = await this.evaluatePlausibility(
      hypotheses,
      input.memories
    );
    
    // 4. Select best explanation
    return {
      explanation: this.selectBestExplanation(evaluated),
      confidence: this.calculatePlausibility(evaluated),
      insights: this.extractExplanatoryInsights(hypotheses)
    };
  }
}
```

## 3. Integration with TextMessageHandler

### 3.1 Modified TextMessageHandler
```typescript
// In handlers.ts - TextMessageHandler.handle()
async handle(message: AdvancedChatMessage, context: ProcessingContext) {
  // ... existing code ...
  
  // Check if reasoning was executed
  const reasoningContext = (message.context as any)?.reasoning;
  
  if (reasoningContext && reasoningContext.steps?.length > 0) {
    // Build reasoning-aware system prompt
    const reasoningPrompt = this.buildReasoningPrompt(reasoningContext);
    
    // Inject reasoning conclusions into message context
    msgs.unshift({
      role: 'system',
      content: reasoningPrompt
    });
    
    // If reasoning suggests tools, prioritize them
    if (reasoningContext.suggested_tools?.length > 0) {
      // Reorder available tools based on reasoning suggestions
      availableTools = this.prioritizeTools(
        availableTools,
        reasoningContext.suggested_tools
      );
    }
  }
  
  // ... continue with existing LLM call ...
}

private buildReasoningPrompt(reasoning: any): string {
  const sections = [];
  
  sections.push('=== REASONING ANALYSIS ===');
  sections.push(`Reasoning Style: ${reasoning.style}`);
  sections.push(`Confidence: ${(reasoning.confidence * 100).toFixed(1)}%`);
  
  if (reasoning.conclusion) {
    sections.push('\n=== REASONING CONCLUSION ===');
    sections.push(reasoning.conclusion);
  }
  
  if (reasoning.insights?.length > 0) {
    sections.push('\n=== KEY INSIGHTS ===');
    reasoning.insights.forEach((insight: string, idx: number) => {
      sections.push(`${idx + 1}. ${insight}`);
    });
  }
  
  if (reasoning.memory_connections?.length > 0) {
    sections.push('\n=== RELEVANT MEMORIES ===');
    reasoning.memory_connections.forEach((mem: any) => {
      sections.push(`- ${mem.summary}`);
    });
  }
  
  sections.push('\n=== INSTRUCTION ===');
  sections.push('Build your response based on the above reasoning analysis.');
  sections.push('Incorporate the insights and conclusions into your answer.');
  
  return sections.join('\n');
}
```

## 4. UI Integration - Safety Switch

### 4.1 Add Safety Switch to ChatHeader
```typescript
// In ChatHeader.tsx
export function ChatHeader({ 
  agent, 
  onStopReasoning,
  isReasoningActive 
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      {/* ... existing header content ... */}
      
      {isReasoningActive && (
        <button
          onClick={onStopReasoning}
          className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600"
          title="Stop reasoning and provide response"
        >
          <StopCircle className="w-4 h-4 mr-1" />
          End Reasoning
        </button>
      )}
    </div>
  );
}
```

### 4.2 Handle Safety Switch in AgentChatPage
```typescript
// In AgentChatPage.tsx
const handleStopReasoning = useCallback(async () => {
  // Send signal to edge function to conclude reasoning
  const { data } = await supabase.functions.invoke('advanced-reasoning', {
    body: {
      action: 'force_conclude',
      agent_id: agentId,
      user_id: user?.id
    }
  });
  
  // Update UI state
  setIsReasoningActive(false);
  
  // Process the partial reasoning result
  if (data?.result) {
    setCurrentProcessingDetails(data.result);
  }
}, [agentId, user?.id]);
```

## 5. Database Schema Updates

```sql
-- Create reasoning_sessions table for tracking
CREATE TABLE reasoning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  user_id UUID REFERENCES auth.users(id),
  conversation_id UUID,
  query TEXT NOT NULL,
  reasoning_type TEXT NOT NULL,
  iterations INTEGER DEFAULT 0,
  final_confidence DECIMAL(3,2),
  conclusion TEXT,
  insights JSONB,
  memory_connections JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  forced_stop BOOLEAN DEFAULT FALSE
);

-- Add reasoning configuration to agents metadata
ALTER TABLE agents 
ADD COLUMN reasoning_config JSONB DEFAULT '{
  "enabled": true,
  "confidence_threshold": 0.85,
  "max_iterations": 10,
  "preferred_styles": ["inductive", "deductive", "abductive"],
  "auto_invoke_threshold": 0.6
}'::jsonb;
```

## 6. Testing Strategy

### 6.1 Unit Tests
- Test each reasoning engine independently
- Test Markov state transitions
- Test confidence calculations
- Test memory integration

### 6.2 Integration Tests
- Test full reasoning chain execution
- Test iteration limits
- Test safety switch functionality
- Test LLM integration

### 6.3 Test Scenarios
```typescript
// Test complex query requiring multiple reasoning types
const complexQuery = "Based on recent user behavior patterns and historical data, what's the most likely reason for the 30% drop in engagement, and what specific actions should we take?";

// Expected flow:
// 1. Analyze complexity -> High complexity (0.9)
// 2. Inductive reasoning -> Identify patterns
// 3. Abductive reasoning -> Generate hypotheses
// 4. Deductive reasoning -> Validate conclusions
// 5. Final confidence: 0.87
```

## 7. Performance Considerations

### 7.1 Optimization Strategies
- Cache reasoning results for similar queries
- Implement parallel reasoning for independent steps
- Use streaming for real-time progress updates
- Limit memory searches to top-k relevant items

### 7.2 Resource Limits
```typescript
const RESOURCE_LIMITS = {
  MAX_ITERATIONS: 10,
  MAX_EXECUTION_TIME_MS: 30000,
  MAX_MEMORY_SEARCHES: 20,
  MAX_PARALLEL_REASONERS: 3,
  CACHE_TTL_SECONDS: 3600
};
```

## 8. Monitoring and Metrics

### 8.1 Key Metrics
- Average iterations to convergence
- Confidence distribution
- Reasoning type usage frequency
- Memory hit rate
- Response quality correlation

### 8.2 Logging
```typescript
console.log('[AdvancedReasoning] Metrics:', {
  session_id: sessionId,
  iterations: currentIteration,
  final_confidence: confidence,
  reasoning_types_used: typesUsed,
  memory_hits: memoryHits,
  execution_time_ms: executionTime,
  forced_stop: forcedStop
});
```

## 9. Rollout Plan

### Phase 1: Core Implementation (Week 1)
- [ ] Create edge function structure
- [ ] Implement basic reasoning engines
- [ ] Set up database schema

### Phase 2: Integration (Week 2)
- [ ] Integrate with UniversalToolExecutor
- [ ] Modify TextMessageHandler
- [ ] Add memory integration

### Phase 3: UI and Testing (Week 3)
- [ ] Add safety switch UI
- [ ] Implement monitoring
- [ ] Comprehensive testing

### Phase 4: Optimization (Week 4)
- [ ] Performance tuning
- [ ] Caching implementation
- [ ] Production deployment

## 10. Success Criteria

- ✅ Reasoning chains produce coherent, building conclusions
- ✅ Confidence threshold accurately triggers completion
- ✅ LLM responses incorporate reasoning insights
- ✅ Memory integration enhances reasoning quality
- ✅ Safety switch provides user control
- ✅ Performance within acceptable limits (<5s for most queries)
- ✅ 90%+ user satisfaction with reasoning-enhanced responses
