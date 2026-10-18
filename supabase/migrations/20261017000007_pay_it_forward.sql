-- Pay it forward x3 and the college dashboard.
--
-- Trusted server-side functions set the transaction-local flag kal.trusted so the guard
-- triggers let them change protected columns, even when a signed-in user called them.
-- Clients cannot set this flag: it is not reachable through the API.

alter table public.users
  add column succeeded_at    timestamptz,
  add column success_company text check (char_length(success_company) <= 120);

-- The one question a junior would like a senior to answer.
alter table public.goals
  add column open_question text check (char_length(open_question) <= 300);

alter table public.helps
  add column question text check (char_length(question) <= 300),
  add column answer   text check (char_length(answer) <= 1000),
  add constraint helps_one_per_pair unique (helper_id, helped_id);

create or replace function public.guard_user_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('kal.trusted', true), '') <> '1' then
    if new.role is distinct from old.role
       or new.college_id is distinct from old.college_id
       or new.college_email_verified is distinct from old.college_email_verified
       or new.help_owed is distinct from old.help_owed
       or new.succeeded_at is distinct from old.succeeded_at
       or new.success_company is distinct from old.success_company then
      raise exception 'protected user columns cannot be changed';
    end if;
  end if;
  return new;
end $$;

-- Same rules as before; trusted functions (forward reply) now bypass the party checks.
create or replace function public.guard_ask() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := auth.uid();
  steps     constant text[] := array['question','call','task','referral'];
  is_senior boolean;
  is_asker  boolean;
  a_batch smallint; a_college uuid;
  s_id uuid; s_batch smallint; s_college uuid;
begin
  if tg_op = 'INSERT' then
    s_id := coalesce(new.via_id, new.target_id);
    select batch, college_id into a_batch, a_college from public.users where id = new.asker_id;
    select batch, college_id into s_batch, s_college from public.users where id = s_id;
    if s_batch is null or s_college is distinct from a_college or s_batch >= a_batch then
      raise exception 'not a senior from your college';
    end if;

    if new.via_id is not null then
      if new.target_id is not null then
        raise exception 'a bridge request has no direct target';
      end if;
      if new.target_company is null or not exists (
        select 1 from public.company_counts c
        where c.user_id = new.via_id and lower(c.company) = lower(new.target_company) and c.count >= 2
      ) then
        raise exception 'this senior has no contacts at that company';
      end if;
      if exists (
        select 1 from public.asks
        where asker_id = new.asker_id and via_id is not null
          and status in ('pending','forwarded') and expires_at > now()
          and not exists (select 1 from public.ask_declines d where d.ask_id = asks.id)
      ) then
        raise exception 'one open bridge request per student';
      end if;
    end if;

    if (select count(*) from public.asks a
        where a.status = 'pending' and a.expires_at > now()
          and (a.target_id = s_id or a.via_id = s_id)
          and not exists (select 1 from public.ask_declines d where d.ask_id = a.id)) >= 3 then
      raise exception 'this senior already has 3 waiting requests';
    end if;
    return new;
  end if;

  if new.asker_id is distinct from old.asker_id
     or new.target_id is distinct from old.target_id
     or new.via_id is distinct from old.via_id
     or new.expires_at is distinct from old.expires_at
     or new.message is distinct from old.message
     or new.target_company is distinct from old.target_company then
    raise exception 'ask parties, message and expiry are immutable';
  end if;

  -- Service role, or a trusted function such as the one-tap forward reply.
  if uid is null or coalesce(current_setting('kal.trusted', true), '') = '1' then return new; end if;

  if old.expires_at <= now() or old.status in ('cancelled','expired','declined') then
    raise exception 'this request is closed';
  end if;

  is_senior := uid in (old.target_id, old.via_id);
  is_asker  := uid = old.asker_id;
  if not (is_senior or is_asker) then raise exception 'not a party to this request'; end if;

  if new.forward_token_hash is distinct from old.forward_token_hash
     and (old.forward_token_hash is not null or uid is distinct from old.via_id) then
    raise exception 'only the bridging senior can create the forward link, once';
  end if;
  if new.replied_at is distinct from old.replied_at or new.reply_note is distinct from old.reply_note then
    raise exception 'replies come through the forward link';
  end if;

  if is_senior then
    if new.work_url is distinct from old.work_url then
      raise exception 'only the student can submit work';
    end if;
    if new.trust_step is distinct from old.trust_step
       and array_position(steps, new.trust_step) <> array_position(steps, old.trust_step) + 1 then
      raise exception 'trust steps go one at a time';
    end if;
    if new.status is distinct from old.status and new.status not in ('accepted','forwarded') then
      raise exception 'invalid status for a senior';
    end if;
    if new.status = 'forwarded' and new.forward_token_hash is null then
      raise exception 'a forwarded request needs a forward link';
    end if;
  else
    if new.trust_step is distinct from old.trust_step
       or new.work_seen_at is distinct from old.work_seen_at
       or new.forwarded_at is distinct from old.forwarded_at
       or new.forward_token_hash is distinct from old.forward_token_hash then
      raise exception 'only the senior can advance the trust step';
    end if;
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'students can only cancel a request';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_ask() from public, anon, authenticated;

-- The forward reply must work for signed-in users too, so mark it trusted.
create or replace function public.reply_forward(p_hash text, p_note text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('kal.trusted', '1', true);
  update public.asks
     set status = 'replied', replied_at = now(), reply_note = nullif(left(trim(coalesce(p_note, '')), 500), '')
   where forward_token_hash = p_hash and status = 'forwarded' and expires_at > now();
  return found;
end $$;

-- "I got it": records the success once and opens three pay-it-forward answers.
create or replace function public.report_success(p_company text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'sign in required'; end if;
  perform set_config('kal.trusted', '1', true);
  update public.users
     set succeeded_at = now(), success_company = nullif(left(trim(coalesce(p_company, '')), 120), ''), help_owed = 3
   where id = uid and succeeded_at is null and role in ('student', 'alumni');
  if not found then raise exception 'already reported or not eligible'; end if;
end $$;

-- Answer one junior's open question. Each answer uses up one of the three.
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
  return hid;
end $$;

-- College dashboard: counts only, for the placement cell of the caller's own college.
create or replace function public.college_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
    -- companies with fewer than 2 placements are left out so no single person can be picked out
    'top_companies', coalesce((select jsonb_agg(jsonb_build_object('company', c, 'count', n) order by n desc, c)
                       from (select success_company c, count(*) n from public.users
                             where college_id = cid and success_company is not null
                             group by success_company having count(*) >= 2
                             order by count(*) desc, success_company limit 8) t), '[]'::jsonb),
    'helps', (select count(*) from public.helps h join public.users u on u.id = h.helper_id where u.college_id = cid),
    'helpers', (select count(distinct h.helper_id) from public.helps h join public.users u on u.id = h.helper_id where u.college_id = cid),
    'help_owed_open', coalesce((select sum(help_owed) from public.users where college_id = cid), 0)
  );
end $$;

revoke execute on function public.report_success(text), public.answer_question(uuid, text), public.college_stats() from public, anon;
grant  execute on function public.report_success(text), public.answer_question(uuid, text), public.college_stats() to authenticated;
