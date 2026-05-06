-- =============================================================================
-- GetEasyData – Full Production Schema
-- Migration: 20260506100000_full_schema.sql
-- Builds on top of: 20260506093000_auth_profiles.sql
--
-- Tables:  data_bundles, checker_packages, stores, agent_packages, orders,
--          transactions, withdrawals, agent_applications, free_data_campaigns,
--          campaign_codes, notifications, notification_reads, site_settings
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

do $$ begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum (
      'data_purchase',   -- guest / public user buying data
      'agent_upgrade',   -- user paying to become an agent
      'agent_order',     -- agent buying data from their own wallet
      'wallet_topup',    -- admin manual top-up
      'withdrawal',      -- agent cash-out
      'refund',          -- refund of a failed order
      'commission'       -- profit credited to agent after delivery
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'transaction_status') then
    create type public.transaction_status as enum ('pending', 'completed', 'failed', 'reversed');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type public.order_status as enum ('processing', 'delivered', 'failed', 'refunded');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'withdrawal_status') then
    create type public.withdrawal_status as enum ('pending', 'approved', 'rejected', 'paid');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'network_type') then
    create type public.network_type as enum ('MTN', 'Telecel', 'AirtelTigo');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'checker_type') then
    create type public.checker_type as enum ('BECE', 'WASSCE');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum ('info', 'success', 'warning', 'alert');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'notification_audience') then
    create type public.notification_audience as enum ('all', 'agents', 'public');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'agent_application_status') then
    create type public.agent_application_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- =============================================================================
-- GENERIC updated_at TRIGGER FUNCTION
-- =============================================================================

create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- TABLE: data_bundles
-- Base packages configured by admin. Agents inherit these and add a margin.
-- =============================================================================

