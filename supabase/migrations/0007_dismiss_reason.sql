-- Why a finding was dismissed: the false-positive dataset that tunes the
-- prompts. Surfaced in the dismiss flow, required when dismissing.
alter table findings add column dismiss_reason text
  check (dismiss_reason in ('not_a_discrepancy','wrong_extraction','duplicate','known_intentional','other'));
