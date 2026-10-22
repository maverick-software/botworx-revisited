# Voice Chat Research: Chat System & LLM Router Developer Brief

**Research Date**: January 2025  
**Purpose**: Understanding the existing chat system architecture for voice chat integration  
**Status**: Completed

---

## Executive Summary

Agentopia's chat system is a sophisticated, production-grade conversational AI platform built on a **Advanced JSON-based architecture (V2)** with full backward compatibility for legacy V1 clients. The system features multi-provider LLM routing, intelligent context management, dual-memory architecture, universal MCP tool execution, and comprehensive monitoring capabilities.

**Version**: 2.0.0  
**Status**: Production-Ready  
**Last Updated**: October 2025

---

## 🏗️ System Architecture Overview

### **High-Level Request Flow**

```
HTTP Request → index.ts Entry Point
    ↓
CORS + JWT Authentication
    ↓
API Version Detection (V1/V2)
    ↓
Request Validation (Zod Schema)
    ↓
MessageProcessor Pipeline
    ↓
├─ ParsingStage
├─ ValidationStage  
├─ EnrichmentStage (Context + Memory)
├─ ReasoningStage (Optional)
└─ MainProcessingStage
    ├─ Intent Classification
    ├─ Tool Discovery
    ├─ LLM Router/Provider Selection
    ├─ LLM API Call (OpenAI Responses API)
    ├─ Tool Execution (UniversalToolExecutor)
    └─ MCP Retry Loop
    ↓
ResponseStage (Build Response)
    ↓
Dual-Write Service (Persist Messages)
    ↓
Return Response (JSON/SSE Stream)
```

---

## 🧠 Core Components

### **1. LLM Router (`supabase/functions/shared/llm/router.ts`)**

The LLM Router provides **per-agent LLM provider selection** with centralized API key management.

#### **Key Features:**
- ✅ **Multi-Provider Support**: OpenAI (GPT-4o, GPT-5) and Anthropic (Claude)
- ✅ **Per-Agent Preferences**: Each agent can use different models/providers
- ✅ **Vault-Based Security**: API keys stored encrypted in Supabase Vault via `system_api_keys` table
- ✅ **Automatic Key Retrieval**: Decrypts keys on-demand using `get_secret()` RPC function
- ✅ **Extensible Architecture**: Easy to add Google, Mistral, Groq, OpenRouter

#### **Database Schema:**
```sql
-- Agent preferences
agent_llm_preferences {
  agent_id: uuid,
  provider: text,              -- 'openai', 'anthropic'
  model: text,                 -- 'gpt-4o-mini', 'claude-3-opus', etc.
  params: jsonb,               -- Custom parameters
  embedding_model: text        -- 'text-embedding-3-small'
}

-- System API keys (admin-managed)
system_api_keys {
  provider_name: text,         -- 'openai', 'anthropic'
  vault_secret_id: text,       -- Reference to encrypted key in vault
  is_active: boolean
}
```

#### **Usage Flow:**
```typescript
// 1. Initialize router
const router = new LLMRouter();

// 2. Resolve agent's provider and preferences
const { provider, prefs } = await router.resolveAgent(agentId);
// Returns: { provider: OpenAIProvider, prefs: { model: 'gpt-4o-mini', ... } }

// 3. Make chat call
const response = await router.chat(agentId, messages, {
  tools: [...],
  temperature: 0.7,
  maxTokens: 1200
});
```

#### **LLM Providers:**

**OpenAI Provider** (`openai_provider.ts`):
- Uses **OpenAI Responses API** (not Chat Completions API)
- Supports function calling with strict mode
- Automatic tool format conversion
- Temperature control disabled for reasoning models (GPT-5, GPT-4.1)
- Returns `responseId` for multi-turn conversations

**Anthropic Provider** (`anthropic_provider.ts`):
- Claude 3 Opus, Sonnet, Haiku support
- Tool calling compatible with OpenAI format
- Token counting support

**Interface** (`interfaces.ts`):
```typescript
interface LLMRouter {
  resolveAgent(agentId: string): Promise<{ provider: LLMProvider; prefs: AgentLLMPreferences }>;
  chat(agentId: string, messages: LLMMessage[], options?: LLMChatOptions): Promise<LLMChatResponse>;
  embed(agentId: string, inputs: string[], modelHint?: string): Promise<number[][]>;
}
```

