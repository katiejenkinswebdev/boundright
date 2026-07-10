-- Billing state beyond `plan` (Section 7): payment-failure grace and
-- read-only mode after cancellation. Written only by Stripe webhooks
-- (service role); readable by the agency via the existing select policy.
alter table agencies
  add column billing_status text not null default 'ok'
    check (billing_status in ('ok','past_due','canceled')),
  add column billing_grace_until timestamptz;

-- Public bucket for agency logos (used on exported reports and in the app).
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;
