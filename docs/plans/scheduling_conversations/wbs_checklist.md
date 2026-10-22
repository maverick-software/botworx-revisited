## Scheduling + Conversations WBS Checklist

### 1. Discovery and Design
- [ ] Inventory DB: verify `agent_tasks`, `agent_task_executions`, `chat_messages_v2`, `conversation_sessions` (status, RLS, triggers)
- [ ] Confirm v2 message shape and required fields for scheduled posts
- [ ] Define “act-as user” secure flow for chat edge function (service role header gate)
- [ ] Decide conversation threading rules for tasks (reuse vs. create new)

### 2. Schema Updates
- [ ] Add `conversation_id` to `agent_tasks`
- [ ] Add `conversation_id` to `agent_task_executions`
- [ ] Add optional `title` to `conversation_sessions` for UI naming
- [ ] Indexes on new columns

### 3. Chat Edge Function
- [ ] Accept service-role calls with header guard (e.g., `X-Agentopia-Service: task-executor`)
- [ ] Support `options.auth.token` or service role auth to set user context
- [ ] Validate `context.agent_id` and `context.user_id` for task posts

### 4. Task Executor
- [ ] Insert v2 user message into `chat_messages_v2` (role user; metadata `{ source:'scheduler', task_id, trigger_type }`)
- [ ] Create/attach `conversation_id` per task rules; set `session_id`
- [ ] Invoke chat function to generate assistant reply; capture outcome
- [ ] Update `agent_task_executions` with `conversation_id`, output, error, duration
- [ ] Update `agent_tasks` statistics and `next_run_at`

### 5. Frontend UI
- [ ] Conversations panel on `AgentChatPage` listing conversations for current agent+user
- [ ] New Conversation, Rename, Archive actions (store in `conversation_sessions.title`)
- [ ] Switch conversation updates localStorage conversation/session IDs
- [ ] Message renderer badge for `metadata.source === 'scheduler'`

### 6. Permissions & Security
- [ ] RLS review: ensure service role has needed rights; users see only their own messages/conversations
- [ ] Header-based guard prevents arbitrary act-as

### 7. Docs & DX
- [ ] Update README (Conversations + Scheduling)
- [ ] Update docs/chat/api.md for service-role act-as flow
- [ ] Add runbook: creating tasks that target a conversation vs. new

### 8. Testing
- [ ] Unit tests for task-executor conversation logic
- [ ] Manual E2E: create task (existing conversation), verify messages show and assistant replies
- [ ] Manual E2E: create task (new conversation), verify thread appears and runs append


