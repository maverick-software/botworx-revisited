# Chat Summary & Context Management System - Implementation Plan

**Version**: 1.0  
**Date**: January 2025  
**Status**: Planning Phase

## Executive Summary

This document outlines a comprehensive plan to transform Agentopia's conversation history management from a simple message accumulation system into an intelligent, multi-layered memory architecture that provides **true contextual understanding** rather than raw message dumps.

### Key Objectives

1. **Replace message history dumps** with intelligent, summarized conversation context
2. **Implement background asynchronous summarization** independent of main chat flow
3. **Create vector-searchable working memory** using Supabase pg_vector
4. **Maintain long-term episodic memory** using existing Pinecone infrastructure
5. **Provide MCP tools** for agents to query conversation history on-demand
6. **Preserve chat history** for user review and posterity

---

## Problem Analysis

### Current Limitations

Based on analysis of `supabase/functions/chat/processor/handlers.ts` and `context_builder.ts`:

1. **Token Inefficiency**: Currently sending up to 25 raw messages (line 374 in MessageProcessor.ts)
   - Simple character/4 estimation for tokens (line 38-42 in context_builder.ts)
   - Linear accumulation without intelligent selection
   - No compression or summarization

2. **Context Overload**: Raw message history consumes valuable context window
   - System instructions + Vector context + MCP context + 25 messages + user input
   - Token limits often exceeded, truncating important context
   - No prioritization of critical information

3. **Lack of Search Tools**: Agent cannot search its own conversation history
   - No ability to recall specific past conversations
   - Cannot find relevant context from earlier in the conversation
   - Limited to whatever fits in context window

4. **No Background Processing**: All processing happens synchronously
   - Delays response times
   - No opportunity for intelligent analysis
   - Cannot build comprehensive understanding over time

### Cursor's Approach (Research Findings)

