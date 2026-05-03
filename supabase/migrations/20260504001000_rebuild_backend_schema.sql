create extension if not exists pgcrypto;

-- =====================================================
-- ENUMS (idempotent)
-- =====================================================
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'app_role' and n.nspname = 'public') then
    create type public.app_role as enum ('admin', 'agent', 'subagent');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'network_type' and n.nspname = 'public') then
    create type public.network_type as enum ('MTN', 'Telecel', 'AirtelTigo');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'checker_type' and n.nspname = 'public') then
    create type public.checker_type as enum ('BECE', 'WASSCE');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'order_status' and n.nspname = 'public') then
    create type public.order_status as enum ('processing', 'delivered', 'failed', 'refunded');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'buyer_type' and n.nspname = 'public') then
    create type public.buyer_type as enum ('public', 'agent', 'subagent');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'withdrawal_status' and n.nspname = 'public') then
    create type public.withdrawal_status as enum ('pending', 'approved', 'rejected', 'paid');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'store_template' and n.nspname = 'public') then
    create type public.store_template as enum ('neon', 'minimal', 'bold');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'notification_type' and n.nspname = 'public') then
    create type public.notification_type as enum ('info', 'success', 'warning', 'alert');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'notification_audience' and n.nspname = 'public') then
    create type public.notification_audience as enum ('all', 'agents', 'public');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typname = 'wallet_tx_type' and n.nspname = 'public') then
    create type public.wallet_tx_type as enum ('topup', 'purchase', 'commission', 'withdrawal', 'refund', 'adjustment');
  end if;
end
$$;

-- =====================================================
-- UTILITY TRIGGER FUNCTION
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================
-- PROFILES (migrate legacy shape to app shape)
-- =====================================================
alter table public.profiles add column if not exists name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists store_slug text;
alter table public.profiles add column if not exists store_template public.store_template;
alter table public.profiles add column if not exists store_logo text;
alter table public.profiles add column if not exists store_brand text;
alter table public.profiles add column if not exists parent_agent_id uuid;
alter table public.profiles add column if not exists api_key text;
alter table public.profiles add column if not exists referral_code text;
alter table public.profiles add column if not exists wallet_balance numeric(12,2) default 0;
alter table public.profiles add column if not exists total_sales integer default 0;
alter table public.profiles add column if not exists total_referrals integer default 0;
alter table public.profiles add column if not exists badges text[] default '{}';
alter table public.profiles add column if not exists active boolean default true;

update public.profiles
set name = coalesce(nullif(name, ''), coalesce(full_name, ''))
where coalesce(name, '') = '';
update public.profiles set phone = '' where phone is null;
update public.profiles set store_template = 'neon' where store_template is null;
update public.profiles set wallet_balance = 0 where wallet_balance is null;
update public.profiles set total_sales = 0 where total_sales is null;
update public.profiles set total_referrals = 0 where total_referrals is null;
update public.profiles set badges = '{}' where badges is null;
update public.profiles set active = true where active is null;

alter table public.profiles alter column name set default '';
alter table public.profiles alter column phone set default '';
alter table public.profiles alter column store_template set default 'neon';
alter table public.profiles alter column wallet_balance set default 0;
alter table public.profiles alter column total_sales set default 0;
alter table public.profiles alter column total_referrals set default 0;
alter table public.profiles alter column badges set default '{}';
alter table public.profiles alter column active set default true;

alter table public.profiles alter column name set not null;
alter table public.profiles alter column phone set not null;
alter table public.profiles alter column wallet_balance set not null;
alter table public.profiles alter column total_sales set not null;
alter table public.profiles alter column total_referrals set not null;
alter table public.profiles alter column badges set not null;
alter table public.profiles alter column active set not null;

create unique index if not exists profiles_store_slug_key on public.profiles(store_slug);
create unique index if not exists profiles_api_key_key on public.profiles(api_key);
create unique index if not exists profiles_referral_code_key on public.profiles(referral_code);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_parent_agent_id_fkey') then
    alter table public.profiles
      add constraint profiles_parent_agent_id_fkey
      foreign key (parent_agent_id) references public.profiles(id) on delete set null;
  end if;
end
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- =====================================================
-- USER ROLES + ACCESS HELPERS
-- =====================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = 'admin'
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text;
  _phone text;
  _slug text;
  _ref text;
  _api text;