create table if not exists public.data_bundles (
  id            uuid        primary key default gen_random_uuid(),
  network       public.network_type not null,
  label         text        not null,            -- e.g. "1GB – 30 Days"
  size_mb       integer     not null,            -- numeric size for sorting/comparison
  validity_days integer     not null,
  price_public  numeric(10,2) not null,          -- price for guest / public buyers
  price_agent   numeric(10,2) not null,          -- base cost charged to agents
  active        boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_data_bundles_network on public.data_bundles (network);
create index if not exists idx_data_bundles_active  on public.data_bundles (active);

drop trigger if exists tr_data_bundles_updated_at on public.data_bundles;
create trigger tr_data_bundles_updated_at
  before update on public.data_bundles
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- TABLE: checker_packages
-- BECE / WASSCE scratch-card checker codes.
-- =============================================================================

create table if not exists public.checker_packages (
  id           uuid        primary key default gen_random_uuid(),
  checker_type public.checker_type not null,
  price_public numeric(10,2) not null,
  price_agent  numeric(10,2) not null,
  stock        integer     not null default 0,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists tr_checker_packages_updated_at on public.checker_packages;
create trigger tr_checker_packages_updated_at
  before update on public.checker_packages
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- TABLE: stores
-- Each agent has exactly one store (unique constraint on agent_id).
-- =============================================================================

create table if not exists public.stores (
  id          uuid    primary key default gen_random_uuid(),
  agent_id    uuid    not null references public.profiles (id) on delete cascade,
  slug        text    not null unique,
  brand_name  text,
  logo_url    text,
  template    text    not null default 'neon'
                      check (template in ('neon', 'minimal', 'bold')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint  stores_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create unique index if not exists idx_stores_agent_id on public.stores (agent_id);
create        index if not exists idx_stores_slug     on public.stores (slug);

drop trigger if exists tr_stores_updated_at on public.stores;
create trigger tr_stores_updated_at
  before update on public.stores
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- TABLE: agent_packages
-- Agent-specific sale price on top of a base bundle or checker package.
-- Exactly one of (bundle_id, checker_id) must be set per row.
-- =============================================================================

create table if not exists public.agent_packages (
  id          uuid    primary key default gen_random_uuid(),
  agent_id    uuid    not null references public.profiles (id) on delete cascade,
  bundle_id   uuid             references public.data_bundles (id) on delete cascade,
  checker_id  uuid             references public.checker_packages (id) on delete cascade,
  sale_price  numeric(10,2) not null check (sale_price >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint  agent_packages_one_product check (
    (bundle_id is not null and checker_id is null) or
    (bundle_id is null     and checker_id is not null)
  ),
  constraint  agent_packages_unique_bundle  unique (agent_id, bundle_id),
  constraint  agent_packages_unique_checker unique (agent_id, checker_id)
);

create index if not exists idx_agent_packages_agent   on public.agent_packages (agent_id);
create index if not exists idx_agent_packages_bundle  on public.agent_packages (bundle_id);
create index if not exists idx_agent_packages_checker on public.agent_packages (checker_id);

drop trigger if exists tr_agent_packages_updated_at on public.agent_packages;
create trigger tr_agent_packages_updated_at
  before update on public.agent_packages
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- TABLE: orders
-- Handles both guest (user_id IS NULL) and authenticated purchases.
-- profit is a generated column: amount - agent_cost.
-- =============================================================================

create table if not exists public.orders (
  id                uuid        primary key default gen_random_uuid(),
  ref               text        not null unique,
  -- nullable = guest checkout
  user_id           uuid        references public.profiles (id) on delete set null,
  -- set when order goes through an agent's store
  agent_id          uuid        references public.profiles (id) on delete set null,
  store_id          uuid        references public.stores (id) on delete set null,
  -- guest fields
  guest_name        text,
  guest_phone       text,
  guest_email       text,
  -- fulfillment
  recipient_phone   text        not null,
  product_label     text        not null,
  network           public.network_type,
  bundle_id         uuid        references public.data_bundles (id) on delete set null,
  checker_id        uuid        references public.checker_packages (id) on delete set null,
  -- pricing
  amount            numeric(10,2) not null check (amount >= 0),   -- what the buyer paid
  agent_cost        numeric(10,2),                                -- what agent was charged
  profit            numeric(10,2) generated always as (
                      case when agent_cost is not null then amount - agent_cost else null end
                    ) stored,
  buyer_type        text        not null default 'guest'
                    check (buyer_type in ('public', 'agent', 'subagent', 'guest')),
  status            public.order_status not null default 'processing',
  fulfillment_error text,
  payment_ref       text,
  profit_credited   boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_orders_user_id   on public.orders (user_id);
create index if not exists idx_orders_agent_id  on public.orders (agent_id);
create index if not exists idx_orders_store_id  on public.orders (store_id);
create index if not exists idx_orders_status    on public.orders (status);
create index if not exists idx_orders_created   on public.orders (created_at desc);
create index if not exists idx_orders_ref       on public.orders (ref);

drop trigger if exists tr_orders_updated_at on public.orders;
create trigger tr_orders_updated_at
  before update on public.orders
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- TABLE: transactions
-- Immutable ledger: every wallet movement is a row here.
-- withdrawal_id FK is added after the withdrawals table is created.
-- =============================================================================

create table if not exists public.transactions (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references public.profiles (id) on delete set null,
  order_id       uuid        references public.orders (id) on delete set null,
  withdrawal_id  uuid,       -- FK added below
  type           public.transaction_type    not null,
  amount         numeric(10,2) not null,
  balance_before numeric(10,2),
  balance_after  numeric(10,2),
  description    text,
  status         public.transaction_status not null default 'completed',
  external_ref   text,       -- payment-provider reference
  metadata       jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_transactions_user_id    on public.transactions (user_id);
create index if not exists idx_transactions_order_id   on public.transactions (order_id);
create index if not exists idx_transactions_type       on public.transactions (type);
create index if not exists idx_transactions_created    on public.transactions (created_at desc);

-- =============================================================================
-- TABLE: withdrawals
-- =============================================================================

create table if not exists public.withdrawals (
  id             uuid    primary key default gen_random_uuid(),
  agent_id       uuid    not null references public.profiles (id) on delete cascade,
  amount         numeric(10,2) not null check (amount > 0),
  momo_number    text    not null,
  momo_network   public.network_type not null,
  account_name   text    not null,
  status         public.withdrawal_status not null default 'pending',
  admin_note     text,
  processed_by   uuid    references public.profiles (id) on delete set null,
  processed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_withdrawals_agent_id on public.withdrawals (agent_id);
create index if not exists idx_withdrawals_status   on public.withdrawals (status);
create index if not exists idx_withdrawals_created  on public.withdrawals (created_at desc);

drop trigger if exists tr_withdrawals_updated_at on public.withdrawals;
create trigger tr_withdrawals_updated_at
  before update on public.withdrawals
  for each row execute function public.fn_touch_updated_at();

-- Back-fill FK on transactions → withdrawals
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'transactions_withdrawal_id_fkey'
  ) then
    alter table public.transactions
      add constraint transactions_withdrawal_id_fkey
      foreign key (withdrawal_id) references public.withdrawals (id) on delete set null;
  end if;
end $$;

-- =============================================================================
-- TABLE: agent_applications
-- Tracks the 50 GHC agent-upgrade payment flow.
-- =============================================================================

create table if not exists public.agent_applications (
  id              uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references public.profiles (id) on delete cascade,
  payment_ref     text,
  payment_amount  numeric(10,2) not null default 50.00,
  status          public.agent_application_status not null default 'pending',
  reviewed_by     uuid    references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_agent_applications_user_id on public.agent_applications (user_id);
create index if not exists idx_agent_applications_status  on public.agent_applications (status);

drop trigger if exists tr_agent_applications_updated_at on public.agent_applications;
create trigger tr_agent_applications_updated_at
  before update on public.agent_applications
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- TABLE: free_data_campaigns
-- =============================================================================

create table if not exists public.free_data_campaigns (
  id             uuid    primary key default gen_random_uuid(),
  name           text    not null,
  data_size      text    not null,   -- e.g. "500MB"
  network        public.network_type not null,
  total_codes    integer not null default 0,
  redeemed_count integer not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists tr_free_data_campaigns_updated_at on public.free_data_campaigns;
create trigger tr_free_data_campaigns_updated_at
  before update on public.free_data_campaigns
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- TABLE: campaign_codes
-- =============================================================================

create table if not exists public.campaign_codes (
  id           uuid    primary key default gen_random_uuid(),
  campaign_id  uuid    not null references public.free_data_campaigns (id) on delete cascade,
  code         text    not null unique,
  redeemed     boolean not null default false,
  redeemed_by  text,         -- phone number or identifier of redeemer
  redeemed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_campaign_codes_campaign_id on public.campaign_codes (campaign_id);
create index if not exists idx_campaign_codes_code        on public.campaign_codes (code);
create index if not exists idx_campaign_codes_redeemed    on public.campaign_codes (redeemed);

-- =============================================================================
-- TABLE: notifications
-- =============================================================================

create table if not exists public.notifications (
  id          uuid    primary key default gen_random_uuid(),
  title       text    not null,
  message     text    not null,
  type        public.notification_type     not null default 'info',
  audience    public.notification_audience not null default 'all',
  created_by  uuid    references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_audience on public.notifications (audience);
create index if not exists idx_notifications_created  on public.notifications (created_at desc);

-- =============================================================================
-- TABLE: notification_reads
-- Tracks which users have dismissed / read each notification.
-- =============================================================================

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- =============================================================================
-- TABLE: site_settings
-- Key/value store for admin-configurable settings.
-- =============================================================================

create table if not exists public.site_settings (
  key         text    primary key,
  value       jsonb   not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid    references public.profiles (id) on delete set null
);

drop trigger if exists tr_site_settings_updated_at on public.site_settings;
create trigger tr_site_settings_updated_at
  before update on public.site_settings
  for each row execute function public.fn_touch_updated_at();

-- =============================================================================
-- ROLE HELPER FUNCTIONS  (security definer – run as postgres, not caller)
-- =============================================================================

create or replace function public.fn_is_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.fn_is_agent_or_admin()
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'agent', 'subagent')
  );
$$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- ---- profiles (extend policies from migration 1) ----

drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
  on public.profiles for select
  using (public.fn_is_admin());

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all"
  on public.profiles for update
  using (public.fn_is_admin());

-- ---- data_bundles ----

alter table public.data_bundles enable row level security;

drop policy if exists "data_bundles_public_read"  on public.data_bundles;
create policy "data_bundles_public_read"
  on public.data_bundles for select
  using (true);

drop policy if exists "data_bundles_admin_write"  on public.data_bundles;
create policy "data_bundles_admin_write"
  on public.data_bundles for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- checker_packages ----

alter table public.checker_packages enable row level security;

drop policy if exists "checker_packages_public_read" on public.checker_packages;
create policy "checker_packages_public_read"
  on public.checker_packages for select
  using (true);

drop policy if exists "checker_packages_admin_write" on public.checker_packages;
create policy "checker_packages_admin_write"
  on public.checker_packages for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- stores ----

alter table public.stores enable row level security;

drop policy if exists "stores_public_read"        on public.stores;
create policy "stores_public_read"
  on public.stores for select
  using (true);

drop policy if exists "stores_agent_manage_own"   on public.stores;
create policy "stores_agent_manage_own"
  on public.stores for all
  using (agent_id = auth.uid()) with check (agent_id = auth.uid());

drop policy if exists "stores_admin_all"          on public.stores;
create policy "stores_admin_all"
  on public.stores for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- agent_packages ----

alter table public.agent_packages enable row level security;

drop policy if exists "agent_packages_read_active" on public.agent_packages;
create policy "agent_packages_read_active"
  on public.agent_packages for select
  using (active = true or agent_id = auth.uid() or public.fn_is_admin());

drop policy if exists "agent_packages_agent_own"   on public.agent_packages;
create policy "agent_packages_agent_own"
  on public.agent_packages for all
  using (agent_id = auth.uid()) with check (agent_id = auth.uid());

drop policy if exists "agent_packages_admin_all"   on public.agent_packages;
create policy "agent_packages_admin_all"
  on public.agent_packages for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- orders ----

alter table public.orders enable row level security;

-- Buyer sees own orders
drop policy if exists "orders_user_own"            on public.orders;
create policy "orders_user_own"
  on public.orders for select
  using (user_id = auth.uid());

-- Agent sees orders flowing through their store
drop policy if exists "orders_agent_store"         on public.orders;
create policy "orders_agent_store"
  on public.orders for select
  using (agent_id = auth.uid());

-- Any authenticated user (or service role for guests) may insert
drop policy if exists "orders_insert"              on public.orders;
create policy "orders_insert"
  on public.orders for insert
  with check (
    auth.uid() is null                  -- service-role guest insert
    or user_id = auth.uid()
    or public.fn_is_admin()
  );

-- Admin sees and manages everything
drop policy if exists "orders_admin_all"           on public.orders;
create policy "orders_admin_all"
  on public.orders for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- transactions ----

alter table public.transactions enable row level security;

drop policy if exists "transactions_user_own"      on public.transactions;
create policy "transactions_user_own"
  on public.transactions for select
  using (user_id = auth.uid());

drop policy if exists "transactions_admin_all"     on public.transactions;
create policy "transactions_admin_all"
  on public.transactions for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- withdrawals ----

alter table public.withdrawals enable row level security;

drop policy if exists "withdrawals_agent_own"      on public.withdrawals;
create policy "withdrawals_agent_own"
  on public.withdrawals for select
  using (agent_id = auth.uid());

drop policy if exists "withdrawals_agent_insert"   on public.withdrawals;
create policy "withdrawals_agent_insert"
  on public.withdrawals for insert
  with check (agent_id = auth.uid() and public.fn_is_agent_or_admin());

drop policy if exists "withdrawals_admin_all"      on public.withdrawals;
create policy "withdrawals_admin_all"
  on public.withdrawals for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- agent_applications ----

alter table public.agent_applications enable row level security;

drop policy if exists "agent_apps_own_read"        on public.agent_applications;
create policy "agent_apps_own_read"
  on public.agent_applications for select
  using (user_id = auth.uid());

drop policy if exists "agent_apps_own_insert"      on public.agent_applications;
create policy "agent_apps_own_insert"
  on public.agent_applications for insert
  with check (user_id = auth.uid());

drop policy if exists "agent_apps_admin_all"       on public.agent_applications;
create policy "agent_apps_admin_all"
  on public.agent_applications for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- free_data_campaigns ----

alter table public.free_data_campaigns enable row level security;

drop policy if exists "campaigns_public_read"      on public.free_data_campaigns;
create policy "campaigns_public_read"
  on public.free_data_campaigns for select
  using (active = true or public.fn_is_admin());

drop policy if exists "campaigns_admin_all"        on public.free_data_campaigns;
create policy "campaigns_admin_all"
  on public.free_data_campaigns for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- campaign_codes ----

alter table public.campaign_codes enable row level security;

-- Only admin can read raw codes; public redemption goes through fn_redeem_campaign_code()
drop policy if exists "campaign_codes_admin_all"   on public.campaign_codes;
create policy "campaign_codes_admin_all"
  on public.campaign_codes for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- notifications ----

alter table public.notifications enable row level security;

drop policy if exists "notifications_read_relevant" on public.notifications;
create policy "notifications_read_relevant"
  on public.notifications for select
  using (
    audience = 'all'
    or (audience = 'agents' and public.fn_is_agent_or_admin())
    or public.fn_is_admin()
  );

drop policy if exists "notifications_admin_write"  on public.notifications;
create policy "notifications_admin_write"
  on public.notifications for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- ---- notification_reads ----

alter table public.notification_reads enable row level security;

drop policy if exists "notification_reads_own"     on public.notification_reads;
create policy "notification_reads_own"
  on public.notification_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- site_settings ----

alter table public.site_settings enable row level security;

drop policy if exists "site_settings_public_read"  on public.site_settings;
create policy "site_settings_public_read"
  on public.site_settings for select
  using (true);

drop policy if exists "site_settings_admin_write"  on public.site_settings;
create policy "site_settings_admin_write"
  on public.site_settings for all
  using (public.fn_is_admin()) with check (public.fn_is_admin());

-- =============================================================================
-- BUSINESS LOGIC FUNCTIONS & TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. fn_promote_to_agent
--    Called by admin after confirming payment.
--    • Updates role to 'agent'
--    • Approves any pending application
--    • Creates the agent's store (if it doesn't exist)
--    • Records the upgrade transaction
-- -----------------------------------------------------------------------------

create or replace function public.fn_promote_to_agent(
  p_user_id     uuid,
  p_payment_ref text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug            text;
  v_name            text;
  v_existing_store  uuid;
begin
  -- Promote role
  update public.profiles
  set role = 'agent', updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'User % not found', p_user_id;
  end if;

  -- Approve pending application
  update public.agent_applications
  set status       = 'approved',
      payment_ref  = coalesce(p_payment_ref, payment_ref),
      reviewed_at  = now()
  where user_id = p_user_id and status = 'pending';

  -- Create store if not already present
  select id into v_existing_store from public.stores where agent_id = p_user_id;

  if v_existing_store is null then
    select name, store_slug into v_name, v_slug
    from public.profiles where id = p_user_id;

    -- Fall back: derive slug from uuid prefix if profile has none
    if v_slug is null or v_slug = '' then
      v_slug := lower(regexp_replace(coalesce(v_name, 'agent'), '[^a-z0-9]', '-', 'g'))
                || '-' || substr(p_user_id::text, 1, 6);
    end if;

    insert into public.stores (agent_id, slug, brand_name)
    values (p_user_id, v_slug, coalesce(v_name, 'Agent') || '''s Store')
    on conflict (agent_id) do nothing;
  end if;

  -- Record upgrade transaction
  insert into public.transactions (user_id, type, amount, description, status, external_ref)
  values (p_user_id, 'agent_upgrade', 50.00, 'Agent upgrade payment', 'completed', p_payment_ref);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. fn_credit_agent_profit  (trigger on orders BEFORE UPDATE)
--    Fires when an order transitions to 'delivered'.
--    • Credits agent wallet with profit
--    • Records commission transaction
--    • Marks order profit_credited = true
-- -----------------------------------------------------------------------------

create or replace function public.fn_credit_agent_profit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profit         numeric(10,2);
  v_balance_before numeric(10,2);
  v_balance_after  numeric(10,2);
begin
  if new.status = 'delivered'
     and old.status <> 'delivered'
     and new.agent_id is not null
     and new.profit is not null
     and new.profit_credited = false
  then
    v_profit := new.profit;

    select wallet_balance into v_balance_before
    from public.profiles where id = new.agent_id;

    v_balance_after := v_balance_before + v_profit;

    update public.profiles
    set wallet_balance = v_balance_after,
        total_sales    = total_sales + 1,
        updated_at     = now()
    where id = new.agent_id;

    insert into public.transactions (
      user_id, order_id, type, amount,
      balance_before, balance_after, description, status
    ) values (
      new.agent_id, new.id, 'commission', v_profit,
      v_balance_before, v_balance_after,
      'Profit from order ' || new.ref, 'completed'
    );

    new.profit_credited := true;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_orders_credit_agent_profit on public.orders;
create trigger tr_orders_credit_agent_profit
  before update on public.orders
  for each row execute function public.fn_credit_agent_profit();

-- -----------------------------------------------------------------------------
-- 3. fn_debit_agent_wallet_on_order  (trigger on orders AFTER INSERT)
--    Debits the agent's wallet when they place an order at agent price.
--    Raises an exception if balance is insufficient — preventing the insert.
-- -----------------------------------------------------------------------------

create or replace function public.fn_debit_agent_wallet_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance_before numeric(10,2);
  v_balance_after  numeric(10,2);
begin
  if new.buyer_type in ('agent', 'subagent')
     and new.agent_id is not null
     and new.agent_cost is not null
  then
    select wallet_balance into v_balance_before
    from public.profiles where id = new.agent_id for update;

    if v_balance_before < new.agent_cost then
      raise exception 'Insufficient wallet balance: have %, need %',
        v_balance_before, new.agent_cost;
    end if;

    v_balance_after := v_balance_before - new.agent_cost;

    update public.profiles
    set wallet_balance = v_balance_after, updated_at = now()
    where id = new.agent_id;

    insert into public.transactions (
      user_id, order_id, type, amount,
      balance_before, balance_after, description, status
    ) values (
      new.agent_id, new.id, 'agent_order', new.agent_cost,
      v_balance_before, v_balance_after,
      'Data order ' || new.ref, 'completed'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists tr_orders_debit_agent_wallet on public.orders;
create trigger tr_orders_debit_agent_wallet
  after insert on public.orders
  for each row execute function public.fn_debit_agent_wallet_on_order();

-- -----------------------------------------------------------------------------
-- 4. fn_process_withdrawal
--    Admin calls this to approve+pay or reject a withdrawal request.
--    • Approve: deducts wallet, marks 'paid', logs transaction
--    • Reject:  marks 'rejected'
-- -----------------------------------------------------------------------------

create or replace function public.fn_process_withdrawal(
  p_withdrawal_id uuid,
  p_admin_id      uuid,
  p_approve       boolean,   -- true = pay, false = reject
  p_note          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agent_id       uuid;
  v_amount         numeric(10,2);
  v_balance_before numeric(10,2);
  v_balance_after  numeric(10,2);
  v_current_status public.withdrawal_status;
begin
  select agent_id, amount, status
  into   v_agent_id, v_amount, v_current_status
  from   public.withdrawals
  where  id = p_withdrawal_id;

  if not found then
    raise exception 'Withdrawal % not found', p_withdrawal_id;
  end if;

  if v_current_status <> 'pending' then
    raise exception 'Withdrawal is already %', v_current_status;
  end if;

  if p_approve then
    select wallet_balance into v_balance_before
    from public.profiles where id = v_agent_id for update;

    if v_balance_before < v_amount then
      raise exception 'Insufficient wallet balance: have %, need %',
        v_balance_before, v_amount;
    end if;

    v_balance_after := v_balance_before - v_amount;

    update public.profiles
    set wallet_balance = v_balance_after, updated_at = now()
    where id = v_agent_id;

    update public.withdrawals
    set status       = 'paid',
        processed_by = p_admin_id,
        processed_at = now(),
        admin_note   = p_note,
        updated_at   = now()
    where id = p_withdrawal_id;

    insert into public.transactions (
      user_id, withdrawal_id, type, amount,
      balance_before, balance_after, description, status
    ) values (
      v_agent_id, p_withdrawal_id, 'withdrawal', v_amount,
      v_balance_before, v_balance_after,
      'Withdrawal paid', 'completed'
    );
  else
    update public.withdrawals
    set status       = 'rejected',
        processed_by = p_admin_id,
        processed_at = now(),
        admin_note   = p_note,
        updated_at   = now()
    where id = p_withdrawal_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. fn_redeem_campaign_code
--    Public-facing code redemption. Returns data_size on success.
-- -----------------------------------------------------------------------------

create or replace function public.fn_redeem_campaign_code(
  p_code  text,
  p_phone text
)
returns text   -- data_size on success; raises on error
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code_id     uuid;
  v_campaign_id uuid;
  v_data_size   text;
  v_active      boolean;
  v_redeemed    boolean;
begin
  select cc.id, cc.campaign_id, cc.redeemed, fc.data_size, fc.active
  into   v_code_id, v_campaign_id, v_redeemed, v_data_size, v_active
  from   public.campaign_codes cc
  join   public.free_data_campaigns fc on fc.id = cc.campaign_id
  where  cc.code = upper(trim(p_code));

  if not found       then raise exception 'Invalid code'; end if;
  if not v_active    then raise exception 'Campaign is no longer active'; end if;
  if v_redeemed      then raise exception 'Code already redeemed'; end if;

  update public.campaign_codes
  set redeemed    = true,
      redeemed_by = p_phone,
      redeemed_at = now()
  where id = v_code_id;

  update public.free_data_campaigns
  set redeemed_count = redeemed_count + 1
  where id = v_campaign_id;

  return v_data_size;
end;
$$;

-- =============================================================================
-- SEED DATA
-- =============================================================================
--
-- NOTE: These rows use fixed UUIDs (dev/staging only).
-- In production, create the admin account via Supabase Auth first;
-- then manually update their profile row's role to 'admin'.
--
-- Profiles are seeded WITHOUT inserting into auth.users.
-- If auth.users rows do not exist, these profile inserts will fail due to the FK.
-- Run this against a dev environment where auth.users rows exist.
-- =============================================================================

do $$
declare
  v_admin_id  constant uuid := '00000000-0000-0000-0000-000000000001';
  v_agent1_id constant uuid := '00000000-0000-0000-0000-000000000002';
  v_agent2_id constant uuid := '00000000-0000-0000-0000-000000000003';
  v_user1_id  constant uuid := '00000000-0000-0000-0000-000000000004';
  v_user2_id  constant uuid := '00000000-0000-0000-0000-000000000005';

  v_bundle1   uuid;
  v_bundle2   uuid;
  v_bundle3   uuid;
  v_bundle4   uuid;

  v_campaign  uuid;
begin
  -- ---- Profiles ----
  -- These upsert so the block is idempotent.
  insert into public.profiles (id, role, name, phone, store_slug, wallet_balance, active)
  values
    (v_admin_id,  'admin',   'Super Admin',  '0200000000', null,          0,   true),
    (v_agent1_id, 'agent',   'Kwame Mensah', '0244100001', 'kwame-data',  250, true),
    (v_agent2_id, 'agent',   'Ama Owusu',    '0244100002', 'ama-bundles', 120, true),
    (v_user1_id,  'agent',   'Kofi Asante',  '0244100003', null,          0,   true),
    (v_user2_id,  'agent',   'Abena Darko',  '0244100004', null,          0,   true)
  on conflict (id) do update
    set name           = excluded.name,
        phone          = excluded.phone,
        wallet_balance = excluded.wallet_balance,
        role           = excluded.role;

  -- ---- Stores ----
  insert into public.stores (agent_id, slug, brand_name, template)
  values
    (v_agent1_id, 'kwame-data',  'Kwame Data Hub',  'neon'),
    (v_agent2_id, 'ama-bundles', 'Ama''s Bundles',  'minimal')
  on conflict (agent_id) do nothing;

  -- ---- Data Bundles ----
  insert into public.data_bundles
    (network,       label,              size_mb, validity_days, price_public, price_agent, sort_order)
  values
    ('MTN',        '1GB – 1 Day',       1024,    1,   5.00,  3.50, 1),
    ('MTN',        '5GB – 30 Days',     5120,   30,  20.00, 14.00, 2),
    ('Telecel',    '2GB – 7 Days',      2048,    7,   8.00,  5.50, 3),
    ('AirtelTigo', '3GB – 14 Days',     3072,   14,  12.00,  8.00, 4)
  on conflict do nothing;

  select id into v_bundle1 from public.data_bundles where label = '1GB – 1 Day'    limit 1;
  select id into v_bundle2 from public.data_bundles where label = '5GB – 30 Days'  limit 1;
  select id into v_bundle3 from public.data_bundles where label = '2GB – 7 Days'   limit 1;
  select id into v_bundle4 from public.data_bundles where label = '3GB – 14 Days'  limit 1;

  -- ---- Checker Packages ----
  insert into public.checker_packages (checker_type, price_public, price_agent, stock)
  values
    ('BECE',   3.50, 2.50, 100),
    ('WASSCE', 4.00, 3.00, 100)
  on conflict do nothing;

  -- ---- Agent Packages ----
  insert into public.agent_packages (agent_id, bundle_id, sale_price)
  values
    (v_agent1_id, v_bundle1, 5.50),
    (v_agent1_id, v_bundle2, 22.00),
    (v_agent2_id, v_bundle3, 9.00),
    (v_agent2_id, v_bundle4, 13.50)
  on conflict do nothing;

  -- ---- Sample Orders ----
  --
  -- Delivered agent orders (profit_credited=true so triggers don't re-credit)
  -- Guest order has no user_id / agent_id.
  insert into public.orders
    (ref,        user_id,     agent_id,     recipient_phone, product_label,          network,       bundle_id, amount, agent_cost, buyer_type, status,      profit_credited)
  values
    ('ORD-0001', v_agent1_id, v_agent1_id, '0244111111', '1GB – 1 Day (MTN)',    'MTN',        v_bundle1,  5.50, 3.50,  'agent', 'delivered',  true),
    ('ORD-0002', v_agent1_id, v_agent1_id, '0244222222', '5GB – 30 Days (MTN)', 'MTN',        v_bundle2, 22.00, 14.00, 'agent', 'delivered',  true),
    ('ORD-0003', v_agent2_id, v_agent2_id, '0244333333', '2GB – 7 Days',        'Telecel',    v_bundle3,  9.00, 5.50,  'agent', 'processing', false),
    ('ORD-0004', null,        null,         '0200999999', '1GB – 1 Day (MTN)',   'MTN',        v_bundle1,  5.00, null,  'guest', 'delivered',  false)
  on conflict (ref) do nothing;

  -- ---- Transactions ----
  insert into public.transactions (user_id, type, amount, description, status)
  values
    (v_agent1_id, 'agent_upgrade',  50.00, 'Agent registration fee',  'completed'),
    (v_agent2_id, 'agent_upgrade',  50.00, 'Agent registration fee',  'completed'),
    (v_agent1_id, 'commission',      2.00, 'Profit: ORD-0001',        'completed'),
    (v_agent1_id, 'commission',      8.00, 'Profit: ORD-0002',        'completed')
  on conflict do nothing;

  -- ---- Withdrawal request ----
  insert into public.withdrawals (agent_id, amount, momo_number, momo_network, account_name, status)
  values
    (v_agent1_id, 100.00, '0244100001', 'MTN', 'Kwame Mensah', 'pending')
  on conflict do nothing;

  -- ---- Agent Applications ----
  insert into public.agent_applications (user_id, payment_ref, status, reviewed_at)
  values
    (v_agent1_id, 'PAY-REF-001', 'approved', now()),
    (v_agent2_id, 'PAY-REF-002', 'approved', now())
  on conflict do nothing;

  -- ---- Free Data Campaign ----
  insert into public.free_data_campaigns (id, name, data_size, network, total_codes, active)
  values
    (gen_random_uuid(), 'May Promo', '500MB', 'MTN', 3, true)
  returning id into v_campaign;

  insert into public.campaign_codes (campaign_id, code)
  values
    (v_campaign, 'MAYDATA01'),
    (v_campaign, 'MAYDATA02'),
    (v_campaign, 'MAYDATA03')
  on conflict do nothing;

  -- ---- Notifications ----
  insert into public.notifications (title, message, type, audience, created_by)
  values
    ('Welcome to GetEasyData!', 'Buy affordable data bundles instantly.', 'info',    'all',    v_admin_id),
    ('Agent Portal Live',       'The agent dashboard is now live. Start earning!', 'success', 'agents', v_admin_id)
  on conflict do nothing;

  -- ---- Site Settings ----
  insert into public.site_settings (key, value, description) values
    ('site_name',           '"GetEasyData"',          'Platform display name'),
    ('whatsapp_number',     '"0200000000"',            'WhatsApp support number'),
    ('whatsapp_channel',    '""',                      'WhatsApp channel link'),
    ('agent_fee',           '50',                      'Fee in GHC to become an agent'),
    ('min_withdrawal',      '20',                      'Minimum withdrawal amount in GHC'),
    ('maintenance_mode',    'false',                   'Toggle site maintenance mode'),
    ('maintenance_message', '"We''ll be back shortly."', 'Message shown during maintenance'),
    ('banner',              'null',                    'Homepage banner HTML/text')
  on conflict (key) do nothing;
end $$;

-- =============================================================================
-- TEST QUERIES  (uncomment to run)
-- =============================================================================

-- T1: Profit per delivered order
-- select ref, product_label, amount, agent_cost, profit
-- from   public.orders
-- where  agent_id is not null
-- order  by created_at desc;

-- T2: Total profit per agent (from wallet + transactions)
-- select p.name,
--        p.wallet_balance,
--        sum(t.amount) filter (where t.type = 'commission')   as total_earned,
--        count(*)      filter (where o.status = 'delivered')  as delivered_orders
-- from   public.profiles p
-- left   join public.transactions t on t.user_id = p.id
-- left   join public.orders o       on o.agent_id = p.id
-- where  p.role = 'agent'
-- group  by p.id, p.name, p.wallet_balance;

-- T3: Guest vs authenticated order breakdown
-- select buyer_type, count(*) as total_orders, sum(amount) as revenue
-- from   public.orders
-- group  by buyer_type;

-- T4: Agent wallet movement ledger
-- select t.created_at, t.type, t.amount, t.balance_before, t.balance_after, t.description
-- from   public.transactions t
-- join   public.profiles p on p.id = t.user_id
-- where  p.role = 'agent'
-- order  by t.created_at desc;

-- T5: Pending withdrawals
-- select w.id, p.name, w.amount, w.momo_number, w.momo_network, w.created_at
-- from   public.withdrawals w
-- join   public.profiles p on p.id = w.agent_id
-- where  w.status = 'pending'
-- order  by w.created_at;

-- T6: Approve a withdrawal (admin only)
-- select public.fn_process_withdrawal(
--   '<withdrawal_uuid>',
--   '<admin_uuid>',
--   true,
--   'Paid via MTN MoMo'
-- );

-- T7: Promote user to agent after payment
-- select public.fn_promote_to_agent('<user_uuid>', 'PAY-REF-XYZ');

-- T8: Redeem campaign code
-- select public.fn_redeem_campaign_code('MAYDATA01', '0244000000');

-- T9: Verify referential integrity
-- select p.name, s.slug, s.brand_name, s.template
-- from   public.profiles p
-- join   public.stores s on s.agent_id = p.id;

-- T10: Agent package margins
-- select p.name,
--        db.label,
--        db.price_agent        as base_cost,
--        ap.sale_price         as agent_price,
--        ap.sale_price - db.price_agent as margin
-- from   public.agent_packages ap
-- join   public.profiles p       on p.id = ap.agent_id
-- join   public.data_bundles db  on db.id = ap.bundle_id
-- order  by p.name, margin desc;