Based on [Cursor's summarization documentation](https://cursor.com/docs/agent/chat/summarization):

1. **Automatic Threshold-Based Summarization**
   - Monitors context window usage
   - Triggers summarization before overflow
   - Maintains conversation flow

2. **Smart Condensation for Large Content**
   - Preserves structural elements (function signatures, classes)
   - Expandable on-demand for specific sections
   - Clear indicators for oversized content

3. **User Control & Transparency**
   - Manual summarization triggers (`/summarize`)
   - View and edit summaries
   - Control over summarization frequency

4. **Persistent Context Management**
   - Maintains conversation continuity
   - Tunable parameters for when/how summarization occurs
   - Prevents context loss between sessions

---

## Proposed Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     User/Agent Chat Session                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────────────────────────────┐
        │         Chat Message Handler               │
        │    (Existing chat/processor/handlers.ts)   │
        └───────┬────────────────────────┬───────────┘
                │                        │
                │ Real-time Chat         │ Background Process
                ▼                        ▼
    ┌──────────────────────┐   ┌──────────────────────┐
    │   Working Memory     │   │  Summary Generator   │
    │  (Recent Summary)    │   │  (Async Background)  │
    └──────────────────────┘   └──────────────────────┘
                │                        │
                ▼                        ▼
    ┌──────────────────────┐   ┌──────────────────────┐
    │   Vector Search      │   │   Conversation       │
    │   (pg_vector)        │   │   Summaries Table    │
    │ Embeddings of chunks │   │  (Supabase PG)       │
    └──────────────────────┘   └──────────────────────┘
                │
                ▼
    ┌──────────────────────┐
    │  MCP Search Tools    │
    │  - search_history    │
    │  - get_summary       │
    │  - recall_context    │
    └──────────────────────┘
                │
                ▼
    ┌──────────────────────┐
    │  Long-Term Memory    │
    │  (Existing Pinecone) │
    │  Episodic memories   │
    └──────────────────────┘
```

### Memory Layers

#### Layer 1: Working Memory (Real-Time Context)
**Purpose**: Immediate conversation awareness  
**Storage**: In-memory + pg_vector for quick retrieval  
**Content**: Rolling conversation summary + key facts  
**Retention**: Current conversation session + recent sessions

#### Layer 2: Conversation Summaries (Medium-Term)
**Purpose**: Searchable conversation archives  
**Storage**: Supabase `conversation_summaries` table with pg_vector  
**Content**: Per-conversation summaries with key entities, topics, outcomes  
**Retention**: User-configurable (default: 90 days)

#### Layer 3: Episodic Memory (Long-Term)
**Purpose**: Deep semantic memory for important events/learnings  
**Storage**: Existing Pinecone infrastructure  
**Content**: Important facts, procedures, user preferences, domain knowledge  
**Retention**: Permanent (subject to user's storage limits)

---

## Database Schema

### New Tables

```sql
-- Conversation summaries with vector search capability
CREATE TABLE conversation_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Summary content
  summary_text TEXT NOT NULL,
  key_facts JSONB DEFAULT '[]'::JSONB,  -- Array of important facts
  entities JSONB DEFAULT '{}'::JSONB,    -- Extracted entities (people, places, things)
  topics TEXT[] DEFAULT ARRAY[]::TEXT[], -- Conversation topics
  
  -- Metadata
  message_count INTEGER DEFAULT 0,
  conversation_start TIMESTAMPTZ,
  conversation_end TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  
  -- Vector embedding for similarity search
  embedding VECTOR(1536),  -- OpenAI text-embedding-3-small dimension
  
  -- Performance indexes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversation_summaries_conversation ON conversation_summaries(conversation_id);
CREATE INDEX idx_conversation_summaries_agent ON conversation_summaries(agent_id);
CREATE INDEX idx_conversation_summaries_user ON conversation_summaries(user_id);
CREATE INDEX idx_conversation_summaries_updated ON conversation_summaries(last_updated DESC);

-- Vector similarity search index using HNSW (Hierarchical Navigable Small World)
CREATE INDEX idx_conversation_summaries_embedding ON conversation_summaries 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- RLS policies
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversation summaries"
  ON conversation_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage conversation summaries"
  ON conversation_summaries FOR ALL
  USING (auth.role() = 'service_role');


-- Working memory chunks for real-time context
CREATE TABLE working_memory_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Chunk content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,  -- Order within conversation
  message_ids UUID[] DEFAULT ARRAY[]::UUID[], -- Source messages
  
  -- Metadata
  importance_score FLOAT DEFAULT 0.5,  -- 0-1 relevance score
  chunk_type TEXT DEFAULT 'dialogue',  -- dialogue, action, fact, question, answer
  
  -- Vector embedding
  embedding VECTOR(1536),
  
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')  -- Auto-cleanup
);

-- Indexes
CREATE INDEX idx_working_memory_conversation ON working_memory_chunks(conversation_id);
CREATE INDEX idx_working_memory_agent ON working_memory_chunks(agent_id);
CREATE INDEX idx_working_memory_expires ON working_memory_chunks(expires_at);
CREATE INDEX idx_working_memory_embedding ON working_memory_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- RLS
ALTER TABLE working_memory_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own working memory"
  ON working_memory_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage working memory"
  ON working_memory_chunks FOR ALL
  USING (auth.role() = 'service_role');


-- Conversation summary board (the "whiteboard" the background agent maintains)
CREATE TABLE conversation_summary_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- The "board" content
  current_summary TEXT NOT NULL DEFAULT '',
  context_notes TEXT DEFAULT '',
  important_facts JSONB DEFAULT '[]'::JSONB,
  pending_questions JSONB DEFAULT '[]'::JSONB,
  action_items JSONB DEFAULT '[]'::JSONB,
  
  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  update_frequency INTEGER DEFAULT 5,  -- Update every N messages
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_summary_boards_conversation ON conversation_summary_boards(conversation_id);
CREATE INDEX idx_summary_boards_agent ON conversation_summary_boards(agent_id);

-- RLS
ALTER TABLE conversation_summary_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own summary boards"
  ON conversation_summary_boards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage summary boards"
  ON conversation_summary_boards FOR ALL
  USING (auth.role() = 'service_role');
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

#### 1.1 Database Setup
- [ ] Create migration for new tables
- [ ] Enable pg_vector extension in Supabase
- [ ] Set up indexes and RLS policies
- [ ] Test vector similarity search performance

#### 1.2 Background Summarization Service
**Location**: `supabase/functions/conversation-summarizer/index.ts`