begin
  _name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  _phone := coalesce(new.raw_user_meta_data->>'phone', '');
  _slug := coalesce(new.raw_user_meta_data->>'store_slug',
    lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 6));
  _ref := 'BOSS-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  _api := 'bd_live_' || replace(new.id::text, '-', '') || substr(md5(random()::text), 1, 8);

  insert into public.profiles (id, name, phone, store_slug, store_brand, referral_code, api_key)
  values (new.id, _name, _phone, _slug, _name || '''s Data Store', _ref, _api)
  on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    store_slug = coalesce(public.profiles.store_slug, excluded.store_slug),
    store_brand = coalesce(public.profiles.store_brand, excluded.store_brand),
    referral_code = coalesce(public.profiles.referral_code, excluded.referral_code),
    api_key = coalesce(public.profiles.api_key, excluded.api_key);

  insert into public.user_roles (user_id, role)
  values (new.id, 'agent')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Profiles RLS policies
create policy "Profiles viewable by self" on public.profiles for select
  to authenticated using (auth.uid() = id);
create policy "Profiles viewable by admin" on public.profiles for select
  to authenticated using (public.is_admin(auth.uid()));
create policy "Profiles viewable by parent agent" on public.profiles for select
  to authenticated using (parent_agent_id = auth.uid());
create policy "Public can view store profiles by slug" on public.profiles for select
  to anon, authenticated using (store_slug is not null and active = true);
create policy "Users update own profile" on public.profiles for update
  to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Admin updates any profile" on public.profiles for update
  to authenticated using (public.is_admin(auth.uid()));

create policy "Users see own roles" on public.user_roles for select
  to authenticated using (user_id = auth.uid());
create policy "Admin sees all roles" on public.user_roles for select
  to authenticated using (public.is_admin(auth.uid()));
create policy "Admin manages roles" on public.user_roles for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- CATALOG
-- =====================================================
create table if not exists public.data_packages (
  id uuid primary key default gen_random_uuid(),
  network public.network_type not null,
  size text not null,
  validity text not null,
  price_public numeric(10,2) not null,
  price_agent numeric(10,2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists data_packages_updated_at on public.data_packages;
create trigger data_packages_updated_at
before update on public.data_packages
for each row execute function public.set_updated_at();

alter table public.data_packages enable row level security;
create policy "Anyone views active packages" on public.data_packages for select
  to anon, authenticated using (active = true or public.is_admin(auth.uid()));
create policy "Admin manages packages" on public.data_packages for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.checker_packages (
  id uuid primary key default gen_random_uuid(),
  type public.checker_type not null,
  price_public numeric(10,2) not null,
  price_agent numeric(10,2) not null,
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists checker_packages_updated_at on public.checker_packages;
create trigger checker_packages_updated_at
before update on public.checker_packages
for each row execute function public.set_updated_at();

alter table public.checker_packages enable row level security;
create policy "Anyone views active checkers" on public.checker_packages for select
  to anon, authenticated using (active = true or public.is_admin(auth.uid()));
create policy "Admin manages checkers" on public.checker_packages for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- COMMERCE
-- =====================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  product_label text not null,
  network public.network_type,
  recipient text not null,
  email text,
  amount numeric(10,2) not null,
  status public.order_status not null default 'processing',
  buyer_type public.buyer_type not null default 'public',
  agent_id uuid,
  pin_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_agent_idx on public.orders(agent_id);
create index if not exists orders_ref_idx on public.orders(ref);

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.orders enable row level security;
create policy "Anyone can place an order" on public.orders for insert
  to anon, authenticated with check (true);
create policy "Anyone can look up an order" on public.orders for select
  to anon, authenticated using (true);
create policy "Admin manages orders" on public.orders for update
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admin deletes orders" on public.orders for delete
  to authenticated using (public.is_admin(auth.uid()));

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type public.wallet_tx_type not null,
  amount numeric(10,2) not null,
  description text,
  ref text,
  created_at timestamptz not null default now()
);

create index if not exists wallet_tx_user_idx on public.wallet_transactions(user_id);

alter table public.wallet_transactions enable row level security;
create policy "Users see own wallet tx" on public.wallet_transactions for select
  to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Users insert own wallet tx" on public.wallet_transactions for insert
  to authenticated with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Admin manages wallet tx" on public.wallet_transactions for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  amount numeric(10,2) not null,
  momo_number text not null,
  network public.network_type not null,
  account_name text not null,
  status public.withdrawal_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists withdrawals_updated_at on public.withdrawals;
create trigger withdrawals_updated_at
before update on public.withdrawals
for each row execute function public.set_updated_at();

alter table public.withdrawals enable row level security;
create policy "Agents see own withdrawals" on public.withdrawals for select
  to authenticated using (agent_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Agents request withdrawals" on public.withdrawals for insert
  to authenticated with check (agent_id = auth.uid());
create policy "Admin manages withdrawals" on public.withdrawals for update
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- FREE DATA CAMPAIGNS
-- =====================================================
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  data_size text not null,
  network public.network_type not null,
  total_codes integer not null default 0,
  redeemed integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists campaigns_updated_at on public.campaigns;
create trigger campaigns_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;
create policy "Anyone views active campaigns" on public.campaigns for select
  to anon, authenticated using (active = true or public.is_admin(auth.uid()));
create policy "Admin manages campaigns" on public.campaigns for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.campaign_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code text not null unique,
  redeemed boolean not null default false,
  redeemed_by text,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists campaign_codes_campaign_idx on public.campaign_codes(campaign_id);
create index if not exists campaign_codes_code_idx on public.campaign_codes(code);

alter table public.campaign_codes enable row level security;
create policy "Admin manages campaign codes" on public.campaign_codes for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(phone)
);

alter table public.redemptions enable row level security;
create policy "Admin sees redemptions" on public.redemptions for select
  to authenticated using (public.is_admin(auth.uid()));

create or replace function public.redeem_code(_code text, _phone text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  _row public.campaign_codes%rowtype;
  _camp public.campaigns%rowtype;
begin
  if _phone !~ '^0\d{9}$' then
    return json_build_object('ok', false, 'message', 'Enter a valid Ghana phone (10 digits).');
  end if;

  if exists (select 1 from public.redemptions where phone = _phone) then
    return json_build_object('ok', false, 'message', 'This phone number has already redeemed a code.');
  end if;

  select * into _row
  from public.campaign_codes
  where code = upper(trim(_code)) and redeemed = false
  limit 1;

  if not found then
    return json_build_object('ok', false, 'message', 'Invalid or expired code.');
  end if;

  select * into _camp
  from public.campaigns
  where id = _row.campaign_id and active = true;

  if not found then
    return json_build_object('ok', false, 'message', 'Campaign is no longer active.');
  end if;

  update public.campaign_codes
  set redeemed = true, redeemed_by = _phone, redeemed_at = now()
  where id = _row.id;

  update public.campaigns
  set redeemed = redeemed + 1
  where id = _camp.id;

  insert into public.redemptions (phone, code, campaign_id)
  values (_phone, _row.code, _camp.id);

  return json_build_object('ok', true, 'message', 'Success! ' || _camp.data_size || ' ' || _camp.network::text || ' will be sent to ' || _phone || '.');
end;
$$;

grant execute on function public.redeem_code(text, text) to anon, authenticated;

-- =====================================================
-- COMMUNICATION
-- =====================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  type public.notification_type not null default 'info',
  audience public.notification_audience not null default 'all',
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "Anyone reads public notifications" on public.notifications for select
  to anon, authenticated using (audience in ('all', 'public'));
create policy "Agents read agent notifications" on public.notifications for select
  to authenticated using (audience in ('all', 'agents'));
create policy "Admin manages notifications" on public.notifications for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table if not exists public.site_settings (
  id integer primary key default 1,
  site_name text not null default 'BossuDataGH',
  whatsapp_number text not null default '233500000000',
  agent_fee numeric(10,2) not null default 50,
  min_withdrawal numeric(10,2) not null default 20,
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'We are currently performing scheduled maintenance. Please check back shortly.',
  banner text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;
create policy "Anyone reads settings" on public.site_settings for select
  to anon, authenticated using (true);
create policy "Admin updates settings" on public.site_settings for update
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- OPTIONAL: agent storefront package pricing (existing app migration)
-- =====================================================
create table if not exists public.agent_store_packages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  package_id uuid not null references public.data_packages(id) on delete cascade,
  sale_price numeric not null check (sale_price > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, package_id)
);

create index if not exists idx_agent_store_packages_agent on public.agent_store_packages(agent_id);

drop trigger if exists trg_agent_store_packages_updated on public.agent_store_packages;
create trigger trg_agent_store_packages_updated
before update on public.agent_store_packages
for each row execute function public.set_updated_at();

alter table public.agent_store_packages enable row level security;
create policy "Agents manage own store packages" on public.agent_store_packages for all
  to authenticated using (agent_id = auth.uid()) with check (agent_id = auth.uid());
create policy "Admins manage all store packages" on public.agent_store_packages for all
  to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
create policy "Public views active store packages" on public.agent_store_packages for select
  to anon, authenticated using (
    active = true
    and exists (
      select 1 from public.profiles p
      where p.id = agent_id and p.active = true and p.store_slug is not null
    )
  );

create or replace function public.record_agent_sale(
  _agent_id uuid,
  _package_id uuid,
  _sale_price numeric,
  _order_ref text
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  _agent_cost numeric;
  _profit numeric;
  _new_bal numeric;
begin
  select price_agent into _agent_cost
  from public.data_packages
  where id = _package_id;

  if _agent_cost is null then
    return json_build_object('ok', false, 'message', 'Unknown package');
  end if;

  _profit := greatest(_sale_price - _agent_cost, 0);
  if _profit = 0 then
    return json_build_object('ok', true, 'profit', 0);
  end if;

  update public.profiles
  set wallet_balance = wallet_balance + _profit,
      total_sales = coalesce(total_sales, 0) + 1
  where id = _agent_id
  returning wallet_balance into _new_bal;

  insert into public.wallet_transactions (user_id, type, amount, description, ref)
  values (_agent_id, 'commission', _profit, 'Store sale profit (' || _sale_price::text || ' - ' || _agent_cost::text || ')', _order_ref);

  return json_build_object('ok', true, 'profit', _profit, 'balance', _new_bal);
end;
$$;

-- =====================================================
-- Realtime publication safety
-- =====================================================
alter table public.orders replica identity full;
alter table public.withdrawals replica identity full;
alter table public.notifications replica identity full;
alter table public.data_packages replica identity full;
alter table public.checker_packages replica identity full;
alter table public.campaigns replica identity full;
alter table public.agent_store_packages replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.withdrawals; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.data_packages; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.checker_packages; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.campaigns; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.agent_store_packages; exception when duplicate_object then null; when undefined_object then null; end;
end
$$;
