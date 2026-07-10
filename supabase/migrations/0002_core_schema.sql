-- Core schema: agencies, profiles, checks, findings, monthly_snapshots, events.
-- RLS rule for every table: a user may only touch rows whose agency_id
-- matches their profile. Agencies + profiles are created server-side
-- (service role) during onboarding; user clients never insert them directly.

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  avg_account_premium numeric not null default 25000,
  manual_check_minutes int not null default 45,
  csr_hourly_rate numeric not null default 35,
  plan text not null default 'trial' check (plan in ('trial','founding','standard')),
  trial_ends_at timestamptz,
  stripe_customer_id text,
  checks_this_period int not null default 0,
  period_resets_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade,
  full_name text not null,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table checks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  label text not null,
  policy_type text not null check (policy_type in ('GL','Property','WC','Auto','Umbrella','Package','Other')),
  status text not null default 'queued' check (status in ('queued','extracting','comparing','ready_for_review','reviewed','failed')),
  failure_reason text,
  doc_a_filename text,
  doc_b_filename text,
  doc_a_scanned boolean not null default false,
  doc_b_scanned boolean not null default false,
  model_version text,
  prompt_version text,
  tokens_in int,
  tokens_out int,
  cost_cents int,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  exported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checks_agency_created_idx on checks (agency_id, created_at desc);

create table findings (
  id uuid primary key default gen_random_uuid(),
  check_id uuid not null references checks(id) on delete cascade,
  agency_id uuid not null references agencies(id) on delete cascade, -- denormalized for RLS + dashboard
  field_name text not null,
  category text not null check (category in ('named_insured','dates','limits','deductibles','forms','premium','other')),
  status text not null check (status in ('match','mismatch','not_found_in_policy','not_found_in_proposal')),
  severity text check (severity in ('critical','moderate','minor')),
  expected_value text,
  found_value text,
  doc_a_page int,
  doc_b_page int,
  confidence text not null default 'high' check (confidence in ('high','medium','low')),
  reviewer_action text check (reviewer_action in ('confirmed','dismissed')),
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index findings_check_idx on findings (check_id);
create index findings_agency_idx on findings (agency_id);

create table monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete cascade,
  month date not null,
  checks_run int not null default 0,
  findings_confirmed int not null default 0,
  critical_confirmed int not null default 0,
  hours_saved numeric not null default 0,
  exposure_flagged numeric not null default 0,
  report_pdf_generated boolean not null default false,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, month)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references agencies(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_agency_idx on events (agency_id, created_at desc);

-- updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['agencies','profiles','checks','findings','monthly_snapshots','events'] loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- The caller's agency, looked up once. SECURITY DEFINER so the profiles
-- lookup itself is not blocked by profiles' own RLS.
create or replace function public.current_agency_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select agency_id from profiles where user_id = auth.uid()
$$;
revoke all on function public.current_agency_id() from public;
grant execute on function public.current_agency_id() to authenticated;

-- New tables are not exposed to Data API roles without explicit grants.
-- Table-level privileges are the ceiling; RLS below narrows to row level.
grant usage on schema public to anon, authenticated, service_role;
grant all on agencies, profiles, checks, findings, monthly_snapshots, events to service_role;
grant select, update on agencies to authenticated;
grant select, update on profiles to authenticated;
grant select, insert, update, delete on checks to authenticated;
grant select, insert, update, delete on findings to authenticated;
grant select on monthly_snapshots to authenticated;
grant select, insert on events to authenticated;

alter table agencies enable row level security;
alter table profiles enable row level security;
alter table checks enable row level security;
alter table findings enable row level security;
alter table monthly_snapshots enable row level security;
alter table events enable row level security;

-- agencies: members can read and update their own agency. No user-level
-- insert/delete (onboarding and account deletion run with the service role).
create policy agencies_select on agencies for select to authenticated
  using (id = public.current_agency_id());
create policy agencies_update on agencies for update to authenticated
  using (id = public.current_agency_id())
  with check (id = public.current_agency_id());

-- profiles: read profiles in your agency; update only your own.
create policy profiles_select on profiles for select to authenticated
  using (agency_id = public.current_agency_id());
create policy profiles_update on profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and agency_id = public.current_agency_id());

-- checks / findings: full CRUD within your agency.
create policy checks_all on checks for all to authenticated
  using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());
create policy findings_all on findings for all to authenticated
  using (agency_id = public.current_agency_id())
  with check (agency_id = public.current_agency_id());

-- monthly_snapshots: readable by the agency; written by server jobs.
create policy snapshots_select on monthly_snapshots for select to authenticated
  using (agency_id = public.current_agency_id());

-- events: agency members can insert their own events and read their agency's.
create policy events_select on events for select to authenticated
  using (agency_id = public.current_agency_id());
create policy events_insert on events for insert to authenticated
  with check (agency_id = public.current_agency_id() and user_id = auth.uid());
