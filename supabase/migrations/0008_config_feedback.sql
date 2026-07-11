-- Admin-configurable metrics + in-app feedback.
alter table agencies
  add column premium_variance_threshold numeric not null default 5,
  add column renewal_premium_threshold numeric not null default 10,
  add column reminder_hours int not null default 48;

create table feedback (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  category text not null default 'general'
    check (category in ('general','bug','idea','accuracy')),
  message text not null,
  page text,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;
grant all on feedback to service_role;