#### **Enabling the Router:**
Set environment variable: `USE_LLM_ROUTER=true`

Without the router, the system falls back to direct OpenAI Chat Completions API.

---

### **2. Message Processor (`chat/processor/MessageProcessor.ts`)**

The **MessageProcessor** orchestrates the entire message handling pipeline through a series of processing stages.

#### **Pipeline Stages:**

1. **ParsingStage**: Raw request parsing and initial validation
2. **ValidationStage**: Zod schema validation against V2 contracts
3. **EnrichmentStage**: Context retrieval and memory augmentation
4. **ReasoningStage**: Advanced reasoning (when enabled)
5. **MainProcessingStage**: LLM call and tool execution
6. **ResponseStage**: Response formatting and metadata

#### **Key Methods:**
```typescript
class MessageProcessor {
  async process(request: ChatRequestV2, options: ProcessingOptions): Promise<MessageResponse>
  async* processStream(request: ChatRequestV2): AsyncGenerator<StreamEvent>
}
```

#### **Processing Context:**
Every stage receives a shared `ProcessingContext` object:
```typescript
interface ProcessingContext {
  agent_id: string;
  user_id: string;
  conversation_id: string;
  session_id: string;
  workspace_id?: string;
  channel_id?: string;
  request_options?: any;
  auth_token?: string;
}
```

---

### **3. Text Message Handler (`chat/processor/handlers.ts`)**

The **TextMessageHandler** is the primary handler for user messages, managing the complex orchestration of LLM calls and tool execution.

#### **Processing Steps:**

**STEP 1**: Extract user message text  
**STEP 2**: Intent classification (determine if tools are needed)  
**STEP 3**: Load available tools (if needed)  
**STEP 4**: Add tool guidance to messages  
**STEP 5**: Setup LLM Router/Caller  
**STEP 6**: Initial LLM call  
**STEP 7**: Tool execution with intelligent retry  
**STEP 8**: MCP retry loop (up to 3 attempts)  
**STEP 9**: Final response formatting  

#### **Intent Classification:**
```typescript
class IntentClassifier {
  static classify(userMessage: string): {
    requiresTools: boolean;
    confidence: number;
    reasoning: string;
  }
}
```

**Optimization**: If user message is a simple question/statement, tools are NOT loaded, saving ~750ms per request.

#### **LLM Caller:**
```typescript
class LLMCaller {
  constructor(openai: OpenAI, router: LLMRouter | null, agentId: string);
  
  async call(options: LLMCallOptions): Promise<LLMCallResult> {
    // Uses router if available, otherwise falls back to OpenAI
  }
}
```

**Tool Choice Logic:**
- `none`: No tools allowed (simple conversation)
- `auto`: LLM decides whether to use tools
- `required`: Force tool use (when user explicitly requests action)

---

### **4. Context Engine (`chat/core/context/context_engine.ts`)**

The **ContextEngine** provides intelligent context optimization for optimal AI model performance.

#### **Core Capabilities:**
- ✅ Multi-source context retrieval (chat history, vector search, MCP, workspace)
- ✅ Token budget management
- ✅ Context optimization and prioritization
- ✅ Compression when needed
- ✅ Structured context formatting
- ✅ Quality metrics tracking

#### **Context Sources:**
```typescript
enum ContextSource {
  CHAT_HISTORY = 'chat_history',
  VECTOR_SEARCH = 'vector_search',
  MCP_TOOLS = 'mcp_tools',
  WORKSPACE = 'workspace',
  AGENT_KNOWLEDGE = 'agent_knowledge',
  SYSTEM = 'system'
}
```

#### **Context Building:**
```typescript
interface ContextBuildRequest {
  query: string;
  conversation_context: ConversationContext;
  token_budget?: number;
  optimization_goals?: OptimizationGoal[];
  priority_overrides?: Record<string, ContextPriority>;
}

interface OptimizedContext {
  context_window: ContextWindow;
  total_tokens: number;
  budget_utilization: number;
  quality_score: number;
  sources_used: ContextSource[];
  compression_applied: boolean;
}
```

