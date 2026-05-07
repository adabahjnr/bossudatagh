create or replace function public.is_store_slug_available(p_slug text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where store_slug = nullif(lower(trim(p_slug)), '')
  );
$$;

revoke all on function public.is_store_slug_available(text) from public;
grant execute on function public.is_store_slug_available(text) to anon, authenticated;
