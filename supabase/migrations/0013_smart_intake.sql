-- Smart intake feature flag: classify-and-pair multi-document upload.
-- Enabled per agency by a system_admin only.
alter table agencies add column smart_intake_enabled boolean not null default false;
