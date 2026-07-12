-- List hygiene + intake attribution for reporting.
alter table checks add column archived_at timestamptz;
alter table checks add column source text not null default 'manual'
  check (source in ('manual','smart_intake','email','sample'));
