-- =====================================================
-- ENUMS
-- =====================================================
create type public.app_role as enum ('admin', 'agent', 'subagent');
create type public.network_type as enum ('MTN', 'Telecel', 'AirtelTigo');
create type public.checker_type as enum ('BECE', 'WASSCE');
create type public.order_status as enum ('processing', 'delivered', 'failed', 'refunded');
create type public.buyer_type as enum ('public', 'agent', 'subagent');
create type public.withdrawal_status as enum ('pending', 'approved', 'rejected', 'paid');
create type public.store_template as enum ('neon', 'minimal', 'bold');
create type public.notification_type as enum ('info', 'success', 'warning', 'alert');
create type public.notification_audience as enum ('all', 'agents', 'public');
create type public.wallet_tx_type as enum ('topup', 'purchase', 'commission', 'withdrawal', 'refund', 'adjustment');

-- =====================================================
-- UTILITY: updated_at trigger
-- =====================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================
-- PROFILES
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  store_slug text unique,
  store_template public.store_template default 'neon',
  store_logo text,
  store_brand text,
  parent_agent_id uuid references public.profiles(id) on delete set null,
  api_key text unique,
  referral_code text unique,
  wallet_balance numeric(12,2) not null default 0,
  total_sales integer not null default 0,
  total_referrals integer not null default 0,
  badges text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- =====================================================
-- USER ROLES (separate table — security best practice)
-- =====================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin')
$$;

