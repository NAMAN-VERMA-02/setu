-- The rest of the network for demos: faculty, founders and recruiters, rich profiles and intents
-- for everyone, about 80 opportunities, connections and expressions of interest.
-- Run after sample_journeys.sql and sample_outcomes.sql. Deterministic and safe to re-run.
-- Sample accounts use the reserved @seed.invalid domain, so none can log in.

create or replace function pg_temp.pick(arr text[]) returns text language sql volatile as $$
  select arr[1 + floor(random() * array_length(arr, 1))::int]
$$;

do $$
declare
  v_college uuid := (select id from public.colleges where email_domain = 'kiet.edu');
  firsts text[] := array['Aarav','Vivaan','Aditya','Arjun','Rohan','Karan','Ishaan','Kabir','Riya','Anushka','Diya','Ananya','Priya','Sneha','Kavya','Meera','Harsh','Naman','Kshitij','Tanvi','Pooja','Rahul','Neha','Sahil','Isha'];
  lasts  text[] := array['Sharma','Verma','Gupta','Singh','Kumar','Mishra','Yadav','Tiwari','Agarwal','Jain','Saxena','Pandey','Chauhan','Rastogi','Bansal'];
  cities text[] := array['Noida','Ghaziabad','Delhi','Bengaluru','Pune','Gurugram','Hyderabad','Chennai','Remote'];
  skills text[] := array['React','Node.js','Python','Java','SQL','DSA','Machine Learning','Docker','AWS','Django','Spring Boot','MongoDB','Git','Linux','System Design','Data Analysis','Power BI','Excel','Communication','Figma'];
  areas  text[] := array['Machine Learning','Databases','Computer Networks','Operating Systems','Embedded Systems','Algorithms','Cloud Computing','Data Mining'];
  companies text[] := array['Cognizant','TCS','Infosys','Wipro','Accenture','Capgemini','Zoho','Paytm','HCL','Tech Mahindra'];
  startups text[] := array['Learnloop','Kisaan Cloud','Zipcart','MedBridge','Cityflow','Paywise','Fieldhand','Nibble','Hostelhub','Gridly'];
  stages text[] := array['idea','pre-seed','seed','series A+','bootstrapped'];
  opens  text[] := array['mentoring','advice','referrals','hiring','projects','collaborating','speaking'];
  i int; k int; v_id uuid; v_name text; v_role text; v_co text; v_skill text; v_n int;
  r record; a uuid; b uuid; ids uuid[];
