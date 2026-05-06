-- Add agent activation tracking to profiles
-- Agents must pay an activation fee before accessing their dashboard

alter table public.profiles
  add column if not exists agent_activated boolean not null default false,
  add column if not exists activation_paid_at timestamptz;

-- Trigger: set activation_paid_at when agent_activated is set to true
create or replace function public.fn_set_activation_paid_at()
returns trigger
language plpgsql
as $$
begin
  if new.agent_activated and not old.agent_activated then
    new.activation_paid_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists tr_profiles_set_activation_paid_at on public.profiles;
create trigger tr_profiles_set_activation_paid_at
  before update on public.profiles
  for each row
  when (old.agent_activated is distinct from new.agent_activated)
  execute function public.fn_set_activation_paid_at();

-- RLS: Only admin can update activation status
drop policy if exists "profiles_update_agent_activation" on public.profiles;
create policy "profiles_update_agent_activation"
on public.profiles
for update
using (auth.jwt() ->> 'role' = 'admin')
with check (auth.jwt() ->> 'role' = 'admin');
