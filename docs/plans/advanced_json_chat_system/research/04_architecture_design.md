# Architecture Design - Advanced JSON Chat System

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │   UI    │  │   API   │  │   SDK   │  │  Agent  │          │
│  │ Clients │  │ Clients │  │ Clients │  │ Clients │          │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
└───────┼────────────┼────────────┼────────────┼─────────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway Layer                             │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │    Auth     │  │ Rate Limiter │  │  Load Balancer │        │
│  │  Service    │  │              │  │                │        │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘        │
└─────────┼────────────────┼──────────────────┼──────────────────┘
          │                │                  │
          └────────────────┴──────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Chat Service Layer                             │
│  ┌────────────────────────────────────────────────────┐        │
│  │              Message Processor                      │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │        │
│  │  │  Parser  │  │Validator │  │ Router   │        │        │
│  │  └──────────┘  └──────────┘  └──────────┘        │        │
│  └────────────────────────┬───────────────────────────┘        │
│                           │                                      │
│  ┌────────────────────────┴───────────────────────────┐        │
│  │              Context Engine                         │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │        │
│  │  │ Builder  │  │Optimizer │  │Compressor│        │        │
│  │  └──────────┘  └──────────┘  └──────────┘        │        │
│  └────────────────────────┬───────────────────────────┘        │
└───────────────────────────┼─────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Memory & State Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ Memory Manager  │  │ State Manager   │  │   Persistence   ││
│  │ ┌─────────────┐│  │ ┌─────────────┐│  │ ┌─────────────┐││
│  │ │  Episodic   ││  │ │Local State  ││  │ │  Database   │││
│  │ ├─────────────┤│  │ ├─────────────┤│  │ ├─────────────┤││
│  │ │  Semantic   ││  │ │Shared State ││  │ │   Cache     │││
│  │ ├─────────────┤│  │ ├─────────────┤│  │ ├─────────────┤││
│  │ │ Procedural  ││  │ │Checkpoints  ││  │ │   Files     │││
│  │ └─────────────┘│  │ └─────────────┘│  │ └─────────────┘││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   OpenAI    │  │   Pinecone  │  │     MCP     │            │
│  │ Integration │  │ Integration │  │ Integration │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Message Processor

```typescript
class MessageProcessor {
  private parser: JSONParser;
  private validator: SchemaValidator;
  private router: MessageRouter;
  
  async process(request: ChatRequestV2): Promise<ProcessedMessage> {
    // Parse JSON request
    const parsed = await this.parser.parse(request);
    
    // Validate against schema
    const validated = await this.validator.validate(parsed);
    
    // Route to appropriate handler
    const routed = await this.router.route(validated);
    
    return routed;
  }
}
```

**Responsibilities:**
- Parse incoming JSON messages
- Validate against versioned schemas
- Route to appropriate handlers
- Handle version compatibility

### 2. Context Engine

```typescript
class ContextEngine {
  private builder: ContextBuilder;
  private optimizer: ContextOptimizer;
  private compressor: ContextCompressor;
  
  async buildContext(
    message: AdvancedChatMessage,
    memories: Memory[],
    state: AgentState
  ): Promise<OptimizedContext> {
    // Build initial context
    const rawContext = await this.builder.build(message, memories, state);
    
    // Optimize for relevance and coherence
    const optimized = await this.optimizer.optimize(rawContext);
    
    // Compress if needed
    const final = await this.compressor.compress(optimized);
    
    return final;
  }
}
```

**Responsibilities:**
- Assemble context from multiple sources
- Optimize for token efficiency
- Apply compression strategies
- Maintain context coherence

### 3. Memory Manager

