-- Opportunities board: jobs, internships, projects, research, referrals, mentorship and events,
-- posted by the people who have them and ranked for the people who fit.

create table public.opportunities (
  id          uuid primary key default gen_random_uuid(),
  poster_id   uuid not null references public.users (id) on delete cascade,
  kind        text not null check (kind in ('job','internship','project','research','referral','mentorship','event')),
  title       text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  company     text check (char_length(company) <= 120),
  skills      text[] not null default '{}' check (cardinality(skills) <= 15),
  mode        text check (mode in ('onsite','remote','hybrid')),
  location    text check (char_length(location) <= 120),
  deadline    date,
  status      text not null default 'open' check (status in ('open','closed')),
  created_at  timestamptz not null default now()
);
create index opportunities_feed_idx on public.opportunities (status, created_at desc);
create index opportunities_poster_idx on public.opportunities (poster_id);
create index opportunities_skills_gin on public.opportunities using gin (skills);
alter table public.opportunities enable row level security;

create table public.opportunity_interests (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  user_id        uuid not null references public.users (id) on delete cascade,
  note           text check (char_length(note) <= 500),
  status         text not null default 'sent' check (status in ('sent','seen','shortlisted')),
  created_at     timestamptz not null default now(),
  unique (opportunity_id, user_id)
);
create index opportunity_interests_user_idx on public.opportunity_interests (user_id);
alter table public.opportunity_interests enable row level security;

-- Same-college people can read open opportunities; posters always see their own.
create policy opportunities_read on public.opportunities for select to authenticated
  using (
    poster_id = (select auth.uid())
    or (status = 'open' and exists (select 1 from public.users u
                                    where u.id = opportunities.poster_id and u.college_id = (select public.my_college())))
  );
create policy opportunities_insert on public.opportunities for insert to authenticated
  with check (poster_id = (select auth.uid()));
create policy opportunities_update on public.opportunities for update to authenticated
  using (poster_id = (select auth.uid())) with check (poster_id = (select auth.uid()));
create policy opportunities_delete on public.opportunities for delete to authenticated
  using (poster_id = (select auth.uid()));

create policy interests_read on public.opportunity_interests for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.opportunities o where o.id = opportunity_id and o.poster_id = (select auth.uid()))
  );
create policy interests_insert on public.opportunity_interests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'sent');
create policy interests_poster_update on public.opportunity_interests for update to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id and o.poster_id = (select auth.uid())))
  with check (exists (select 1 from public.opportunities o where o.id = opportunity_id and o.poster_id = (select auth.uid())));
create policy interests_delete on public.opportunity_interests for delete to authenticated
  using (user_id = (select auth.uid()));

-- Who may post, and how many open at once.
create or replace function public.guard_opportunity() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if tg_op = 'INSERT' then
    select role into r from public.users where id = new.poster_id;
    if r is null or r not in ('alumni','faculty','founder','recruiter','placement') then
      raise exception 'your role cannot post opportunities';
    end if;
    if (select count(*) from public.opportunities where poster_id = new.poster_id and status = 'open') >= 20 then
      raise exception 'at most 20 open opportunities';
    end if;
  elsif new.poster_id is distinct from old.poster_id then
    raise exception 'the poster cannot change';
  end if;
  return new;
end $$;
revoke execute on function public.guard_opportunity() from public, anon, authenticated;
create trigger opportunities_guard before insert or update on public.opportunities
  for each row execute function public.guard_opportunity();

-- Interest rules: same college, open, not your own, and only the poster moves the status.
create or replace function public.guard_interest() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.opportunities; mine uuid; theirs uuid;
begin
  if tg_op = 'INSERT' then
    select * into o from public.opportunities where id = new.opportunity_id;
    if o.id is null or o.status <> 'open' or (o.deadline is not null and o.deadline < current_date) then
      raise exception 'this opportunity is closed';
    end if;
    if o.poster_id = new.user_id then raise exception 'you cannot apply to your own opportunity'; end if;
    select college_id into mine from public.users where id = new.user_id;
    select college_id into theirs from public.users where id = o.poster_id;
    if mine is distinct from theirs then raise exception 'not from your college'; end if;
  else
    if new.opportunity_id is distinct from old.opportunity_id or new.user_id is distinct from old.user_id
       or new.note is distinct from old.note then
      raise exception 'only the status can change';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_interest() from public, anon, authenticated;
create trigger interests_guard before insert or update on public.opportunity_interests
  for each row execute function public.guard_interest();
