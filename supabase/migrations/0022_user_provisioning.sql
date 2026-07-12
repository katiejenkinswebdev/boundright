-- Operator-provisioned users sign in with a default password and must
-- change it before using the app.
alter table profiles add column must_change_password boolean not null default false;
