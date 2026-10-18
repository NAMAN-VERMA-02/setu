-- Put every table that drives a live screen on the Realtime publication.
-- Row security still decides who receives each change, so nobody sees rows they could not read.
-- REPLICA IDENTITY FULL lets deletes and updates reach subscribers under row security too.
do $$
declare
  t text;
begin
  foreach t in array array[
    'asks', 'connections', 'opportunities', 'opportunity_interests',
    'vouches', 'announcements', 'helps'
  ] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
