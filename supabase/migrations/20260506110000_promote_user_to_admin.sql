-- Promote a user to admin role across all auth metadata and profiles
-- Replace YOUR_EMAIL_HERE with the email of the account to promote

begin;

do $$
declare
  v_email   text := lower('YOUR_EMAIL_HERE');
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is null then
    raise exception 'No auth user found for email: %', v_email;
  end if;

  -- Update auth metadata to include admin role
  update auth.users
  set
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin', 'roles', jsonb_build_array('admin')),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin')
  where id = v_user_id;

  -- Ensure profile exists with admin role
  insert into public.profiles (id, role, active)
  values (v_user_id, 'admin'::public.app_role, true)
  on conflict (id) do update
  set
    role = 'admin'::public.app_role,
    active = true,
    updated_at = now();

  raise notice 'User % promoted to admin', v_email;
end
$$;

commit;
