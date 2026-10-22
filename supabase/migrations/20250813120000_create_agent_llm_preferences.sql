-- Create table for per-agent LLM preferences
create table if not exists agent_llm_preferences (
  agent_id uuid primary key references agents(id) on delete cascade,
  provider text not null default 'openai',
  model text not null default 'gpt-4o-mini',
  params jsonb not null default '{}',
  embedding_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agent_llm_prefs_provider on agent_llm_preferences(provider);

-- Simple updated_at trigger
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_agent_llm_prefs_updated on agent_llm_preferences;
create trigger trg_agent_llm_prefs_updated before update on agent_llm_preferences
for each row execute function set_updated_at();


