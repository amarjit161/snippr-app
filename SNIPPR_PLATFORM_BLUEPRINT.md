# Snippr Platform Blueprint

This is the production architecture proposal for Snippr, written to preserve the current app while upgrading it into a scalable realtime salon platform.

## 1. Executive Summary

Snippr should keep the current frontend routes, auth flows, animations, and styling intact, while moving queue operations into a cleaner realtime architecture built around Supabase, Vercel, and edge-safe serverless modules.

The safest path is phased, not a rewrite:

1. Keep existing customer and owner routes working.
2. Keep current booking pages and dashboards intact.
3. Add a new canonical queue layer with compatibility bridges.
4. Add verification, realtime queue state, and analytics as isolated modules.
5. Migrate consumers gradually.

### Branding update

Replace all user-facing references to Smart Salon Queue with Snippr AI.

## 2. Full System Architecture

### Client layer

- Next.js frontend on Vercel
- Mobile-first UX with premium SaaS styling
- Route groups for customer, owner, and admin experiences
- Lazy loading for heavy dashboard and queue views
- Skeletons, toasts, optimistic UI, and motion-based state changes

### Application layer

- Supabase Auth for identity
- Supabase Realtime for queue movement and seat state
- Edge functions for server-side mutations that need trust or anti-abuse checks
- Small API routes only where direct client access is unsafe or repetitive

### Data layer

- Postgres on Supabase
- Canonical table: `queue_bookings`
- Core business tables: `salons`, `services`, `barbers`, `customers`, `notifications`
- Compatibility bridge for current `customer_bookings` references during rollout

### Realtime layer

- Broadcast queue updates from database writes to client subscriptions
- Use row-level channel filters by `salon_id`
- Avoid polling except as a rare fallback sync

### Trust and security layer

- RLS on every customer-owned table
- Admin-only verification actions executed via edge function or privileged server route
- Code expiration and brute-force tracking for arrival verification

## 3. Current State Versus Target State

### Current state

- The app already uses realtime queue logic.
- The app already has a customer booking flow and owner dashboard.
- The app already uses Supabase and protected routes.
- Queue reads and writes are still spread across `customer_bookings` and related helpers.
- Some queue code still falls back to periodic syncing; this should be narrowed to a rare recovery path only.
- Realtime queue updates should be normalized around one canonical table to avoid duplicate state paths.

### Target state

- `queue_bookings` becomes the canonical queue record.
- `customer_bookings` remains available as a compatibility bridge during rollout.
- Verification, expiry, and status transitions are stored in the queue record.
- Realtime subscribers observe one source of truth.

## 4. Folder Structure Improvements

Keep the existing routes and components. Add focused modules instead of flattening everything into pages.

### Recommended structure

```text
src/
  app/
    layout/
    routes/
    providers/
  features/
    auth/
    queue/
    salons/
    verification/
    notifications/
    analytics/
  components/
    ui/
    shared/
    mobile/
  hooks/
    realtime/
    useQueueSubscription.ts
    useVerificationCode.ts
  services/
    supabase/
    queue/
    verification/
    notifications/
    ai/
  lib/
    security/
    formatters/
    constants/
  types/
  pages/
```

### Why this helps

- Keeps route files thin.
- Separates realtime concerns from UI concerns.
- Makes future mobile app support easier.
- Makes testing and reuse much simpler.

## 5. API Structure

Prefer small, purpose-built server entry points.

### Recommended endpoints

- `POST /api/queue/join`
- `POST /api/queue/confirm-arrival`
- `POST /api/queue/advance`
- `POST /api/queue/cancel`
- `POST /api/queue/no-show`
- `POST /api/verification/generate-code`
- `POST /api/verification/verify-code`
- `GET /api/queue/status?salonId=...`
- `GET /api/admin/queue-analytics?salonId=...`

### Rules

- Only write through authenticated routes or edge functions.
- Never expose admin-only transitions directly from the browser.
- Keep read APIs cacheable where appropriate.

## 6. Realtime Architecture

### Queue movement model

1. Customer joins queue.
2. Server creates a queue row with status `waiting`.
3. Server calculates initial estimated wait.
4. Supabase Realtime broadcasts the insert.
5. Customers and admins update instantly.
6. Admin marks arrival and confirms with verification code.
7. Status transitions update the same record and rebroadcast.

### Subscription strategy

- Subscribe by salon.
- Subscribe only to the rows needed for the active screen.
- Merge updates client-side instead of refetching the whole list on every change.

### Avoid

- Continuous polling.
- Full table reloads on every status change.
- Storing live queue state in large global stores unless needed.

## 7. Verification Code Module

### Required behavior

- Generate a secure 4-digit code inside the website or app.
- Do not use SMS OTP for this flow.
- Code is visible to the customer in the app/website.
- Admin enters the code at arrival to verify the booking.
- Code expires after 15 minutes.
- Failed attempts are rate-limited.

### Suggested flow

1. Customer joins queue.
2. Server generates code.
3. Store a hashed version of the code, never plain text in logs.
4. Show the plain code to the customer once.
5. Admin asks customer for the code at arrival.
6. Admin enters the code.
7. Server verifies hash, expiry, salon scope, and attempt count.
8. Booking becomes verified and proceeds to seat confirmation.

### Anti-abuse rules

- Lock after repeated failures.
- Bind code to salon and booking.
- Expire automatically.
- Reject reused or stale codes.

## 8. Database Architecture

### Required tables

- `salons`
- `services`
- `queue_bookings`
- `barbers`
- `customers`
- `notifications`

### `queue_bookings` required columns

