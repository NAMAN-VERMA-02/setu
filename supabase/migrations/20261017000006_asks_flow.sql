-- Asks flow: trust-step rules, silent declines, forward-link lookups.
--
-- Fixes an earlier gap: guard_ask ran with the caller's RLS, so its "3 waiting per senior"
-- count could only see the caller's own asks. It now runs as the table owner.

alter table public.asks
  add column forwarded_at timestamptz,
  add column replied_at   timestamptz,
  add column reply_note   text check (char_length(reply_note) <= 500),
  add column work_url     text check (work_url ~ '^https://' and char_length(work_url) <= 500),
  add constraint asks_work_seen_needs_work check (work_seen_at is null or work_url is not null);

-- A senior's "no" lives here, where the asker can never read it. The ask itself stays
-- "pending" for the asker until it expires, so declining costs the senior nothing.
create table public.ask_declines (
  ask_id      uuid primary key references public.asks (id) on delete cascade,
  declined_by uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index ask_declines_by_idx on public.ask_declines (declined_by);
alter table public.ask_declines enable row level security;

create policy ask_declines_senior_read on public.ask_declines for select to authenticated
  using (declined_by = (select auth.uid()));
create policy ask_declines_senior_insert on public.ask_declines for insert to authenticated
  with check (
    declined_by = (select auth.uid())
    and exists (select 1 from public.asks a
                where a.id = ask_id and (select auth.uid()) in (a.target_id, a.via_id))
  );

create or replace function public.guard_ask() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := auth.uid();
  steps     constant text[] := array['question','call','task','referral'];
  is_senior boolean;
  is_asker  boolean;
  a_batch smallint; a_college uuid;
  s_id uuid; s_batch smallint; s_college uuid;
begin
  if tg_op = 'INSERT' then
    s_id := coalesce(new.via_id, new.target_id);
    select batch, college_id into a_batch, a_college from public.users where id = new.asker_id;
    select batch, college_id into s_batch, s_college from public.users where id = s_id;
    if s_batch is null or s_college is distinct from a_college or s_batch >= a_batch then
      raise exception 'not a senior from your college';
    end if;

    if new.via_id is not null then
      if new.target_id is not null then
        raise exception 'a bridge request has no direct target';
      end if;
      if new.target_company is null or not exists (
        select 1 from public.company_counts c
        where c.user_id = new.via_id and lower(c.company) = lower(new.target_company) and c.count >= 2
      ) then
        raise exception 'this senior has no contacts at that company';
      end if;
      if exists (
        select 1 from public.asks
        where asker_id = new.asker_id and via_id is not null
          and status in ('pending','forwarded') and expires_at > now()
          and not exists (select 1 from public.ask_declines d where d.ask_id = asks.id)
      ) then
        raise exception 'one open bridge request per student';
      end if;
    end if;

    if (select count(*) from public.asks a
        where a.status = 'pending' and a.expires_at > now()
          and (a.target_id = s_id or a.via_id = s_id)
          and not exists (select 1 from public.ask_declines d where d.ask_id = a.id)) >= 3 then
      raise exception 'this senior already has 3 waiting requests';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.asker_id is distinct from old.asker_id
     or new.target_id is distinct from old.target_id
     or new.via_id is distinct from old.via_id
     or new.expires_at is distinct from old.expires_at
     or new.message is distinct from old.message
     or new.target_company is distinct from old.target_company then
    raise exception 'ask parties, message and expiry are immutable';
  end if;

  if uid is null then return new; end if;   -- service role and the reply RPC

  if old.expires_at <= now() or old.status in ('cancelled','expired','declined') then
    raise exception 'this request is closed';
  end if;

  is_senior := uid in (old.target_id, old.via_id);
  is_asker  := uid = old.asker_id;
  if not (is_senior or is_asker) then raise exception 'not a party to this request'; end if;

  if new.forward_token_hash is distinct from old.forward_token_hash
     and (old.forward_token_hash is not null or uid is distinct from old.via_id) then
    raise exception 'only the bridging senior can create the forward link, once';
  end if;
  if new.replied_at is distinct from old.replied_at or new.reply_note is distinct from old.reply_note then
    raise exception 'replies come through the forward link';
  end if;

  if is_senior then
    if new.work_url is distinct from old.work_url then
      raise exception 'only the student can submit work';
    end if;
    if new.trust_step is distinct from old.trust_step
       and array_position(steps, new.trust_step) <> array_position(steps, old.trust_step) + 1 then
      raise exception 'trust steps go one at a time';
    end if;
    if new.status is distinct from old.status and new.status not in ('accepted','forwarded') then
      raise exception 'invalid status for a senior';
    end if;
    if new.status = 'forwarded' and new.forward_token_hash is null then
      raise exception 'a forwarded request needs a forward link';
    end if;
  else
    if new.trust_step is distinct from old.trust_step
       or new.work_seen_at is distinct from old.work_seen_at
       or new.forwarded_at is distinct from old.forwarded_at
       or new.forward_token_hash is distinct from old.forward_token_hash then
      raise exception 'only the senior can advance the trust step';
    end if;
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'students can only cancel a request';
    end if;
  end if;
  return new;
end $$;

-- Waiting requests per senior, excluding silent declines. Service role only (used by matching).
create or replace function public.waiting_asks_for(p_ids uuid[])
returns table (user_id uuid, waiting integer)
language sql stable security definer set search_path = public as $$
  select s.uid, count(*)::integer
  from (select id, target_id as uid from public.asks where target_id = any (p_ids)
        union all
        select id, via_id from public.asks where via_id = any (p_ids)) s
  join public.asks a on a.id = s.id
  where a.status = 'pending' and a.expires_at > now()
    and not exists (select 1 from public.ask_declines d where d.ask_id = a.id)
  group by s.uid
$$;
revoke execute on function public.waiting_asks_for(uuid[]) from public, anon, authenticated;
grant  execute on function public.waiting_asks_for(uuid[]) to service_role;

-- Public forward link: look up by the SHA-256 of the token (the token itself is never stored).
-- Intentionally callable without signing in; it returns only what the recipient needs.
create or replace function public.get_forward(p_hash text)
returns table (ask_id uuid, asker_first_name text, goal text, target_company text, message text,
               work_url text, expires_at timestamptz, status text)
language sql stable security definer set search_path = public as $$
  select a.id, split_part(u.full_name, ' ', 1), g.target, a.target_company, a.message,
         a.work_url, a.expires_at, a.status
  from public.asks a
  join public.users u on u.id = a.asker_id
  left join public.goals g on g.user_id = a.asker_id
  where a.forward_token_hash = p_hash and a.expires_at > now() and a.status in ('forwarded','replied')
  limit 1
$$;

-- One-tap reply. Only an unexpired, still-forwarded ask can be answered, once.
create or replace function public.reply_forward(p_hash text, p_note text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.asks
     set status = 'replied', replied_at = now(), reply_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
   where forward_token_hash = p_hash and status = 'forwarded' and expires_at > now();
  return found;
end $$;

revoke execute on function public.get_forward(text), public.reply_forward(text, text) from public;
grant  execute on function public.get_forward(text), public.reply_forward(text, text) to anon, authenticated;

-- guard_ask is a trigger function; nobody should call it through the API.
revoke execute on function public.guard_ask() from public, anon, authenticated;
