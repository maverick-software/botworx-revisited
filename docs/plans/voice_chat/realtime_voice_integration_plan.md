# Real-time Voice Chat Integration with GPT-4o Audio Preview

**Date**: October 14, 2025  
**Model**: GPT-4o Audio Preview (`gpt-4o-audio-preview`)  
**Goal**: Integrate streaming voice conversation while preserving existing chat system + MCP tools

---

## Overview

OpenAI's **GPT-4o Audio Preview** model supports:
- ✅ Native audio input AND output in a single API call
- ✅ Streaming responses (text + audio simultaneously)
- ✅ Function calling (compatible with MCP tools!)
- ✅ Multi-turn conversations with audio context
- ✅ Multiple voices (alloy, echo, fable, onyx, nova, shimmer)

**Key Difference from Current System**:
- **Current**: Whisper STT → Text Processing → TTS (3 separate API calls)
- **New**: GPT-4o Audio Preview (1 unified API call with audio in/out)

---

## Architecture Options

### Option 1: Parallel System (Recommended) ✅
Keep existing text chat + add separate real-time voice mode

**Pros**:
- No disruption to existing system
- Can test/iterate independently
- Easy rollback if issues
- Users choose which mode to use

**Cons**:
- Slightly more code to maintain
- Need mode switcher UI

### Option 2: Replace Existing Voice System ❌
Replace Whisper+TTS with GPT-4o audio everywhere

**Pros**:
- Single unified system
- Less code duplication

**Cons**:
- Risky - breaks existing voice features
- Can't use non-GPT providers for voice
- All-or-nothing deployment

**DECISION**: Go with **Option 1** - parallel system

---

## Implementation Strategy

### Phase 1: Backend - Audio Streaming Edge Function
Create new edge function that handles GPT-4o audio preview

### Phase 2: Frontend - Real-time Voice Mode Component
Add new "Voice Chat Mode" toggle with streaming UI

### Phase 3: Integration - MCP Tools + Audio
Ensure tool calling works seamlessly with audio responses

---

## Detailed Implementation

### 1. Backend: `voice-chat-stream` Edge Function

**Location**: `supabase/functions/voice-chat-stream/index.ts`

**Features**:
- Accept audio input (base64 or binary)
- Use `gpt-4o-audio-preview` model
- Stream audio + text responses simultaneously
- Support MCP tool calling
- Maintain conversation context
- Use existing LLM Router for API key management

**API Request**:
```typescript
{
  audio_input: string;           // Base64 encoded audio
  conversation_id: string;       // Existing conversation
  agent_id: string;              // Agent configuration
  tools?: MCPTool[];            // Available MCP tools
  voice?: string;                // Voice selection
  format?: 'wav' | 'mp3' | 'pcm16';
}
```

**API Response** (Server-Sent Events):
```typescript
// Event 1: Audio chunk
{
  event: 'audio',
  data: string,                  // Base64 audio chunk
  index: number
}

// Event 2: Text chunk (simultaneous)
{
  event: 'text',
  data: string,                  // Text delta
  index: number
}

// Event 3: Tool call
{
  event: 'tool_call',
  tool_name: string,
  arguments: object
}

// Event 4: Tool result
{
  event: 'tool_result',
  tool_name: string,
  result: any
}

// Event 5: Complete
{
  event: 'complete',
  message_id: string,
  tokens: { input: number, output: number }
}
```

**Integration with Existing System**:
```typescript
// Reuse LLM Router for API key
const router = new LLMRouter();
const { prefs } = await router.resolveAgent(agent_id);
const apiKey = await router.getSystemAPIKey('openai');

// Reuse FunctionCallingManager for tools
const fcm = new FunctionCallingManager(supabase, user_id);
const tools = await fcm.getFormattedTools(agent_id, user_id);

// Call GPT-4o Audio Preview API
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-audio-preview',
    modalities: ['text', 'audio'],
    audio: { voice: 'alloy', format: 'wav' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: audioBase64,
              format: 'wav'
            }
          }
        ]
      }
    ],
    tools: tools,  // MCP tools!
    stream: true
  })
});
```

