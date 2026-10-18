-- The kal.trusted flag is transaction-local, but a trusted function must not leave it
-- switched on for anything else that runs in the same transaction. Clear it on the way out.

create or replace function public.reply_forward(p_hash text, p_note text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare done boolean;
begin
  perform set_config('kal.trusted', '1', true);
  update public.asks
     set status = 'replied', replied_at = now(), reply_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
   where forward_token_hash = p_hash and status = 'forwarded' and expires_at > now();
  done := found;
  perform set_config('kal.trusted', '', true);
  return done;
end $$;

create or replace function public.report_success(p_company text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); n integer;
begin
  if uid is null then raise exception 'sign in required'; end if;
  perform set_config('kal.trusted', '1', true);
  update public.users
     set succeeded_at = now(), success_company = nullif(left(trim(coalesce(p_company, '')), 120), ''), help_owed = 3
   where id = uid and succeeded_at is null and role in ('student', 'alumni');
  get diagnostics n = row_count;   -- PERFORM below would overwrite FOUND
  perform set_config('kal.trusted', '', true);
  if n = 0 then raise exception 'already reported or not eligible'; end if;
end $$;

create or replace function public.answer_question(p_junior uuid, p_answer text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  me public.users;
  j  public.users;
  q  text;
  hid uuid;
begin
  if uid is null then raise exception 'sign in required'; end if;
  select * into me from public.users where id = uid;
  if me.succeeded_at is null or me.help_owed <= 0 then raise exception 'no help owed'; end if;

  select * into j from public.users where id = p_junior;
  if j.id is null or j.college_id <> me.college_id or j.batch <= me.batch then
    raise exception 'not a junior from your college';
  end if;

  select open_question into q from public.goals where user_id = p_junior and open_question is not null limit 1;
  if q is null then raise exception 'no open question'; end if;
  if char_length(trim(coalesce(p_answer, ''))) = 0 then raise exception 'write an answer'; end if;

  perform set_config('kal.trusted', '1', true);
  insert into public.helps (helper_id, helped_id, question, answer)
  values (uid, p_junior, q, left(trim(p_answer), 1000))
  returning id into hid;
  update public.users set help_owed = help_owed - 1 where id = uid;
  perform set_config('kal.trusted', '', true);
  return hid;
end $$;
