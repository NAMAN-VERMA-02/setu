-- Create the SETU profile only once the user has confirmed a mailbox on their
-- college's email domain. Runs inside the database, so no service-role key is
-- needed in the app and clients cannot set college_email_verified themselves.
-- Sign-up data comes from auth user metadata; the date of birth is never stored,
-- only the 18+ confirmation (data minimisation).

create or replace function public.handle_email_confirmed() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_domain  text := lower(split_part(new.email, '@', 2));
  v_college uuid;
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if new.email_confirmed_at is null then return new; end if;
  if exists (select 1 from public.users where id = new.id) then return new; end if;

  select id into v_college from public.colleges
   where v_domain = email_domain or v_domain like '%.' || email_domain
   limit 1;
  if v_college is null then return new; end if;                       -- not a college address
  if coalesce(v_meta->>'age_confirmed', '') <> 'true' then return new; end if;  -- 18+ required
  if v_meta->>'role' not in ('student','alumni','faculty','founder','recruiter') then return new; end if;

  begin
    insert into public.users (id, full_name, role, college_id, branch, batch, is_18_plus, college_email_verified)
    values (new.id,
            left(v_meta->>'full_name', 120),
            v_meta->>'role',
            v_college,
            left(v_meta->>'branch', 80),
            (v_meta->>'batch')::smallint,
            true,
            true);
  exception when others then
    return new;   -- malformed metadata: leave unprofiled, never block email confirmation
  end;
  return new;
end $$;

revoke execute on function public.handle_email_confirmed() from public, anon, authenticated;

create trigger on_auth_user_email_confirmed
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.handle_email_confirmed();
