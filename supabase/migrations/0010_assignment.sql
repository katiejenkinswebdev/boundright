-- Review routing: a check can be assigned to a teammate.
alter table checks add column assigned_to uuid references auth.users(id) on delete set null;
