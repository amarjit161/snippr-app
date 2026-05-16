-- Stabilize the current production legacy queue architecture.
-- This intentionally keeps public.queue + public.customer_bookings as the live path.

begin;

-- Realtime: publish the base tables the active app actually subscribes to.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if to_regclass('public.queue') is not null
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'queue'
      )
    then
      alter publication supabase_realtime add table public.queue;
    end if;

    if to_regclass('public.salons') is not null
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'salons'
      )
    then
      alter publication supabase_realtime add table public.salons;
    end if;

    if to_regclass('public.salon_holidays') is not null
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'salon_holidays'
      )
    then
      alter publication supabase_realtime add table public.salon_holidays;
    end if;
  end if;
end $$;

alter table if exists public.queue replica identity full;
alter table if exists public.salons replica identity full;
alter table if exists public.salon_holidays replica identity full;

-- Views: make exposed views honor the invoking role's RLS.
alter view if exists public.customer_bookings set (security_invoker = true);
alter view if exists public.salon_with_stats set (security_invoker = true);

revoke all on public.queue from anon;
grant select, insert, update, delete on public.queue to authenticated;
grant select, insert, update, delete on public.customer_bookings to authenticated;
grant select on public.salons, public.services, public.barbers, public.salon_holidays to anon, authenticated;
grant select on public.salon_with_stats to anon, authenticated;

-- Indexes for the active query and RLS paths.
create index if not exists idx_queue_service_id
  on public.queue using btree (service_id);

create index if not exists idx_queue_salon_status_created
  on public.queue using btree (salon_id, status, created_at desc);

create index if not exists idx_queue_user_status_created
  on public.queue using btree (user_id, status, created_at desc)
  where user_id is not null;

create unique index if not exists idx_queue_active_barber_slot_unique
  on public.queue using btree (barber_id, booking_date, time_slot)
  where barber_id is not null
    and booking_date is not null
    and time_slot is not null
    and status in ('waiting', 'accepted', 'confirmed', 'in_progress');

-- Function safety: prevent exposed API calls to internal SECURITY DEFINER helpers.
do $$
begin
  if to_regprocedure('public.update_updated_at()') is not null then
    alter function public.update_updated_at() set search_path = public;
  end if;

  if to_regprocedure('public.handle_new_user()') is not null then
    alter function public.handle_new_user() set search_path = public, auth;
  end if;

  if to_regprocedure('public.join_queue(uuid, uuid, uuid[], uuid)') is not null then
    alter function public.join_queue(uuid, uuid, uuid[], uuid) set search_path = public;
  end if;

  if to_regprocedure('public.register_salon(text, text, text, text, integer, integer)') is not null then
    alter function public.register_salon(text, text, text, text, integer, integer) set search_path = public;
  end if;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- RLS policy consolidation. Keep current authenticated behavior, remove anon queue reads.
alter table public.queue enable row level security;

drop policy if exists queue_select_public on public.queue;
drop policy if exists queue_select_availability on public.queue;
drop policy if exists queue_select_owner on public.queue;
create policy queue_select_authenticated
  on public.queue
  for select
  to authenticated
  using (true);