```typescript
class MemoryManager {
  private episodicMemory: EpisodicMemoryStore;
  private semanticMemory: SemanticMemoryStore;
  private proceduralMemory: ProceduralMemoryStore;
  private workingMemory: WorkingMemoryCache;
  
  async retrieve(
    query: string,
    agentId: string,
    options: MemoryOptions
  ): Promise<RelevantMemories> {
    const memories = await Promise.all([
      this.episodicMemory.search(query, agentId, options),
      this.semanticMemory.search(query, agentId, options),
      this.proceduralMemory.search(query, agentId, options)
    ]);
    
    return this.rankAndFilter(memories, options);
  }
  
  async store(
    memory: Memory,
    agentId: string
  ): Promise<void> {
    switch (memory.type) {
      case 'episodic':
        await this.episodicMemory.store(memory, agentId);
        break;
      case 'semantic':
        await this.semanticMemory.store(memory, agentId);
        break;
      case 'procedural':
        await this.proceduralMemory.store(memory, agentId);
        break;
    }
    
    // Update working memory cache
    await this.workingMemory.update(memory, agentId);
  }
}
```

**Responsibilities:**
- Manage different memory types
- Efficient retrieval and storage
- Memory decay and importance
- Cross-memory type coordination

### 4. State Manager

```typescript
class StateManager {
  private localStateStore: LocalStateStore;
  private sharedStateStore: SharedStateStore;
  private checkpointManager: CheckpointManager;
  
  async getState(
    agentId: string,
    options: StateOptions
  ): Promise<AgentState> {
    const [local, shared] = await Promise.all([
      this.localStateStore.get(agentId),
      this.sharedStateStore.get(agentId, options.workspaceId)
    ]);
    
    return this.mergeStates(local, shared, options);
  }
  
  async updateState(
    agentId: string,
    delta: StateDelta
  ): Promise<void> {
    // Apply state changes
    await this.applyDelta(agentId, delta);
    
    // Create checkpoint if needed
    if (this.shouldCheckpoint(delta)) {
      await this.checkpointManager.create(agentId);
    }
  }
}
```

**Responsibilities:**
- Manage agent state lifecycle
- Coordinate local and shared state
- Handle state persistence
- Manage checkpoints and recovery

## Data Flow Architecture

### Request Flow

```
1. Client Request
   │
   ├─> API Gateway
   │   ├─> Authentication
   │   ├─> Rate Limiting
   │   └─> Request Logging
   │
   ├─> Message Processor
   │   ├─> Parse JSON
   │   ├─> Validate Schema
   │   └─> Extract Components
   │
   ├─> Context Engine
   │   ├─> Retrieve Memories
   │   ├─> Load State
   │   ├─> Build Context
   │   └─> Optimize & Compress
   │
   ├─> LLM Integration
   │   ├─> Format Request
   │   ├─> Call OpenAI
   │   └─> Process Response
   │
   ├─> Post-Processing
   │   ├─> Update Memories
   │   ├─> Update State
   │   ├─> Format Response
   │   └─> Log Metrics
   │
   └─> Client Response
```

### Memory Flow

```
Write Path:
User Input -> Memory Extractor -> Memory Classifier -> Memory Store
                                                          │
                                                          ├─> Episodic DB
                                                          ├─> Semantic DB
                                                          └─> Procedural DB

Read Path:
Query -> Embedding Generator -> Vector Search -> Memory Ranker -> Context
              │                      │                │
              └──> Pinecone         │                └─> Relevance Score
                                    └─> Local Cache
```

## Integration Architecture

### OpenAI Integration

```typescript
interface OpenAIAdapter {
  async createCompletion(
    context: OptimizedContext,
    settings: CompletionSettings
  ): Promise<CompletionResult>;
  
  async createEmbedding(
    text: string
  ): Promise<number[]>;
  
  async moderateContent(
    content: string
  ): Promise<ModerationResult>;
}
```

### Pinecone Integration

```typescript
interface PineconeAdapter {
  async upsert(
    vectors: Vector[],
    namespace: string
  ): Promise<void>;
  
  async query(
    vector: number[],
    options: QueryOptions
  ): Promise<QueryResult>;
  
  async delete(
    ids: string[],
    namespace: string
  ): Promise<void>;
}
```

### MCP Integration

```typescript
interface MCPAdapter {
  async getTools(
    agentId: string
  ): Promise<Tool[]>;
  
  async executeTools(
    calls: ToolCall[]
  ): Promise<ToolResult[]>;
  
  async getResources(
    agentId: string
  ): Promise<Resource[]>;
}
```

