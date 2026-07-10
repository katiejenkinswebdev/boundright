-- Landing-page email capture. Written only via the service-role key
-- (server action); RLS is enabled with no policies, so anon/authenticated
-- clients can neither read nor write.
create table if not exists email_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text not null default 'landing',
  created_at timestamptz not null default now()
);

alter table email_signups enable row level security;

-- New tables are not exposed to Data API roles without explicit grants.
-- Only the service role may touch this table; anon/authenticated get nothing.
grant all on email_signups to service_role;