---

### 2. Frontend: Real-time Voice Chat Component

**Location**: `src/components/voice/RealtimeVoiceChat.tsx`

**Features**:
- WebRTC audio capture (continuous recording)
- Real-time audio playback
- Visual waveform/indicators
- Text transcript display (simultaneous)
- Tool execution feedback
- Push-to-talk or voice-activated modes

**UI Layout**:
```
┌──────────────────────────────────────┐
│   [🎙️ Voice Chat Mode]   [⚙️]        │
├──────────────────────────────────────┤
│                                       │
│  ┌────────────────────────────────┐ │
│  │  🔊 ▁▂▃▅▇▅▃▂▁  [Recording...] │ │
│  └────────────────────────────────┘ │
│                                       │
│  💬 Transcript:                      │
│  User: "What's the weather in SF?"   │
│  Assistant: "Let me check that..."   │
│  🔧 [Tool: web_search executing...]  │
│  Assistant: "It's 72°F and sunny!"   │
│                                       │
│  ┌────────────────────────────────┐ │
│  │  [Hold to Talk] or [◼ Stop]   │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
```

**Hook**: `useRealtimeVoiceChat.ts`
```typescript
export function useRealtimeVoiceChat(options) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [currentToolExecution, setCurrentToolExecution] = useState(null);
  
  const startVoiceChat = async () => {
    // 1. Start audio capture
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 2. Connect to voice-chat-stream edge function (SSE)
    const eventSource = new EventSource(`${supabaseUrl}/functions/v1/voice-chat-stream`);
    
    // 3. Send audio chunks as they're captured
    mediaRecorder.ondataavailable = (event) => {
      sendAudioChunk(event.data);
    };
    
    // 4. Receive and play audio responses
    eventSource.addEventListener('audio', (event) => {
      const audioChunk = base64ToAudioBlob(event.data);
      audioQueue.push(audioChunk);
      playNextAudioChunk();
    });
    
    // 5. Display text transcript
    eventSource.addEventListener('text', (event) => {
      appendTranscript('assistant', event.data);
    });
    
    // 6. Show tool execution
    eventSource.addEventListener('tool_call', (event) => {
      setCurrentToolExecution({
        name: event.tool_name,
        status: 'executing'
      });
    });
  };
  
  return {
    isRecording,
    isPlaying,
    transcript,
    currentToolExecution,
    startVoiceChat,
    stopVoiceChat
  };
}
```

---

### 3. Tool Calling Integration

**Challenge**: How do we execute MCP tools during audio conversation?

**Solution**: Interrupt-Resume Pattern

```
User speaks audio → GPT-4o processes → Calls tool → 
Execute tool (pause audio) → Get result → 
Resume audio response with tool result
```

**Flow**:
```typescript
// 1. GPT-4o requests tool call (streaming paused)
{
  event: 'tool_call',
  tool_name: 'web_search',
  arguments: { query: 'weather SF' }
}

// 2. Frontend shows: "🔧 Searching web..."

// 3. Backend executes tool via UniversalToolExecutor
const result = await UniversalToolExecutor.executeTool({
  toolName: 'web_search',
  parameters: { query: 'weather SF' },
  // ... context
});

// 4. Feed result back to GPT-4o
// 5. GPT-4o resumes streaming audio response

{
  event: 'audio',
  data: '...',  // "Based on my search, it's 72 degrees..."
}
```

---

### 4. Message Persistence

**Challenge**: How do we save audio conversations to database?

**Solution**: Hybrid Storage

```typescript
// Save to existing chat_messages_v2 table
{
  id: uuid,
  conversation_id: uuid,
  role: 'user' | 'assistant',
  content: 'Transcribed text',  // Always save text
  metadata: {
    input_method: 'realtime_voice',
    audio_duration_ms: 3500,
    audio_url: 'https://storage/audio/msg_123.wav',  // Optional
    voice: 'alloy',
    model: 'gpt-4o-audio-preview',
    tool_calls: [...]
  },
  tool_calls: [...]  // Existing field
}
```

