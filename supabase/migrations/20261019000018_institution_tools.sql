-- Institution tools for the placement cell: an alumni list import with join tracking,
-- college announcements and events, and network figures in college_stats().

-- One imported row per person per college.
create unique index alumni_imports_email_idx on public.alumni_imports (college_id, lower(email)) where email is not null;

-- Announcements and events, written by the placement cell and read by everyone in the college.
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges (id) on delete cascade,
  author_id  uuid not null references public.users (id) on delete cascade,
  kind       text not null default 'announcement' check (kind in ('announcement', 'event')),
  title      text not null check (char_length(title) between 3 and 120),
  body       text not null check (char_length(body) between 1 and 2000),
  event_at   timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'event' or event_at is null)
);
create index announcements_college_idx on public.announcements (college_id, created_at desc);
create index announcements_author_idx on public.announcements (author_id);
alter table public.announcements enable row level security;

create policy announcements_read on public.announcements for select to authenticated
  using (college_id = (select public.my_college()));
create policy announcements_insert on public.announcements for insert to authenticated
  with check (author_id = (select auth.uid()) and college_id = (select public.my_college()) and (select public.my_role()) = 'placement');
create policy announcements_delete on public.announcements for delete to authenticated
  using (author_id = (select auth.uid()));

create or replace function public.guard_announcement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select role from public.users where id = new.author_id) is distinct from 'placement' then
    raise exception 'only the placement cell can post announcements';
  end if;
  if (select count(*) from public.announcements where author_id = new.author_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many announcements today';
  end if;
  return new;
end $$;
revoke execute on function public.guard_announcement() from public, anon, authenticated;
create trigger announcements_guard before insert on public.announcements
  for each row execute function public.guard_announcement();

-- The imported list with a yes or no for "has this person joined". Placement only; no other data leaves.
create or replace function public.alumni_import_status() returns table (
  id uuid, full_name text, batch smallint, branch text, email text, joined boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if public.my_role() is distinct from 'placement' then raise exception 'placement cell only'; end if;
  return query
    select i.id, i.full_name, i.batch, i.branch, i.email,
           (i.email is not null and exists (select 1 from auth.users a where lower(a.email) = lower(i.email))),
           i.created_at
      from public.alumni_imports i
     where i.college_id = public.my_college()
     order by i.created_at desc, i.full_name
     limit 2000;
end $$;
revoke execute on function public.alumni_import_status() from public, anon;
grant execute on function public.alumni_import_status() to authenticated;

-- college_stats() gains a "network" section: opportunities, applications, connections, vouches, messages.
create or replace function public.college_stats() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare cid uuid;
begin
  if public.my_role() is distinct from 'placement' then raise exception 'placement cell only'; end if;
  cid := public.my_college();

  return jsonb_build_object(
    'members', coalesce((select jsonb_object_agg(role, n) from
                 (select role, count(*) n from public.users where college_id = cid group by role) r), '{}'::jsonb),
    'students', (select count(*) from public.users where college_id = cid and role = 'student'),
    'journeys_shared', (select count(distinct s.user_id) from public.snapshots s
                        join public.users u on u.id = s.user_id where u.college_id = cid and u.role = 'student'),
    'students_asked', (select count(distinct a.asker_id) from public.asks a
                       join public.users u on u.id = a.asker_id where u.college_id = cid and u.role = 'student'),
    'students_replied', (select count(distinct a.asker_id) from public.asks a
                         join public.users u on u.id = a.asker_id
                         where u.college_id = cid and u.role = 'student'
                           and (a.status in ('accepted', 'replied') or a.trust_step <> 'question')),
    'asks_total', (select count(*) from public.asks a join public.users u on u.id = a.asker_id where u.college_id = cid),
    'ladder', (select jsonb_build_object(
                 'question', count(*),
                 'call', count(*) filter (where a.trust_step in ('call', 'task', 'referral')),
                 'task', count(*) filter (where a.trust_step in ('task', 'referral')),
                 'referral', count(*) filter (where a.trust_step = 'referral'))
               from public.asks a join public.users u on u.id = a.asker_id where u.college_id = cid),
    'placed', (select count(*) from public.users where college_id = cid and succeeded_at is not null),
    'top_companies', coalesce((select jsonb_agg(jsonb_build_object('company', c, 'count', n) order by n desc, c)
                       from (select success_company c, count(*) n from public.users
                             where college_id = cid and success_company is not null
                             group by success_company having count(*) >= 2
                             order by count(*) desc, success_company limit 8) t), '[]'::jsonb),
    'helps', (select count(*) from public.helps h join public.users u on u.id = h.helper_id where u.college_id = cid),
    'helpers', (select count(distinct h.helper_id) from public.helps h join public.users u on u.id = h.helper_id where u.college_id = cid),
    'help_owed_open', coalesce((select sum(help_owed) from public.users where college_id = cid), 0),
    'network', jsonb_build_object(
      'opportunities_open', (select count(*) from public.opportunities o join public.users u on u.id = o.poster_id where u.college_id = cid and o.status = 'open'),
      'opportunities_total', (select count(*) from public.opportunities o join public.users u on u.id = o.poster_id where u.college_id = cid),
      'applications', (select count(*) from public.opportunity_interests i join public.users u on u.id = i.user_id where u.college_id = cid),
      'connections', (select count(*) from public.connections c join public.users u on u.id = c.requester_id where u.college_id = cid and c.status = 'accepted'),
      'vouches', (select count(*) from public.vouches v join public.users u on u.id = v.student_id where u.college_id = cid),
      'conversations', (select count(*) from public.threads t join public.users u on u.id = t.user_a where u.college_id = cid),
      'messages_7d', (select count(*) from public.messages m join public.users u on u.id = m.sender_id
                      where u.college_id = cid and m.created_at > now() - interval '7 days'),
      'imported', (select count(*) from public.alumni_imports where college_id = cid),
      'imported_joined', (select count(*) from public.alumni_imports i
                          where i.college_id = cid and i.email is not null
                            and exists (select 1 from auth.users a where lower(a.email) = lower(i.email)))
    )
  );
end $$;
revoke execute on function public.college_stats() from public, anon;
grant execute on function public.college_stats() to authenticated;
