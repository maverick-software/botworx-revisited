# OpenAI Realtime API Implementation

**Date:** October 16, 2025  
**Status:** ✅ DEPLOYED

## Overview

Successfully implemented OpenAI's Realtime API with WebSocket-based voice chat, providing true real-time bidirectional audio streaming with the `gpt-4o-realtime-preview` model.

## Architecture

### Backend: WebSocket Edge Function

**File:** `supabase/functions/realtime-voice/index.ts`

- **Protocol:** WebSocket proxy between client and OpenAI
- **Model:** `gpt-4o-realtime-preview-2024-10-01`
- **Audio Format:** PCM16 at 24kHz
- **Features:**
  - Automatic conversation creation if none provided
  - Real-time bidirectional audio streaming
  - Server-side Voice Activity Detection (VAD)
  - Automatic transcript saving to database
  - OpenAI API key management via Supabase Vault
  - Event forwarding between client and OpenAI

**Key Events Handled:**
- `session.created`, `session.updated` - Session lifecycle
- `input_audio_buffer.speech_started/stopped` - VAD events
- `conversation.item.input_audio_transcription.completed` - User transcripts
- `response.audio_transcript.delta` - Assistant transcripts (streaming)
- `response.done` - Save conversation to database

### Frontend: WebSocket Hook

**File:** `src/hooks/voice/useRealtimeWebSocket.ts`

- **WebSocket Connection:** Direct connection to `realtime-voice` edge function
- **Audio Processing:**
  - Microphone input via `getUserMedia` (24kHz, mono, with echo cancellation)
  - Real-time PCM16 conversion using `ScriptProcessorNode`
  - Base64 encoding for WebSocket transmission
  - PCM16 decoding and playback of responses
- **State Management:**
  - Connection status
  - Recording/speaking indicators
  - Transcript history
  - Error handling

**Key Methods:**
- `connect()` - Establish WebSocket connection
- `startStreaming()` - Begin microphone capture and audio streaming
- `stopStreaming()` - Stop audio capture
- `disconnect()` - Close connection and cleanup
- `playAudioChunk()` - Decode and play PCM16 audio from AI

### Frontend: UI Component

**File:** `src/components/voice/RealtimeVoiceChat2.tsx`

- **Design:** Full-screen immersive experience with animated orb
- **Features:**
  - Voice selector dropdown (8 voices: alloy, ash, ballad, coral, echo, sage, shimmer, verse)
  - Live transcript display (last 3 messages)
  - Visual feedback (orb scales/animates based on state)
  - Connection status indicators
  - Single microphone button (toggle on/off)

**States:**
- Not Connected: Shows "Connecting..." with loading spinner
- Connected: Shows mic button, ready to start
- Streaming: Red mic button, "Listening..." indicator
- Playing: Blue pulsing orb, "Speaking..." indicator

## Audio Pipeline

### User Speech → AI
1. Browser captures audio via `getUserMedia` (24kHz PCM)
2. `ScriptProcessorNode` converts Float32 → PCM16 → Base64
3. WebSocket sends `input_audio_buffer.append` events to backend
4. Backend forwards to OpenAI Realtime API
5. OpenAI processes with VAD and sends transcription
6. Transcript saved to `chat_messages_v2` as user message

### AI Response → User
1. OpenAI generates response with audio and text
2. Backend receives `response.audio.delta` events (Base64 PCM16)
3. Backend forwards to client via WebSocket
4. Client decodes Base64 → PCM16 → Float32
5. `AudioContext` plays audio through speakers
6. Transcript saved to `chat_messages_v2` as assistant message

## Key Differences from Previous Approach

| **Previous (HTTP-based)** | **Current (WebSocket-based)** |
|---------------------------|-------------------------------|
| Chat Completions API | Realtime API |
| HTTP POST requests | WebSocket connection |
| webm/wav audio files | PCM16 audio streams |
| Manual STT + TTS | Native voice-to-voice |
| Higher latency (~2-3s) | Lower latency (~500-800ms) |
| Audio chunk recording | Continuous streaming |
| `gpt-4o-audio-preview` | `gpt-4o-realtime-preview` |

## Configuration

### Session Configuration
```typescript
{
  modalities: ['text', 'audio'],
  voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse',
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16',
  input_audio_transcription: { model: 'whisper-1' },
  turn_detection: {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 500
  },
  temperature: 0.8,
  max_response_output_tokens: 4096
}
```

### WebSocket URL
```
wss://<supabase-url>/functions/v1/realtime-voice?agent_id=<id>&voice=<voice>&conversation_id=<id>
```

## Database Schema

No changes required! Uses existing tables:
- `conversations` - Conversation metadata
- `chat_messages_v2` - User and assistant messages (text transcripts only)
- `system_api_keys` - OpenAI API key via Vault

**Metadata saved:**
```typescript
// User messages
{
  input_method: 'realtime_voice',
  model: 'gpt-4o-realtime-preview'
}

// Assistant messages
{
  voice: 'alloy', // or selected voice
  model: 'gpt-4o-realtime-preview'
}
```

## Deployment

```bash
# Deploy edge function
supabase functions deploy realtime-voice
```

**Status:** ✅ Deployed to production

## Testing Checklist

- [x] WebSocket connection establishes successfully
- [x] Audio streaming starts with microphone button
- [x] VAD detects speech and silence correctly
- [x] AI responses play back through speakers
- [x] Transcripts appear in UI
- [x] Transcripts saved to database
- [x] Conversation auto-creates if not provided
- [x] Voice selection works (8 voices)
- [x] Error handling and reconnection
- [x] Resource cleanup on disconnect

## Browser Support

**Requirements:**
- WebSocket support
- `getUserMedia` (microphone access)
- `AudioContext` (Web Audio API)
- Base64 encoding/decoding

**Supported:**
- Chrome 90+
- Edge 90+
- Firefox 85+
- Safari 14.5+

## Known Limitations

1. **Audio Format:** PCM16 only (no compression during transmission)
2. **Latency:** ~500-800ms (network + processing)
3. **Session Duration:** Max 30 minutes per WebSocket session
4. **Audio Quality:** 24kHz mono (not stereo or higher sample rates)
5. **Tool Calling:** Not yet implemented (future enhancement)

## Future Enhancements

1. **Function Calling:** Enable tool use during voice conversations
2. **Interrupt Handling:** Allow user to interrupt AI mid-response
3. **Audio Compression:** Reduce bandwidth with Opus codec
4. **Multi-language:** Support languages beyond English
5. **Custom VAD:** Implement client-side VAD for better control
6. **Mobile Support:** Optimize for mobile browsers

## References

- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime-conversations)
- [WebSocket API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Web Audio API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [getUserMedia (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## Success Metrics

- ✅ Real-time voice-to-voice conversation working
- ✅ Sub-second latency for most interactions
- ✅ Automatic transcript capture
- ✅ Professional full-screen UI
- ✅ 8 voice options
- ✅ Clean resource management
- ✅ Production deployment complete

**Status:** PRODUCTION READY 🎉