-- =====================================================
-- AUTO-CREATE PROFILE + AGENT ROLE ON SIGNUP
-- =====================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
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
  _api := 'sk_live_' || replace(new.id::text, '-', '') || substr(md5(random()::text), 1, 8);

  insert into public.profiles (id, name, phone, store_slug, store_brand, referral_code, api_key)
  values (new.id, _name, _phone, _slug, _name || '''s Data Store', _ref, _api);

  insert into public.user_roles (user_id, role) values (new.id, 'agent');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profile RLS
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

-- user_roles RLS
create policy "Users see own roles" on public.user_roles for select
  to authenticated using (user_id = auth.uid());
create policy "Admin sees all roles" on public.user_roles for select
  to authenticated using (public.is_admin(auth.uid()));
create policy "Admin manages roles" on public.user_roles for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- DATA PACKAGES
-- =====================================================
create table public.data_packages (
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
create trigger data_packages_updated_at before update on public.data_packages
  for each row execute function public.set_updated_at();
alter table public.data_packages enable row level security;
create policy "Anyone views active packages" on public.data_packages for select
  to anon, authenticated using (active = true or public.is_admin(auth.uid()));
create policy "Admin manages packages" on public.data_packages for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- CHECKER PACKAGES
-- =====================================================
create table public.checker_packages (
  id uuid primary key default gen_random_uuid(),
  type public.checker_type not null,
  price_public numeric(10,2) not null,
  price_agent numeric(10,2) not null,
  stock integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger checker_packages_updated_at before update on public.checker_packages
  for each row execute function public.set_updated_at();
alter table public.checker_packages enable row level security;
create policy "Anyone views active checkers" on public.checker_packages for select
  to anon, authenticated using (active = true or public.is_admin(auth.uid()));
create policy "Admin manages checkers" on public.checker_packages for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- ORDERS
-- =====================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text unique not null,
  product_label text not null,
  network public.network_type,
  recipient text not null,
  email text,
  amount numeric(10,2) not null,
  status public.order_status not null default 'processing',
  buyer_type public.buyer_type not null default 'public',
  agent_id uuid references public.profiles(id) on delete set null,
  pin_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create index orders_agent_idx on public.orders(agent_id);
create index orders_ref_idx on public.orders(ref);
alter table public.orders enable row level security;

create policy "Anyone can place an order" on public.orders for insert
  to anon, authenticated with check (true);
create policy "Anyone can look up an order" on public.orders for select
  to anon, authenticated using (true);
create policy "Admin manages orders" on public.orders for update
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "Admin deletes orders" on public.orders for delete
  to authenticated using (public.is_admin(auth.uid()));

-- =====================================================
-- WALLET TRANSACTIONS
-- =====================================================
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.wallet_tx_type not null,
  amount numeric(10,2) not null,
  description text,
  ref text,
  created_at timestamptz not null default now()
);
create index wallet_tx_user_idx on public.wallet_transactions(user_id);
alter table public.wallet_transactions enable row level security;
create policy "Users see own wallet tx" on public.wallet_transactions for select
  to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Users insert own wallet tx" on public.wallet_transactions for insert
  to authenticated with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Admin manages wallet tx" on public.wallet_transactions for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- WITHDRAWALS
-- =====================================================
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  momo_number text not null,
  network public.network_type not null,
  account_name text not null,
  status public.withdrawal_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger withdrawals_updated_at before update on public.withdrawals
  for each row execute function public.set_updated_at();
alter table public.withdrawals enable row level security;
create policy "Agents see own withdrawals" on public.withdrawals for select
  to authenticated using (agent_id = auth.uid() or public.is_admin(auth.uid()));
create policy "Agents request withdrawals" on public.withdrawals for insert
  to authenticated with check (agent_id = auth.uid());
create policy "Admin manages withdrawals" on public.withdrawals for update
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- =====================================================
-- CAMPAIGNS + CODES + REDEMPTIONS
-- =====================================================
create table public.campaigns (
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
create trigger campaigns_updated_at before update on public.campaigns
  for each row execute function public.set_updated_at();
alter table public.campaigns enable row level security;
create policy "Anyone views active campaigns" on public.campaigns for select
  to anon, authenticated using (active = true or public.is_admin(auth.uid()));
create policy "Admin manages campaigns" on public.campaigns for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.campaign_codes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  code text not null unique,
  redeemed boolean not null default false,
  redeemed_by text,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
create index campaign_codes_campaign_idx on public.campaign_codes(campaign_id);
create index campaign_codes_code_idx on public.campaign_codes(code);
alter table public.campaign_codes enable row level security;
create policy "Admin manages campaign codes" on public.campaign_codes for all
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
-- Note: redemption goes through a security-definer RPC; no public select needed.

create table public.redemptions (
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

-- Redemption RPC
create or replace function public.redeem_code(_code text, _phone text)
returns json language plpgsql security definer set search_path = public as $$
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
  select * into _row from public.campaign_codes where code = upper(trim(_code)) and redeemed = false limit 1;
  if not found then
    return json_build_object('ok', false, 'message', 'Invalid or expired code.');
  end if;
  select * into _camp from public.campaigns where id = _row.campaign_id and active = true;
  if not found then
    return json_build_object('ok', false, 'message', 'Campaign is no longer active.');
  end if;
  update public.campaign_codes set redeemed = true, redeemed_by = _phone, redeemed_at = now() where id = _row.id;
  update public.campaigns set redeemed = redeemed + 1 where id = _camp.id;
  insert into public.redemptions (phone, code, campaign_id) values (_phone, _row.code, _camp.id);
  return json_build_object('ok', true, 'message', 'Success! ' || _camp.data_size || ' ' || _camp.network::text || ' will be sent to ' || _phone || '.');
end;
$$;
grant execute on function public.redeem_code(text, text) to anon, authenticated;

-- =====================================================
-- NOTIFICATIONS
-- =====================================================
create table public.notifications (
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

-- =====================================================
-- SITE SETTINGS (single row)
-- =====================================================
create table public.site_settings (
  id integer primary key default 1,
  site_name text not null default 'BossuData',
  whatsapp_number text not null default '233500000000',
  agent_fee numeric(10,2) not null default 50,
  min_withdrawal numeric(10,2) not null default 20,
  maintenance_mode boolean not null default false,
  maintenance_message text not null default 'We are currently performing scheduled maintenance. Please check back shortly.',
  banner text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();
insert into public.site_settings (id) values (1);
alter table public.site_settings enable row level security;
create policy "Anyone reads settings" on public.site_settings for select
  to anon, authenticated using (true);
create policy "Admin updates settings" on public.site_settings for update
  to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));