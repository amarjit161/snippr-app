alter table public.owners
add column if not exists is_verified boolean not null default false;