```typescript
// Core summarization service
interface SummarizerConfig {
  updateFrequency: number;  // Messages between updates
  summaryMaxTokens: number; // Max tokens for summary
  chunkSize: number;        // Messages per chunk
}

class ConversationSummarizer {
  async updateSummaryBoard(
    conversationId: string,
    agentId: string,
    userId: string
  ): Promise<void> {
    // 1. Fetch recent messages since last update
    // 2. Get existing summary board
    // 3. Generate incremental summary update
    // 4. Extract key facts, entities, topics
    // 5. Update summary board
  }
  
  async generateCompleteSummary(
    conversationId: string
  ): Promise<ConversationSummary> {
    // 1. Fetch all conversation messages
    // 2. Chunk into semantic segments
    // 3. Generate summary for each chunk
    // 4. Combine into final summary
    // 5. Generate embedding
    // 6. Store in conversation_summaries
  }
}
```

**Key Features**:
- Asynchronous processing (non-blocking)
- Incremental updates (not full re-summarization each time)
- Intelligent chunking (semantic boundaries, not arbitrary cuts)
- Entity extraction (people, dates, actions)
- Topic modeling

#### 1.3 Trigger System
**Options**:

**Option A: Database Trigger (Recommended)**
```sql
-- Trigger function to queue summarization
CREATE OR REPLACE FUNCTION queue_summary_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if enough messages have accumulated
  PERFORM pg_notify(
    'summarization_queue',
    json_build_object(
      'conversation_id', NEW.conversation_id,
      'agent_id', NEW.agent_id,
      'user_id', NEW.user_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to chat_messages
CREATE TRIGGER trigger_summary_update
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION queue_summary_update();
```

**Option B: Edge Function Hook**
- Call summarizer after every N messages in chat handler
- More control, but couples summarization to chat flow

### Phase 2: Working Memory System (Week 3-4)

#### 2.1 Real-Time Context Manager
**Location**: `supabase/functions/chat/core/context/working_memory_manager.ts`

```typescript
class WorkingMemoryManager {
  /**
   * Get current working memory for conversation
   * Returns: Recent summary + important facts + context notes
   */
  async getWorkingContext(
    conversationId: string,
    agentId: string
  ): Promise<WorkingMemoryContext> {
    // 1. Get summary board
    // 2. Get recent working memory chunks
    // 3. Combine into coherent context
    // 4. Format for LLM consumption
  }
  
  /**
   * Update working memory with new message
   * Creates searchable chunks of recent dialogue
   */
  async updateWorkingMemory(
    conversationId: string,
    messages: Message[]
  ): Promise<void> {
    // 1. Chunk recent messages
    // 2. Generate embeddings
    // 3. Calculate importance scores
    // 4. Store in working_memory_chunks
  }
  
  /**
   * Search working memory by semantic similarity
   */
  async searchWorkingMemory(
    agentId: string,
    query: string,
    limit: number = 5
  ): Promise<MemoryChunk[]> {
    // 1. Generate query embedding
    // 2. Vector similarity search in pg_vector
    // 3. Return ranked results
  }
}
```

#### 2.2 Integration with Chat Pipeline
**Modify**: `supabase/functions/chat/processor/handlers.ts`

```typescript
// In TextMessageHandler.handle() method:

// REPLACE: Adding raw message history (lines 119-128)
const recentMessages = (message as any)?.context?.recent_messages || [];
for (const msg of recentMessages) {
  if (msg.role === 'user' || msg.role === 'assistant') {
    msgs.push({ 
      role: msg.role as 'user' | 'assistant', 
      content: String(msg.content || '')
    });
  }
}

// WITH: Adding working memory summary
const workingMemory = await WorkingMemoryManager.getWorkingContext(
  context.conversation_id,
  context.agent_id
);

if (workingMemory) {
  msgs.push({
    role: 'assistant',
    content: `=== CONVERSATION CONTEXT ===\n${workingMemory.summary}\n\nKey Facts:\n${workingMemory.facts.join('\n')}\n=== END CONTEXT ===`
  });
}
```

### Phase 3: MCP Search Tools (Week 5-6)

