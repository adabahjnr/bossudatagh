-- Fix legacy BossuData branding leftovers
UPDATE public.site_settings SET site_name = 'GetEasyData' WHERE site_name = 'BossuData';
ALTER TABLE public.site_settings ALTER COLUMN site_name SET DEFAULT 'GetEasyData';

-- Update the new-user trigger to use EASY- prefix instead of BOSS-
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  _ref := 'EASY-' || upper(substr(replace(new.id::text, '-', ''), 1, 6));
  _api := 'bd_live_' || replace(new.id::text, '-', '') || substr(md5(random()::text), 1, 8);

  insert into public.profiles (id, name, phone, store_slug, store_brand, referral_code, api_key)
  values (new.id, _name, _phone, _slug, _name || '''s Data Store', _ref, _api);

  insert into public.user_roles (user_id, role) values (new.id, 'agent');
  return new;
end;
$function$;

-- Make sure the trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow users to insert their own wallet transactions (already exists), and ensure the
-- profiles wallet_balance can be updated by the user themselves (already covered by "Users update own profile")
-- Add an INSERT policy on redemptions so the SECURITY DEFINER redeem_code can route through it (already definer, OK).