## Scalability Architecture

### Horizontal Scaling

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Chat Service   │     │  Chat Service   │     │  Chat Service   │
│   Instance 1    │     │   Instance 2    │     │   Instance 3    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                        ┌────────▼────────┐
                        │  Load Balancer  │
                        └────────┬────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │                       │                       │
┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
│     Redis       │     │   PostgreSQL    │     │    Pinecone     │
│    Cluster      │     │    Cluster      │     │    Cluster      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Caching Strategy

```
L1 Cache: In-Memory (Working Memory)
  └─> 10-100ms response time
  └─> Agent-specific data
  └─> LRU eviction

L2 Cache: Redis (Shared Cache)
  └─> 50-200ms response time
  └─> Cross-agent data
  └─> TTL-based expiration

L3 Storage: PostgreSQL + Pinecone
  └─> 200-1000ms response time
  └─> Persistent storage
  └─> Full historical data
```

## Security Architecture

### Authentication & Authorization

```typescript
interface SecurityLayer {
  authenticate(token: string): Promise<User>;
  authorize(user: User, resource: string, action: string): Promise<boolean>;
  encrypt(data: any): Promise<string>;
  decrypt(encrypted: string): Promise<any>;
  audit(action: AuditAction): Promise<void>;
}
```

### Data Protection

1. **Encryption at Rest**: All sensitive memories encrypted
2. **Encryption in Transit**: TLS 1.3 for all communications
3. **Access Control**: Role-based access to memories and state
4. **Audit Logging**: All state changes logged
5. **Data Retention**: Configurable retention policies

## Monitoring Architecture

### Metrics Collection

```typescript
interface MetricsCollector {
  // Performance Metrics
  recordLatency(operation: string, duration: number): void;
  recordTokenUsage(tokens: TokenUsage): void;
  recordMemoryUsage(usage: MemoryUsage): void;
  
  // Business Metrics
  recordConversation(conversation: ConversationMetrics): void;
  recordToolUsage(tool: ToolMetrics): void;
  recordError(error: ErrorMetrics): void;
  
  // System Metrics
  recordCacheHit(cache: string, hit: boolean): void;
  recordQueueDepth(queue: string, depth: number): void;
  recordDatabaseQuery(query: QueryMetrics): void;
}
```

### Observability Stack

1. **Metrics**: Prometheus + Grafana
2. **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
3. **Tracing**: OpenTelemetry + Jaeger
4. **Alerting**: PagerDuty integration
5. **Analytics**: Custom dashboards

## Deployment Architecture

### Container Structure

```dockerfile
# Base services
chat-service:latest
memory-service:latest
state-service:latest
context-service:latest

# Supporting services
redis:7-alpine
postgres:15-alpine
nginx:alpine

# Monitoring
prometheus:latest
grafana:latest
elasticsearch:8
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chat-service
  template:
    metadata:
      labels:
        app: chat-service
    spec:
      containers:
      - name: chat-service
        image: agentopia/chat-service:latest
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

## Migration Architecture

### Dual-Write Pattern

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Client    │      │   Writer    │      │  Databases  │
│             │      │             │      │             │
│   Request   ├─────>│   Process   ├─────>│  Old Schema │
│             │      │             │      │             │
└─────────────┘      │             ├─────>│  New Schema │
                     └─────────────┘      └─────────────┘
```

### Feature Flag System

```typescript
interface FeatureFlags {
  isJsonChatEnabled(userId: string): boolean;
  getMemorySystemVersion(agentId: string): 'v1' | 'v2';
  isStateManagementEnabled(workspaceId: string): boolean;
  getCompressionStrategy(agentId: string): CompressionStrategy;
}
```

## Conclusion

This architecture provides a robust, scalable foundation for the advanced JSON chat system. Key architectural decisions include:

1. **Modular Design**: Clear separation of concerns
2. **Scalability First**: Horizontal scaling capabilities
3. **Performance Focus**: Multi-tier caching strategy
4. **Security by Design**: Encryption and access control
5. **Observable System**: Comprehensive monitoring

The architecture supports incremental implementation while maintaining system stability and performance.