-- Covering index for the invite redemption foreign key (performance advisor).
create index if not exists invites_used_by_idx on public.invites (used_by);
