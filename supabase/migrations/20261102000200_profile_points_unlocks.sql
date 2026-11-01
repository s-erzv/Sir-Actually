-- Persistent points wallet + character unlocks.
alter table public.profiles add column if not exists points_earned integer not null default 0;
alter table public.profiles add column if not exists points_spent integer not null default 0;
alter table public.profiles add column if not exists unlocked_characters text[] not null default '{}';

-- Backfill existing finished runs once so old players keep their points.
update public.profiles p
set points_earned = coalesce((
  select sum(r.points_total)
  from public.runs r
  join public.research_maps rm on rm.id = r.research_map_id
  join public.manuscripts m on m.id = rm.manuscript_id
  where m.owner_id = p.id and r.status = 'finished'
), 0)
where p.points_earned = 0;

-- Prevent double-crediting points when /api/run/finish is retried.
alter table public.runs add column if not exists points_credited boolean not null default false;
update public.runs set points_credited = true where status = 'finished';
