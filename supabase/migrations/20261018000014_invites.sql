-- Invites: how recruiters and founders (who rarely have a college email) join a college's network.
-- An alumnus, faculty member or the placement cell vouches for them with a single-use,
-- expiring code. The invitee still has to confirm a real mailbox.

create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  role       text not null check (role in ('recruiter', 'founder')),
  college_id uuid not null references public.colleges (id) on delete cascade,
  invited_by uuid not null references public.users (id) on delete cascade,
  note       text check (char_length(note) <= 200),
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_by    uuid references auth.users (id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index invites_by_idx on public.invites (invited_by, created_at desc);
create index invites_college_idx on public.invites (college_id);
alter table public.invites enable row level security;

-- Inviters see their own; the placement cell sees every invite for its college.
create policy invites_read on public.invites for select to authenticated
  using (
    invited_by = (select auth.uid())
    or (college_id = (select public.my_college()) and (select public.my_role()) = 'placement')
  );
create policy invites_insert on public.invites for insert to authenticated
  with check (invited_by = (select auth.uid()));
create policy invites_delete on public.invites for delete to authenticated
  using (invited_by = (select auth.uid()) and used_by is null);

create or replace function public.guard_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text; c uuid;
begin
  select role, college_id into r, c from public.users where id = new.invited_by;
  if r is null or r not in ('alumni', 'faculty', 'placement') then
    raise exception 'your role cannot invite people';
  end if;
  new.college_id := c;   -- an invite always belongs to the inviter's own college
  if (select count(*) from public.invites
      where invited_by = new.invited_by and used_by is null and expires_at > now()) >= 10 then
    raise exception 'at most 10 open invites';
  end if;
  return new;
end $$;
revoke execute on function public.guard_invite() from public, anon, authenticated;
create trigger invites_guard before insert on public.invites
  for each row execute function public.guard_invite();

-- Lets the signup page show "you were invited as a recruiter at X" without exposing the table.
create or replace function public.check_invite(p_code text)
returns table (role text, college_name text)
language sql stable security definer set search_path = public as $$
  select i.role, c.name
  from public.invites i join public.colleges c on c.id = i.college_id
  where i.code = lower(trim(p_code)) and i.used_by is null and i.expires_at > now()
$$;
revoke execute on function public.check_invite(text) from public;
grant execute on function public.check_invite(text) to anon, authenticated;

-- Profile creation after the mailbox is confirmed: a college address, or a valid invite.
-- The invite is claimed in the same step as the profile, so a failure never burns it.
create or replace function public.handle_email_confirmed() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_domain  text := lower(split_part(new.email, '@', 2));
  v_college uuid;
  v_role    text;
  v_invite  boolean := false;
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if new.email_confirmed_at is null then return new; end if;
  if exists (select 1 from public.users where id = new.id) then return new; end if;
  if coalesce(v_meta->>'age_confirmed', '') <> 'true' then return new; end if;

  select id into v_college from public.colleges
   where v_domain = email_domain or v_domain like '%.' || email_domain
   limit 1;

  if v_college is not null then
    v_role := v_meta->>'role';
    if v_role is null or v_role not in ('student','alumni','faculty','founder','recruiter') then return new; end if;
  elsif coalesce(v_meta->>'invite_code', '') <> '' then
    v_invite := true;
  else
    return new;
  end if;

  begin
    if v_invite then
      -- Single use: claim the invite and take its role and college.
      update public.invites
         set used_by = new.id, used_at = now()
       where code = lower(trim(v_meta->>'invite_code')) and used_by is null and expires_at > now()
      returning college_id, role into v_college, v_role;
      if v_college is null then return new; end if;
    end if;

    insert into public.users (id, full_name, role, college_id, branch, batch, is_18_plus, college_email_verified)
    values (new.id,
            left(v_meta->>'full_name', 120),
            v_role,
            v_college,
            left(coalesce(nullif(v_meta->>'branch', ''), 'Industry'), 80),
            coalesce((v_meta->>'batch')::smallint, extract(year from now())::smallint),
            true,
            not v_invite);   -- invitees are vouched for, not college-email verified
  exception when others then
    return new;
  end;
  return new;
end $$;
revoke execute on function public.handle_email_confirmed() from public, anon, authenticated;
