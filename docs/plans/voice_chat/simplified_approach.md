# Simplified Voice Chat Approach

**Date**: January 2025  
**Approach**: Text-Only, No Audio Storage

---

## Overview

Voice chat will work as a **UI-only enhancement** to the existing chat system. Audio is captured, transcribed to text, processed through the existing chat pipeline, and optionally converted back to speech - all without storing audio files.

---

## Architecture

### Audio Mode Flow
```
User speaks → WebRTC capture → Whisper API (STT) → Text appears in chat input
→ User can edit text → Submit to existing chat API → Text response
→ Optional: TTS playback → Audio played (not saved)
```

### Voice Chat Mode Flow
```
User speaks → WebRTC capture → Whisper API (STT) → Auto-submit as text
→ Existing chat pipeline → Text response → Auto TTS → Audio played
→ All saved as regular text messages in existing tables
```

---

## What We Need

### 1. Frontend Components (Simple)
- `VoiceInputButton` - Microphone button in chat input
- `useVoiceRecorder` - Hook for audio capture
- `useVoicePlayback` - Hook for TTS playback (optional)
- Voice mode toggle in chat interface

### 2. Backend (Minimal Changes)
- Add Whisper API call to existing chat edge function (optional endpoint)
- Add TTS API call for response playback (optional)
- Or create single `voice-utils` edge function for STT/TTS

### 3. Database (No Changes Needed!)
- Use existing `chat_messages_v2` table
- Add optional metadata field to track if message was voice-originated:
  ```sql
  -- In existing chat_messages_v2.metadata field:
  {
    "input_method": "voice",  // or "text"
    "transcription_confidence": 0.95,
    "voice_mode": "audio" // or "voice_chat"
  }
  ```

---

## Implementation Steps

### Phase 1: Audio Mode (STT only)
1. Create `VoiceInputButton` component
2. Implement `useVoiceRecorder` hook
3. Add Whisper API integration
4. Display transcribed text in chat input
5. User edits and submits normally

### Phase 2: TTS Response (Optional)
1. Create `useVoicePlayback` hook
2. Add TTS API integration
3. Auto-play assistant responses
4. Add play/pause controls

### Phase 3: Voice Chat Mode (Auto-submit)
1. Add mode toggle (Text vs Voice Chat)
2. Auto-submit transcribed text in Voice Chat mode
3. Auto-play TTS responses
4. Continuous conversation flow

---

## Benefits of This Approach

✅ **Simple**: Minimal code changes  
✅ **Fast**: Reuses entire existing infrastructure  
✅ **Cost-effective**: No audio storage costs  
✅ **Privacy-friendly**: No audio files to manage  
✅ **Searchable**: All conversations are text-searchable  
✅ **Accessible**: Text available for all users  
✅ **Maintainable**: One system to maintain  

---

## File Structure

```
src/
├── components/
│   └── voice/
│       ├── VoiceInputButton.tsx       (Mic button in chat input)
│       ├── VoiceModeToggle.tsx        (Text/Voice mode switcher)
│       └── VoiceVisualizer.tsx        (Optional: waveform during recording)
└── hooks/
    └── voice/
        ├── useVoiceRecorder.ts        (Record + STT)
        └── useVoicePlayback.ts        (TTS + playback)

supabase/functions/
└── voice-utils/                       (Optional: STT/TTS utilities)
    └── index.ts
```

---

## Cost Estimation (Much Lower!)

### OpenAI API Costs (No storage!)
- **Whisper API**: $0.006/minute of audio
- **TTS API**: $15/1M characters (≈$0.015/1000 chars)

### For 1000 active users (estimated)
- Average 10 voice messages/user/month
- Average 30 seconds per message
- **Total**: ~$30-50/month (vs $500-1000 with audio storage!)

---

## Next Steps

1. ✅ Simplify approach (this document)
2. ⏳ Create `VoiceInputButton` component
3. ⏳ Create `useVoiceRecorder` hook with Whisper integration
4. ⏳ Add voice button to chat input
5. ⏳ Test end-to-end flow
6. ⏳ Add TTS for responses (optional)
7. ⏳ Add Voice Chat mode (auto-submit)

---

**This approach leverages your comprehensive existing system and adds voice as a natural input/output method rather than a separate feature!**

