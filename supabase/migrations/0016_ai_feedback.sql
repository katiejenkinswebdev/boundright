-- Thumbs up/down on AI outputs (correction letters, smart intake pairing,
-- check reports). One row per rating event; keyed to the prompt version so
-- the ops console can see satisfaction move when a prompt changes.
create table ai_feedback (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id uuid not null,
  check_id uuid,          -- intentionally not FK'd: survives check deletion
  target text not null check (target in ('letter','report','smart_intake')),
  rating smallint not null check (rating in (-1, 1)),
  note text,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now()
);
create index ai_feedback_agency_idx on ai_feedback (agency_id, created_at);
create index ai_feedback_version_idx on ai_feedback (prompt_version);
alter table ai_feedback enable row level security;

create policy ai_feedback_insert on ai_feedback for insert
  with check (agency_id = public.current_agency_id());
create policy ai_feedback_select on ai_feedback for select
  using (agency_id = public.current_agency_id());

grant insert, select on ai_feedback to authenticated;
grant all on ai_feedback to service_role;
