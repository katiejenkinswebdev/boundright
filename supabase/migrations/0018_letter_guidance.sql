-- Customizable correction-letter guidance. Two layers on top of the
-- versioned base prompt (prompts/letter_v2.ts):
--   1. platform_config['letter_guidance'] — one standardized addition,
--      edited in the ops console, applied to every client's letters.
--   2. agencies.letter_instructions — per-client guidance, also ops-console
--      only, applied after (and with priority over) the platform layer.
create table platform_config (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table platform_config enable row level security;  -- no policies: server-only
grant all on platform_config to service_role;

alter table agencies add column letter_instructions text;
