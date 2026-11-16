-- One injected fake citation per research map; one ghost check per run.

create unique index if not exists citations_one_injected_per_map
  on public.citations (research_map_id)
  where is_injected;

create unique index if not exists ghost_checks_one_per_run
  on public.ghost_checks (run_id);
