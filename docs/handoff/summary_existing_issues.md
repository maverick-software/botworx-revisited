Reviewing the log events and mapping them to the chat function code and monitoring/metrics system. I’ll locate where metrics exports happen, how token budgets are set, and how Pinecone and tool permission checks are wired, then outline concise fixes.
Ran tool

Ran tool
Ran tool
Ran tool

### What the logs are telling you

- [OpenAI] context_length_exceeded (8192 limit, requested 8904)
  - Root causes:
    - Very long preamble in `supabase/functions/chat/processor/handlers.ts` (the “CRITICAL FORMATTING INSTRUCTIONS” block is huge).
    - 25 prior messages included as working memory.
    - Up to 4 context sections with 2000 chars each.
    - Model fallback uses `gpt-4` (8k), so budget is tight.

- [Memory] Pinecone key rejected
  - Expected per README; episodic/semantic memory falls back. Not fatal.

- [FunctionCalling] Only Mailgun tools available
  - Gmail/web-search not authorized for this agent/user. Behavior is correct.

- [Metrics] “Supabase export failed: {}” repeating
  - The monitoring system writes to `system_metrics`, `usage_events`, `system_health`, `system_alerts`. These tables likely don’t exist (or RLS denies writes). Console exporter still prints “[Metrics] Exporting 1 metrics”.

### Targeted fixes

1) Stop the context overflows (no UX change, safer defaults)
- Reduce working memory cap:
  - In `handlers.ts`, default `workingLimit` is 20; set a lower default (e.g., 10) unless `options.context.max_messages` overrides.
- Trim context sections more aggressively:
  - Keep top 1–2 sections and cap each to ~500–800 chars (currently 2000).
- Drastically shorten or gate the formatting preamble:
  - Replace the long rules with a 1–2 line reminder or guard behind an env flag (e.g., `INCLUDE_FORMATTING_GUIDANCE=false`).
- Token-aware retry on overflow:
  - Catch `context_length_exceeded` and retry once after trimming history and removing preamble/context sections.
- Prefer a larger-context model when router is unavailable:
  - Switch fallback from `gpt-4` (8k) to `gpt-4o-mini` (128k) if available in your billing/project.

2) Unblock metrics export (create tables, permissive RLS)
- Create required tables with simple schema and allow service role inserts.

```sql
-- system_metrics
create table if not exists public.system_metrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value double precision not null,
  type text not null,
  labels jsonb,
  timestamp timestamptz not null default now()
);

-- usage_events
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  feature text not null,
  timestamp timestamptz not null default now(),
  user_id uuid,
  agent_id uuid,
  metadata jsonb
);

-- system_health (probed by health check)
create table if not exists public.system_health (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- system_alerts
create table if not exists public.system_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null,
  message text not null,
  context jsonb,
  triggered_at timestamptz not null default now()
);

-- RLS (optional). If you enable RLS, add permissive policies or rely on service role.
alter table public.system_metrics enable row level security;
create policy system_metrics_insert_service on public.system_metrics for insert to authenticated with check (true);

alter table public.usage_events enable row level security;
create policy usage_events_insert_service on public.usage_events for insert to authenticated with check (true);

alter table public.system_alerts enable row level security;
create policy system_alerts_insert_service on public.system_alerts for insert to authenticated with check (true);
```

- Alternative: temporarily disable the Supabase exporter in `MonitoringSystem` if you don’t want these tables yet.

3) Pinecone errors
- Either add a valid Pinecone key (and index) or set memory options to disable episodic lookups for now. Current fallback is safe.

### Minimal implementation checklist

- Context safety
  - Lower `workingLimit` default.
  - Trim context sections (count and size).
  - Shorten/gate preamble.
  - Add “on overflow, retry with trimmed input”.
  - Optional: change fallback model to higher-context.

- Metrics
  - Add tables above (single migration).
  - Confirm inserts succeed; remove exporter only if you choose not to persist metrics.

- Memory
  - Configure Pinecone or toggle episodic off.

Want me to create a migration for the four monitoring tables and add the safe-trim/retry to `handlers.ts` now?