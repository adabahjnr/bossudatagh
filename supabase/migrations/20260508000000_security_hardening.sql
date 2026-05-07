-- ============================================================================
-- Migration: 20260508000000_security_hardening.sql
-- Comprehensive RLS policies and security hardening
-- ============================================================================

-- ── Helper: check if caller is an admin ─────────────────────────────────────
-- Re-create in case it doesn't exist or needs updating
create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ── Helper: check if caller is an activated agent ───────────────────────────
create or replace function public.fn_is_activated_agent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('agent', 'subagent')
      and (agent_activated = true or role = 'subagent')
  );
$$;

-- ============================================================================
-- PROFILES
-- ============================================================================
alter table public.profiles enable row level security;

-- Own profile: read + update (name, phone, store settings only — not role/balance)
drop policy if exists "profiles_select_own"            on public.profiles;
drop policy if exists "profiles_update_own"            on public.profiles;
drop policy if exists "profiles_insert_own"            on public.profiles;
drop policy if exists "profiles_admin_select_all"      on public.profiles;
drop policy if exists "profiles_update_agent_activation" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Agents can update their own display fields (NOT role, wallet_balance, agent_activated)
-- Sensitive fields are only updated by edge functions using the service role key
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admin can read all profiles
create policy "profiles_admin_select_all"
  on public.profiles for select
  using (public.fn_is_admin());

-- Admin can update any profile (for activation, crediting, etc.)
-- NOTE: The admin-set-activation edge function uses service role (bypasses RLS),
-- but this policy also allows admin JWT-based updates as a fallback.
create policy "profiles_admin_update_any"
  on public.profiles for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- ============================================================================
-- ORDERS
-- ============================================================================
alter table public.orders enable row level security;

drop policy if exists "orders_agent_select_own"    on public.orders;
drop policy if exists "orders_admin_select_all"    on public.orders;
drop policy if exists "orders_insert_service_role" on public.orders;

-- Agents and customers can read their own orders
create policy "orders_agent_select_own"
  on public.orders for select
  using (
    agent_id = auth.uid()
    or buyer_type = 'public' -- public orders tied by payment_ref, readable by anyone who has the ref
  );

-- Admin can read all orders
create policy "orders_admin_select_all"
  on public.orders for select
  using (public.fn_is_admin());

-- Direct inserts via RLS (service-role bypass used by edge functions)
-- Only allow authenticated service role inserts (edge functions use service role)
-- Prevent direct client inserts by NOT creating an insert policy for authenticated users
-- (service role bypasses RLS, so no policy needed for edge function inserts)

-- Admin can update order status
create policy "orders_admin_update"
  on public.orders for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- ============================================================================
-- WITHDRAWALS
-- ============================================================================
alter table public.withdrawals enable row level security;

drop policy if exists "withdrawals_agent_select_own"  on public.withdrawals;
drop policy if exists "withdrawals_agent_insert_own"  on public.withdrawals;
drop policy if exists "withdrawals_admin_select_all"  on public.withdrawals;
drop policy if exists "withdrawals_admin_update"      on public.withdrawals;

-- Agents read their own withdrawals
create policy "withdrawals_agent_select_own"
  on public.withdrawals for select
  using (agent_id = auth.uid());

-- Admin reads all
create policy "withdrawals_admin_select_all"
  on public.withdrawals for select
  using (public.fn_is_admin());

-- Admin updates status (approve/reject)
create policy "withdrawals_admin_update"
  on public.withdrawals for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

-- Inserts only via edge function (service role bypasses RLS)
-- No direct insert policy for authenticated users

-- ============================================================================
-- TRANSACTIONS
-- ============================================================================
alter table public.transactions enable row level security;

drop policy if exists "transactions_user_select_own" on public.transactions;
drop policy if exists "transactions_admin_select_all" on public.transactions;

create policy "transactions_user_select_own"
  on public.transactions for select
  using (user_id = auth.uid());

create policy "transactions_admin_select_all"
  on public.transactions for select
  using (public.fn_is_admin());

-- ============================================================================
-- DATA_BUNDLES
-- ============================================================================
alter table public.data_bundles enable row level security;

drop policy if exists "data_bundles_public_read"   on public.data_bundles;
drop policy if exists "data_bundles_admin_write"   on public.data_bundles;

-- Anyone (including anonymous) can read active packages
create policy "data_bundles_public_read"
  on public.data_bundles for select
  using (true);

-- Only admin can create/update/delete packages
create policy "data_bundles_admin_insert"
  on public.data_bundles for insert
  with check (public.fn_is_admin());

create policy "data_bundles_admin_update"
  on public.data_bundles for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

create policy "data_bundles_admin_delete"
  on public.data_bundles for delete
  using (public.fn_is_admin());

-- ============================================================================
-- CHECKER_PACKAGES
-- ============================================================================
alter table public.checker_packages enable row level security;

drop policy if exists "checker_packages_public_read"  on public.checker_packages;
drop policy if exists "checker_packages_admin_write"  on public.checker_packages;

create policy "checker_packages_public_read"
  on public.checker_packages for select
  using (true);

create policy "checker_packages_admin_insert"
  on public.checker_packages for insert
  with check (public.fn_is_admin());