#### 3.1 Conversation History MCP Tools
**Location**: `supabase/functions/conversation-history-mcp/index.ts`

```typescript
// Tool 1: Search conversation history
{
  name: 'search_conversation_history',
  description: 'Search through past conversations using semantic similarity. Use this when you need to recall specific information from previous discussions.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What to search for in conversation history'
      },
      time_range: {
        type: 'string',
        enum: ['today', 'week', 'month', 'all'],
        description: 'Time range to search within'
      },
      limit: {
        type: 'number',
        default: 5,
        description: 'Maximum number of results'
      }
    },
    required: ['query']
  }
}

// Tool 2: Get conversation summary
{
  name: 'get_conversation_summary',
  description: 'Get a summary of the current or a past conversation. Use this to recall the overall context and key points.',
  parameters: {
    type: 'object',
    properties: {
      conversation_id: {
        type: 'string',
        description: 'ID of conversation to summarize (defaults to current)'
      }
    }
  }
}

// Tool 3: Recall specific context
{
  name: 'recall_context',
  description: 'Recall specific contextual information like action items, pending questions, or important facts from the conversation.',
  parameters: {
    type: 'object',
    properties: {
      context_type: {
        type: 'string',
        enum: ['action_items', 'questions', 'facts', 'entities'],
        description: 'Type of context to recall'
      },
      conversation_id: {
        type: 'string',
        description: 'Conversation to recall from (defaults to current)'
      }
    },
    required: ['context_type']
  }
}
```

#### 3.2 Tool Registration
**Modify**: `supabase/functions/get-agent-tools/index.ts`

```typescript
// Add conversation history tools for all agents
const conversationTools = [
  'search_conversation_history',
  'get_conversation_summary',
  'recall_context'
];

for (const toolName of conversationTools) {
  const parameters = generateParametersForCapability(toolName);
  
  tools.push({
    name: toolName,
    description: `${toolName} - Conversation History`,
    parameters,
    status: 'active',
    provider_name: 'Conversation History',
    connection_name: 'Internal'
  });
}
```

#### 3.3 Universal Tool Executor Routing
**Modify**: `supabase/functions/chat/function_calling/universal-tool-executor.ts`

```typescript
const TOOL_ROUTING_MAP: Record<string, {
  edgeFunction: string;
  actionMapping: (toolName: string) => string;
}> = {
  // ... existing tools ...
  
  'search_conversation_history': {
    edgeFunction: 'conversation-history-mcp',
    actionMapping: () => 'search_history'
  },
  'get_conversation_summary': {
    edgeFunction: 'conversation-history-mcp',
    actionMapping: () => 'get_summary'
  },
  'recall_context': {
    edgeFunction: 'conversation-history-mcp',
    actionMapping: () => 'recall_context'
  }
};
```

### Phase 4: Summarization Intelligence (Week 7-8)

#### 4.1 Intelligent Summarization Algorithm

**Prompting Strategy**:
```typescript
const SUMMARIZATION_PROMPT = `You are a conversation summarization specialist. Your task is to update a running summary of an ongoing conversation.

CONTEXT:
Previous Summary: {previousSummary}
Recent Messages: {recentMessages}

INSTRUCTIONS:
1. UPDATE the summary to incorporate new information from recent messages
2. PRESERVE important facts, entities, and context
3. CONSOLIDATE redundant information
4. MAINTAIN chronological flow
5. EXTRACT key facts, entities, action items, and pending questions
6. Keep summary concise (max 500 tokens)

OUTPUT FORMAT (JSON):
{
  "summary": "Updated conversation summary",
  "key_facts": ["fact1", "fact2"],
  "entities": {
    "people": ["name1", "name2"],
    "places": ["place1"],
    "organizations": ["org1"]
  },
  "topics": ["topic1", "topic2"],
  "action_items": ["item1", "item2"],
  "pending_questions": ["question1"]
}`;
```

#### 4.2 Smart Chunking Strategy

