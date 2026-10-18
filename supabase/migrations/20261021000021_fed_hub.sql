-- Setu Hub (round 2): the federated, pseudonymous layer. Everything here is safe to show on a projector:
-- no names, emails, phones, CGPA or message text. Names stay on each college's own node.
-- All writes go through server routes using the service role; the public can only read.

create table public.fed_nodes (
  id text primary key,
  name text not null,
  city text,
  base_url text not null,
  mcp_url text not null,
  status text not null default 'unknown' check (status in ('online', 'offline', 'revoked', 'unknown')),
  people_count int default 0,
  latency_ms int,
  last_seen timestamptz
);

create table public.fed_directory (
  pid text primary key,
  node_id text not null references public.fed_nodes (id),
  story_key text,
  role text not null check (role in ('student', 'alum', 'faculty', 'placement', 'professional')),
  branch_code text,
  grad_year smallint,
  public_title text,
  public_company text,
  open_to_intros boolean not null default true,
  on_leaderboard boolean not null default true,
  created_at timestamptz default now()
);
create index fed_directory_node_idx on public.fed_directory (node_id);
create index fed_directory_company_idx on public.fed_directory (lower(public_company));

create table public.fed_edges (
  a text not null references public.fed_directory (pid) on delete cascade,
  b text not null references public.fed_directory (pid) on delete cascade,
  prior real not null check (prior > 0 and prior < 1),
  yes_count int not null default 0,
  no_count int not null default 0,
  primary key (a, b)
);
create index fed_edges_b_idx on public.fed_edges (b);

create view public.fed_graph with (security_invoker = on) as
  select a, b, prior, yes_count, no_count,
         ((yes_count + prior * 4) / (yes_count + no_count + 4))::real as p
  from public.fed_edges;

-- intros and hops: no free text here; the ask and notes live on the requester's node
create table public.fed_intros (
  id uuid primary key default gen_random_uuid(),
  requester text not null references public.fed_directory (pid),
  target text not null references public.fed_directory (pid),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'needs_reroute', 'delivered', 'hired', 'failed', 'cancelled')),
  trust_step text not null default 'question' check (trust_step in ('question', 'call', 'referral')),
  response text check (response in ('question', 'call', 'referral')),
  success_prob real,
  shortest_prob real,
  work_seen boolean default false,
  is_history boolean default false,
  created_at timestamptz default now(),
  completed_at timestamptz
);
create index fed_intros_requester_idx on public.fed_intros (requester);
create index fed_intros_target_idx on public.fed_intros (target);

create table public.fed_hops (
  id uuid primary key default gen_random_uuid(),
  intro_id uuid not null references public.fed_intros (id) on delete cascade,
  idx smallint not null,
  from_pid text not null,
  to_pid text not null,
  status text not null check (status in ('waiting', 'sent', 'accepted', 'declined', 'cancelled')),
  is_target boolean not null default false,
  sent_at timestamptz,
  responded_at timestamptz
);
create index fed_hops_intro_idx on public.fed_hops (intro_id, idx);
create index fed_hops_to_idx on public.fed_hops (to_pid, status);

create table public.fed_ledger (
  id bigserial primary key,
  pid text not null references public.fed_directory (pid) on delete cascade,
  points int not null default 0,
  karz int not null default 0,
  reason text not null,
  intro_id uuid,
  created_at timestamptz default now()
);
create index fed_ledger_pid_idx on public.fed_ledger (pid);

create view public.fed_leaderboard with (security_invoker = on) as
  select d.pid, d.node_id, d.role, d.grad_year,
         coalesce(sum(l.points), 0)::int as points,
         coalesce(sum(l.karz), 0)::int as karz,
         (coalesce(sum(l.points), 0) - coalesce(sum(l.karz), 0))::int as score
  from public.fed_directory d
  left join public.fed_ledger l on l.pid = d.pid
  where d.role <> 'placement'
  group by d.pid;

create table public.fed_events (
  id bigserial primary key,
  kind text not null,
  text text not null, -- never contains names; checked by a test and by the writers
  node_id text,
  intro_id uuid,
  created_at timestamptz default now()
);
create index fed_events_created_idx on public.fed_events (created_at desc);

create table public.fed_audit (
  id bigserial primary key,
  ts timestamptz default now(),
  node_id text,
  call text not null,
  identifying_fields int not null default 0,
  ms int,
  note text
);
create index fed_audit_ts_idx on public.fed_audit (ts desc);

create table public.fed_vouches (
  from_pid text not null,
  to_pid text not null,
  skill text not null,
  created_at timestamptz default now(),
  primary key (from_pid, to_pid, skill)
);

create table public.fed_payforward (
  id uuid primary key default gen_random_uuid(),
  helper_pid text,
  junior_pid text,
  intro_id uuid,
  status text default 'open' check (status in ('open', 'answered')),
  created_at timestamptz default now()
);

