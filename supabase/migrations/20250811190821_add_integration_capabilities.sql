-- Integration Capabilities catalog
create table if not exists integration_capabilities (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references integrations(id) on delete cascade,
  capability_key text not null,
  display_label text not null,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(integration_id, capability_key)
);

create index if not exists idx_integration_capabilities_integration on integration_capabilities(integration_id);

-- RLS
alter table integration_capabilities enable row level security;
do $$ begin
  create policy "Integration capabilities are readable by everyone"
    on integration_capabilities for select using (true);
exception when duplicate_object then null; end $$;

-- Seed capabilities for existing integrations (best-effort)
insert into integration_capabilities (integration_id, capability_key, display_label, display_order)
select i.id, 'send_email', 'Send Email', 1 from integrations i where lower(i.name) in ('gmail','sendgrid','mailgun') on conflict do nothing;
insert into integration_capabilities (integration_id, capability_key, display_label, display_order)
select i.id, 'validate', 'Validate Email', 2 from integrations i where lower(i.name) = 'mailgun' on conflict do nothing;
insert into integration_capabilities (integration_id, capability_key, display_label, display_order)
select i.id, 'stats', 'Stats', 3 from integrations i where lower(i.name) = 'mailgun' on conflict do nothing;
insert into integration_capabilities (integration_id, capability_key, display_label, display_order)
select i.id, 'suppressions', 'Suppressions', 4 from integrations i where lower(i.name) = 'mailgun' on conflict do nothing;

-- Web search tools
insert into integration_capabilities (integration_id, capability_key, display_label, display_order)
select i.id, 'web_search', 'Web Search', 1 from integrations i where lower(i.name) like '%serper%' or lower(i.name) like '%serpapi%' or lower(i.name) like '%brave%' or lower(i.name) like '%search%' on conflict do nothing;
insert into integration_capabilities (integration_id, capability_key, display_label, display_order)
select i.id, 'news_search', 'News Search', 2 from integrations i where lower(i.name) like '%serper%' or lower(i.name) like '%serpapi%' or lower(i.name) like '%brave%' on conflict do nothing;
insert into integration_capabilities (integration_id, capability_key, display_label, display_order)
select i.id, 'image_search', 'Image Search', 3 from integrations i where lower(i.name) like '%serper%' or lower(i.name) like '%serpapi%' or lower(i.name) like '%brave%' on conflict do nothing;

-- Trigger to maintain updated_at
create or replace function update_integration_capabilities_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_update_integration_capabilities on integration_capabilities;
create trigger trg_update_integration_capabilities before update on integration_capabilities for each row execute function update_integration_capabilities_updated_at();