#### **Context Retriever:**
Retrieves candidate contexts from all sources with relevance scoring.

#### **Context Optimizer:**
Selects optimal context within token budget based on optimization goals:
- `MAXIMIZE_RELEVANCE`: Prioritize most relevant content
- `MAXIMIZE_COVERAGE`: Cover diverse topics
- `BALANCE_ALL`: Balanced approach

#### **Context Compressor:**
Applies compression when context exceeds budget.

#### **Context Structurer:**
Formats context into structured sections for model consumption.

---

### **5. Memory Manager (`chat/core/memory/memory_manager.ts`)**

The **MemoryManager** provides a sophisticated dual-memory architecture inspired by cognitive psychology.

#### **Memory Types:**

**Episodic Memory** (`episodic_memory.ts`):
- Conversation-specific memories
- Time-stamped events
- Stored in PostgreSQL `agent_memories` table
- Managed by `EpisodicMemoryManager`

**Semantic Memory** (`semantic_memory.ts`):
- General knowledge and facts
- Vector embeddings in Pinecone
- Semantic search capabilities
- Managed by `SemanticMemoryManager`

**GetZep Integration** (`getzep_semantic_manager.ts`):
- Knowledge graph integration
- Entity extraction and relationship mapping
- Fact retrieval and validation

#### **Key Operations:**
```typescript
class MemoryManager {
  // Storage
  async store(memory: Partial<AgentMemory>): Promise<string>;
  
  // Retrieval
  async retrieve(query: MemoryQuery): Promise<MemorySearchResult[]>;
  async search(query: string, agentId: string, options: SearchOptions): Promise<MemorySearchResult[]>;
  
  // Consolidation
  async consolidate(criteria: ConsolidationCriteria): Promise<ConsolidationResult>;
  
  // Decay
  async applyDecay(agentId: string, timeSinceLastAccess: number): Promise<DecayResult>;
}
```

#### **Memory Schema:**
```typescript
interface AgentMemory {
  id: string;
  agent_id: string;
  memory_type: 'episodic' | 'semantic' | 'procedural' | 'working';
  content: string;
  embeddings?: number[];
  importance: number;        // 0-1 scale
  decay_rate: number;        // Memory decay over time
  access_count: number;      // Times accessed
  related_memories: string[]; // IDs of related memories
  expires_at?: string;
  created_at: string;
  last_accessed: string;
}
```

#### **Memory Consolidation:**
Automatic process that merges similar memories to reduce redundancy and improve efficiency. Managed by `MemoryConsolidationManager`.

---

### **6. Function Calling Manager (`chat/function_calling/manager.ts`)**

The **FunctionCallingManager** provides unified MCP (Model Context Protocol) tool discovery and execution.

#### **Architecture Evolution:**
- ❌ **Old**: 4 separate providers (Gmail, SMTP, WebSearch, MCP)
- ✅ **New**: Unified MCP architecture where ALL tools are MCP tools

#### **Tool Discovery:**
```typescript
class FunctionCallingManager {
  async getAvailableTools(agentId: string, userId: string): Promise<OpenAIFunction[]>;
}
```

**Discovery Flow:**
1. Calls `get-agent-tools` edge function
2. Edge function queries `agent_integration_permissions` table
3. Returns unified list of authorized tools across all providers
4. Tools are cached (disabled for debugging, normally 15 messages or 10 minutes)

**Tool Format:**
```typescript
interface OpenAIFunction {
  name: string;               // e.g., 'gmail_send_email'
  description: string;
  parameters: JSONSchema;     // JSON Schema for parameters
}
```

#### **Tool Execution:**
```typescript
class FunctionCallingManager {
  async executeTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult>;
}
```

Uses **UniversalToolExecutor** for routing.

---

### **7. Universal Tool Executor (`chat/function_calling/universal-tool-executor.ts`)**

The **UniversalToolExecutor** routes tool calls to appropriate edge functions based on a configuration map.

