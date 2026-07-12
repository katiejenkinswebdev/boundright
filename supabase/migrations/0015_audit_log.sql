-- Append-only audit trail: every touch on a check, from ingestion to export.
create table check_audit (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  check_id uuid,          -- intentionally not FK'd: survives check deletion
  check_label text,
  user_id uuid,           -- null = system/pipeline
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index check_audit_agency_time_idx on check_audit (agency_id, created_at);
create index check_audit_check_idx on check_audit (check_id);
alter table check_audit enable row level security;  -- no policies: server-only
grant insert, select on check_audit to service_role;