create table public.fed_opportunities (
  id uuid primary key default gen_random_uuid(),
  poster_pid text references public.fed_directory (pid),
  title text,
  company text,
  kind text check (kind in ('job', 'internship', 'project', 'referral')),
  skills text[],
  blurb text,
  created_at timestamptz default now()
);

-- Row security: everything is readable (it is all non-identifying), nothing is writable by clients.
do $$
declare t text;
begin
  foreach t in array array[
    'fed_nodes', 'fed_directory', 'fed_edges', 'fed_intros', 'fed_hops', 'fed_ledger',
    'fed_events', 'fed_audit', 'fed_vouches', 'fed_payforward', 'fed_opportunities'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "fed read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;
grant select on public.fed_graph, public.fed_leaderboard to anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

-- ---------------------------------------------------------------------------------------------
-- RPCs. Only the service role can call them.
-- ---------------------------------------------------------------------------------------------

create function public.fed_event(p_kind text, p_text text, p_node text, p_intro uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.fed_events (kind, text, node_id, intro_id) values (p_kind, p_text, p_node, p_intro);
$$;

-- p_path = [requester, ..., target], at most 4 edges
create function public.fed_create_intro(
  p_requester text, p_target text, p_path text[], p_prob real, p_shortest real, p_trust text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_intro uuid;
  v_len int := coalesce(array_length(p_path, 1), 0);
  v_open int;
  v_req public.fed_directory;
  v_tgt public.fed_directory;
  i int;
begin
  if v_len < 2 or v_len > 5 then raise exception 'bad_path'; end if;
  if p_path[1] <> p_requester or p_path[v_len] <> p_target then raise exception 'bad_path'; end if;
  select count(*) into v_open from public.fed_intros
    where requester = p_requester and status in ('in_progress', 'needs_reroute') and not is_history;
  if v_open >= 3 then raise exception 'too_many_open_intros'; end if;
  select * into v_req from public.fed_directory where pid = p_requester;
  select * into v_tgt from public.fed_directory where pid = p_target;
  if v_req.pid is null or v_tgt.pid is null then raise exception 'unknown_person'; end if;

  insert into public.fed_intros (requester, target, trust_step, success_prob, shortest_prob)
    values (p_requester, p_target, coalesce(p_trust, 'question'), p_prob, p_shortest)
    returning id into v_intro;

  for i in 1 .. v_len - 1 loop
    insert into public.fed_hops (intro_id, idx, from_pid, to_pid, status, is_target, sent_at)
      values (v_intro, i, p_path[i], p_path[i + 1],
              case when i = 1 then 'sent' else 'waiting' end,
              i = v_len - 1,
              case when i = 1 then now() end);
  end loop;

  insert into public.fed_ledger (pid, karz, reason, intro_id) values (p_requester, 10, 'asked', v_intro);
  perform public.fed_event('intro',
    format('A %s %s asked for an intro to %s at %s', upper(v_req.node_id), v_req.role,
           coalesce(v_tgt.public_title, 'a professional'), coalesce(v_tgt.public_company, 'a company')),
    v_req.node_id, v_intro);
  return v_intro;
end $$;

create function public.fed_respond_hop(p_hop uuid, p_accept boolean, p_response text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h public.fed_hops;
  v_intro public.fed_intros;
  v_next public.fed_hops;
  v_pts int;
  v_resp text := coalesce(p_response, 'question');
  v_node text;
begin
  select * into h from public.fed_hops where id = p_hop for update;
  if h.id is null then raise exception 'unknown_hop'; end if;
  if h.status <> 'sent' then
    return jsonb_build_object('ok', false, 'idempotent', true, 'status', h.status);
  end if;
  select * into v_intro from public.fed_intros where id = h.intro_id for update;
  select node_id into v_node from public.fed_directory where pid = h.to_pid;

  if p_accept then
    update public.fed_hops set status = 'accepted', responded_at = now() where id = h.id;
    if h.is_target then
      v_pts := case v_resp when 'referral' then 50 when 'call' then 25 else 10 end;
    else
      v_pts := 10;
    end if;
    insert into public.fed_ledger (pid, points, reason, intro_id)
      values (h.to_pid, v_pts, case when h.is_target then 'target_' || v_resp else 'hop_yes' end, h.intro_id);
    update public.fed_edges set yes_count = yes_count + 1
      where (a = h.from_pid and b = h.to_pid) or (a = h.to_pid and b = h.from_pid);

    select * into v_next from public.fed_hops
      where intro_id = h.intro_id and idx > h.idx and status = 'waiting' order by idx limit 1;
    if v_next.id is not null then
      update public.fed_hops set status = 'sent', sent_at = now() where id = v_next.id;
      perform public.fed_event('hop_yes', 'Someone on the path said yes and passed it on', v_node, h.intro_id);
      return jsonb_build_object('ok', true, 'accepted_pid', h.to_pid, 'next_hop', v_next.id, 'delivered', false);
    end if;
    update public.fed_intros
      set status = 'delivered', response = v_resp, completed_at = now()
      where id = h.intro_id;
    perform public.fed_event('delivered', format('The intro was delivered (%s)', v_resp), v_node, h.intro_id);
    return jsonb_build_object('ok', true, 'accepted_pid', h.to_pid, 'next_hop', null, 'delivered', true, 'response', v_resp);
  end if;

  update public.fed_hops set status = 'declined', responded_at = now() where id = h.id;
  update public.fed_edges set no_count = no_count + 1
    where (a = h.from_pid and b = h.to_pid) or (a = h.to_pid and b = h.from_pid);
  update public.fed_hops set status = 'cancelled'
    where intro_id = h.intro_id and idx > h.idx and status in ('waiting', 'sent');
  update public.fed_intros set status = 'needs_reroute' where id = h.intro_id;
  perform public.fed_event('hop_no',
    'Someone on the path couldn''t help. Setu is finding another route.', v_node, h.intro_id);
  return jsonb_build_object('ok', true, 'declined_pid', h.to_pid, 'from_pid', h.from_pid, 'reroute', true);
end $$;

-- p_tail starts at the last accepted person (or the requester) and ends at the target; null = no route
create function public.fed_reroute(p_intro uuid, p_tail text[], p_prob real)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_len int := coalesce(array_length(p_tail, 1), 0);
  v_base int;
  v_node text;
  i int;
begin
  select coalesce(max(idx), 0) into v_base from public.fed_hops where intro_id = p_intro;
  select d.node_id into v_node from public.fed_intros n join public.fed_directory d on d.pid = n.requester where n.id = p_intro;
  if v_len < 2 then
    update public.fed_intros set status = 'failed', completed_at = now() where id = p_intro;
    perform public.fed_event('failed', 'No other route was found for this intro', v_node, p_intro);
    return jsonb_build_object('ok', true, 'failed', true);
  end if;
  for i in 1 .. v_len - 1 loop
    insert into public.fed_hops (intro_id, idx, from_pid, to_pid, status, is_target, sent_at)
      values (p_intro, v_base + i, p_tail[i], p_tail[i + 1],
              case when i = 1 then 'sent' else 'waiting' end,
              i = v_len - 1,
              case when i = 1 then now() end);
  end loop;
  update public.fed_intros set status = 'in_progress', success_prob = p_prob where id = p_intro;
  perform public.fed_event('reroute', 'Setu found another route.', v_node, p_intro);
  return jsonb_build_object('ok', true, 'failed', false);
end $$;

create function public.fed_mark_hired(p_intro uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  v_pids text[];
  v_node text;
begin
  perform 1 from public.fed_intros where id = p_intro and status = 'delivered' for update;
  if not found then raise exception 'not_delivered'; end if;
  select array_agg(distinct to_pid) into v_pids from public.fed_hops where intro_id = p_intro and status = 'accepted';
  insert into public.fed_ledger (pid, points, reason, intro_id)
    select unnest(v_pids), 100, 'hired', p_intro;
  update public.fed_intros set status = 'hired', completed_at = now() where id = p_intro;
  select d.node_id into v_node from public.fed_intros n join public.fed_directory d on d.pid = n.requester where n.id = p_intro;
  perform public.fed_event('hired', 'Someone got the offer. Everyone on the chain earned +100.', v_node, p_intro);
  return v_pids;
end $$;

revoke all on function public.fed_event(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.fed_create_intro(text, text, text[], real, real, text) from public, anon, authenticated;
revoke all on function public.fed_respond_hop(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.fed_reroute(uuid, text[], real) from public, anon, authenticated;
revoke all on function public.fed_mark_hired(uuid) from public, anon, authenticated;
grant execute on function public.fed_event(text, text, text, uuid) to service_role;
grant execute on function public.fed_create_intro(text, text, text[], real, real, text) to service_role;
grant execute on function public.fed_respond_hop(uuid, boolean, text) to service_role;
grant execute on function public.fed_reroute(uuid, text[], real) to service_role;
grant execute on function public.fed_mark_hired(uuid) to service_role;

alter publication supabase_realtime add table
  public.fed_events, public.fed_hops, public.fed_intros, public.fed_ledger,
  public.fed_nodes, public.fed_directory, public.fed_audit, public.fed_payforward;
alter table public.fed_hops replica identity full;
alter table public.fed_intros replica identity full;
alter table public.fed_nodes replica identity full;