#### **Tool Routing Map:**
```typescript
const TOOL_ROUTING_MAP: Record<string, {
  edgeFunction: string;
  actionMapping: (toolName: string) => string;
  parameterMapping?: (params: any, context: any) => any;
}> = {
  'gmail_': {
    edgeFunction: 'gmail-api',
    actionMapping: (toolName) => toolName.replace('gmail_', ''),
  },
  'outlook_': {
    edgeFunction: 'microsoft-outlook-api',
    actionMapping: (toolName) => toolName.replace('outlook_', ''),
  },
  'smtp_': {
    edgeFunction: 'smtp-api',
    actionMapping: (toolName) => toolName.replace('smtp_', ''),
  },
  'search_web': {
    edgeFunction: 'web-search-api',
    actionMapping: () => 'search',
  },
  // ... more mappings
};
```

#### **Tool Execution Flow:**
```typescript
static async executeTool(context: MCPToolExecutionContext): Promise<MCPToolResult> {
  // 1. Check tool status
  // 2. Check for required user input
  // 3. Find routing configuration
  // 4. Call appropriate edge function
  // 5. Return result with error handling
}
```

#### **Error Enhancement:**
The executor enhances errors with LLM-friendly messages for intelligent retry:
```typescript
function enhanceErrorForRetry(toolName: string, error: string): string {
  // Converts technical errors to actionable LLM guidance
}
```

---

### **8. Tool Executor & Intelligent Retry (`chat/processor/utils/tool-executor.ts`)**

The **ToolExecutor** orchestrates tool execution with intelligent retry capabilities.

#### **Key Features:**
- ✅ Parallel tool execution
- ✅ Automatic parameter extraction from user message
- ✅ Missing parameter detection and retry
- ✅ Error classification (retryable vs. terminal)
- ✅ Token tracking across retries

#### **Execution Flow:**
```typescript
class ToolExecutor {
  static async executeToolCalls(
    toolCalls: ToolCall[],
    messages: LLMMessage[],
    fcm: FunctionCallingManager,
    context: ProcessingContext,
    availableTools: OpenAIFunction[],
    openai: OpenAI,
    router: LLMRouter | null,
    useRouter: boolean,
    normalizeTools: Function
  ): Promise<ToolExecutionResult>
}
```

**Result:**
```typescript
interface ToolExecutionResult {
  toolDetails: ToolDetail[];
  msgs: LLMMessage[];
  tokensUsed: { prompt: number; completion: number; total: number };
  requiresLLMRetry: boolean;
  retryGuidanceAdded: boolean;
}
```

#### **MCP Retry Loop:**
When tool execution fails with retryable errors, the system adds guidance to the message array and calls the LLM again (up to 3 attempts).

---

### **9. Message Adapters (`chat/adapters/message_adapter.ts`)**

The **MessageAdapter** provides backward compatibility between V1 and V2 message formats.

#### **V1 Format (Legacy):**
```typescript
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  agentName?: string | null;
}
```

#### **V2 Format (Advanced JSON):**
```typescript
interface AdvancedChatMessage {
  id: string;
  version: '2.0.0';
  role: MessageRole;
  content: MessageContent;
  timestamp: string;
  created_at: string;
  metadata: MessageMetadata;
  context: MessageContext;
  tools?: ToolDefinition[];
}
```

#### **Conversion Methods:**
```typescript
class MessageAdapter {
  static v1ToV2(request: any): ChatRequestV2;
  static v2ToV1Response(response: MessageResponse): any;
}
```

---

## 📡 API Endpoints

