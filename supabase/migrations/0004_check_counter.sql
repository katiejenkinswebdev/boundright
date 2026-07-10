-- Atomic usage-counter increment, called by the pipeline (service role) when
-- a check reaches ready_for_review. Failed checks never call this.
create or replace function public.increment_checks_this_period(p_agency_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update agencies
  set checks_this_period = checks_this_period + 1
  where id = p_agency_id
$$;

revoke all on function public.increment_checks_this_period(uuid) from public;
grant execute on function public.increment_checks_this_period(uuid) to service_role;
