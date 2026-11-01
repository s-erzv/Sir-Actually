-- Resume an active dungeon exactly where the player left it.
alter table public.runs add column if not exists current_floor integer not null default 1;
alter table public.runs add column if not exists progress jsonb not null default '{}'::jsonb;