drop policy if exists queue_insert_customer on public.queue;
create policy queue_insert_customer
  on public.queue
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists queue_update_customer on public.queue;
drop policy if exists queue_update_owner on public.queue;
create policy queue_update_authenticated
  on public.queue
  for update
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and coalesce(status, '') in ('waiting', 'cancelled')
    )
    or exists (
      select 1
      from public.salons s
      where s.id = queue.salon_id
        and s.owner_id = (select auth.uid())
    )
  )
  with check (
    (
      user_id = (select auth.uid())
      and coalesce(status, '') in ('waiting', 'cancelled')
    )
    or exists (
      select 1
      from public.salons s
      where s.id = queue.salon_id
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists queue_delete_customer on public.queue;
create policy queue_delete_customer
  on public.queue
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- Remove duplicate broad reads while preserving public discovery data.
drop policy if exists "Allow public read" on public.salons;
drop policy if exists "Allow authenticated read" on public.salons;
drop policy if exists salons_select_public on public.salons;
create policy salons_select_public
  on public.salons
  for select
  to anon, authenticated
  using (true);

drop policy if exists barbers_select_all on public.barbers;
drop policy if exists barbers_select_public on public.barbers;
create policy barbers_select_public
  on public.barbers
  for select
  to anon, authenticated
  using (true);

drop policy if exists holidays_select_all on public.salon_holidays;
drop policy if exists holidays_select_public on public.salon_holidays;
create policy holidays_select_public
  on public.salon_holidays
  for select
  to anon, authenticated
  using (true);

drop policy if exists salons_insert_owner on public.salons;
create policy salons_insert_owner
  on public.salons
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists salons_update_owner on public.salons;
create policy salons_update_owner
  on public.salons
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists salons_delete_owner on public.salons;
create policy salons_delete_owner
  on public.salons
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists services_insert_owner on public.services;
create policy services_insert_owner
  on public.services
  for insert
  to authenticated
  with check (exists (
    select 1 from public.salons s
    where s.id = services.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists services_update_owner on public.services;
create policy services_update_owner
  on public.services
  for update
  to authenticated
  using (exists (
    select 1 from public.salons s
    where s.id = services.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists services_delete_owner on public.services;
create policy services_delete_owner
  on public.services
  for delete
  to authenticated
  using (exists (
    select 1 from public.salons s
    where s.id = services.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists barbers_insert_owner on public.barbers;
create policy barbers_insert_owner
  on public.barbers
  for insert
  to authenticated
  with check (exists (
    select 1 from public.salons s
    where s.id = barbers.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists barbers_update_owner on public.barbers;
create policy barbers_update_owner
  on public.barbers
  for update
  to authenticated
  using (exists (
    select 1 from public.salons s
    where s.id = barbers.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists barbers_delete_owner on public.barbers;
create policy barbers_delete_owner
  on public.barbers
  for delete
  to authenticated
  using (exists (
    select 1 from public.salons s
    where s.id = barbers.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists holidays_insert_owner on public.salon_holidays;
create policy holidays_insert_owner
  on public.salon_holidays
  for insert
  to authenticated
  with check (exists (
    select 1 from public.salons s
    where s.id = salon_holidays.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists holidays_delete_owner on public.salon_holidays;
create policy holidays_delete_owner
  on public.salon_holidays
  for delete
  to authenticated
  using (exists (
    select 1 from public.salons s
    where s.id = salon_holidays.salon_id
      and s.owner_id = (select auth.uid())
  ));

drop policy if exists notifications_owner_read on public.email_notifications;
create policy notifications_owner_read
  on public.email_notifications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.salons s
      where s.id = email_notifications.salon_id
        and s.owner_id = (select auth.uid())
    )
    or to_email = (
      select u.email::text
      from auth.users u
      where u.id = (select auth.uid())
    )
  );

-- Owner/profile duplicate cleanup without changing visible app behavior.
drop policy if exists owners_select_own on public.owners;
drop policy if exists owners_insert_own on public.owners;
drop policy if exists "Authenticated users can insert their own owner profile" on public.owners;
create policy owners_insert_own
  on public.owners
  for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists owners_update_own on public.owners;
drop policy if exists "Users can update their own owner profile" on public.owners;
create policy owners_update_own
  on public.owners
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "Users can delete their own owner profile" on public.owners;
create policy owners_delete_own
  on public.owners
  for delete
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_own on public.customer_profiles;
drop policy if exists profiles_select_own on public.customer_profiles;
drop policy if exists profiles_owner_read on public.customer_profiles;
create policy profiles_select_authenticated
  on public.customer_profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.queue q
      join public.salons s on s.id = q.salon_id
      where q.user_id = customer_profiles.id
        and s.owner_id = (select auth.uid())
    )
  );

drop policy if exists profiles_insert_own on public.customer_profiles;
create policy profiles_insert_own
  on public.customer_profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.customer_profiles;
create policy profiles_update_own
  on public.customer_profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

commit;
