alter table public.queue
add column if not exists started_at timestamp with time zone default now();
