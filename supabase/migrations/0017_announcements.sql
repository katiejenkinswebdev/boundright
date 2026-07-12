-- Platform announcements: system admin posts a message with an active
-- window; the banner shows and hides itself on the dates, no deploy needed.
create table announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index announcements_window_idx on announcements (starts_at, ends_at);
alter table announcements enable row level security;

-- Everyone signed in can read announcements inside their active window;
-- writes go through the ops console only (service role).
create policy announcements_read_active on announcements for select
  using (now() >= starts_at and now() < ends_at);
grant select on announcements to authenticated;
grant all on announcements to service_role;
