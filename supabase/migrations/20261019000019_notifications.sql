-- In-app notifications. Rows are written only by triggers on the events below (never by a client),
-- and each person can read and mark only their own.

alter table public.users add column email_digest boolean not null default true;

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  kind       text not null check (kind in ('connection_request', 'connection_accepted', 'ask', 'interest', 'vouch', 'announcement')),
  title      text not null check (char_length(title) between 1 and 160),
  link       text,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;

create policy notifications_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Internal helper: write one notification (never exposed to clients).
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_link text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, link) values (p_user, p_kind, left(p_title, 160), p_link);
$$;
revoke execute on function public.notify(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.display_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(regexp_replace(full_name, '\s*\(.*?\)\s*', ' ', 'g')), ''), 'Someone') from public.users where id = p_user;
$$;
revoke execute on function public.display_name(uuid) from public, anon, authenticated;

-- A new connection request, and its acceptance.
create or replace function public.notify_connection() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.notify(new.addressee_id, 'connection_request', public.display_name(new.requester_id) || ' wants to connect', '/network');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.notify(new.requester_id, 'connection_accepted', public.display_name(new.addressee_id) || ' accepted your request', '/people/' || new.addressee_id);
  end if;
  return null;
end $$;
revoke execute on function public.notify_connection() from public, anon, authenticated;
create trigger connections_notify after insert or update on public.connections
  for each row execute function public.notify_connection();

-- Someone shows interest in an opportunity you posted.
create or replace function public.notify_interest() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.opportunities;
begin
  select * into o from public.opportunities where id = new.opportunity_id;
  if o.id is not null then
    perform public.notify(o.poster_id, 'interest', public.display_name(new.user_id) || ' is interested in "' || o.title || '"', '/opportunities/mine');
  end if;
  return null;
end $$;
revoke execute on function public.notify_interest() from public, anon, authenticated;
create trigger interests_notify after insert on public.opportunity_interests
  for each row execute function public.notify_interest();

-- A senior vouches for you.
create or replace function public.notify_vouch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(new.student_id, 'vouch', public.display_name(new.voucher_id) || ' vouched for your ' || new.skill, '/people/' || new.student_id);
  return null;
end $$;
revoke execute on function public.notify_vouch() from public, anon, authenticated;
create trigger vouches_notify after insert on public.vouches
  for each row execute function public.notify_vouch();

-- A new ask reaches the person who can answer it. The asker's name is never given for a bridge ask.
create or replace function public.notify_ask() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.via_id is not null then
    perform public.notify(new.via_id, 'ask', 'A student asked you to pass on an introduction', '/requests');
  elsif new.target_id is not null then
    perform public.notify(new.target_id, 'ask', 'A student sent you a request', '/requests');
  end if;
  return null;
end $$;
revoke execute on function public.notify_ask() from public, anon, authenticated;
create trigger asks_notify after insert on public.asks
  for each row execute function public.notify_ask();

-- An announcement or event reaches everyone in the college.
create or replace function public.notify_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, title, link)
  select u.id, 'announcement', left(case when new.kind = 'event' then 'Event: ' else 'Announcement: ' end || new.title, 160), '/announcements'
    from public.users u where u.college_id = new.college_id and u.id <> new.author_id;
  return null;
end $$;
revoke execute on function public.notify_announcement() from public, anon, authenticated;
create trigger announcements_notify after insert on public.announcements
  for each row execute function public.notify_announcement();

-- Header badge: how many are unread.
create or replace function public.notifications_unread() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notifications where user_id = (select auth.uid()) and read_at is null;
$$;
revoke execute on function public.notifications_unread() from public, anon;
grant execute on function public.notifications_unread() to authenticated;

-- Mark some (or all, when no list is given) of my notifications as read.
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.notifications set read_at = now()
   where user_id = (select auth.uid()) and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Weekly email on or off.
create or replace function public.set_email_digest(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.users set email_digest = p_on where id = (select auth.uid());
$$;
revoke execute on function public.set_email_digest(boolean) from public, anon;
grant execute on function public.set_email_digest(boolean) to authenticated;

alter publication supabase_realtime add table public.notifications;
