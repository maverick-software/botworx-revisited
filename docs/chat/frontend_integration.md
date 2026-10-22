### Frontend Integration (React)

### What it is
A React page (`AgentChatPage.tsx`) and supporting UI (ProcessModal) that interact with the Edge Function.

### Purpose
- Provide a modern chat UX with introspection and tool/state awareness

### How it’s integrated
- Sends V1 requests; backend adapts to V2
- Displays AI thinking steps; stores and shows `processing_details`
- Persists assistant messages to `chat_messages`

### How to interact
- Implement message send via `fetch({ url: /functions/v1/chat, headers: Authorization })`
- On response, use `response.message` and optional `processing_details`
- Open `ProcessModal` to display pipeline details

### How to extend
- Add new visualizations to ProcessModal (tools, memory hit details)
- Add tool UIs or inline actions
- Add streaming UI (SSE) to consume streamed tokens

### Troubleshooting
- JSX adjacent errors → ensure single root and proper wrapping
- Messages disappearing → ensure persistence of assistant messages (done in `completeAIProcessingWithResponse`)

### Files & Edge Functions
- `src/pages/AgentChatPage.tsx`
- `src/components/modals/ProcessModal.tsx`
- Edge entry: `supabase/functions/chat/index.ts`
