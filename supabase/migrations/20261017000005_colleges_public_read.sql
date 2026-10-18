-- College names and email domains are not sensitive and must be readable before
-- sign-in so the signup form can reject non-college addresses early.
drop policy colleges_read on public.colleges;
create policy colleges_read on public.colleges for select to anon, authenticated using (true);
