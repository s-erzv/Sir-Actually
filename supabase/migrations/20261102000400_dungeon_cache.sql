-- Cache AI output so reopening a map/floor does not regenerate it.

alter table public.research_maps
  add column if not exists dungeon_draft jsonb,
  add column if not exists dungeon_draft_version text,
  add column if not exists question_bank jsonb not null default '{}'::jsonb;
