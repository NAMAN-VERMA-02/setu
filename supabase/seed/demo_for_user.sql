-- Makes a real demo account look lived in: fills an empty profile and connects it to a few
-- sample people. It targets the most recently created non-sample user, changes nothing that
-- is already filled in, and is safe to re-run. Run after sample_network.sql.

do $$
declare
  me uuid;
  r record;
  n int := 0;
begin
  select u.id into me
    from public.users u join auth.users a on a.id = u.id
   where a.email not like '%@seed.invalid'
   order by a.created_at desc limit 1;
  if me is null then raise notice 'no real user found'; return; end if;

  update public.users set
    headline  = coalesce(headline, branch || ' student, batch ' || batch),
    bio       = coalesce(bio, 'Building things, preparing for placements, and always up for a good question.'),
    location  = coalesce(location, 'Ghaziabad'),
    expertise = case when cardinality(expertise) = 0 then array['React','SQL','DSA'] else expertise end,
    open_to   = case when cardinality(open_to) = 0 then array['advice','collaborating'] else open_to end
  where id = me;

  insert into public.intents (user_id, kind, category, statement)
  select me, 'seek', 'career', coalesce((select target from public.goals where user_id = me limit 1), 'SDE at a product company')
  where not exists (select 1 from public.intents where user_id = me);

  -- Six accepted connections across different groups, two requests waiting, one sent.
  for r in
    select id, role from (
      select id, role, row_number() over (partition by role order by id) rn
        from public.users where full_name like '%(sample)' and role in ('alumni','faculty','founder','recruiter')
    ) q where rn <= 2
    order by role, id
  loop
    n := n + 1;
    begin
      insert into public.connections (requester_id, addressee_id, status, responded_at, message)
      values (
        case when n in (7, 8) then r.id else me end,
        case when n in (7, 8) then me else r.id end,
        case when n <= 6 then 'accepted' when n in (7, 8) then 'pending' else 'pending' end,
        case when n <= 6 then now() end,
        case when n in (7, 8) then 'Saw your profile, would love to connect.' end);
    exception when others then null;
    end;
  end loop;
end $$;