```typescript
class SemanticChunker {
  /**
   * Chunk messages by semantic boundaries, not arbitrary counts
   */
  chunkMessages(messages: Message[]): MessageChunk[] {
    const chunks: MessageChunk[] = [];
    let currentChunk: Message[] = [];
    let currentTokens = 0;
    
    for (const msg of messages) {
      const tokens = estimateTokens(msg.content);
      
      // Check for semantic boundary signals
      const isTopicChange = this.detectTopicChange(currentChunk, msg);
      const isActionComplete = this.detectActionCompletion(msg);
      
      if ((currentTokens + tokens > MAX_CHUNK_TOKENS) || 
          isTopicChange || 
          isActionComplete) {
        // Start new chunk
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk));
        }
        currentChunk = [msg];
        currentTokens = tokens;
      } else {
        currentChunk.push(msg);
        currentTokens += tokens;
      }
    }
    
    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk));
    }
    
    return chunks;
  }
  
  private detectTopicChange(existingMessages: Message[], newMessage: Message): boolean {
    // Use embedding similarity to detect topic shifts
    // Or look for explicit topic indicators (questions, new subjects, etc.)
  }
  
  private detectActionCompletion(message: Message): boolean {
    // Detect patterns indicating task completion
    // e.g., "Done", "Completed", tool execution results
  }
}
```

### Phase 5: UI Integration (Week 9-10)

#### 5.1 Summary Board Viewer
**Location**: `src/components/chat/SummaryBoardModal.tsx`

```typescript
interface SummaryBoardModalProps {
  conversationId: string;
  agentId: string;
  onClose: () => void;
}

export function SummaryBoardModal({ conversationId, agentId, onClose }: SummaryBoardModalProps) {
  const [summaryBoard, setSummaryBoard] = useState<SummaryBoard | null>(null);
  
  // Fetch and display:
  // - Current conversation summary
  // - Key facts
  // - Action items
  // - Pending questions
  // - Extracted entities
  
  return (
    <Modal>
      <div className="summary-board">
        <section className="summary">
          <h3>Conversation Summary</h3>
          <p>{summaryBoard?.current_summary}</p>
        </section>
        
        <section className="key-facts">
          <h3>Key Facts</h3>
          <ul>
            {summaryBoard?.important_facts.map(fact => <li>{fact}</li>)}
          </ul>
        </section>
        
        <section className="action-items">
          <h3>Action Items</h3>
          <ul>
            {summaryBoard?.action_items.map(item => <li>{item}</li>)}
          </ul>
        </section>
        
        {/* ... more sections ... */}
      </div>
    </Modal>
  );
}
```

#### 5.2 Chat Interface Updates
**Modify**: `src/pages/AgentChatPage.tsx`

- Add "View Summary" button to chat header
- Show indicator when background summarization is running
- Display token savings from using summaries
- Allow manual summary refresh

---

## Technical Specifications

### Supabase pg_vector Configuration

```sql
-- Enable pg_vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Configure for optimal performance
ALTER SYSTEM SET shared_buffers = '256MB';  -- Adjust based on instance size
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Reload configuration
SELECT pg_reload_conf();
```

### Vector Search Performance

**Index Strategy**:
- HNSW (Hierarchical Navigable Small World) for fast approximate search
- Cosine distance for semantic similarity
- `m = 16`: Higher values = better recall, more memory
- `ef_construction = 64`: Build quality parameter

**Query Performance**:
```sql
-- Fast vector similarity search
SELECT 
  id,
  summary_text,
  1 - (embedding <=> query_embedding) AS similarity
FROM conversation_summaries
WHERE agent_id = $1
  AND 1 - (embedding <=> query_embedding) > 0.7  -- Similarity threshold
ORDER BY embedding <=> query_embedding
LIMIT 10;
```

### Token Estimation Improvement

**Current**: Simple character/4 estimation (inaccurate)  
**Proposed**: Use tiktoken library for accurate counting

```typescript
import { encoding_for_model } from '@dqbd/tiktoken';

class TokenCounter {
  private encoder = encoding_for_model('gpt-4');
  
  countTokens(text: string): number {
    return this.encoder.encode(text).length;
  }
  
  truncateToTokenLimit(text: string, limit: number): string {
    const tokens = this.encoder.encode(text);
    if (tokens.length <= limit) return text;
    
    const truncated = tokens.slice(0, limit);
    return this.encoder.decode(truncated);
  }
}
```