- `verification_code`
- `verification_verified`
- `booking_status`
- `estimated_wait`
- `joined_at`
- `expires_at`

### Keep existing columns

Do not remove current queue or booking columns. Add only additive changes during rollout.

### Recommended indexes

- `(salon_id, booking_status, joined_at)`
- `(salon_id, barber_id, booking_status)`
- `(verification_code)` partial or hashed lookup helper
- `(expires_at)` for cleanup jobs
- `(customer_id, joined_at desc)` for customer history

## 9. Supabase Migration SQL

This migration is a safe draft. Apply it in a staging branch first.

### Draft migration

```sql
-- 1) Canonical queue table for realtime operations
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

-- 2) Preserve current compatibility columns by adding only if they do not exist
alter table public.queue_bookings
  add column if not exists position integer,
  add column if not exists status text;

-- 3) Indexes for realtime and queue lookups
create index if not exists idx_queue_bookings_salon_status_joined
  on public.queue_bookings (salon_id, booking_status, joined_at desc);

create index if not exists idx_queue_bookings_salon_barber_status
  on public.queue_bookings (salon_id, barber_id, booking_status);

create index if not exists idx_queue_bookings_customer_joined
  on public.queue_bookings (customer_id, joined_at desc);

create index if not exists idx_queue_bookings_expires_at
  on public.queue_bookings (expires_at);

-- 4) Cleanup helper for expired verification codes and stale pending bookings
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

-- 5) RLS
alter table public.queue_bookings enable row level security;

-- customers can read their own queue rows
create policy "Customers can read own queue rows"
on public.queue_bookings
for select
using (auth.uid() = customer_id);

-- customers can insert only their own booking row
create policy "Customers can insert own queue rows"
on public.queue_bookings
for insert
with check (auth.uid() = customer_id);

-- customers can update only limited fields on their own active booking
create policy "Customers can update own queue rows"
on public.queue_bookings
for update
using (auth.uid() = customer_id)
with check (auth.uid() = customer_id);

-- salon owners/admins should be restricted via an ownership check or service role
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

-- 6) Publication
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
```

### Rollout note

If you want zero downtime, keep `customer_bookings` live during the cutover and migrate clients in stages.

## 10. Security Recommendations

- Enforce RLS on all customer and salon-owned tables.
- Keep admin verification mutations server-side.
- Hash verification codes before storing.
- Rate limit verification attempts per booking and per IP.
- Sanitize all user-provided notes and names.
- Use service role only in trusted server or edge functions.
- Reject any queue action for expired rows.

## 11. Performance Improvements

- Lazy load dashboard-heavy pages.
- Paginate queue and booking history.
- Subscribe to one salon at a time.
- Merge realtime payloads locally.
- Keep images on optimized CDN sources.
- Avoid broad re-renders by splitting queue state into small hooks.
- Keep expensive analytics off the hot path.

## 12. UX Improvements

- Bottom mobile navigation.
- Live queue badge with position and ETA.
- Animated queue movement when a booking changes position.
- Verification success animation with a clear next step.
- Glassmorphism cards for queue and booking state.
- Skeleton loaders for salon lists and dashboard panels.
- Toast feedback for every important mutation.

## 13. Error Handling Strategy

- Show a friendly empty state when the queue is empty.
- Show a retry action on realtime connection failure.
- Keep optimistic UI but revert on API error.
- Log to a server-side sink for admin actions and verification failures.
- Surface business errors separately from transport errors.
- Never block the whole page because one queue card fails.

## 14. Vercel Optimization Strategy

- Keep client-side pages split by feature.
- Use edge runtime only for lightweight checks.
- Avoid serverless functions that do heavy queue scans.
- Cache static salon and service data where safe.
- Put verification and queue mutations behind small server endpoints.
- Use image optimization for hero and salon images.
- Prefer incremental updates over re-fetching full lists.

## 15. Suggested Code Refactors

- Move queue state logic out of page components into feature hooks.
- Create a verification service module.
- Create a queue mutation service module.
- Create a shared realtime subscription utility.
- Normalize queue status constants in one file.
- Replace magic strings with typed enums or union types.
- Split admin dashboard into smaller feature sections.

## 16. Missing Scalability Improvements

- Queue sharding by salon for high-volume operators.
- Analytics materialized views for dashboard speed.
- Background job for expiry cleanup.
- Anti-abuse counters for verification attempts.
- Optional push notification support for queue movement.
- Optional mobile deep-link support for future apps.

## 17. Future-Ready Features

- QR verification.
- Loyalty rewards.
- WhatsApp notifications.
- Payments and prepayment deposits.
- AI hairstyle recommendations.
- Franchise management.

## 18. Production Deployment Checklist

- Confirm existing routes still resolve.
- Confirm current booking flow works end to end.
- Confirm owner dashboard can read and update queue data.
- Confirm realtime subscriptions fire on insert, update, delete.
- Confirm verification code generation expires correctly.
- Confirm RLS blocks cross-user access.
- Confirm edge functions are deployed with secrets.
- Confirm Vercel env vars match Supabase project settings.
- Confirm mobile layout on iPhone and Android widths.
- Confirm fallback states for offline and auth loss.

## 19. Safe Fix Summary

If you see issues in the current codebase, the safe fix is to modularize, not rewrite:

- Preserve the current UI and routes.
- Add a canonical queue layer behind the scenes.
- Introduce verification as an additive feature.
- Move riskier actions into server or edge handlers.
- Keep realtime subscriptions narrow and salon-scoped.

This is the correct production approach for a system that needs to scale like Swiggy, Zomato, Urban Company, or Uber-style live queue operations without breaking the current product.