-- Roles, check types, citation excerpts, carrier analytics, integrations.

-- Three roles: admin (everything), manager (+dashboard analytics), user
-- (run and review checks). Existing 'owner' accounts become admins.
update profiles set role = 'admin' where role = 'owner';
alter table profiles alter column role set default 'user';
alter table profiles add constraint profiles_role_check
  check (role in ('admin','manager','user'));

-- Team invites (created by admins via service role; consumed at signup).
create table invites (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('admin','manager','user')),
  token text not null unique,
  invited_by uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table invites enable row level security;
grant all on invites to service_role;
create trigger invites_updated_at before update on invites
  for each row execute function public.set_updated_at();

-- Check types: issuance (proposal vs issued policy), renewal (expiring vs
-- renewal policy), coi (certificate vs policy).
alter table checks add column check_type text not null default 'issuance'
  check (check_type in ('issuance','renewal','coi'));
-- Issuing carrier, auto-extracted from document B (per-carrier analytics).
alter table checks add column carrier text;
-- Draft correction request letter (generated from confirmed findings).
alter table checks add column correction_letter text;

-- Short source excerpts around each citation (page previews without
-- retaining documents; disclosed in the privacy policy and one-pager).
alter table findings add column doc_a_excerpt text;
alter table findings add column doc_b_excerpt text;

-- Integrations: Slack/Teams incoming webhook + inbound email token.
alter table agencies add column notify_webhook_url text;
alter table agencies add column inbound_token text not null default encode(gen_random_bytes(9), 'hex');
