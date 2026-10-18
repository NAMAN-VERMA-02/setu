-- In-app messaging between people who are connected. One thread per pair, created only through
-- open_thread(), which checks the connection. Messages are readable only by the two members.

create table public.threads (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references public.users (id) on delete cascade,
  user_b          uuid not null references public.users (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  last_preview    text,
  a_read_at       timestamptz not null default now(),
  b_read_at       timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  check (user_a < user_b)
);
create unique index threads_pair_idx on public.threads (user_a, user_b);
create index threads_b_idx on public.threads (user_b);
alter table public.threads enable row level security;

create policy threads_read on public.threads for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads (id) on delete cascade,
  sender_id  uuid not null references public.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_thread_idx on public.messages (thread_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);
alter table public.messages enable row level security;

create policy messages_read on public.messages for select to authenticated
  using (exists (select 1 from public.threads t where t.id = messages.thread_id and (select auth.uid()) in (t.user_a, t.user_b)));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()));

-- Business rules for a new message.
create or replace function public.guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.threads;
begin
  select * into t from public.threads where id = new.thread_id;
  if t.id is null or new.sender_id not in (t.user_a, t.user_b) then raise exception 'not in this conversation'; end if;
  if not exists (select 1 from public.connections c
                 where c.status = 'accepted'
                   and ((c.requester_id = t.user_a and c.addressee_id = t.user_b) or (c.requester_id = t.user_b and c.addressee_id = t.user_a))) then
    raise exception 'you are no longer connected';
  end if;
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many messages, slow down';
  end if;
  return new;
end $$;
revoke execute on function public.guard_message() from public, anon, authenticated;
create trigger messages_guard before insert on public.messages
  for each row execute function public.guard_message();

-- After a message: bump the thread and mark it read for the sender.
create or replace function public.after_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.threads set
    last_message_at = new.created_at,
    last_preview    = left(new.body, 120),
    a_read_at       = case when user_a = new.sender_id then new.created_at else a_read_at end,
    b_read_at       = case when user_b = new.sender_id then new.created_at else b_read_at end
  where id = new.thread_id;
  return new;
end $$;
revoke execute on function public.after_message() from public, anon, authenticated;
create trigger messages_after after insert on public.messages
  for each row execute function public.after_message();

-- Find or create the thread with a connected person.
create or replace function public.open_thread(p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := (select auth.uid()); a uuid; b uuid; tid uuid;
begin
  if me is null or p_other is null or me = p_other then raise exception 'choose someone else'; end if;
  if not exists (select 1 from public.connections c
                 where c.status = 'accepted'
                   and ((c.requester_id = me and c.addressee_id = p_other) or (c.requester_id = p_other and c.addressee_id = me))) then
    raise exception 'connect first';
  end if;
  a := least(me, p_other); b := greatest(me, p_other);
  select id into tid from public.threads where user_a = a and user_b = b;
  if tid is null then
    insert into public.threads (user_a, user_b) values (a, b) returning id into tid;
  end if;
  return tid;
end $$;
revoke execute on function public.open_thread(uuid) from public, anon;
grant execute on function public.open_thread(uuid) to authenticated;

-- Mark everything in a thread as read for the caller.
create or replace function public.mark_thread_read(p_thread uuid) returns void
language sql security definer set search_path = public as $$
  update public.threads set
    a_read_at = case when user_a = (select auth.uid()) then now() else a_read_at end,
    b_read_at = case when user_b = (select auth.uid()) then now() else b_read_at end
  where id = p_thread and (select auth.uid()) in (user_a, user_b);
$$;
revoke execute on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;

-- How many conversations have something I have not read (drives the header badge).
create or replace function public.unread_threads() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.threads t
  where (select auth.uid()) in (t.user_a, t.user_b)
    and exists (
      select 1 from public.messages m
      where m.thread_id = t.id and m.sender_id <> (select auth.uid())
        and m.created_at > case when t.user_a = (select auth.uid()) then t.a_read_at else t.b_read_at end);
$$;
revoke execute on function public.unread_threads() from public, anon;
grant execute on function public.unread_threads() to authenticated;

-- Live updates for the open conversation (row security still applies to Realtime).
alter publication supabase_realtime add table public.messages;
