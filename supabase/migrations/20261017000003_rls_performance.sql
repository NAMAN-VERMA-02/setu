-- Performance advisors: evaluate auth.uid() once per query, index remaining FKs,
-- and avoid duplicate permissive SELECT policies on company_counts.

create index if not exists alumni_imports_uploaded_by_idx on public.alumni_imports (uploaded_by);
create index if not exists helps_ask_idx on public.helps (ask_id);

drop policy users_read on public.users;
drop policy users_insert_self on public.users;
drop policy users_update_self on public.users;
create policy users_read on public.users for select to authenticated
  using (id = (select auth.uid()) or college_id = (select public.my_college()));
create policy users_insert_self on public.users for insert to authenticated
  with check (id = (select auth.uid()) and role <> 'placement' and college_email_verified = false and help_owed = 0);
create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy snapshots_owner_all on public.snapshots;
create policy snapshots_owner_all on public.snapshots for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy goals_owner_all on public.goals;
create policy goals_owner_all on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- one SELECT policy (owner or same college); owner-only write policies
drop policy company_counts_owner_all on public.company_counts;
drop policy company_counts_college_read on public.company_counts;
create policy company_counts_read on public.company_counts for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.users u
                    where u.id = company_counts.user_id and u.college_id = (select public.my_college())));
create policy company_counts_owner_insert on public.company_counts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy company_counts_owner_update on public.company_counts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy company_counts_owner_delete on public.company_counts for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy asks_parties_read on public.asks;
drop policy asks_asker_insert on public.asks;
drop policy asks_parties_update on public.asks;
create policy asks_parties_read on public.asks for select to authenticated
  using ((select auth.uid()) in (asker_id, target_id, via_id));
create policy asks_asker_insert on public.asks for insert to authenticated
  with check (asker_id = (select auth.uid()) and trust_step = 'question' and status = 'pending'
              and work_seen_at is null and forward_token_hash is null);
create policy asks_parties_update on public.asks for update to authenticated
  using ((select auth.uid()) in (asker_id, target_id, via_id))
  with check ((select auth.uid()) in (asker_id, target_id, via_id));

drop policy helps_parties_read on public.helps;
create policy helps_parties_read on public.helps for select to authenticated
  using ((select auth.uid()) in (helper_id, helped_id));

drop policy alumni_imports_placement_all on public.alumni_imports;
create policy alumni_imports_placement_all on public.alumni_imports for all to authenticated
  using ((select public.my_role()) = 'placement' and college_id = (select public.my_college()))
  with check ((select public.my_role()) = 'placement' and college_id = (select public.my_college())
              and uploaded_by = (select auth.uid()));
