-- Rich profiles for every group (expertise, what people are open to) and stated intents
-- ("who I am looking for" / "what I can offer"). Visibility is the same as before: people see
-- profiles from their own college only.

alter table public.users
  add column headline        text  check (char_length(headline) <= 140),
  add column bio             text  check (char_length(bio) <= 800),
  add column current_company text  check (char_length(current_company) <= 120),
  add column current_title   text  check (char_length(current_title) <= 120),
  add column location        text  check (char_length(location) <= 120),
  add column expertise       text[] not null default '{}'
    check (cardinality(expertise) <= 20),
  add column open_to         text[] not null default '{}'
    check (cardinality(open_to) <= 8
           and open_to <@ array['mentoring','hiring','referrals','projects','collaborating','speaking','advice']),
  -- role specific extras (founder stage and problems, faculty lab, recruiter hiring focus)
  add column details         jsonb not null default '{}'::jsonb
    check (pg_column_size(details) < 4000);

create index users_expertise_gin on public.users using gin (expertise);

create table public.intents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  kind       text not null check (kind in ('seek', 'offer')),
  category   text not null check (category in ('career','mentoring','referral','project','research','hiring','learning','other')),
  statement  text not null check (char_length(statement) between 3 and 200),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index intents_user_idx on public.intents (user_id);
create index intents_fts_idx on public.intents using gin (to_tsvector('simple', statement));
alter table public.intents enable row level security;

-- Anyone in the same college can read active intents; owners manage their own.
create policy intents_read on public.intents for select to authenticated
  using (
    user_id = (select auth.uid())
    or (active and exists (select 1 from public.users u
                           where u.id = intents.user_id and u.college_id = (select public.my_college())))
  );
create policy intents_owner_insert on public.intents for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy intents_owner_update on public.intents for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy intents_owner_delete on public.intents for delete to authenticated
  using (user_id = (select auth.uid()));

-- At most 8 active intents per person, so profiles stay readable and search stays honest.
create or replace function public.guard_intent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.active and (select count(*) from public.intents
                     where user_id = new.user_id and active and id is distinct from new.id) >= 8 then
    raise exception 'at most 8 active intents';
  end if;
  return new;
end $$;
revoke execute on function public.guard_intent() from public, anon, authenticated;
create trigger intents_guard before insert or update on public.intents
  for each row execute function public.guard_intent();