---

## Migration Strategy

### Phase 1: Parallel Running (Weeks 1-4)
- New summarization system runs alongside existing message history
- Both systems provide context to LLM
- Measure token usage, response quality, latency

### Phase 2: Gradual Cutover (Weeks 5-8)
- Start reducing raw message count (25 → 15 → 10 → 5)
- Increase reliance on summary context
- Monitor for quality degradation

### Phase 3: Full Transition (Weeks 9-10)
- Summary system becomes primary context source
- Raw messages only for very recent turns (last 3-5)
- Preserve chat history for user review only

### Rollback Plan
- Feature flag: `USE_SUMMARY_SYSTEM` (default: false)
- Quick toggle if issues arise
- Existing context builder remains intact

---

## Performance Targets

### Summarization Service
- **Latency**: < 2 seconds for incremental update (5 messages)
- **Throughput**: 100 conversations/minute
- **Accuracy**: 90%+ retention of key information

### Vector Search (pg_vector)
- **Query Latency**: < 100ms for similarity search
- **Recall**: > 85% for relevant context
- **Index Size**: ~2KB per conversation summary

### Token Savings
- **Current**: ~3,000 tokens for 25 message history
- **Target**: ~500 tokens for summary + key facts
- **Savings**: 83% reduction in context tokens

### Cost Optimization
- **Pinecone**: Long-term storage for important memories only
- **pg_vector**: Working memory and summaries (included with Supabase)
- **Reduced LLM calls**: Fewer tokens = lower API costs

---

## Testing Strategy

### Unit Tests
```typescript
describe('ConversationSummarizer', () => {
  it('should generate accurate summaries', async () => {
    const messages = createTestMessages(25);
    const summary = await summarizer.generateSummary(messages);
    
    expect(summary.summary_text).toContain('key information');
    expect(summary.key_facts.length).toBeGreaterThan(0);
    expect(summary.entities).toBeDefined();
  });
  
  it('should update summaries incrementally', async () => {
    const initial = await summarizer.generateSummary(messages.slice(0, 10));
    const updated = await summarizer.updateSummary(initial, messages.slice(10, 15));
    
    expect(updated.message_count).toBe(15);
    expect(updated.summary_text).toContain(initial.summary_text);
  });
});

describe('WorkingMemoryManager', () => {
  it('should retrieve relevant context', async () => {
    const context = await workingMemory.getWorkingContext(convId, agentId);
    
    expect(context.summary).toBeDefined();
    expect(context.facts.length).toBeGreaterThan(0);
  });
  
  it('should perform semantic search', async () => {
    const results = await workingMemory.searchWorkingMemory(
      agentId,
      'what was the user\'s question about emails?'
    );
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk_text).toContain('email');
  });
});
```

### Integration Tests
- End-to-end conversation with summarization enabled
- Verify agent can recall information from earlier in conversation
- Test MCP tool execution for history search
- Measure token usage reduction

### Load Tests
- 1000 concurrent conversations
- Measure summarization backlog
- pg_vector query performance under load
- Database connection pooling

---

## Monitoring & Observability

### Metrics to Track
```typescript
// Summarization metrics
- summaries_generated_total
- summary_generation_duration_seconds
- summary_token_count

// Working memory metrics
- working_memory_chunks_created
- working_memory_searches_total
- working_memory_search_latency_ms

// Vector search metrics
- vector_search_queries_total
- vector_search_latency_ms
- vector_index_size_mb

// Context window metrics
- context_tokens_used (before)
- context_tokens_saved (after)
- context_quality_score
```

### Logging Strategy
```typescript
console.log('[ConversationSummarizer] Starting summarization', {
  conversation_id,
  message_count,
  existing_summary_tokens,
  timestamp: new Date().toISOString()
});

console.log('[ConversationSummarizer] ✅ Summary generated', {
  conversation_id,
  summary_tokens: newSummary.tokens,
  key_facts_count: newSummary.key_facts.length,
  duration_ms: Date.now() - startTime
});
```

---

## Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Multi-Agent Summary Coordination**
   - Shared summary boards for team conversations
   - Agent-specific perspectives on conversations
   - Cross-agent context sharing

