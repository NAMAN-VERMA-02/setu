-- Address Supabase security advisors raised on the initial schema.

-- Pin search_path on trigger functions.
alter function public.guard_user_update() set search_path = public;
alter function public.guard_ask()         set search_path = public;

-- RLS helpers are needed by signed-in users only; anonymous callers get nothing.
revoke execute on function public.my_college() from public, anon;
revoke execute on function public.my_role()    from public, anon;
grant  execute on function public.my_college() to authenticated;
grant  execute on function public.my_role()    to authenticated;

-- Intentional advisor finding: snapshots_visible is SECURITY DEFINER on purpose.
-- Raw snapshot rows are owner-only; the view exposes mark ranges to same-college
-- users only where the owner opted in (show_* flags), which RLS cannot express per column.
comment on view public.snapshots_visible is
  'Intentionally security definer: masks mark ranges by per-field opt-in, scoped to the caller''s college.';
