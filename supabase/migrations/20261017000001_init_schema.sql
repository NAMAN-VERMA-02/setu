-- SETU initial schema. RLS is enabled on every table.
-- Server-only writes (helps, forward-link redemption) go through the service role,
-- which bypasses RLS; there are deliberately no client policies for those.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.colleges (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  tier         smallint not null check (tier between 1 and 3),
  email_domain text not null unique,
  created_at   timestamptz not null default now()
);

create table public.users (
  id                     uuid primary key references auth.users (id) on delete cascade,
  full_name              text not null check (char_length(full_name) between 1 and 120),
  role                   text not null check (role in ('student','alumni','faculty','founder','recruiter','placement')),
  college_id             uuid not null references public.colleges (id),
  branch                 text not null check (char_length(branch) <= 80),
  batch                  smallint not null check (batch between 1990 and 2100),
  is_18_plus             boolean not null check (is_18_plus),
  college_email_verified boolean not null default false,
  help_owed              smallint not null default 0 check (help_owed >= 0),
  last_active_at         timestamptz not null default now(),
  created_at             timestamptz not null default now()
);
create index users_college_idx on public.users (college_id, role);

-- One row per person per semester. Marks are stored as ranges only.
create table public.snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  semester      smallint not null check (semester between 1 and 12),
  cgpa_range    text check (cgpa_range ~ '^[0-9](\.[0-9])?-[0-9]+(\.[0-9])?$'),
  backlog_count smallint not null default 0 check (backlog_count between 0 and 50),
  tenth_range   text check (tenth_range ~ '^[0-9]{1,3}-[0-9]{1,3}$'),
  twelfth_range text check (twelfth_range ~ '^[0-9]{1,3}-[0-9]{1,3}$'),
  skills        text[] not null default '{}' check (cardinality(skills) <= 40),
  status        text check (char_length(status) <= 200),
  decision      text check (decision in ('gate','job','startup','higher_studies','other')),
  -- per-field opt-in: a range is visible to others only if its flag is true
  show_cgpa     boolean not null default false,
  show_tenth    boolean not null default false,
  show_twelfth  boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, semester)
);
create index snapshots_semester_idx on public.snapshots (semester);

create table public.goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  target     text not null check (char_length(target) between 1 and 200),
  company    text check (char_length(company) <= 120),
  created_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id);

-- Counts only, never names. A count below 2 could identify one contact.
create table public.company_counts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  company    text not null check (char_length(company) between 1 and 120),
  count      integer not null check (count >= 2),
  created_at timestamptz not null default now(),
  unique (user_id, company)
);

create table public.asks (
  id                 uuid primary key default gen_random_uuid(),
  asker_id           uuid not null references public.users (id) on delete cascade,
  target_id          uuid references public.users (id) on delete set null,
  via_id             uuid references public.users (id) on delete set null,  -- bridging senior (max 2 hops)
  target_company     text check (char_length(target_company) <= 120),
  message            text not null check (char_length(message) between 1 and 2000),
  trust_step         text not null default 'question' check (trust_step in ('question','call','task','referral')),
  status             text not null default 'pending' check (status in ('pending','forwarded','replied','accepted','declined','expired','cancelled')),
  work_seen_at       timestamptz,
  forward_token_hash text unique,   -- sha256 of the public link token; raw token is never stored
  expires_at         timestamptz not null default (now() + interval '7 days'),
  created_at         timestamptz not null default now(),
  check (target_id is not null or via_id is not null),
  check (asker_id <> target_id and asker_id <> via_id),
  -- referral unlocks only after the senior has seen the student's work
  check (trust_step <> 'referral' or work_seen_at is not null)
);
create index asks_asker_idx  on public.asks (asker_id, status);
create index asks_target_idx on public.asks (target_id, status);
create index asks_via_idx    on public.asks (via_id, status);

create table public.helps (
  id         uuid primary key default gen_random_uuid(),
  helper_id  uuid not null references public.users (id) on delete cascade,
  helped_id  uuid not null references public.users (id) on delete cascade,
  ask_id     uuid references public.asks (id) on delete set null,
  created_at timestamptz not null default now(),
  check (helper_id <> helped_id)
);
create index helps_helper_idx on public.helps (helper_id);
create index helps_helped_idx on public.helps (helped_id);

create table public.alumni_imports (
  id          uuid primary key default gen_random_uuid(),
  college_id  uuid not null references public.colleges (id) on delete cascade,
  uploaded_by uuid not null references public.users (id),
  full_name   text not null,
  batch       smallint not null,
  branch      text not null,
  email       text,
  created_at  timestamptz not null default now()
);
create index alumni_imports_college_idx on public.alumni_imports (college_id);

-- ---------------------------------------------------------------- helpers

create or replace function public.my_college() returns uuid
language sql stable security definer set search_path = public as $$
  select college_id from public.users where id = auth.uid()
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid()
$$;

-- ---------------------------------------------------------------- guard triggers

