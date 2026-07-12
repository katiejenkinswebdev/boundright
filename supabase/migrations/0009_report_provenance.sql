-- Provenance for the exported report: fingerprints of the source documents
-- (computed before deletion) and the processing timestamp.
alter table checks
  add column doc_a_sha256 text,
  add column doc_b_sha256 text,
  add column doc_a_pages int,
  add column doc_b_pages int,
  add column processed_at timestamptz;
