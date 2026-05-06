-- Auth and profile foundation for GetEasyData.
-- This migration creates a public profiles table linked 1:1 with auth.users.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'agent', 'subagent');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'agent',
  name text,
  phone text,
  store_slug text,
  store_template text,
  store_logo text,
  store_brand text,
  parent_agent_id uuid references public.profiles(id) on delete set null,
  api_key text,
  referral_code text,
  wallet_balance numeric not null default 0,
  total_sales numeric not null default 0,
  total_referrals integer not null default 0,
  badges text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Handle existing data for role and store_slug
alter table public.profiles drop constraint if exists profiles_store_slug_key;
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  alter column role drop default;

update public.profiles
set role = 'agent'
where role is null
   or role not in ('admin', 'agent', 'subagent');

alter table public.profiles
  alter column role set default 'agent',
  alter column role set not null;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'agent', 'subagent'));

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_parent_agent_id on public.profiles(parent_agent_id);
create unique index if not exists idx_profiles_store_slug_unique on public.profiles(store_slug) where store_slug is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'agent');

  insert into public.profiles (
    id,
    role,
    name,
    phone,
    store_slug,
    active
  )
  values (
    new.id,
    case
      when requested_role in ('admin', 'agent', 'subagent') then requested_role::public.app_role
      else 'agent'::public.app_role
    end,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'store_slug',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_profiles_touch_updated_at on public.profiles;

create trigger tr_profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_profiles_updated_at();
