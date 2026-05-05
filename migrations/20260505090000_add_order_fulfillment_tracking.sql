begin;

alter table public.orders
  add column if not exists fulfillment_error_code text,
  add column if not exists fulfillment_error_message text,
  add column if not exists provider_response jsonb,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_fulfillment_attempt_at timestamptz;

alter table public.site_settings
  add column if not exists whatsapp_channel_link text;

commit;
