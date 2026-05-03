-- Agent-curated store packages
create table public.agent_store_packages (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null,
  package_id uuid not null references public.data_packages(id) on delete cascade,
  sale_price numeric not null check (sale_price > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, package_id)
);

create index idx_agent_store_packages_agent on public.agent_store_packages(agent_id);

alter table public.agent_store_packages enable row level security;

create policy "Agents manage own store packages"
on public.agent_store_packages for all
to authenticated
using (agent_id = auth.uid())
with check (agent_id = auth.uid());

create policy "Admins manage all store packages"
on public.agent_store_packages for all
to authenticated
using (is_admin(auth.uid()))
with check (is_admin(auth.uid()));

create policy "Public views active store packages"
on public.agent_store_packages for select
to anon, authenticated
using (
  active = true
  and exists (
    select 1 from public.profiles p
    where p.id = agent_id and p.active = true and p.store_slug is not null
  )
);

create trigger trg_agent_store_packages_updated
before update on public.agent_store_packages
for each row execute function public.set_updated_at();

-- Realtime
alter table public.agent_store_packages replica identity full;
alter publication supabase_realtime add table public.agent_store_packages;

-- RPC: record an agent's profit from a sale on their store
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
  select price_agent into _agent_cost from public.data_packages where id = _package_id;
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
  values (_agent_id, 'commission', _profit,
          'Store sale profit (' || _sale_price::text || ' − ' || _agent_cost::text || ')',
          _order_ref);

  return json_build_object('ok', true, 'profit', _profit, 'balance', _new_bal);
end;
$$;