begin
  perform setseed(0.44);

  -- Start clean so the script can be re-run.
  delete from auth.users where email ~ '^(faculty|founder|recruiter)[0-9]+@seed\.invalid$';
  delete from public.intents where user_id in (select id from public.users where full_name like '%(sample)');
  delete from public.opportunities where poster_id in (select id from public.users where full_name like '%(sample)');
  delete from public.connections where requester_id in (select id from public.users where full_name like '%(sample)');

  -- New people: 12 faculty, 10 founders, 12 recruiters.
  for i in 1..34 loop
    v_id := gen_random_uuid();
    v_role := case when i <= 12 then 'faculty' when i <= 22 then 'founder' else 'recruiter' end;
    v_name := pg_temp.pick(firsts) || ' ' || pg_temp.pick(lasts) || ' (sample)';
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            v_role || lpad(i::text, 2, '0') || '@seed.invalid', jsonb_build_object('sample', true), now(), now());

    if v_role = 'faculty' then
      insert into public.users (id, full_name, role, college_id, branch, batch, is_18_plus, college_email_verified, last_active_at,
                                headline, bio, location, current_title, expertise, open_to, details)
      values (v_id, 'Dr. ' || v_name, 'faculty', v_college, pg_temp.pick(array['CSE','IT','ECE']), 2000 + floor(random()*15)::int, true, true, now() - random()*40*interval '1 day',
              'Professor, ' || pg_temp.pick(areas), 'Teaching and research with a focus on practical projects for undergraduates.', 'Ghaziabad',
              pg_temp.pick(array['Assistant Professor','Associate Professor','Professor']),
              (select array_agg(x) from (select unnest(areas) x order by random() limit 3) q),
              array['mentoring','projects','collaborating'],
              jsonb_build_object('lab', pg_temp.pick(areas) || ' Lab'));
    elsif v_role = 'founder' then
      v_co := pg_temp.pick(startups);
      insert into public.users (id, full_name, role, college_id, branch, batch, is_18_plus, college_email_verified, last_active_at,
                                headline, bio, location, current_company, current_title, expertise, open_to, details)
      values (v_id, v_name, 'founder', v_college, pg_temp.pick(array['CSE','IT','ECE','ME']), 2012 + floor(random()*10)::int, true, false, now() - random()*30*interval '1 day',
              'Founder at ' || v_co, 'Building ' || v_co || ' with a small team. Always looking for sharp juniors.', pg_temp.pick(cities),
              v_co, 'Founder',
              (select array_agg(x) from (select unnest(skills) x order by random() limit 4) q),
              array['hiring','advice','projects'],
              jsonb_build_object('stage', pg_temp.pick(stages), 'problems', 'Making ' || lower(v_co) || ' dependable for first-time users in small towns.'));
    else
      v_co := pg_temp.pick(companies);
      insert into public.users (id, full_name, role, college_id, branch, batch, is_18_plus, college_email_verified, last_active_at,
                                headline, bio, location, current_company, current_title, expertise, open_to, details)
      values (v_id, v_name, 'recruiter', v_college, 'Industry', 2010 + floor(random()*10)::int, true, false, now() - random()*20*interval '1 day',
              'Talent acquisition at ' || v_co, 'Hiring freshers and interns every quarter. Happy to explain what we look for.', pg_temp.pick(cities),
              v_co, 'Talent Acquisition Partner',
              (select array_agg(x) from (select unnest(skills) x order by random() limit 4) q),
              array['hiring','advice'],
              jsonb_build_object('hiring_focus', 'Freshers and interns for ' || pg_temp.pick(array['software engineering','data and analytics','testing and QA','support engineering'])));
    end if;
  end loop;

  -- Profiles for the existing sample alumni and students.
  for r in select u.id, u.role, u.branch, u.batch, g.company, g.target
             from public.users u left join public.goals g on g.user_id = u.id
            where u.full_name like '%(sample)' and u.role in ('alumni', 'student') loop
    if r.role = 'alumni' then
      update public.users set
        current_company = coalesce(r.company, pg_temp.pick(companies)),
        current_title   = pg_temp.pick(array['Software Engineer','Associate Engineer','Analyst','Senior Analyst','Developer']),
        location        = pg_temp.pick(cities),
        headline        = pg_temp.pick(array['Software Engineer','Associate Engineer','Analyst','Developer']) || ' at ' || coalesce(r.company, 'a product company'),
        bio             = 'Batch of ' || r.batch || ', ' || r.branch || '. I remember how confusing the placement season felt.',
        expertise       = (select array_agg(x) from (select unnest(skills) x order by random() limit 4) q),
        open_to         = (select array_agg(x) from (select unnest(opens) x order by random() limit 1 + floor(random()*3)::int) q)
      where id = r.id;
    else
      update public.users set
        location  = 'Ghaziabad',
        headline  = r.branch || ' student, batch ' || r.batch || coalesce(', aiming for ' || r.target, ''),
        expertise = (select array_agg(x) from (select unnest(skills) x order by random() limit 3) q),
        open_to   = array['advice','mentoring']
      where id = r.id;
    end if;
  end loop;

  -- Intents: what everyone is looking for, and what they can offer.
  for r in select id, role, current_company, expertise, details from public.users where full_name like '%(sample)' loop
    v_skill := coalesce(r.expertise[1], 'software');
    if r.role = 'student' then
      insert into public.intents (user_id, kind, category, statement)
        select r.id, 'seek', 'career', g.target from public.goals g where g.user_id = r.id and g.target is not null;
      insert into public.intents (user_id, kind, category, statement)
        values (r.id, 'seek', 'mentoring', pg_temp.pick(array['A mentor for GATE preparation','Someone who got placed with a backlog','Advice on choosing between GATE and a job','Help with my first real project']));
    elsif r.role = 'alumni' then
      insert into public.intents (user_id, kind, category, statement)
        values (r.id, 'offer', 'mentoring', pg_temp.pick(array['GATE mentoring for CSE juniors','Mock interviews for service companies','Resume review','Advice on getting placed with backlogs']));
      if random() < 0.5 then
        insert into public.intents (user_id, kind, category, statement)
          values (r.id, 'offer', 'referral', 'Referrals at ' || coalesce(r.current_company, 'my company') || ' after a small task');
      end if;
    elsif r.role = 'faculty' then
      insert into public.intents (user_id, kind, category, statement)
        values (r.id, 'offer', 'research', 'Guiding final-year projects in ' || v_skill),
               (r.id, 'seek', 'project', 'Students keen on ' || v_skill || ' research');
    elsif r.role = 'founder' then
      insert into public.intents (user_id, kind, category, statement)
        values (r.id, 'seek', 'hiring', 'Interns who know ' || v_skill),
               (r.id, 'offer', 'mentoring', 'Advice on building a first product');
    else
      insert into public.intents (user_id, kind, category, statement)
        values (r.id, 'seek', 'hiring', 'Freshers with ' || v_skill || ' and clear communication'),
               (r.id, 'offer', 'learning', 'What our online test and interviews look for');
    end if;
  end loop;

  -- Opportunities from the people who have them.
  for r in select id, role, current_company, expertise, details
             from public.users where full_name like '%(sample)' and role in ('alumni','faculty','founder','recruiter')
              and (role <> 'alumni' or random() < 0.2) loop
    for k in 1..(case when r.role = 'alumni' then 1 else 1 + floor(random()*2)::int end) loop
      v_skill := coalesce(r.expertise[1], 'React');
      insert into public.opportunities (poster_id, kind, title, description, company, skills, mode, location, deadline, created_at)
      values (
        r.id,
        case r.role when 'alumni' then pg_temp.pick(array['referral','mentorship'])
                    when 'faculty' then pg_temp.pick(array['project','research'])
                    when 'founder' then pg_temp.pick(array['job','internship','project'])
                    else pg_temp.pick(array['job','internship','event']) end,
        case r.role when 'alumni' then 'Referral and mentoring at ' || coalesce(r.current_company, 'my company')
                    when 'faculty' then pg_temp.pick(array['Final-year project: ','Research assistant: ']) || coalesce(r.expertise[1], 'Machine Learning')
                    when 'founder' then pg_temp.pick(array['Intern, ','Junior developer, ','Part-time builder, ']) || v_skill
                    else pg_temp.pick(array['Associate software engineer','Graduate trainee','Campus drive','Internship']) || case when random() < 0.5 then ' ' || v_skill else '' end end,
        case r.role when 'alumni' then 'I can refer strong juniors after a short call and a small task, and share how our interviews work.'
                    when 'faculty' then 'Work with me on a real problem for a semester. Weekly check-ins, a paper or demo at the end.'
                    when 'founder' then 'Join a small team and ship something real. You will own a feature end to end and learn fast.'
                    else 'We hire freshers every quarter. Strong fundamentals and clear communication matter more than a perfect CGPA.' end,
        r.current_company,
        (select array_agg(x) from (select unnest(skills) x order by random() limit 2 + floor(random()*3)::int) q),
        pg_temp.pick(array['onsite','remote','hybrid']),
        pg_temp.pick(cities),
        case when random() < 0.7 then (current_date + (10 + floor(random()*50))::int) end,
        now() - random()*20*interval '1 day');
    end loop;
  end loop;

  -- Connections among the sample people (about 70% accepted).
  select array_agg(id) into ids from public.users where full_name like '%(sample)';
  for i in 1..420 loop
    a := ids[1 + floor(random()*array_length(ids,1))::int];
    b := ids[1 + floor(random()*array_length(ids,1))::int];
    continue when a = b;
    begin
      insert into public.connections (requester_id, addressee_id, status, responded_at)
      values (a, b, case when random() < 0.7 then 'accepted' else 'pending' end, now());
    exception when others then null;   -- duplicate pair or pending cap: skip
    end;
  end loop;

  -- Students show interest in a few openings.
  for r in select u.id from public.users u where u.full_name like '%(sample)' and u.role = 'student' loop
    for k in 1..(1 + floor(random()*3)::int) loop
      begin
        insert into public.opportunity_interests (opportunity_id, user_id, note, status)
        select o.id, r.id, pg_temp.pick(array['I have built something similar and would love to learn more.','Keen to contribute this semester.','This matches what I am preparing for.']),
               pg_temp.pick(array['sent','sent','seen','shortlisted'])
          from public.opportunities o where o.poster_id <> r.id order by random() limit 1;
      exception when others then null;
      end;
    end loop;
  end loop;
end $$;