### **Main Chat Endpoint**
```
POST {SUPABASE_URL}/functions/v1/chat
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

### **V2 Request Schema:**
```json
{
  "version": "2.0.0",
  "message": {
    "role": "user",
    "content": {
      "type": "text",
      "text": "Send an email to john@example.com"
    }
  },
  "context": {
    "conversation_id": "conv_123",
    "agent_id": "agent_456",
    "user_id": "user_789"
  },
  "options": {
    "response": {
      "stream": false,
      "include_metadata": true,
      "include_metrics": true
    },
    "memory": {
      "enabled": true,
      "types": ["episodic", "semantic"],
      "max_results": 10
    },
    "context": {
      "max_messages": 20,
      "token_budget": 4096
    }
  }
}
```

### **V2 Response Schema:**
```json
{
  "version": "2.0.0",
  "status": "success",
  "data": {
    "message": {
      "id": "msg_abc",
      "role": "assistant",
      "content": {
        "type": "text",
        "text": "I've sent the email successfully."
      },
      "metadata": {
        "processing_time_ms": 1250,
        "tokens": 45
      }
    }
  },
  "metrics": {
    "tokens": {
      "prompt": 120,
      "completion": 45,
      "total": 165
    },
    "model": "gpt-4o-mini",
    "processing_time_ms": 1250
  },
  "processing_details": {
    "context_tokens": 120,
    "reasoning": {
      "score": 0.85,
      "enabled": false,
      "style": "none"
    }
  }
}
```

### **Additional Endpoints:**

**Health Check:**
```
GET {SUPABASE_URL}/functions/v1/chat/health
```

**Metrics:**
```
GET {SUPABASE_URL}/functions/v1/chat/metrics
```

**Tool Diagnostics:**
```
GET {SUPABASE_URL}/functions/v1/chat/tools/diagnostics?agent_id=X&user_id=Y
```

---

## 🔧 Advanced Features

### **1. Streaming Support**

Enable real-time streaming responses:
```typescript
// Request
{
  "options": {
    "response": {
      "stream": true
    }
  }
}

// Headers
Accept: text/event-stream
```

**Server-Sent Events Format:**
```
event: delta
data: {"text": "Hello"}

event: complete
data: {"metrics": {...}}
```

### **2. Advanced Reasoning**

Optional reasoning layer that adds deliberation steps:
- Enabled per-agent via `agent.metadata.settings.reasoning_enabled`
- Threshold-based activation (0-1 scale)
- Multiple reasoning styles (analytical, creative, balanced)
- Memory-integrated Markov chain reasoning
- Confidence scoring

### **3. Conversation Management**

Automatic conversation title generation:
- Initial title from first user message
- Improved title after 3rd message using conversation context
- Stored in `conversation_sessions` table

### **4. Context Window Overflow Handling**

Automatic retry with reduced history:
- Up to 3 retry attempts
- Aggressive history reduction (50% each time)
- User-friendly error messages

---

## 🗄️ Database Schema

### **Key Tables:**

```sql
-- Agent LLM preferences
agent_llm_preferences {
  agent_id: uuid PRIMARY KEY,
  provider: text,
  model: text,
  params: jsonb,
  embedding_model: text
}

