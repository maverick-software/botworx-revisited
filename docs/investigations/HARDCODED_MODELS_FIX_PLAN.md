# Hardcoded Models Fix Plan

## Problem
Multiple parts of the chat system use hardcoded models (`gpt-4o-mini`, `gpt-4`) instead of respecting the agent's UI-selected model from `agent_llm_preferences` table.

## Current System
- **Model Storage**: `agent_llm_preferences` table
  - `provider`: 'openai', 'anthropic', etc.
  - `model`: User-selected model (e.g., 'gpt-4', 'gpt-4o', 'claude-3-5-sonnet')
  - `params`: Additional parameters
- **Model Retrieval**: `LLMRouter.resolveAgent(agentId)` returns `{ provider, prefs }`

## Hardcoded Model Locations

### **Category 1: Should Use Agent Model (CRITICAL)**

1. **Contextual Awareness** (`processor/utils/contextual-awareness.ts:359`)
   - Current: `model: 'gpt-4o-mini'`
   - Fix: Use agent's model or fast fallback

2. **Intent Classification** (`processor/utils/intent-classifier.ts:300`)
   - Current: `model: 'gpt-4o-mini'`
   - Fix: Use agent's model or fast fallback

3. **LLMCaller Fallback** (`processor/handlers/llm-caller.ts:154`)
   - Current: `model: 'gpt-4o-mini'`
   - Fix: Use agent's model

4. **Main LLM Call Default** (`processor/handlers.ts:246`)
   - Current: `effectiveModel = 'gpt-4'`
   - Fix: Use agent's model as default

### **Category 2: Utility Functions (Should Accept Model Parameter)**

5. **Title Generation** (`index.ts:83, 119`)
   - Current: `model: 'gpt-4o-mini'`
   - Fix: Accept model parameter, use agent's model

6. **Intelligent Retry System** (`processor/utils/intelligent-retry-system.ts:53, 356, 588`)
   - Current: `model: 'gpt-4o-mini'` and `model: 'gpt-4'`
   - Fix: Accept model parameter

7. **Memory Manager** (`core/memory/memory_manager.ts:1377`)
   - Current: `model: 'gpt-4'`
   - Fix: Accept model parameter

8. **Semantic Memory** (`core/memory/semantic_memory.ts:485, 785`)
   - Current: `model: 'gpt-4'`
   - Fix: Accept model parameter

## Solution Strategy

### **Approach 1: Create Model Resolution Helper**
Create a centralized helper that resolves the agent's model with appropriate fallbacks:

```typescript
// processor/utils/model-resolver.ts
export class ModelResolver {
  private cache: Map<string, string> = new Map();
  
  async getAgentModel(agentId: string, supabase: any, context: 'fast' | 'main' = 'main'): Promise<string> {
    const cacheKey = `${agentId}:${context}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Fetch from agent_llm_preferences
    const { data } = await supabase
      .from('agent_llm_preferences')
      .select('model, provider')
      .eq('agent_id', agentId)
      .single();
    
    let model: string;
    if (data?.model) {
      model = data.model;
    } else {
      // Fallback based on context
      model = context === 'fast' ? 'gpt-4o-mini' : 'gpt-4';
    }
    
    this.cache.set(cacheKey, model);
    setTimeout(() => this.cache.delete(cacheKey), 60000); // 1-min cache
    
    return model;
  }
  
  // For operations that need a fast model
  async getFastModel(agentId: string, supabase: any): Promise<string> {
    const agentModel = await this.getAgentModel(agentId, supabase, 'main');
    
    // If agent uses a slow model, use a faster alternative for quick operations
    const slowModels = ['gpt-4', 'claude-3-opus', 'claude-3-5-sonnet'];
    if (slowModels.includes(agentModel)) {
      return 'gpt-4o-mini'; // Fast fallback
    }
    
    return agentModel;
  }
}
```

### **Approach 2: Extend LLMRouter Usage**
Instead of direct OpenAI calls, always use LLMRouter which already handles model resolution.

## Implementation Plan

### **Phase 1: Create Model Resolver (HIGH PRIORITY)**
1. Create `processor/utils/model-resolver.ts`
2. Add caching and fallback logic
3. Export singleton instance

### **Phase 2: Fix Critical Paths (HIGH PRIORITY)**
1. **Contextual Awareness**
   - Add `agentId` and `supabase` to constructor
   - Use ModelResolver to get fast model
   
2. **Intent Classifier**
   - Add `agentId` and `supabase` to constructor
   - Use ModelResolver to get fast model
   
3. **LLMCaller**
   - Use agent model from router if available
   - Otherwise query ModelResolver

### **Phase 3: Fix Utility Functions (MEDIUM PRIORITY)**
1. **Title Generation**
   - Accept `agentId` parameter
   - Query model before generating title
   
2. **Intelligent Retry System**
   - Accept `model` parameter in constructor
   - Use agent's model throughout

### **Phase 4: Fix Memory Operations (LOW PRIORITY)**
1. **Memory Manager**
   - Accept model in config
   - Pass through to all LLM calls
   
2. **Semantic Memory**
   - Accept model in config

## Testing Plan
1. Set agent model to `gpt-4o` in UI
2. Send test message
3. Verify all LLM calls use `gpt-4o` (check Debug Modal)
4. Set agent model to `claude-3-5-sonnet`
5. Verify all LLM calls use Claude
6. Test with default (no model set)
7. Verify fallback to `gpt-4o-mini` for fast operations

## Migration Notes
- **Backward Compatible**: Existing agents without `agent_llm_preferences` will use defaults
- **Performance**: 1-minute cache prevents excessive DB queries
- **Flexibility**: Fast operations can still use faster models even if agent prefers slow model

