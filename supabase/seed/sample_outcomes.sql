-- Outcomes for the sample journeys: placements, open questions, requests, helps and a
-- sample placement-cell account. Run after sample_journeys.sql. Safe to re-run.
-- Sample accounts use @seed.invalid, so none of them can log in.

do $$
declare
  v_college uuid := (select id from public.colleges where email_domain = 'kiet.edu');
  questions text[] := array[
    'How did you prepare for the online coding test?',
    'Was my backlog a problem in interviews?',
    'GATE or a job after final year: how did you decide?',
    'Which one project helped you most in interviews?',
    'How do I explain a low CGPA to recruiters?',
    'What should I do in the summer before placements?',
    'How many companies should I apply to?',
    'Which subjects should I revise first for service-company tests?'];
  v_pc uuid := gen_random_uuid();
  r record; i int := 0; n int;
  askers uuid[]; targets uuid[]; helpers uuid[]; juniors uuid[];
begin
  perform setseed(0.43);

  -- Placement cell account (cannot log in).
  delete from auth.users where email = 'placement@seed.invalid';
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (v_pc, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'placement@seed.invalid', jsonb_build_object('sample', true), now(), now());
  insert into public.users (id, full_name, role, college_id, branch, batch, is_18_plus, college_email_verified)
  values (v_pc, 'Placement Cell (sample)', 'placement', v_college, 'Placement', 2000, true, true);

  -- Open questions from the juniors (batch 2026 and 2027).
  for r in select u.id from public.users u join auth.users a on a.id = u.id
           where a.email like 'sample%@seed.invalid' and u.batch >= 2026 loop
    update public.goals set open_question = questions[1 + floor(random() * array_length(questions, 1))::int]
     where user_id = r.id;
  end loop;

  -- Placements: most alumni who aimed for a job report where they landed.
  update public.users u
     set succeeded_at = now() - (random() * 300) * interval '1 day', success_company = g.company
    from public.goals g
   where g.user_id = u.id and u.role = 'alumni' and g.company is not null and random() < 0.7
     and exists (select 1 from auth.users a where a.id = u.id and a.email like 'sample%@seed.invalid');

  -- A few recent successes still owe their three answers.
  update public.users u set help_owed = 3
   where u.succeeded_at is not null and u.batch = 2025
     and exists (select 1 from auth.users a where a.id = u.id and a.email like 'sample%@seed.invalid');
  -- Only people who reported a success owe answers.
  update public.users u set help_owed = 0
   where u.succeeded_at is null
     and exists (select 1 from auth.users a where a.id = u.id and a.email like 'sample%@seed.invalid');
  update public.users u set help_owed = 0
   where u.succeeded_at is not null and u.batch <> 2025
     and exists (select 1 from auth.users a where a.id = u.id and a.email like 'sample%@seed.invalid');

  -- Requests from final-year students to seniors, at different points on the trust ladder.
  delete from public.asks where asker_id in (select id from public.users where full_name like '%(sample)');
  select array_agg(id) into askers from (select u.id from public.users u join auth.users a on a.id = u.id
    where a.email like 'sample%@seed.invalid' and u.batch = 2027 order by u.id limit 24) q;
  select array_agg(id) into targets from (select u.id from public.users u join auth.users a on a.id = u.id
    where a.email like 'sample%@seed.invalid' and u.batch <= 2025 order by u.id limit 24) q;
  for i in 1..least(array_length(askers, 1), array_length(targets, 1)) loop
    insert into public.asks (asker_id, target_id, message, trust_step, status, work_url, work_seen_at)
    values (askers[i], targets[i], 'Sample question ' || i,
            case when i % 6 = 0 then 'referral' when i % 6 in (1, 2) then 'task' when i % 6 in (3, 4) then 'call' else 'question' end,
            case when i % 5 = 0 then 'pending' else 'accepted' end,
            case when i % 6 in (0, 1, 2) then 'https://github.com/example/sample-' || i end,
            case when i % 6 = 0 then now() end);
  end loop;

  -- Pay-it-forward answers already given.
  delete from public.helps where helper_id in (select id from public.users where full_name like '%(sample)');
  select array_agg(id) into helpers from (select id from public.users where full_name like '%(sample)' and succeeded_at is not null and batch <> 2025 order by id limit 6) q;
  select array_agg(id) into juniors from (select user_id id from public.goals where open_question is not null and user_id in (select id from public.users where batch = 2027) order by user_id limit 12) q;
  for i in 1..least(coalesce(array_length(helpers, 1), 0) * 2, coalesce(array_length(juniors, 1), 0)) loop
    insert into public.helps (helper_id, helped_id, question, answer)
    select helpers[1 + (i - 1) / 2], juniors[i], g.open_question,
           'Sample answer: start with one small project, ask early, and keep revising the basics.'
      from public.goals g where g.user_id = juniors[i]
    on conflict do nothing;
  end loop;
end $$;
