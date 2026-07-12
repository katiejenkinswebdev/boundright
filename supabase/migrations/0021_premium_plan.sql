-- Fourth billing tier: premium (bulk smart intake + custom check volumes).
alter table agencies drop constraint agencies_plan_check;
alter table agencies add constraint agencies_plan_check
  check (plan in ('trial','founding','standard','premium'));
