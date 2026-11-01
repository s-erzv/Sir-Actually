alter table public.runs
  add column if not exists character_slug text,
  add column if not exists weapon_slug text,
  add column if not exists points_total integer not null default 0,
  add column if not exists rank text,
  add column if not exists dungeon_tier text,
  add column if not exists floor_count integer,
  add column if not exists dungeon_title text;

create table if not exists public.run_points_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  kind text not null,
  encounter_key text,
  seq integer not null default 0,
  amount integer not null,
  created_at timestamptz not null default now(),
  unique (run_id, kind, encounter_key, seq)
);

alter table public.run_points_events enable row level security;
revoke all on public.run_points_events from anon, authenticated;
grant all on public.run_points_events to service_role;
