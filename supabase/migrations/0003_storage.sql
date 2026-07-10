-- Private bucket for in-flight check documents. Files live here only while a
-- check is processing; the pipeline deletes them immediately afterwards.
-- No storage.objects policies are created: anon/authenticated clients get
-- nothing. Uploads happen via service-role-signed upload URLs; downloads and
-- deletes happen server-side with the service role.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
