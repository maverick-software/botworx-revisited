# Voice Chat Feature Documentation

This directory contains documentation for the voice chat feature implementation in Agentopia.

---

## Quick Links

- **[Simplified Approach](./simplified_approach.md)** - Architecture overview and rationale
- **[Phase 1 Complete](./phase1_complete.md)** - Voice input (STT) implementation
- **[Phase 2 Complete](./phase2_complete.md)** - Voice output (TTS) implementation
- **[Deployment Complete](./deployment_complete.md)** - Deployment summary
- **[Research](./research.md)** - Initial research on OpenAI Realtime Voice API

---

## Current Status

### ✅ Phase 1: Voice Input (Audio Mode) - COMPLETE
Voice input is fully functional! Users can:
- Click microphone button in chat input
- Record voice message with visual feedback
- Get automatic transcription via Whisper API
- Edit transcribed text before sending
- Send message through normal chat flow

**No audio files are stored** - everything is converted to text immediately.

### ✅ Phase 2: Text-to-Speech - COMPLETE
Voice output is fully functional! Users can:
- Click speaker icon on any assistant message
- Hear the response as audio via OpenAI TTS
- Stop playback anytime
- Choose from 6 different voices (configurable)
- Adjust playback speed (0.25x to 4.0x)

**No audio files are stored** - audio is generated on-demand and cleaned up immediately.

### 🔄 Phase 3: Voice Chat Mode (Optional) - NOT STARTED
Would add continuous voice conversation mode with auto-submit and auto-play features.

---

## Architecture Overview

### Voice Input (Phase 1)
```
User speaks → WebRTC capture → voice-transcribe edge function → Whisper API
→ Text transcription → Chat input field → User edits (optional)
→ Submit → Existing chat system → Text response
```

### Voice Output (Phase 2)
```
Assistant responds → User clicks speaker icon → voice-synthesize edge function
→ OpenAI TTS API → MP3 audio → Browser Audio element
→ Playback (no storage) → Auto cleanup
```

**Key Points:**
- Text-only storage (no audio files)
- Reuses 100% of existing chat infrastructure
- Backend processing keeps API keys secure
- Progressive enhancement (optional features)
- Bidirectional voice interaction

---

## Files Structure

```
src/
├── components/voice/
│   ├── VoiceInputButton.tsx       # Microphone button (input)
│   ├── MessageAudioButton.tsx     # Speaker button (output)
│   └── index.ts
├── hooks/voice/
│   ├── useVoiceRecorder.ts        # Audio recording & transcription
│   ├── useVoicePlayback.ts        # Audio playback & TTS
│   └── index.ts

supabase/functions/
├── voice-transcribe/
│   └── index.ts                    # Whisper API (STT)
└── voice-synthesize/
    └── index.ts                    # OpenAI TTS API

docs/plans/voice_chat/
├── README.md                       # This file
├── simplified_approach.md          # Architecture decisions
├── phase1_complete.md              # Implementation details
└── research.md                     # Initial research notes
```

---

## Quick Start

### For Developers

1. **Configure OpenAI API Key**:
   - Navigate to **Admin > System API Keys** in Agentopia
   - Add/verify OpenAI API key (encrypted in Supabase Vault)
   - No manual environment variables needed!

2. **Deploy Edge Function** (already done!):
   ```powershell
   supabase functions deploy voice-transcribe
   ```

3. **Test Locally**:
   - Start Supabase: `supabase start`
   - Start frontend: `npm run dev`
   - Click microphone in chat input
   - Grant mic permissions
   - Speak and test

### For Users

**Voice Input:**
1. Click the microphone icon in the chat input (when field is empty)
2. Grant microphone permission (browser will prompt first time)
3. Speak your message
4. Click stop when done
5. Wait for transcription (~2-5 seconds)
6. Edit text if needed
7. Send message normally

**Voice Output:**
1. Receive an assistant response
2. Hover over the message
3. Click the speaker icon (next to copy button)
4. Audio plays automatically
5. Click stop to end playback (optional)

---

## Cost Estimation

### Phase 1 + Phase 2 Combined
- **Whisper API (STT)**: $0.006/minute = ~$30/month
- **TTS API**: $15/1M chars = ~$60/month
- **Total**: ~$90/month for 1000 active users
- **Savings vs Audio Storage**: 90-94% cheaper

---

## Browser Support

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (macOS/iOS)
- ❌ Internet Explorer (not supported)

---

## Future Enhancements

If desired, we can add:
- 🎵 Text-to-Speech for responses
- 🔄 Continuous voice chat mode
- 🌍 Language selection
- 🎙️ Voice selection for TTS
- ⚡ Keyboard shortcuts
- 🎯 Voice commands

---

## Support

For questions or issues:
1. Check [Phase 1 Complete](./phase1_complete.md) for detailed docs
2. Review [Simplified Approach](./simplified_approach.md) for architecture
3. See testing checklist in Phase 1 Complete document
4. Check Supabase edge function logs for backend errors
5. Check browser console for frontend errors

---

**Last Updated**: October 13, 2025  
**Status**: Phase 1 + Phase 2 Complete - Production Ready ✅

