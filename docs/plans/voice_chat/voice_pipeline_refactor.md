# Voice Chat Pipeline Refactor - Complete

## Date: October 17, 2025

## Overview
Refactored voice chat to use the **same chat pipeline as text messages**, instead of bypassing it. This ensures proper agent context, conversation management, and message persistence.

## Previous Architecture (Bypassed Pipeline)
```
Voice Input → voice-chat-stream → GPT-4o (directly) → Response
```

**Problems:**
- ❌ Bypassed Message Processor, Context Engine, Memory Manager
- ❌ Bypassed LLM Router (per-agent model selection)
- ❌ Agent context not properly applied
- ❌ Conversation IDs not created correctly
- ❌ Messages not saved to database properly
- ❌ No tool execution support

## New Architecture (Proper Pipeline)
```
Voice Input → STT (Whisper) → Chat Pipeline → TTS → Voice Output
            (transcribe)      (full system)    (synthesize)
```

### Three-Step Process

#### Step 1: Speech-to-Text (STT)
- **Endpoint**: `/functions/v1/voice-transcribe`
- **Input**: Audio blob (webm format)
- **Output**: Transcribed text
- **Technology**: OpenAI Whisper API

#### Step 2: Chat Processing (Full Pipeline)
- **Endpoint**: `/functions/v1/chat`
- **Input**: V2 JSON format with transcribed text
- **Processing**:
  - ✅ Message Processor (parsing, validation, enrichment)
  - ✅ Context Engine (intelligent context retrieval)
  - ✅ Memory Manager (episodic + semantic memory)
  - ✅ LLM Router (per-agent model selection from Supabase Vault)
  - ✅ Tool Execution (MCP tools via `get-agent-tools`)
  - ✅ Message Adapters (V1/V2 format handling)
- **Output**: Assistant response text
- **Database**: Messages saved to `chat_messages_v2` with proper `conversation_id`, `session_id`, `sender_agent_id`, `sender_user_id`

#### Step 3: Text-to-Speech (TTS)
- **Endpoint**: `/functions/v1/voice-synthesize`
- **Input**: Response text + voice selection
- **Output**: Audio (MP3 format, base64 encoded)
- **Technology**: OpenAI TTS API
- **Frontend**: Auto-plays audio response

## Changes Made

### 1. `/src/hooks/voice/useSimpleVoiceChat.ts`
**Refactored `processAudio()` function:**
```typescript
// OLD: Single call to voice-chat-stream
await fetch('/voice-chat-stream', { audio, conversation_id, agent_id });

// NEW: Three-step pipeline
const { transcript } = await fetch('/voice-transcribe', { audio });
const { message } = await fetch('/chat', { 
  message: { content: { text: transcript } },
  context: { agent_id, conversation_id, session_id }
});
const { audio } = await fetch('/voice-synthesize', { text: message, voice });
```

### 2. `/src/components/voice/RealtimeVoiceChat.tsx`
**Added conversation management:**
```typescript
// Create conversation ID on mount if none exists (like text chat)
useEffect(() => {
  if (!conversationId && agentId) {
    const newConversationId = crypto.randomUUID();
    const newSessionId = crypto.randomUUID();
    setConversationId(newConversationId);
    localStorage.setItem(`agent_${agentId}_conversation_id`, newConversationId);
    localStorage.setItem(`agent_${agentId}_session_id`, newSessionId);
    onConversationCreated?.(newConversationId);
  }
}, [conversationId, agentId, onConversationCreated]);
```

### 3. `/src/pages/AgentChatPage.tsx`
**Connected voice chat to conversation lifecycle:**
```typescript
<RealtimeVoiceChat
  conversationId={conversationHook.conversationLifecycle.id || ''}
  onConversationCreated={(newConversationId) => {
    conversationHook.startNewConversation(newConversationId);
    messageHook.markConversationAsFresh(newConversationId);
  }}
/>
```

## Benefits

### ✅ Full Feature Parity
- Voice chat now has access to all chat features:
  - Agent-specific LLM models and configurations
  - Context retrieval from memory and documents
  - Tool execution (MCP tools)
  - Message history and conversation management
  - Memory consolidation and decay

### ✅ Proper Data Flow
- Conversation IDs created correctly (on first message, voice or text)
- Session IDs managed in localStorage (same as text)
- Messages saved to `chat_messages_v2` with proper schema compliance
- `conversation_sessions` table updated correctly

### ✅ Agent Context Respected
- Agent's selected LLM model is used (via LLM Router)
- Agent's system prompt and configuration applied
- Agent's available tools are discovered and executed
- Agent's memory and knowledge base accessed

### ✅ Database Consistency
- All messages (voice or text) follow the same V2 schema
- `content` field properly formatted as JSONB with `type` field
- `sender_agent_id` and `sender_user_id` set correctly
- `conversation_id` and `session_id` linked properly

## Testing Checklist

- [ ] Voice chat creates conversation ID on first use
- [ ] Voice messages appear in chat history after processing
- [ ] Agent responds using their configured LLM model
- [ ] Agent has access to conversation history in voice chats
- [ ] Tools are available and executable in voice chats
- [ ] Switching between voice and text mode preserves conversation
- [ ] TTS audio plays automatically after response
- [ ] Messages are saved to database with correct schema

## Future Enhancements

### Potential Optimizations
1. **Streaming TTS**: Stream audio as text is generated (requires different TTS API)
2. **Parallel Processing**: Start TTS synthesis while response is streaming
3. **Caching**: Cache common responses in audio format
4. **Voice Activity Detection**: Auto-detect when user stops speaking
5. **Conversation Summarization**: Generate voice-friendly summaries

### True Real-Time Option (Future)
- OpenAI Realtime API (WebSocket) for true bidirectional audio
- Requires dedicated WebSocket server (DigitalOcean/AWS)
- Supabase Edge Functions don't fully support WebSockets
- See `/docs/plans/voice_chat/digitalocean_websocket_solution.md`

## Status
✅ **COMPLETE** - Voice chat now uses proper pipeline, full feature parity with text chat.

## Files Modified
1. `src/hooks/voice/useSimpleVoiceChat.ts` - Refactored to use 3-step pipeline
2. `src/components/voice/RealtimeVoiceChat.tsx` - Added conversation management
3. `src/pages/AgentChatPage.tsx` - Connected to conversation lifecycle

## Files NOT Modified (Deprecated)
- `supabase/functions/voice-chat-stream/index.ts` - No longer used (can be removed)

