-- At most one active run per research map. Keep the newest if duplicates exist.

with ranked as (
  select id,
         row_number() over (
           partition by research_map_id
           order by started_at desc, id desc
         ) as rn
  from public.runs
  where status = 'active'
)
update public.runs
set status = 'finished',
    finished_at = now()
where id in (select id from ranked where rn > 1);

create unique index if not exists runs_one_active_per_map
  on public.runs (research_map_id)
  where status = 'active';
