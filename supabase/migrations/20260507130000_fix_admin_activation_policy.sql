-- Fix: RLS policy for admin updating agent activation was checking
-- auth.jwt() ->> 'role' which is always 'authenticated', never 'admin'.
-- Replace with fn_is_admin() which queries the profiles table correctly.

drop policy if exists "profiles_update_agent_activation" on public.profiles;
create policy "profiles_update_agent_activation"
on public.profiles
for update
using (public.fn_is_admin())
with check (public.fn_is_admin());

-- Also ensure admins can select all profiles (needed to list agents in admin panel).
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
on public.profiles
for select
using (public.fn_is_admin());
