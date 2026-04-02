-- Ensure owners table exists in public schema for owner login/register flow
create extension if not exists "uuid-ossp";

create table if not exists public.owners (
  id uuid primary key default uuid_generate_v4(),
  name text,
  owner_name text,
  email text unique,
  password text,
  phone text,
  is_verified boolean not null default false,
  created_at timestamp default now()
);

alter table public.owners add column if not exists name text;
alter table public.owners add column if not exists owner_name text;
alter table public.owners add column if not exists phone text;
alter table public.owners add column if not exists is_verified boolean not null default false;

update public.owners
set owner_name = coalesce(owner_name, name)
where owner_name is null;

update public.owners
set name = coalesce(name, owner_name)
where name is null;

alter table public.owners enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owners' and policyname = 'Allow insert'
  ) then
    create policy "Allow insert"
    on public.owners
    for insert
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'owners' and policyname = 'Allow read'
  ) then
    create policy "Allow read"
    on public.owners
    for select
    using (true);
  end if;
end $$;

notify pgrst, 'reload schema';
