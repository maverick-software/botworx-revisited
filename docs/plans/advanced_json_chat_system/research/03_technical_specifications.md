# Technical Specifications - Advanced JSON Chat System

## Message Schema Specifications

### Core Message Schema v1.0.0

```typescript
interface AdvancedChatMessage {
  // Identification
  id: string;                          // UUID v4
  version: string;                     // Semantic versioning (1.0.0)
  
  // Core Properties
  role: MessageRole;                   // 'system' | 'user' | 'assistant' | 'tool'
  content: MessageContent;             // Structured content object
  
  // Temporal Information
  timestamp: string;                   // ISO 8601 with timezone
  created_at: string;                  // Database timestamp
  updated_at?: string;                 // For message edits
  
  // Metadata
  metadata: MessageMetadata;
  
  // Context Information
  context: MessageContext;
  
  // Optional Components
  tools?: ToolCall[];
  memory?: MemoryReference[];
  state?: StateSnapshot;
  
  // Compliance & Audit
  audit?: AuditInformation;
}

interface MessageContent {
  type: 'text' | 'structured' | 'multimodal' | 'tool_result';
  text?: string;
  structured?: Record<string, any>;
  parts?: ContentPart[];
  format?: 'plain' | 'markdown' | 'html' | 'json';
  language?: string;                   // ISO 639-1 code
}

interface ContentPart {
  type: 'text' | 'image' | 'code' | 'data' | 'reference';
  content: string | object;
  metadata?: Record<string, any>;
}

interface MessageMetadata {
  // Model Information
  model?: string;                      // e.g., "gpt-4"
  model_version?: string;
  temperature?: number;
  max_tokens?: number;
  
  // Performance Metrics
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency?: {
    inference_ms: number;
    total_ms: number;
  };
  
  // Quality Metrics
  confidence?: number;                 // 0.0 - 1.0
  quality_score?: number;
  
  // Source Information
  source?: 'api' | 'ui' | 'automation' | 'system';
  client_id?: string;
  request_id?: string;
}

interface MessageContext {
  // Conversation Context
  conversation_id: string;
  session_id: string;
  thread_id?: string;
  parent_message_id?: string;
  
  // User/Agent Context
  user_id?: string;
  agent_id?: string;
  workspace_id?: string;
  channel_id?: string;
  
  // Semantic Context
  intent?: string;
  topics?: string[];
  entities?: Entity[];
  sentiment?: SentimentAnalysis;
  
  // Memory Context
  relevant_memories?: string[];        // Memory IDs
  memory_score?: number;               // Relevance score
  
  // State Context
  state_version?: string;
  state_delta?: StateDelta;
}
```

### Memory System Specifications

```typescript
interface MemoryBank {
  agent_id: string;
  version: string;
  memories: {
    episodic: EpisodicMemory[];
    semantic: SemanticMemory[];
    procedural: ProceduralMemory[];
    working: WorkingMemory;
  };
  indexes: MemoryIndexes;
  metadata: MemoryMetadata;
}

interface EpisodicMemory {
  id: string;
  type: 'episodic';
  content: {
    event: string;
    context: Record<string, any>;
    participants: string[];
    outcome?: string;
  };
  temporal: {
    timestamp: string;
    duration_ms?: number;
    sequence_number: number;
  };
  importance: number;                  // 0.0 - 1.0
  decay_rate: number;                  // Memory decay over time
  access_count: number;
  last_accessed: string;
  embeddings?: number[];               // Vector representation
}

interface SemanticMemory {
  id: string;
  type: 'semantic';
  content: {
    concept: string;
    definition: string;
    relationships: Relationship[];
    attributes: Record<string, any>;
  };
  source: {
    origin: 'learned' | 'configured' | 'extracted';
    references: string[];
    confidence: number;
  };
  embeddings?: number[];
  usage_frequency: number;
}

interface ProceduralMemory {
  id: string;
  type: 'procedural';
  content: {
    skill: string;
    steps: ProcedureStep[];
    prerequisites: string[];
    outcomes: string[];
  };
  performance: {
    success_rate: number;
    average_duration_ms: number;
    last_execution: string;
    execution_count: number;
  };
  optimization: {
    learned_shortcuts: string[];
    error_patterns: ErrorPattern[];
  };
}

interface WorkingMemory {
  capacity: number;                    // Token limit
  usage: number;                       // Current tokens
  items: WorkingMemoryItem[];
  priority_queue: string[];            // Ordered item IDs
  compression_enabled: boolean;
}
```

### State Management Specifications

```typescript
interface AgentState {
  agent_id: string;
  version: string;
  
  // Core State
  local_state: LocalState;
  shared_state: SharedState;
  
  // Temporal State
  session_state: SessionState;
  persistent_state: PersistentState;
  
  // Meta Information
  checkpoints: StateCheckpoint[];
  last_modified: string;
  modification_count: number;
}

interface LocalState {
  // Agent-specific state
  preferences: Record<string, any>;
  learned_patterns: Pattern[];
  skill_levels: SkillLevel[];
  error_history: ErrorRecord[];
  
  // Context-specific state
  current_context: {
    active_task?: string;
    working_memory: string[];
    attention_focus: string[];
  };
}

interface SharedState {
  // Cross-agent shared information
  shared_knowledge: Record<string, any>;
  coordination_state: {
    active_collaborations: Collaboration[];
    shared_resources: Resource[];
    synchronization_points: SyncPoint[];
  };
  
  // Workspace-level state
  workspace_context: Record<string, any>;
}

interface StateCheckpoint {
  id: string;
  timestamp: string;
  state_hash: string;
  trigger: 'manual' | 'automatic' | 'error_recovery';
  size_bytes: number;
  restoration_time_ms?: number;
}
```

