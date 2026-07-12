-- User management: suspension marker, and auth.users references that
-- survive account deletion (review attribution lives on in check_audit).
alter table profiles add column suspended_at timestamptz;

alter table checks drop constraint checks_reviewed_by_fkey;
alter table checks add constraint checks_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;

alter table invites drop constraint invites_invited_by_fkey;
alter table invites add constraint invites_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete set null;
