-- Agency lifecycle: decommission (closed, members locked out) and archive
-- (hidden from the ops clients table, kept under Archived clients).
alter table agencies add column closed_at timestamptz;
alter table agencies add column archived_at timestamptz;
