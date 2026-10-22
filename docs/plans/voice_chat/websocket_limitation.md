# WebSocket Limitation in Supabase Edge Functions

**Date:** October 16, 2025  
**Issue:** WebSocket connections fail in Supabase Edge Functions

## Problem

Attempted to implement OpenAI's Realtime API using WebSocket proxy through Supabase Edge Functions. Connection immediately fails with:

```
WebSocket connection failed: WebSocket is closed before the connection is established.
```

## Root Cause

**Supabase Edge Functions (powered by Deno Deploy) have limited WebSocket support:**

1. Edge Functions are designed for **HTTP requests with SSE (Server-Sent Events)** streaming
2. WebSocket `upgrade` is supported in Deno, but **not fully supported in Deno Deploy's production environment**
3. Supabase's infrastructure proxies/load balancers may not properly handle WebSocket upgrade requests
4. The platform is optimized for short-lived HTTP requests, not persistent WebSocket connections

## Solution

**Use HTTP + SSE streaming** instead of WebSockets:

### Approach: HTTP-based Realtime Voice

We already have a working `voice-chat-stream` edge function that uses:
- **HTTP POST** for audio input
- **Server-Sent Events (SSE)** for streaming responses
- **OpenAI Chat Completions API** with audio support

This approach:
- ✅ Works reliably on Supabase Edge Functions
- ✅ Supports streaming audio responses
- ✅ Has lower infrastructure requirements
- ✅ Is already deployed and tested
- ❌ Has slightly higher latency (~1-2s vs ~500ms for true WebSocket)
- ❌ Requires sending full audio chunks vs continuous streaming

### Alternative: Self-Hosted WebSocket Server

If true WebSocket support is required:

1. **Deploy separate WebSocket server** (not in Supabase Edge Functions):
   - Use Deno Deploy standalone (not via Supabase)
   - Use Node.js on VPS/cloud provider
   - Use Railway, Render, or similar platforms with WebSocket support

2. **Architecture:**
   ```
   Frontend → WebSocket Server → OpenAI Realtime API
        ↓
   Supabase (for auth & database only)
   ```

3. **Complexity:**
   - Requires separate deployment
   - Additional infrastructure costs
   - More complex authentication flow
   - Need to manage WebSocket server scaling

## Decision

**Proceed with HTTP + SSE approach** for now:

- It's already built and working
- Latency is acceptable for most use cases
- Simpler architecture
- Lower operational complexity
- Can upgrade to WebSocket later if needed

## References

- [Deno Deploy WebSocket Limitations](https://deno.com/deploy/docs/runtime-websocket)
- [Supabase Edge Functions Architecture](https://supabase.com/docs/guides/functions)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

