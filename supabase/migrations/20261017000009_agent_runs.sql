-- Audit trail and rate limit for the draft-writing agent. Stores counts only, never the
-- journey, the matches or the drafted text.
create table public.agent_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  status        text not null check (status in ('ok', 'refused', 'invalid', 'limit', 'error')),
  turns         integer not null default 0 check (turns >= 0),
  tool_calls    integer not null default 0 check (tool_calls >= 0),
  drafts        integer not null default 0 check (drafts >= 0),
  rejected      integer not null default 0 check (rejected >= 0),
  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  created_at    timestamptz not null default now()
);
create index agent_runs_user_idx on public.agent_runs (user_id, created_at desc);
alter table public.agent_runs enable row level security;

create policy agent_runs_owner_read on public.agent_runs for select to authenticated
  using (user_id = (select auth.uid()));
create policy agent_runs_owner_insert on public.agent_runs for insert to authenticated
  with check (user_id = (select auth.uid()));