-- Users cannot promote themselves or self-verify.
create or replace function public.guard_user_update() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then  -- service role / migrations (null uid) are exempt
    if new.role is distinct from old.role
       or new.college_id is distinct from old.college_id
       or new.college_email_verified is distinct from old.college_email_verified
       or new.help_owed is distinct from old.help_owed then
      raise exception 'protected user columns cannot be changed';
    end if;
  end if;
  return new;
end $$;
create trigger users_guard before update on public.users
  for each row execute function public.guard_user_update();

-- Ask rules: one open bridge request per student, max 3 waiting per senior,
-- and the parties of an ask never change.
create or replace function public.guard_ask() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.via_id is not null and exists (
      select 1 from public.asks
      where asker_id = new.asker_id and via_id is not null
        and status in ('pending','forwarded') and expires_at > now()
    ) then
      raise exception 'one open bridge request per student';
    end if;
    if (select count(*) from public.asks
        where status = 'pending' and expires_at > now()
          and (target_id = coalesce(new.via_id, new.target_id)
               or via_id = coalesce(new.via_id, new.target_id))) >= 3 then
      raise exception 'this senior already has 3 waiting requests';
    end if;
  else
    if new.asker_id is distinct from old.asker_id
       or new.target_id is distinct from old.target_id
       or new.via_id is distinct from old.via_id
       or new.forward_token_hash is distinct from old.forward_token_hash
       or new.expires_at is distinct from old.expires_at then
      raise exception 'ask parties, token and expiry are immutable';
    end if;
    -- only the senior (target or bridging senior) can mark work seen or advance trust
    if auth.uid() is not null
       and auth.uid() is distinct from old.target_id
       and auth.uid() is distinct from old.via_id
       and (new.work_seen_at is distinct from old.work_seen_at
            or new.trust_step is distinct from old.trust_step) then
      raise exception 'only the senior can advance the trust step';
    end if;
  end if;
  return new;
end $$;
create trigger asks_guard before insert or update on public.asks
  for each row execute function public.guard_ask();

-- ---------------------------------------------------------------- views

-- What other people may see of a snapshot: same college only, and a mark range
-- only when its owner switched it on. Runs with owner rights, so scoping is explicit.
create view public.snapshots_visible with (security_invoker = false) as
select s.id, s.user_id, s.semester,
       case when s.user_id = auth.uid() or s.show_cgpa    then s.cgpa_range    end as cgpa_range,
       case when s.user_id = auth.uid() or s.show_tenth   then s.tenth_range   end as tenth_range,
       case when s.user_id = auth.uid() or s.show_twelfth then s.twelfth_range end as twelfth_range,
       s.backlog_count, s.skills, s.status, s.decision
from public.snapshots s
join public.users u on u.id = s.user_id
where u.college_id = public.my_college();
revoke all on public.snapshots_visible from anon;
grant select on public.snapshots_visible to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.colleges        enable row level security;
alter table public.users           enable row level security;
alter table public.snapshots       enable row level security;
alter table public.goals           enable row level security;
alter table public.company_counts  enable row level security;
alter table public.asks            enable row level security;
alter table public.helps           enable row level security;
alter table public.alumni_imports  enable row level security;

-- colleges: readable by signed-in users (needed at signup); written by service role only
create policy colleges_read on public.colleges for select to authenticated using (true);

-- users: same-college directory; self-insert (unverified, never placement); self-update
create policy users_read on public.users for select to authenticated
  using (id = auth.uid() or college_id = public.my_college());
create policy users_insert_self on public.users for insert to authenticated
  with check (id = auth.uid() and role <> 'placement' and college_email_verified = false and help_owed = 0);
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- snapshots: raw rows are owner-only; others read through snapshots_visible
create policy snapshots_owner_all on public.snapshots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- goals: private to the owner
create policy goals_owner_all on public.goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- company_counts: owner manages; same-college users see counts (never names, none are stored)
create policy company_counts_owner_all on public.company_counts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy company_counts_college_read on public.company_counts for select to authenticated
  using (exists (select 1 from public.users u
                 where u.id = company_counts.user_id and u.college_id = public.my_college()));

-- asks: visible to the three parties only
create policy asks_parties_read on public.asks for select to authenticated
  using (auth.uid() in (asker_id, target_id, via_id));
create policy asks_asker_insert on public.asks for insert to authenticated
  with check (asker_id = auth.uid() and trust_step = 'question' and status = 'pending'
              and work_seen_at is null and forward_token_hash is null);
create policy asks_parties_update on public.asks for update to authenticated
  using (auth.uid() in (asker_id, target_id, via_id))
  with check (auth.uid() in (asker_id, target_id, via_id));
-- Trust-step and work_seen_at changes are restricted to the senior by guard_ask.

-- helps: parties can read their own record; inserts happen server-side only
create policy helps_parties_read on public.helps for select to authenticated
  using (auth.uid() in (helper_id, helped_id));

-- alumni_imports: placement cell of that college only
create policy alumni_imports_placement_all on public.alumni_imports for all to authenticated
  using (public.my_role() = 'placement' and college_id = public.my_college())
  with check (public.my_role() = 'placement' and college_id = public.my_college() and uploaded_by = auth.uid());
