-- Connections: the network itself. A request is pending until the other person accepts.
-- A "no" is silent: it is recorded where only the person who said it can read it, so the
-- requester just keeps waiting (like asks).

create table public.connections (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users (id) on delete cascade,
  addressee_id uuid not null references public.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  message      text check (char_length(message) <= 300),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
-- One connection per pair, whichever way round it was requested.
create unique index connections_pair_idx on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status);
create index connections_requester_idx on public.connections (requester_id, status);
alter table public.connections enable row level security;

create table public.connection_declines (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  declined_by   uuid not null references public.users (id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index connection_declines_by_idx on public.connection_declines (declined_by);
alter table public.connection_declines enable row level security;

create policy connections_read on public.connections for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));
create policy connections_insert on public.connections for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');
create policy connections_accept on public.connections for update to authenticated
  using (addressee_id = (select auth.uid())) with check (addressee_id = (select auth.uid()));
create policy connections_delete on public.connections for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create policy connection_declines_read on public.connection_declines for select to authenticated
  using (declined_by = (select auth.uid()));
create policy connection_declines_insert on public.connection_declines for insert to authenticated
  with check (
    declined_by = (select auth.uid())
    and exists (select 1 from public.connections c where c.id = connection_id and c.addressee_id = (select auth.uid()))
  );

create or replace function public.guard_connection() returns trigger
language plpgsql security definer set search_path = public as $$
declare a uuid; b uuid;
begin
  if tg_op = 'INSERT' then
    select college_id into a from public.users where id = new.requester_id;
    select college_id into b from public.users where id = new.addressee_id;
    if a is null or a is distinct from b then raise exception 'not from your college'; end if;
    if (select count(*) from public.connections c
        where c.requester_id = new.requester_id and c.status = 'pending'
          and not exists (select 1 from public.connection_declines d where d.connection_id = c.id)) >= 15 then
      raise exception 'too many pending requests';
    end if;
  else
    if new.requester_id is distinct from old.requester_id or new.addressee_id is distinct from old.addressee_id
       or new.message is distinct from old.message then
      raise exception 'only the status can change';
    end if;
    if old.status = 'accepted' and new.status <> 'accepted' then raise exception 'already connected'; end if;
    if new.status = 'accepted' and old.status = 'pending' then new.responded_at := now(); end if;
  end if;
  return new;
end $$;
revoke execute on function public.guard_connection() from public, anon, authenticated;
create trigger connections_guard before insert or update on public.connections
  for each row execute function public.guard_connection();

-- How many accepted connections two people share. A count only, never names.
create or replace function public.mutual_count(p_other uuid) returns integer
language sql stable security definer set search_path = public as $$
  with mine as (
    select case when requester_id = (select auth.uid()) then addressee_id else requester_id end as pid
    from public.connections
    where status = 'accepted' and (select auth.uid()) in (requester_id, addressee_id)
  ), theirs as (
    select case when requester_id = p_other then addressee_id else requester_id end as pid
    from public.connections
    where status = 'accepted' and p_other in (requester_id, addressee_id)
  )
  select count(*)::integer from mine join theirs using (pid)
$$;
revoke execute on function public.mutual_count(uuid) from public, anon;
grant execute on function public.mutual_count(uuid) to authenticated;
