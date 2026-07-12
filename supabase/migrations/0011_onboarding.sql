-- First-run checklist dismissal (per agency).
alter table agencies add column onboarding_dismissed_at timestamptz;