**Storage Strategy**:
- **Text**: Always saved (searchable, indexable)
- **Audio**: Optional - store in Supabase Storage if user enables "Save Audio"
- **Tools**: Saved as normal (existing tool_calls field)

---

### 5. Mode Switching UI

Add toggle in chat interface:

```typescript
// In ChatInput or ChatHeader
<div className="flex items-center gap-2">
  <Button
    variant={mode === 'text' ? 'default' : 'ghost'}
    onClick={() => setMode('text')}
  >
    💬 Text Chat
  </Button>
  <Button
    variant={mode === 'voice' ? 'default' : 'ghost'}
    onClick={() => setMode('voice')}
  >
    🎙️ Voice Chat
  </Button>
  <Button
    variant={mode === 'realtime_voice' ? 'default' : 'ghost'}
    onClick={() => setMode('realtime_voice')}
  >
    🔊 Real-time Voice
  </Button>
</div>

{mode === 'text' && <ChatInput ... />}
{mode === 'voice' && <VoiceInputButton ... />}  // Existing: STT → Text → Submit
{mode === 'realtime_voice' && <RealtimeVoiceChat ... />}  // New: Streaming
```

---

## Cost Analysis

### GPT-4o Audio Preview Pricing
- **Input**: $2.50 / 1M tokens + audio processing
- **Output**: $10.00 / 1M tokens + audio generation
- **Audio**: ~25 tokens per second of audio

### Comparison with Current System
**Current (Whisper + GPT-4 + TTS)**:
- Whisper: $0.006/min ($0.36/hour)
- GPT-4o text: ~$0.15 per conversation
- TTS: $15/1M chars (~$0.05 per response)
- **Total**: ~$0.56/conversation hour

**New (GPT-4o Audio Preview)**:
- All-in-one: ~$0.80/conversation hour
- **~43% more expensive** BUT much better UX

---

## Advantages of This Approach

✅ **Keeps existing system intact** - no disruption  
✅ **Full MCP tool support** - function calling works  
✅ **Lower latency** - single API call vs 3  
✅ **Better UX** - true real-time conversation  
✅ **Reuses infrastructure** - LLM Router, tools, auth, storage  
✅ **Progressive enhancement** - add as new feature  
✅ **Parallel development** - can build alongside existing features

---

## Implementation Timeline

### Week 1: Backend Foundation
- [ ] Create `voice-chat-stream` edge function
- [ ] Integrate with LLM Router for API keys
- [ ] Add GPT-4o audio preview support
- [ ] Test streaming response
- [ ] Test tool calling with audio

### Week 2: Frontend Components
- [ ] Create `RealtimeVoiceChat` component
- [ ] Build `useRealtimeVoiceChat` hook
- [ ] Implement audio capture + playback
- [ ] Add transcript display
- [ ] Add tool execution feedback UI

### Week 3: Integration & Testing
- [ ] Add mode switcher to chat interface
- [ ] Test MCP tools with voice chat
- [ ] Test message persistence
- [ ] Performance optimization
- [ ] Error handling & edge cases

### Week 4: Polish & Deploy
- [ ] UI/UX refinements
- [ ] Documentation
- [ ] Cost monitoring
- [ ] Deploy to production
- [ ] User testing & feedback

---

## Next Steps

1. **Decision Point**: Approve this approach?
2. **Start with**: Backend `voice-chat-stream` edge function
3. **Then**: Frontend `RealtimeVoiceChat` component
4. **Finally**: Integration testing

---

## Questions to Answer

1. Should we store audio files or only text transcripts?
2. Push-to-talk or voice-activated mode (or both)?
3. Which voices should be default (alloy, echo, fable, etc.)?
4. Should we allow mid-conversation mode switching?
5. How do we handle interruptions (user speaking while agent responds)?

---

**Ready to start implementation?**