### Context Optimization Specifications

```typescript
interface ContextWindow {
  // Window Configuration
  max_tokens: number;
  current_tokens: number;
  compression_ratio: number;
  
  // Content Organization
  segments: ContextSegment[];
  priority_scores: Record<string, number>;
  
  // Optimization Metrics
  relevance_threshold: number;
  diversity_score: number;
  coherence_score: number;
}

interface ContextSegment {
  id: string;
  type: 'system' | 'memory' | 'history' | 'tool' | 'knowledge';
  content: any;
  
  // Metrics
  tokens: number;
  priority: number;
  relevance: number;
  recency: number;
  
  // Compression
  compressed: boolean;
  compression_method?: 'summary' | 'extraction' | 'encoding';
  original_tokens?: number;
}

interface CompressionStrategy {
  method: 'adaptive' | 'fixed' | 'intelligent';
  settings: {
    target_ratio: number;
    quality_threshold: number;
    preserve_entities: boolean;
    preserve_intent: boolean;
  };
  
  // Compression Functions
  summarize: (content: string) => string;
  extract_key_points: (content: string) => string[];
  encode: (content: string) => string;
}
```

### API Specifications

```typescript
// New JSON-based Chat API v2
interface ChatRequestV2 {
  version: '2.0.0';
  message: AdvancedChatMessage;
  
  options?: {
    // Memory Options
    memory?: {
      retrieve: boolean;
      store: boolean;
      types: ('episodic' | 'semantic' | 'procedural')[];
      max_results: number;
    };
    
    // State Options
    state?: {
      include_previous: boolean;
      checkpoint: boolean;
      merge_strategy: 'override' | 'merge' | 'append';
    };
    
    // Context Options
    context?: {
      window_size: number;
      compression_enabled: boolean;
      include_tools: boolean;
      include_knowledge: boolean;
    };
    
    // Response Options
    response?: {
      format: 'json' | 'text' | 'structured';
      include_metadata: boolean;
      include_reasoning: boolean;
      stream: boolean;
    };
  };
}

interface ChatResponseV2 {
  version: '2.0.0';
  message: AdvancedChatMessage;
  
  // Performance Metrics
  metrics: {
    total_duration_ms: number;
    llm_duration_ms: number;
    memory_retrieval_ms: number;
    state_sync_ms: number;
  };
  
  // Memory Updates
  memory_updates?: {
    created: string[];
    updated: string[];
    relevance_scores: Record<string, number>;
  };
  
  // State Changes
  state_delta?: StateDelta;
  
  // Debugging Information
  debug?: {
    context_size: number;
    compression_ratio: number;
    memory_hits: number;
    tool_calls: number;
  };
}
```

### Database Schema Updates

```sql
-- New table for structured messages
CREATE TABLE chat_messages_v2 (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(10) NOT NULL DEFAULT '1.0.0',
  conversation_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  context JSONB,
  tools JSONB,
  memory_refs UUID[],
  state_snapshot JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Memory storage tables
CREATE TABLE agent_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  memory_type VARCHAR(20) NOT NULL,
  content JSONB NOT NULL,
  embeddings VECTOR(1536),
  importance FLOAT DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- State management tables
CREATE TABLE agent_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id),
  state_type VARCHAR(20) NOT NULL,
  state_data JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  checksum VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE
);

-- Context snapshots for debugging/audit
CREATE TABLE context_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES chat_messages_v2(id),
  snapshot_data JSONB NOT NULL,
  tokens_used INTEGER,
  compression_ratio FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_memories_agent_type ON agent_memories(agent_id, memory_type);
CREATE INDEX idx_memories_embedding ON agent_memories USING ivfflat (embeddings vector_cosine_ops);
CREATE INDEX idx_states_agent_type ON agent_states(agent_id, state_type);
CREATE INDEX idx_messages_conversation ON chat_messages_v2(conversation_id, created_at);
```

## Implementation Guidelines

### Type Safety
- Use TypeScript strict mode
- Validate all inputs against schemas
- Runtime type checking with io-ts or zod

### Performance Considerations
- Lazy load memory segments
- Cache frequently accessed states
- Compress large context windows
- Stream responses when possible

### Security Requirements
- Encrypt sensitive memory content
- Validate JSON schemas strictly
- Audit all state changes
- Rate limit memory operations

### Monitoring Requirements
- Track memory usage per agent
- Monitor context window efficiency
- Log compression ratios
- Alert on state corruption

## Migration Strategy

### Phase 1: Parallel Implementation
1. Implement new system alongside existing
2. Use feature flags for gradual rollout
3. Mirror data to new tables
4. Validate parity

### Phase 2: Gradual Migration
1. Route percentage of traffic to v2
2. Monitor performance and errors
3. Increase traffic gradually
4. Full cutover when stable

### Phase 3: Cleanup
1. Migrate historical data
2. Update all clients
3. Deprecate v1 endpoints
4. Remove old code

## Conclusion

These specifications provide a comprehensive foundation for implementing an advanced JSON-based chat system with sophisticated memory management, state persistence, and context optimization. The modular design allows for incremental implementation while maintaining system stability.