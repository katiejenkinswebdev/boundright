-- The operator role: system_admin sits above agency admins and is granted
-- manually (never via the team UI). Sees every client's configuration in
-- the ops console.
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('system_admin','admin','manager','user'));