-- System API keys (admin-managed)
system_api_keys {
  id: uuid PRIMARY KEY,
  provider_name: text UNIQUE,
  vault_secret_id: text,
  is_active: boolean,
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Agent memories
agent_memories {
  id: uuid PRIMARY KEY,
  agent_id: uuid,
  memory_type: memory_type_enum,
  content: text,
  embeddings: vector(1536),
  importance: float,
  decay_rate: float,
  access_count: integer,
  expires_at: timestamptz
}

-- Conversation sessions
conversation_sessions {
  conversation_id: uuid PRIMARY KEY,
  agent_id: uuid,
  user_id: uuid,
  title: text,
  status: text,
  last_active: timestamptz
}

-- Chat messages (V2)
chat_messages_v2 {
  id: uuid PRIMARY KEY,
  conversation_id: uuid,
  role: text,
  content: jsonb,
  metadata: jsonb,
  created_at: timestamptz
}
```

---

## ⚡ Performance Optimizations

1. **Intent Classification**: Skips tool loading for simple messages (~750ms savings)
2. **Tool Caching**: 15-message or 10-minute cache for available tools
3. **Lazy Loading**: Router and executors loaded only when needed
4. **Parallel Operations**: Context retrieval, tool execution
5. **Token Estimation**: Fast character/4 estimation vs. tiktoken
6. **Context Compression**: Applied only when needed

---

## 🔒 Security & Authentication

- **JWT Authentication**: Required on all requests
- **Service Role Override**: `X-Agentopia-Service: task-executor` header
- **Vault Integration**: All API keys encrypted in Supabase Vault
- **RLS Policies**: Row-level security on all tables
- **Token Injection**: Auth token passed through to tool execution

---

## 🐛 Debugging & Monitoring

### **Logging:**
```typescript
import { createLogger } from './utils/logger.ts';
const logger = createLogger('ComponentName');

logger.info('Message', { data });
logger.warn('Warning', error);
logger.error('Error', error);
```

### **Metrics:**
```typescript
import { metrics } from './utils/metrics.ts';
const timer = metrics.startTimer('operation_name');
// ... operation ...
timer.stop();
```

### **Monitoring System:**
```typescript
class MonitoringSystem {
  async checkHealth(): Promise<HealthStatus>;
  async exportMetrics(): Promise<Metrics>;
}
```

---

## 🚀 Development Workflow

### **Running Locally:**
```powershell
# Start Supabase
supabase start

# Serve chat function
supabase functions serve chat --no-verify-jwt --env-file .env.local
```

### **Testing:**
```powershell
# Test with curl
curl -X POST http://localhost:54321/functions/v1/chat `
  -H "Authorization: Bearer YOUR_JWT" `
  -H "Content-Type: application/json" `
  -d '{"version": "2.0.0", "message": {...}}'
```

### **Deploying:**
```powershell
# Deploy chat function
supabase functions deploy chat

# Deploy related functions
supabase functions deploy get-agent-tools
supabase functions deploy gmail-api
supabase functions deploy microsoft-outlook-api
```

---

## 📊 Voice Chat Integration Considerations

### **Potential Integration Points:**

1. **Audio Input Processing**
   - Convert speech to text (STT) before entering chat pipeline
   - Preserve audio metadata in message context
   - Handle streaming audio input

2. **Audio Output Generation**
   - Convert text responses to speech (TTS) after response stage
   - Support streaming TTS for real-time responses
   - Voice selection based on agent preferences

3. **Context Adaptations**
   - Voice conversations may be shorter and more conversational
   - Adjust context window for voice-specific patterns
   - Handle interruptions and turn-taking

4. **Tool Integration**
   - Voice-triggered tool calls
   - Audio feedback for tool execution
   - Hands-free operation considerations

5. **Streaming Requirements**
   - Bidirectional audio streaming
   - WebSocket or WebRTC integration
   - Low-latency requirements for natural conversation

### **Recommended Architecture:**

```
Audio Input (WebRTC/WebSocket)
    ↓
STT Service (Whisper/Deepgram)
    ↓
Existing Chat System (V2 API)
    ↓
TTS Service (ElevenLabs/OpenAI TTS)
    ↓
Audio Output (WebRTC/WebSocket)
```

### **Key Files to Modify:**

1. `supabase/functions/voice-chat/index.ts` (new function)
2. `supabase/functions/chat/processor/MessageProcessor.ts` (add voice context)
3. `src/components/chat/VoiceChatInterface.tsx` (new component)
4. `src/hooks/useVoiceChat.ts` (new hook)

---

## 📋 Key Takeaways

1. **LLM Router**: Provides per-agent model selection with vault-based API key management
2. **V2 Architecture**: Advanced JSON-based system with full V1 backward compatibility
3. **Universal Tool Execution**: Single pathway for all tool types (Gmail, SMTP, MCP, etc.)
4. **Intelligent Retry**: Automatic parameter extraction and LLM-guided retry on errors
5. **Memory System**: Dual-memory architecture (episodic + semantic) with consolidation
6. **Context Engine**: Sophisticated context optimization with token budgeting
7. **Production-Ready**: Comprehensive error handling, monitoring, and security
8. **Streaming Support**: Already supports SSE streaming, can be adapted for voice
9. **Modular Design**: Clean separation allows for voice integration without breaking existing functionality

---

## 🎯 Next Steps for Voice Chat Implementation

1. **Research STT/TTS Providers**: Evaluate OpenAI Whisper, Deepgram, ElevenLabs, etc.
2. **Design Voice Message Format**: Extend V2 message schema to support audio
3. **Create Voice Edge Function**: New endpoint for handling voice-specific flows
4. **Build WebRTC/WebSocket**: Real-time bidirectional audio streaming
5. **Implement Voice UI Components**: Frontend components for voice interaction
6. **Add Voice-Specific Context**: Optimize context engine for voice patterns
7. **Test Latency**: Ensure sub-200ms latency for natural conversation

---

**This system represents a mature, enterprise-grade conversational AI platform capable of handling complex multi-turn conversations with tool integration, memory persistence, and intelligent context management. It provides an excellent foundation for voice chat integration.**

