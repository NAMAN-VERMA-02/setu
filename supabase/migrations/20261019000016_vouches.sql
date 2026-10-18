-- Vouches: a senior or faculty member puts their name to one of a student's skills.
-- Seniors can only vouch after they have actually seen the student's work (the same rule that
-- unlocks a referral); faculty can vouch for students from their own college they have taught.

create table public.vouches (
  id         uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.users (id) on delete cascade,
  student_id uuid not null references public.users (id) on delete cascade,
  skill      text not null check (char_length(skill) between 2 and 40),
  note       text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (voucher_id <> student_id)
);
create unique index vouches_unique_idx on public.vouches (voucher_id, student_id, lower(skill));
create index vouches_student_idx on public.vouches (student_id);
alter table public.vouches enable row level security;

-- Visible to people in the same college as the student.
create policy vouches_read on public.vouches for select to authenticated
  using (
    voucher_id = (select auth.uid()) or student_id = (select auth.uid())
    or exists (select 1 from public.users u where u.id = vouches.student_id and u.college_id = (select public.my_college()))
  );
create policy vouches_insert on public.vouches for insert to authenticated
  with check (voucher_id = (select auth.uid()));
create policy vouches_delete on public.vouches for delete to authenticated
  using (voucher_id = (select auth.uid()));

create or replace function public.guard_vouch() returns trigger
language plpgsql security definer set search_path = public as $$
declare v public.users; s public.users;
begin
  select * into v from public.users where id = new.voucher_id;
  select * into s from public.users where id = new.student_id;
  if v.id is null or s.id is null or v.college_id <> s.college_id then raise exception 'not from your college'; end if;
  if s.role <> 'student' then raise exception 'you can vouch for students'; end if;
  if v.role = 'faculty' then
    null;   -- faculty vouch from teaching or project supervision
  elsif v.role in ('alumni', 'founder', 'recruiter') and v.batch < s.batch then
    if not exists (select 1 from public.asks a
                   where a.asker_id = new.student_id and v.id in (a.target_id, a.via_id) and a.work_seen_at is not null) then
      raise exception 'you can vouch once you have seen their work';
    end if;
  else
    raise exception 'your role cannot vouch';
  end if;
  if (select count(*) from public.vouches where voucher_id = new.voucher_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many vouches today';
  end if;
  return new;
end $$;
revoke execute on function public.guard_vouch() from public, anon, authenticated;
create trigger vouches_guard before insert on public.vouches
  for each row execute function public.guard_vouch();

-- Whether the signed-in person may vouch for this student right now (drives the profile button).
create or replace function public.can_vouch(p_student uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v public.users; s public.users;
begin
  select * into v from public.users where id = (select auth.uid());
  select * into s from public.users where id = p_student;
  if v.id is null or s.id is null or s.role <> 'student' or v.college_id <> s.college_id or v.id = s.id then return false; end if;
  if v.role = 'faculty' then return true; end if;
  return v.role in ('alumni', 'founder', 'recruiter') and v.batch < s.batch
    and exists (select 1 from public.asks a where a.asker_id = p_student and v.id in (a.target_id, a.via_id) and a.work_seen_at is not null);
end $$;
revoke execute on function public.can_vouch(uuid) from public, anon;
grant execute on function public.can_vouch(uuid) to authenticated;
