-- Draft migration for the Snippr realtime queue upgrade.
-- Do not apply directly to production without validating the compatibility plan.

create table if not exists public.queue_bookings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  service_id uuid null references public.services(id) on delete set null,
  barber_id uuid null references public.barbers(id) on delete set null,
  customer_id uuid null references public.customers(id) on delete set null,
  customer_first_name text,
  customer_last_name text,
  customer_phone text,
  booking_date date,
  booking_time time,
  notes text,
  booking_status text not null default 'waiting',
  estimated_wait integer not null default 0,
  joined_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  verification_code_hash text,
  verification_verified boolean not null default false,
  verification_verified_at timestamptz,
  verification_attempt_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.queue_bookings
  add column if not exists position integer,
  add column if not exists status text,
  add column if not exists user_id uuid,
  add column if not exists time_slot text;

create index if not exists idx_queue_bookings_salon_status_joined
  on public.queue_bookings (salon_id, booking_status, joined_at desc);

create index if not exists idx_queue_bookings_salon_barber_status
  on public.queue_bookings (salon_id, barber_id, booking_status);

create index if not exists idx_queue_bookings_customer_joined
  on public.queue_bookings (customer_id, joined_at desc);

create index if not exists idx_queue_bookings_expires_at
  on public.queue_bookings (expires_at);

create or replace function public.cleanup_expired_queue_bookings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.queue_bookings
  set booking_status = 'expired', updated_at = now()
  where booking_status = 'waiting'
    and expires_at < now();
end;
$$;

alter table public.queue_bookings enable row level security;

create policy "Customers can read own queue rows"
on public.queue_bookings
for select
using (auth.uid() = customer_id);

create policy "Customers can insert own queue rows"
on public.queue_bookings
for insert
with check (auth.uid() = customer_id);

create policy "Customers can update own queue rows"
on public.queue_bookings
for update
using (auth.uid() = customer_id)
with check (auth.uid() = customer_id);

create policy "Salon owners can manage salon queue"
on public.queue_bookings
for all
using (
  exists (
    select 1
    from public.salons s
    where s.id = queue_bookings.salon_id
      and s.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.salons s
    where s.id = queue_bookings.salon_id
      and s.owner_id = auth.uid()
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queue_bookings'
  ) then
    alter publication supabase_realtime add table public.queue_bookings;
  end if;
end
$$;