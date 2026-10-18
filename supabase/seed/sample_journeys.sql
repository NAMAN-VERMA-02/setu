-- 150 synthetic journeys for demos and for testing /api/match. Safe to re-run.
--
-- All accounts use the reserved domain @seed.invalid, so they can never receive mail or
-- log in (no password, email unconfirmed). Names carry a "(sample)" suffix. Data is
-- generated with a fixed random seed, so every run produces the same people.
-- Remove everything with:  delete from auth.users where email like '%@seed.invalid';
-- (profiles, snapshots, goals and company counts cascade).
--
-- Requires the demo college from supabase/seed.sql (kiet.edu).

create or replace function pg_temp.cgpa_bucket(c numeric) returns text language sql immutable as $$
  select case when c < 4 then '0-4'
    else trim_scale(4 + floor((least(c, 9.99) - 4) / 0.5) * 0.5)::text || '-' ||
         trim_scale(4 + floor((least(c, 9.99) - 4) / 0.5) * 0.5 + 0.5)::text end
$$;

create or replace function pg_temp.pct_bucket(p numeric) returns text language sql immutable as $$
  select case when p < 40 then '0-40'
    else (floor(least(p, 99.9) / 5) * 5)::int::text || '-' || ((floor(least(p, 99.9) / 5) * 5)::int + 5)::text end
$$;

do $$
declare
  v_college   uuid := (select id from public.colleges where email_domain = 'kiet.edu');
  firsts      text[] := array['Aarav','Vivaan','Aditya','Arjun','Rohan','Karan','Ishaan','Kabir','Riya','Anushka','Diya','Ananya','Priya','Sneha','Kavya','Meera','Harsh','Naman','Kshitij','Tanvi','Pooja','Rahul','Neha','Sahil','Isha'];
  lasts       text[] := array['Sharma','Verma','Gupta','Singh','Kumar','Mishra','Yadav','Tiwari','Agarwal','Jain','Saxena','Pandey','Chauhan','Rastogi','Bansal'];
  branches    text[] := array['CSE','CSE','CSE','CSE','CSE','IT','IT','ECE','ECE','ME','EEE','CE'];
  companies   text[] := array['Cognizant','TCS','Infosys','Wipro','Accenture','Capgemini','Amazon','Microsoft','Zoho','Paytm','HCL','Tech Mahindra'];
  skill_pool  text[] := array['C','C++','Java','Python','SQL','DBMS','DSA','HTML','CSS','JavaScript','React','Node.js','Git','Linux','OS','Networks','Excel','Power BI','Django','Spring Boot','MongoDB','Docker','AWS','Machine Learning'];
  decisions   text[] := array['job','job','job','job','gate','gate','startup','higher_studies','other'];
  i int; s int; n_sem int; k int;
  v_id uuid; v_batch int; v_branch text; v_name text; v_role text;
  v_ability numeric; v_cgpa numeric; v_back int; v_tenth numeric; v_twelfth numeric;
  v_decision text; v_skills text[]; v_company text;
  v_show_c bool; v_show_t bool; v_show_w bool;
  v_status text;
begin
  perform setseed(0.42);
  delete from auth.users where email like '%@seed.invalid';

  for i in 1..150 loop
    v_id      := gen_random_uuid();
    v_batch   := 2021 + floor(random() * 7)::int;                 -- 2021..2027
    v_role    := case when v_batch = 2027 then 'student' else 'alumni' end;
    v_branch  := branches[1 + floor(random() * array_length(branches, 1))::int];
    v_name    := firsts[1 + floor(random() * array_length(firsts, 1))::int] || ' ' ||
                 lasts[1 + floor(random() * array_length(lasts, 1))::int] || ' (sample)';
    v_ability := 5.2 + random() * 3.3;                            -- 5.2..8.5
    v_tenth   := 55 + random() * 40;
    v_twelfth := 55 + random() * 40;
    v_decision := decisions[1 + floor(random() * array_length(decisions, 1))::int];
    v_company := companies[1 + floor(random() * array_length(companies, 1))::int];
    v_show_c  := random() < 0.5;
    v_show_t  := random() < 0.3;
    v_show_w  := random() < 0.3;
    n_sem     := case when v_batch = 2027 then 7 else 8 end;
    select array_agg(x) into v_skills from (select x from unnest(skill_pool) x order by random()) t;

    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'sample' || lpad(i::text, 3, '0') || '@seed.invalid', jsonb_build_object('sample', true), now(), now());

    insert into public.users (id, full_name, role, college_id, branch, batch, is_18_plus, college_email_verified, help_owed, last_active_at)
    values (v_id, v_name, v_role, v_college, v_branch, v_batch, true, true,
            case when random() < 0.15 then 1 + floor(random() * 3)::int else 0 end,
            now() - (random() * 400) * interval '1 day');

    for s in 1..n_sem loop
      v_cgpa := v_ability + (random() - 0.5) * 0.8;
      v_back := case when v_ability < 6.5 and random() < 0.6 then floor(random() * 3)::int
                     when random() < 0.12 then 1 else 0 end;
      k := least(1 + s, 12);
      v_status := case
        when s <= 2 then 'Settling in, learning the basics'
        when s <= 4 then 'Building projects and fixing weak subjects'
        when s <= 6 then 'Preparing for placements and internships'
        else 'Interviewing and finishing the final year' end;

      insert into public.snapshots (user_id, semester, cgpa_range, backlog_count, tenth_range, twelfth_range,
                                    skills, status, decision, show_cgpa, show_tenth, show_twelfth)
      values (v_id, s, pg_temp.cgpa_bucket(v_cgpa), v_back, pg_temp.pct_bucket(v_tenth), pg_temp.pct_bucket(v_twelfth),
              v_skills[1:k], v_status, case when s >= 4 then v_decision end, v_show_c, v_show_t, v_show_w);
    end loop;

    insert into public.goals (user_id, target, company)
    values (v_id,
            case when v_decision = 'gate' then 'Crack GATE' else 'SDE at ' || v_company end,
            case when v_decision = 'gate' then null else v_company end);

    -- ~45% of people can bridge to a few companies, as counts only (>= 2).
    if random() < 0.45 then
      insert into public.company_counts (user_id, company, count)
      select v_id, c, 2 + floor(random() * 7)::int
      from (select c from unnest(companies) c order by random() limit 1 + floor(random() * 3)::int) q;
    end if;
  end loop;
end $$;
