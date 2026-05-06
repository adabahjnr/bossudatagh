-- Ensure orders.payment_ref exists for Paystack callback idempotency.
alter table public.orders
  add column if not exists payment_ref text;

-- Prevent duplicate order creation from the same payment callback.
create unique index if not exists idx_orders_payment_ref_unique
  on public.orders(payment_ref)
  where payment_ref is not null;
