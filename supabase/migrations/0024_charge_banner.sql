-- Per-client managed billing amount and client-specific announcement banner.
alter table agencies add column custom_monthly_cents integer;
alter table agencies add column banner_message text;
