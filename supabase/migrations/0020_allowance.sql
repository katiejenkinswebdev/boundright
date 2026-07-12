-- Per-client monthly check allowance override; null falls back to the plan
-- default in lib/pricing.ts. Operator-set only.
alter table agencies add column checks_allowance integer;