2. **Advanced Summarization Techniques**
   - Hierarchical summarization (summaries of summaries)
   - Topic modeling and clustering
   - Sentiment analysis tracking
   - User preference learning

3. **User Controls**
   - Manual summary editing
   - Summary regeneration
   - Importance scoring feedback
   - Privacy controls (what to remember/forget)

4. **Analytics Dashboard**
   - Conversation insights
   - Topic trends over time
   - Agent memory usage statistics
   - Cost optimization recommendations

---

## Risk Analysis & Mitigation

### Risk 1: Summary Quality Degradation
**Impact**: High - Agent loses important context  
**Probability**: Medium  
**Mitigation**:
- Extensive testing with diverse conversations
- Quality scoring system with alerts
- User feedback mechanism
- Ability to view/edit summaries
- Fallback to full message history if quality drops

### Risk 2: Vector Search Performance
**Impact**: Medium - Slow response times  
**Probability**: Low  
**Mitigation**:
- pg_vector is well-optimized for Supabase
- Proper indexing strategy (HNSW)
- Query result caching
- Gradual scaling with monitoring

### Risk 3: Background Process Delays
**Impact**: Low - Summaries lag behind conversation  
**Probability**: Medium  
**Mitigation**:
- Queue-based processing with priority levels
- Horizontal scaling for summarization workers
- Rate limiting and backpressure handling
- User-visible status indicators

### Risk 4: Migration Complexity
**Impact**: High - Potential downtime or bugs  
**Probability**: Low  
**Mitigation**:
- Feature flag for gradual rollout
- Parallel running with existing system
- Comprehensive testing strategy
- Clear rollback plan

---

## Success Criteria

### Phase 1 Success (Foundation)
- [ ] Database tables created and optimized
- [ ] Background summarization service deployed
- [ ] Summaries generated within 2s per 5 messages
- [ ] No degradation in chat response times

### Phase 2 Success (Working Memory)
- [ ] Working memory context integrated into chat
- [ ] 80%+ reduction in raw message tokens
- [ ] Agent maintains conversation continuity
- [ ] Vector search latency < 100ms

### Phase 3 Success (MCP Tools)
- [ ] History search tools available to agents
- [ ] Agents successfully recall past context
- [ ] Tool execution latency < 500ms
- [ ] High user satisfaction with recall accuracy

### Overall Project Success
- [ ] 80%+ token savings in context window
- [ ] Improved conversation quality (user feedback)
- [ ] No increase in response latency
- [ ] Cost reduction from reduced token usage
- [ ] Positive user feedback on agent memory

---

## Resource Requirements

### Development Time
- **Phase 1**: 2 weeks (1 senior developer)
- **Phase 2**: 2 weeks (1 senior developer)
- **Phase 3**: 2 weeks (1 senior developer + 0.5 frontend)
- **Phase 4**: 2 weeks (1 senior developer)
- **Phase 5**: 2 weeks (0.5 backend + 1 frontend)
- **Total**: 10 weeks

### Infrastructure
- **Supabase**: pg_vector extension (included)
- **Database Storage**: ~100MB for 10K conversations
- **Compute**: Background worker for summarization
- **OpenAI API**: Embeddings + summarization calls

### Cost Estimates
- **Development**: 10 weeks × $8K/week = $80K
- **OpenAI API**: ~$50/month for 10K conversations
- **Infrastructure**: Included in existing Supabase plan
- **Total 1st Year**: ~$81K (mostly dev time)

---

## Conclusion

This comprehensive plan transforms Agentopia's conversation management from a naive message accumulation system into an intelligent, multi-layered memory architecture. By implementing background summarization, vector-searchable working memory, and on-demand history tools, agents will maintain true contextual understanding without overwhelming the LLM's context window.

The phased approach allows for gradual rollout, extensive testing, and risk mitigation, while the use of Supabase pg_vector keeps infrastructure costs low and performance high.

**Next Steps**:
1. Review and approve this plan
2. Create detailed task breakdown for Phase 1
3. Set up development environment with pg_vector
4. Begin implementation of database schema
5. Develop background summarization service

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Author**: AI Development Team  
**Status**: Awaiting Approval

