-- Ensure idempotent order creation from payment callbacks.
create unique index if not exists idx_orders_payment_ref_unique
  on public.orders(payment_ref)
  where payment_ref is not null;