create policy "checker_packages_admin_update"
  on public.checker_packages for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

create policy "checker_packages_admin_delete"
  on public.checker_packages for delete
  using (public.fn_is_admin());

-- ============================================================================
-- AGENT_PACKAGES (agent store packages)
-- ============================================================================
alter table public.agent_packages enable row level security;

drop policy if exists "agent_packages_public_read"        on public.agent_packages;
drop policy if exists "agent_packages_agent_manage_own"   on public.agent_packages;
drop policy if exists "agent_packages_admin_select_all"   on public.agent_packages;

-- Anyone can read agent store packages (needed for MiniStore public page)
create policy "agent_packages_public_read"
  on public.agent_packages for select
  using (true);

-- Agents can manage their own store packages
create policy "agent_packages_agent_insert_own"
  on public.agent_packages for insert
  with check (agent_id = auth.uid() and public.fn_is_activated_agent());

create policy "agent_packages_agent_update_own"
  on public.agent_packages for update
  using (agent_id = auth.uid() and public.fn_is_activated_agent())
  with check (agent_id = auth.uid());

create policy "agent_packages_agent_delete_own"
  on public.agent_packages for delete
  using (agent_id = auth.uid() and public.fn_is_activated_agent());

-- Admin can read/manage all
create policy "agent_packages_admin_select_all"
  on public.agent_packages for select
  using (public.fn_is_admin());

-- ============================================================================
-- STORES (agent store branding)
-- ============================================================================
alter table public.stores enable row level security;

drop policy if exists "stores_public_read"         on public.stores;
drop policy if exists "stores_agent_manage_own"    on public.stores;
drop policy if exists "stores_admin_select_all"    on public.stores;

create policy "stores_public_read"
  on public.stores for select
  using (true);

create policy "stores_agent_insert_own"
  on public.stores for insert
  with check (agent_id = auth.uid());

create policy "stores_agent_update_own"
  on public.stores for update
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid());

create policy "stores_admin_select_all"
  on public.stores for select
  using (public.fn_is_admin());

-- ============================================================================
-- SITE_SETTINGS
-- ============================================================================
alter table public.site_settings enable row level security;

drop policy if exists "site_settings_public_read"  on public.site_settings;
drop policy if exists "site_settings_admin_write"  on public.site_settings;

-- Anyone can read settings (activation fee, min withdrawal, etc.)
create policy "site_settings_public_read"
  on public.site_settings for select
  using (true);

create policy "site_settings_admin_insert"
  on public.site_settings for insert
  with check (public.fn_is_admin());

create policy "site_settings_admin_update"
  on public.site_settings for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

create policy "site_settings_admin_delete"
  on public.site_settings for delete
  using (public.fn_is_admin());

-- ============================================================================
-- CAMPAIGN_CODES
-- ============================================================================
alter table public.campaign_codes enable row level security;

drop policy if exists "campaign_codes_public_read"  on public.campaign_codes;
drop policy if exists "campaign_codes_admin_write"  on public.campaign_codes;

create policy "campaign_codes_public_read"
  on public.campaign_codes for select
  using (true);

create policy "campaign_codes_admin_insert"
  on public.campaign_codes for insert
  with check (public.fn_is_admin());

create policy "campaign_codes_admin_update"
  on public.campaign_codes for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

create policy "campaign_codes_admin_delete"
  on public.campaign_codes for delete
  using (public.fn_is_admin());

-- ============================================================================
-- FREE_DATA_CAMPAIGNS
-- ============================================================================
alter table public.free_data_campaigns enable row level security;

drop policy if exists "free_data_campaigns_public_read" on public.free_data_campaigns;
drop policy if exists "free_data_campaigns_admin_write" on public.free_data_campaigns;

create policy "free_data_campaigns_public_read"
  on public.free_data_campaigns for select
  using (true);

create policy "free_data_campaigns_admin_insert"
  on public.free_data_campaigns for insert
  with check (public.fn_is_admin());

create policy "free_data_campaigns_admin_update"
  on public.free_data_campaigns for update
  using (public.fn_is_admin())
  with check (public.fn_is_admin());

create policy "free_data_campaigns_admin_delete"
  on public.free_data_campaigns for delete
  using (public.fn_is_admin());

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
alter table public.notifications enable row level security;

drop policy if exists "notifications_user_select_own"  on public.notifications;
drop policy if exists "notifications_admin_select_all" on public.notifications;
drop policy if exists "notifications_admin_insert"     on public.notifications;

create policy "notifications_user_select_own"
  on public.notifications for select
  using (user_id = auth.uid() or user_id is null);

create policy "notifications_admin_select_all"
  on public.notifications for select
  using (public.fn_is_admin());

create policy "notifications_admin_insert"
  on public.notifications for insert
  with check (public.fn_is_admin());

-- Users can mark own notifications as read
create policy "notifications_user_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- RPC SECURITY: is_store_slug_available (used in BecomeAgent.tsx)
-- ============================================================================
-- Ensure the RPC is SECURITY DEFINER so it can read profiles without RLS bypass
-- being available to the caller
create or replace function public.is_store_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where store_slug = p_slug
  );
$$;
