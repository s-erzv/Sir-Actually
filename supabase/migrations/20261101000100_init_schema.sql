-- Sir, Actually — initial schema (idempotent)
-- Reconstructed from docs/BRIEF.md and the app's typed data layer.
-- Safe to paste into the Supabase SQL editor even if profiles/other tables
-- were partially created by an earlier run.

create extension if not exists vector with schema extensions;
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Core manuscript tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.manuscripts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  field text,
  language text not null default 'id' check (language in ('id', 'en')),
  stage text not null check (stage in ('proposal', 'skripsi', 'jurnal')),
  min_references integer check (min_references is null or min_references > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.research_maps (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  source_text text not null,
  completeness jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (manuscript_id, version)
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  research_map_id uuid not null references public.research_maps (id) on delete cascade,
  kind text not null check (
    kind in ('problem', 'gap', 'objective', 'rq', 'method', 'finding', 'limitation', 'conclusion')
  ),
  text text not null,
  source_quote text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.citations (
  id uuid primary key default gen_random_uuid(),
  research_map_id uuid not null references public.research_maps (id) on delete cascade,
  raw_text text not null,
  parsed jsonb,
  verification_status text not null default 'unchecked' check (
    verification_status in ('unchecked', 'verified', 'not_found', 'mismatch', 'needs_review')
  ),
  matched_work jsonb,
  is_injected boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_citations (
  claim_id uuid not null references public.claims (id) on delete cascade,
  citation_id uuid not null references public.citations (id) on delete cascade,
  primary key (claim_id, citation_id)
);

create table if not exists public.manuscript_chunks (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references public.manuscripts (id) on delete cascade,
  version integer not null,
  chunk_index integer not null,
  section_label text,
  char_start integer not null,
  char_end integer not null,
  text text not null,
  embedding extensions.vector(768),
  embedding_model text,
  fts tsvector generated always as (to_tsvector('simple', text)) stored,
  created_at timestamptz not null default now(),
  unique (manuscript_id, version, chunk_index),
  check (char_start >= 0 and char_end >= char_start)
);

-- ---------------------------------------------------------------------------
-- Game catalogue and state
-- ---------------------------------------------------------------------------

create table if not exists public.weakness_types (
  slug text primary key,
  dimension text not null,
  detector text not null check (detector in ('code', 'llm')),
  uses_retrieval boolean not null default false,
  default_severity integer not null default 2 check (default_severity between 1 and 3),
  attack_types text[] not null default '{}',
  version text not null default 'v1',
  description text not null default ''
);

create table if not exists public.rubrics (
  id text primary key,
  weakness_type text references public.weakness_types (slug) on delete set null,
  criteria jsonb not null,
  scale_max integer not null default 2,
  version text not null default 'v1'
);

create table if not exists public.bosses (
  slug text primary key,
  name text not null,
  floor_order integer not null,
  dimension text,
  base_hp integer,
  rubric_id text references public.rubrics (id) on delete set null,
  sprite_key text
);

create table if not exists public.findings (
  id uuid primary key default gen_random_uuid(),
  research_map_id uuid not null references public.research_maps (id) on delete cascade,
  weakness_type text not null references public.weakness_types (slug),
  claim_id uuid references public.claims (id) on delete set null,
  citation_id uuid references public.citations (id) on delete set null,
  severity integer not null check (severity between 1 and 3),
  severity_source text not null default 'default' check (severity_source in ('default', 'llm', 'human')),
  centrality integer not null check (centrality between 1 and 3),
  confidence real not null check (confidence between 0 and 1),
  detector text not null check (detector in ('code', 'llm')),
  evidence_quote text not null,
  evidence_chunk_ids uuid[] not null default '{}',
  rank integer,
  status text not null default 'untested' check (
    status in ('untested', 'defended', 'conceded', 'disputed', 'needs_review')
  ),
  dispute_note text,
  version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  research_map_id uuid not null references public.research_maps (id) on delete cascade,
  examiner_style text not null check (examiner_style in ('strict', 'detail', 'friendly')),
  status text not null default 'active' check (status in ('active', 'finished', 'closed_revised')),
  previous_run_id uuid references public.runs (id) on delete set null,
  hearts_left integer not null check (hearts_left >= 0),
  rubric_version text not null,
  model_version text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.encounters (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  boss_slug text not null references public.bosses (slug),
  finding_id uuid references public.findings (id) on delete set null,
  is_boss boolean not null default false,
  floor_order integer not null,
  room_order integer not null,
  status text not null default 'pending' check (
    status in ('pending', 'active', 'won', 'conceded', 'disputed', 'lost', 'retried')
  ),
  hp_start integer,
  hp_end integer,
  questions_asked integer not null default 0,
  advice jsonb,
  advice_prompt_version text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (run_id, floor_order, room_order)
);

create table if not exists public.turns (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters (id) on delete cascade,
  seq integer not null check (seq > 0),
  role text not null check (role in ('boss', 'player')),
  text text not null,
  target_claim_id uuid references public.claims (id) on delete set null,
  attack_type text,
  question_hash text,
  created_at timestamptz not null default now(),
  unique (encounter_id, seq)
);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references public.turns (id) on delete cascade,
  rubric_id text not null references public.rubrics (id),
  scores jsonb not null,
  evidence_quotes jsonb not null default '{}',
  score_total integer not null,
  score_max integer not null,
  damage integer not null,
  heart_lost boolean not null default false,
  missing text,
  rule_caps jsonb not null default '[]',
  raw_judge_output jsonb,
  rationale text,
  judge_model text not null,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ghost_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  citation_id uuid not null references public.citations (id) on delete cascade,
  flagged_citation_ids uuid[] not null default '{}',
  hit boolean not null,
  duration_ms integer,
  flagged_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique references public.runs (id) on delete cascade,
  readiness jsonb not null,
  weak_links jsonb not null,
  comparison jsonb,
  untested jsonb not null default '[]',
  prompt_version text,
  model_version text,
  generated_at timestamptz not null default now()
);

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs (id) on delete cascade,
  usability integer check (usability between 1 and 5),
  question_relevance integer check (question_relevance between 1 and 5),
  advice_usefulness integer check (advice_usefulness between 1 and 5),
  felt_repetitive boolean,
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.recon_jobs (
  id uuid primary key default gen_random_uuid(),
  research_map_id uuid not null unique references public.research_maps (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  step text,
  steps_done integer not null default 0,
  steps_total integer,
  cursor jsonb not null default '{}',
  timings jsonb not null default '{}',
  discarded jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Safe upgrades for projects that already ran an earlier draft.
-- `create table if not exists` skips existing tables, so add any missing
-- columns before indexes/triggers below reference them.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists id uuid default gen_random_uuid();
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.manuscripts add column if not exists owner_id uuid;
alter table public.manuscripts add column if not exists title text;
alter table public.manuscripts add column if not exists stage text;
alter table public.claims add column if not exists kind text;
alter table public.claims add column if not exists text text;
alter table public.research_maps add column if not exists manuscript_id uuid;
alter table public.claims add column if not exists research_map_id uuid;
alter table public.citations add column if not exists research_map_id uuid;
alter table public.citations add column if not exists raw_text text;
alter table public.claim_citations add column if not exists claim_id uuid;
alter table public.claim_citations add column if not exists citation_id uuid;
alter table public.manuscript_chunks add column if not exists manuscript_id uuid;
alter table public.manuscript_chunks add column if not exists version integer;
alter table public.manuscript_chunks add column if not exists chunk_index integer;
alter table public.manuscript_chunks add column if not exists char_start integer;
alter table public.manuscript_chunks add column if not exists char_end integer;
alter table public.manuscript_chunks add column if not exists text text;
alter table public.findings add column if not exists research_map_id uuid;
alter table public.findings add column if not exists weakness_type text;
alter table public.runs add column if not exists research_map_id uuid;
alter table public.encounters add column if not exists run_id uuid;
alter table public.turns add column if not exists encounter_id uuid;
alter table public.evaluations add column if not exists turn_id uuid;
alter table public.ghost_checks add column if not exists run_id uuid;
alter table public.ghost_checks add column if not exists citation_id uuid;
alter table public.reports add column if not exists run_id uuid;
alter table public.pilot_feedback add column if not exists run_id uuid;
alter table public.recon_jobs add column if not exists research_map_id uuid;
alter table public.weakness_types add column if not exists slug text;
alter table public.rubrics add column if not exists id text;
alter table public.bosses add column if not exists slug text;
alter table public.bosses add column if not exists name text;

alter table public.manuscripts add column if not exists field text;
alter table public.manuscripts add column if not exists language text not null default 'id';
alter table public.manuscripts add column if not exists min_references integer;
alter table public.manuscripts add column if not exists created_at timestamptz not null default now();
alter table public.manuscripts add column if not exists deleted_at timestamptz;

alter table public.research_maps add column if not exists version integer not null default 1;
alter table public.research_maps add column if not exists status text not null default 'draft';
alter table public.research_maps add column if not exists source_text text;
alter table public.research_maps add column if not exists completeness jsonb;
alter table public.research_maps add column if not exists created_at timestamptz not null default now();
alter table public.research_maps add column if not exists confirmed_at timestamptz;

alter table public.claims add column if not exists source_quote text;
alter table public.claims add column if not exists position integer not null default 0;
alter table public.claims add column if not exists created_at timestamptz not null default now();

alter table public.citations add column if not exists parsed jsonb;
alter table public.citations add column if not exists verification_status text not null default 'unchecked';
alter table public.citations add column if not exists matched_work jsonb;
alter table public.citations add column if not exists is_injected boolean not null default false;
alter table public.citations add column if not exists verified_at timestamptz;
alter table public.citations add column if not exists created_at timestamptz not null default now();

alter table public.manuscript_chunks add column if not exists section_label text;
alter table public.manuscript_chunks add column if not exists embedding extensions.vector(768);
alter table public.manuscript_chunks add column if not exists embedding_model text;
alter table public.manuscript_chunks add column if not exists created_at timestamptz not null default now();
alter table public.manuscript_chunks
  add column if not exists fts tsvector generated always as (to_tsvector('simple', text)) stored;

alter table public.weakness_types add column if not exists dimension text;
alter table public.weakness_types add column if not exists detector text;
alter table public.weakness_types add column if not exists uses_retrieval boolean not null default false;
alter table public.weakness_types add column if not exists default_severity integer not null default 2;
alter table public.weakness_types add column if not exists attack_types text[] not null default '{}';
alter table public.weakness_types add column if not exists version text not null default 'v1';
alter table public.weakness_types add column if not exists description text not null default '';

alter table public.rubrics add column if not exists weakness_type text;
alter table public.rubrics add column if not exists criteria jsonb;
alter table public.rubrics add column if not exists scale_max integer not null default 2;
alter table public.rubrics add column if not exists version text not null default 'v1';

alter table public.bosses add column if not exists floor_order integer;
alter table public.bosses add column if not exists dimension text;
alter table public.bosses add column if not exists base_hp integer;
alter table public.bosses add column if not exists rubric_id text;
alter table public.bosses add column if not exists sprite_key text;

alter table public.findings add column if not exists claim_id uuid;
alter table public.findings add column if not exists citation_id uuid;
alter table public.findings add column if not exists severity integer;
alter table public.findings add column if not exists severity_source text not null default 'default';
alter table public.findings add column if not exists centrality integer;
alter table public.findings add column if not exists confidence real;
alter table public.findings add column if not exists detector text;
alter table public.findings add column if not exists evidence_quote text;
alter table public.findings add column if not exists evidence_chunk_ids uuid[] not null default '{}';
alter table public.findings add column if not exists rank integer;
alter table public.findings add column if not exists status text not null default 'untested';
alter table public.findings add column if not exists dispute_note text;
alter table public.findings add column if not exists version text;
alter table public.findings add column if not exists created_at timestamptz not null default now();

alter table public.runs add column if not exists examiner_style text;
alter table public.runs add column if not exists status text not null default 'active';
alter table public.runs add column if not exists previous_run_id uuid;
alter table public.runs add column if not exists hearts_left integer;
alter table public.runs add column if not exists rubric_version text;
alter table public.runs add column if not exists model_version text;
alter table public.runs add column if not exists started_at timestamptz not null default now();
alter table public.runs add column if not exists finished_at timestamptz;

alter table public.encounters add column if not exists boss_slug text;
alter table public.encounters add column if not exists finding_id uuid;
alter table public.encounters add column if not exists is_boss boolean not null default false;
alter table public.encounters add column if not exists floor_order integer;
alter table public.encounters add column if not exists room_order integer;
alter table public.encounters add column if not exists status text not null default 'pending';
alter table public.encounters add column if not exists hp_start integer;
alter table public.encounters add column if not exists hp_end integer;
alter table public.encounters add column if not exists questions_asked integer not null default 0;
alter table public.encounters add column if not exists advice jsonb;
alter table public.encounters add column if not exists advice_prompt_version text;
alter table public.encounters add column if not exists created_at timestamptz not null default now();
alter table public.encounters add column if not exists resolved_at timestamptz;

alter table public.turns add column if not exists seq integer;
alter table public.turns add column if not exists role text;
alter table public.turns add column if not exists text text;
alter table public.turns add column if not exists target_claim_id uuid;
alter table public.turns add column if not exists attack_type text;
alter table public.turns add column if not exists question_hash text;
alter table public.turns add column if not exists created_at timestamptz not null default now();

alter table public.evaluations add column if not exists rubric_id text;
alter table public.evaluations add column if not exists scores jsonb;
alter table public.evaluations add column if not exists evidence_quotes jsonb not null default '{}';
alter table public.evaluations add column if not exists score_total integer;
alter table public.evaluations add column if not exists score_max integer;
alter table public.evaluations add column if not exists damage integer;
alter table public.evaluations add column if not exists heart_lost boolean not null default false;
alter table public.evaluations add column if not exists missing text;
alter table public.evaluations add column if not exists rule_caps jsonb not null default '[]';
alter table public.evaluations add column if not exists raw_judge_output jsonb;
alter table public.evaluations add column if not exists rationale text;
alter table public.evaluations add column if not exists judge_model text;
alter table public.evaluations add column if not exists prompt_version text;
alter table public.evaluations add column if not exists created_at timestamptz not null default now();

alter table public.ghost_checks add column if not exists flagged_citation_ids uuid[] not null default '{}';
alter table public.ghost_checks add column if not exists hit boolean;
alter table public.ghost_checks add column if not exists duration_ms integer;
alter table public.ghost_checks add column if not exists flagged_at timestamptz not null default now();

alter table public.reports add column if not exists readiness jsonb;
alter table public.reports add column if not exists weak_links jsonb;
alter table public.reports add column if not exists comparison jsonb;
alter table public.reports add column if not exists untested jsonb not null default '[]';
alter table public.reports add column if not exists prompt_version text;
alter table public.reports add column if not exists model_version text;
alter table public.reports add column if not exists generated_at timestamptz not null default now();

alter table public.pilot_feedback add column if not exists usability integer;
alter table public.pilot_feedback add column if not exists question_relevance integer;
alter table public.pilot_feedback add column if not exists advice_usefulness integer;
alter table public.pilot_feedback add column if not exists felt_repetitive boolean;
alter table public.pilot_feedback add column if not exists comment text;
alter table public.pilot_feedback add column if not exists created_at timestamptz not null default now();

alter table public.recon_jobs add column if not exists status text not null default 'queued';
alter table public.recon_jobs add column if not exists step text;
alter table public.recon_jobs add column if not exists steps_done integer not null default 0;
alter table public.recon_jobs add column if not exists steps_total integer;
alter table public.recon_jobs add column if not exists cursor jsonb not null default '{}';
alter table public.recon_jobs add column if not exists timings jsonb not null default '{}';
alter table public.recon_jobs add column if not exists discarded jsonb not null default '{}';
alter table public.recon_jobs add column if not exists error text;
alter table public.recon_jobs add column if not exists created_at timestamptz not null default now();
alter table public.recon_jobs add column if not exists started_at timestamptz;
alter table public.recon_jobs add column if not exists finished_at timestamptz;
alter table public.recon_jobs add column if not exists updated_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists manuscripts_owner_idx on public.manuscripts (owner_id) where deleted_at is null;
create index if not exists research_maps_manuscript_idx on public.research_maps (manuscript_id);
create index if not exists claims_map_position_idx on public.claims (research_map_id, position);
create index if not exists citations_map_idx on public.citations (research_map_id);
create index if not exists findings_map_rank_idx on public.findings (research_map_id, rank);
create index if not exists findings_map_severity_idx on public.findings (research_map_id, severity desc, centrality desc, confidence desc);
create index if not exists runs_map_idx on public.runs (research_map_id);
create unique index if not exists runs_one_active_per_map on public.runs (research_map_id) where status = 'active';
create index if not exists encounters_run_idx on public.encounters (run_id, floor_order, room_order);
create index if not exists turns_encounter_idx on public.turns (encounter_id, seq);
create index if not exists manuscript_chunks_lookup_idx on public.manuscript_chunks (manuscript_id, version, chunk_index);
create index if not exists manuscript_chunks_fts_idx on public.manuscript_chunks using gin (fts);
do $$
begin
  create index if not exists manuscript_chunks_embedding_idx on public.manuscript_chunks
    using hnsw (embedding extensions.vector_cosine_ops);
exception when others then
  raise notice 'Lewati index embedding: %', sqlerrm;
end $$;

-- Inline UNIQUE constraints from CREATE TABLE are skipped when the table
-- already exists. Re-add the ones the app relies on for upserts.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.research_maps'::regclass
      and conname = 'research_maps_manuscript_id_version_key'
  ) then
    alter table public.research_maps
      add constraint research_maps_manuscript_id_version_key unique (manuscript_id, version);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.manuscript_chunks'::regclass
      and conname = 'manuscript_chunks_manuscript_id_version_chunk_index_key'
  ) then
    alter table public.manuscript_chunks
      add constraint manuscript_chunks_manuscript_id_version_chunk_index_key
      unique (manuscript_id, version, chunk_index);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.recon_jobs'::regclass
      and conname = 'recon_jobs_research_map_id_key'
  ) then
    alter table public.recon_jobs
      add constraint recon_jobs_research_map_id_key unique (research_map_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.encounters'::regclass
      and conname = 'encounters_run_id_floor_order_room_order_key'
  ) then
    alter table public.encounters
      add constraint encounters_run_id_floor_order_room_order_key
      unique (run_id, floor_order, room_order);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.turns'::regclass
      and conname = 'turns_encounter_id_seq_key'
  ) then
    alter table public.turns
      add constraint turns_encounter_id_seq_key unique (encounter_id, seq);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.reports'::regclass
      and conname = 'reports_run_id_key'
  ) then
    alter table public.reports
      add constraint reports_run_id_key unique (run_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Existing projects may already have these helpers with a different
-- argument name/return type. CREATE OR REPLACE cannot change those, so drop
-- first (CASCADE also clears the old triggers/policies, recreated below).
-- ---------------------------------------------------------------------------

drop function if exists public.search_manuscript_chunks_fts(text, uuid, integer, integer) cascade;
drop function if exists public.match_manuscript_chunks(extensions.vector, uuid, integer, integer, text) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists private.owns_turn(uuid) cascade;
drop function if exists private.owns_encounter(uuid) cascade;
drop function if exists private.owns_run(uuid) cascade;
drop function if exists private.owns_research_map(uuid) cascade;
drop function if exists private.owns_manuscript(uuid) cascade;
drop function if exists private.validate_map_confirmation() cascade;
drop function if exists private.freeze_claim_citation() cascade;
drop function if exists private.freeze_citation() cascade;
drop function if exists private.freeze_claim() cascade;
drop function if exists private.freeze_research_map() cascade;
drop function if exists private.map_is_confirmed(uuid) cascade;
drop function if exists private.touch_updated_at() cascade;

-- ---------------------------------------------------------------------------
-- Profile + timestamps + freeze triggers
-- ---------------------------------------------------------------------------

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists recon_jobs_touch_updated_at on public.recon_jobs;
create trigger recon_jobs_touch_updated_at
before update on public.recon_jobs
for each row execute function private.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function private.map_is_confirmed(map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.research_maps
    where id = map_id and status = 'confirmed'
  );
$$;

create or replace function private.freeze_research_map()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'confirmed' then
    raise exception 'Research Map yang sudah dikonfirmasi beku; buat versi baru.';
  end if;
  return new;
end;
$$;

drop trigger if exists research_maps_freeze on public.research_maps;
create trigger research_maps_freeze
before update on public.research_maps
for each row execute function private.freeze_research_map();

create or replace function private.freeze_claim()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  map_id uuid;
begin
  map_id := case when tg_op = 'DELETE' then old.research_map_id else new.research_map_id end;
  if private.map_is_confirmed(map_id) then
    raise exception 'Klaim pada Research Map confirmed beku.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists claims_freeze on public.claims;
create trigger claims_freeze
before insert or update or delete on public.claims
for each row execute function private.freeze_claim();

create or replace function private.freeze_citation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if private.map_is_confirmed(old.research_map_id) then
      raise exception 'Sitasi pada Research Map confirmed tidak bisa dihapus.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' and private.map_is_confirmed(new.research_map_id) and not new.is_injected then
    raise exception 'Research Map confirmed hanya boleh menerima sitasi sisipan Ghost.';
  end if;

  if tg_op = 'UPDATE' and private.map_is_confirmed(old.research_map_id) then
    if new.raw_text <> old.raw_text
      or new.parsed is distinct from old.parsed
      or new.is_injected <> old.is_injected
      or new.research_map_id <> old.research_map_id then
      raise exception 'Hanya status verifikasi sitasi yang boleh berubah setelah konfirmasi.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists citations_freeze on public.citations;
create trigger citations_freeze
before insert or update or delete on public.citations
for each row execute function private.freeze_citation();

create or replace function private.freeze_claim_citation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  map_id uuid;
begin
  select research_map_id into map_id
  from public.claims
  where id = case when tg_op = 'DELETE' then old.claim_id else new.claim_id end;

  if map_id is not null and private.map_is_confirmed(map_id) then
    raise exception 'Tautan klaim–sitasi pada Research Map confirmed beku.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists claim_citations_freeze on public.claim_citations;
create trigger claim_citations_freeze
before insert or update or delete on public.claim_citations
for each row execute function private.freeze_claim_citation();

create or replace function private.validate_map_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and old.status <> 'confirmed' then
    if new.completeness is null then
      raise exception 'Cek kelengkapan belum dijalankan.';
    end if;
    if coalesce(jsonb_array_length(new.completeness -> 'missing'), -1) <> 0 then
      raise exception 'Masih ada bagian naskah yang kurang.';
    end if;
    if not exists (
      select 1 from public.citations
      where research_map_id = new.id and not is_injected
    ) then
      raise exception 'Daftar pustaka kosong; Research Map tidak bisa dikonfirmasi.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists research_maps_validate_confirmation on public.research_maps;
create trigger research_maps_validate_confirmation
before update on public.research_maps
for each row execute function private.validate_map_confirmation();

-- ---------------------------------------------------------------------------
-- RLS helpers
-- ---------------------------------------------------------------------------

create or replace function private.owns_manuscript(manuscript_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.manuscripts
    where id = manuscript_id
      and owner_id = auth.uid()
      and deleted_at is null
  );
$$;

create or replace function private.owns_research_map(map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.research_maps rm
    join public.manuscripts m on m.id = rm.manuscript_id
    where rm.id = map_id
      and m.owner_id = auth.uid()
      and m.deleted_at is null
  );
$$;

create or replace function private.owns_run(run_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.runs r
    join public.research_maps rm on rm.id = r.research_map_id
    join public.manuscripts m on m.id = rm.manuscript_id
    where r.id = run_id
      and m.owner_id = auth.uid()
      and m.deleted_at is null
  );
$$;

create or replace function private.owns_encounter(encounter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.encounters e
    where e.id = encounter_id
      and private.owns_run(e.run_id)
  );
$$;

create or replace function private.owns_turn(turn_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.turns t
    where t.id = turn_id
      and private.owns_encounter(t.encounter_id)
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.owns_manuscript(uuid) to authenticated;
grant execute on function private.owns_research_map(uuid) to authenticated;
grant execute on function private.owns_run(uuid) to authenticated;
grant execute on function private.owns_encounter(uuid) to authenticated;
grant execute on function private.owns_turn(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.manuscripts enable row level security;
alter table public.research_maps enable row level security;
alter table public.claims enable row level security;
alter table public.citations enable row level security;
alter table public.claim_citations enable row level security;
alter table public.manuscript_chunks enable row level security;
alter table public.weakness_types enable row level security;
alter table public.rubrics enable row level security;
alter table public.bosses enable row level security;
alter table public.findings enable row level security;
alter table public.runs enable row level security;
alter table public.encounters enable row level security;
alter table public.turns enable row level security;
alter table public.evaluations enable row level security;
alter table public.ghost_checks enable row level security;
alter table public.reports enable row level security;
alter table public.pilot_feedback enable row level security;
alter table public.recon_jobs enable row level security;

drop policy if exists "profiles select own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "manuscripts select own" on public.manuscripts;
drop policy if exists "manuscripts update own" on public.manuscripts;
drop policy if exists "research maps select own" on public.research_maps;
drop policy if exists "claims select own" on public.claims;
drop policy if exists "citations select own" on public.citations;
drop policy if exists "findings select own" on public.findings;
drop policy if exists "recon jobs select own" on public.recon_jobs;
drop policy if exists "catalogue weakness read" on public.weakness_types;
drop policy if exists "catalogue rubrics read" on public.rubrics;
drop policy if exists "catalogue bosses read" on public.bosses;
drop policy if exists "runs select own" on public.runs;
drop policy if exists "encounters select own" on public.encounters;
drop policy if exists "turns select own" on public.turns;
drop policy if exists "evaluations select own" on public.evaluations;
drop policy if exists "ghost checks select own" on public.ghost_checks;
drop policy if exists "reports select own" on public.reports;
drop policy if exists "pilot feedback select own" on public.pilot_feedback;

create policy "profiles select own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "manuscripts select own" on public.manuscripts
  for select to authenticated using (owner_id = auth.uid() and deleted_at is null);
create policy "manuscripts update own" on public.manuscripts
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "research maps select own" on public.research_maps
  for select to authenticated using (private.owns_research_map(id));
create policy "claims select own" on public.claims
  for select to authenticated using (private.owns_research_map(research_map_id));
create policy "citations select own" on public.citations
  for select to authenticated using (private.owns_research_map(research_map_id));
create policy "findings select own" on public.findings
  for select to authenticated using (private.owns_research_map(research_map_id));
create policy "recon jobs select own" on public.recon_jobs
  for select to authenticated using (private.owns_research_map(research_map_id));

create policy "catalogue weakness read" on public.weakness_types
  for select to authenticated using (true);
create policy "catalogue rubrics read" on public.rubrics
  for select to authenticated using (true);
create policy "catalogue bosses read" on public.bosses
  for select to authenticated using (true);

create policy "runs select own" on public.runs
  for select to authenticated using (private.owns_run(id));
create policy "encounters select own" on public.encounters
  for select to authenticated using (private.owns_run(run_id));
create policy "turns select own" on public.turns
  for select to authenticated using (private.owns_encounter(encounter_id));
create policy "evaluations select own" on public.evaluations
  for select to authenticated using (private.owns_turn(turn_id));
create policy "ghost checks select own" on public.ghost_checks
  for select to authenticated using (private.owns_run(run_id));
create policy "reports select own" on public.reports
  for select to authenticated using (private.owns_run(run_id));
create policy "pilot feedback select own" on public.pilot_feedback
  for select to authenticated using (private.owns_run(run_id));

-- Source text and chunks stay server-only.
revoke all on public.manuscript_chunks from anon, authenticated;

-- Hidden Ghost columns must not leak before the Ghost stage.
revoke select on public.citations from anon, authenticated;
grant select (id, research_map_id, raw_text, parsed, created_at)
  on public.citations to authenticated;

-- ---------------------------------------------------------------------------
-- Retrieval RPCs
-- ---------------------------------------------------------------------------

create or replace function public.search_manuscript_chunks_fts(
  query_text text,
  filter_manuscript_id uuid,
  filter_version integer,
  match_count integer default 8
)
returns table (
  id uuid,
  chunk_index integer,
  section_label text,
  text text,
  rank real
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.chunk_index,
    c.section_label,
    c.text,
    ts_rank(c.fts, websearch_to_tsquery('simple', query_text))::real as rank
  from public.manuscript_chunks c
  where c.manuscript_id = filter_manuscript_id
    and c.version = filter_version
    and c.fts @@ websearch_to_tsquery('simple', query_text)
    and (auth.role() = 'service_role' or private.owns_manuscript(filter_manuscript_id))
  order by rank desc
  limit match_count;
$$;

create or replace function public.match_manuscript_chunks(
  query_embedding extensions.vector(768),
  filter_manuscript_id uuid,
  filter_version integer,
  match_count integer default 8,
  filter_model text default null
)
returns table (
  id uuid,
  chunk_index integer,
  section_label text,
  text text,
  similarity real
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.chunk_index,
    c.section_label,
    c.text,
    (1 - (c.embedding operator(extensions.<=>) query_embedding))::real as similarity
  from public.manuscript_chunks c
  where c.manuscript_id = filter_manuscript_id
    and c.version = filter_version
    and c.embedding is not null
    and (filter_model is null or c.embedding_model = filter_model)
    and (auth.role() = 'service_role' or private.owns_manuscript(filter_manuscript_id))
  order by c.embedding operator(extensions.<=>) query_embedding
  limit match_count;
$$;

revoke all on function public.search_manuscript_chunks_fts(text, uuid, integer, integer) from public;
revoke all on function public.match_manuscript_chunks(extensions.vector, uuid, integer, integer, text) from public;
grant execute on function public.search_manuscript_chunks_fts(text, uuid, integer, integer) to authenticated;
grant execute on function public.match_manuscript_chunks(extensions.vector, uuid, integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------

insert into public.weakness_types
  (slug, dimension, detector, uses_retrieval, default_severity, attack_types, version, description)
values
  ('gap_unsupported', 'gap', 'code', true, 2, array['clarify', 'challenge', 'counterexample'], 'v1', 'Gap tidak didukung referensi.'),
  ('gap_answered_by_own_refs', 'gap', 'llm', true, 3, array['challenge', 'spot', 'counterexample'], 'v1', 'Gap sudah dijawab referensi sendiri.'),
  ('claim_without_citation', 'gap', 'code', false, 2, array['numbers', 'spot', 'clarify'], 'v1', 'Klaim faktual tanpa sitasi.'),
  ('problem_objective_gap', 'align', 'llm', true, 2, array['clarify', 'challenge', 'repair'], 'v1', 'Masalah dan tujuan tidak tersambung.'),
  ('objective_rq_mismatch', 'align', 'llm', true, 2, array['clarify', 'repair', 'scenario'], 'v1', 'Tujuan dan RQ tidak selaras.'),
  ('rq_method_mismatch', 'method', 'llm', true, 3, array['challenge', 'scenario', 'repair'], 'v1', 'Metode tidak menjawab RQ.'),
  ('sample_unreported', 'method', 'code', false, 2, array['numbers', 'clarify', 'challenge'], 'v1', 'Ukuran sampel tidak dilaporkan.'),
  ('generalization_beyond_sample', 'method', 'llm', true, 3, array['challenge', 'counterexample', 'scenario'], 'v1', 'Generalisasi melampaui sampel.'),
  ('limitation_missing', 'method', 'code', true, 2, array['limitation', 'scenario', 'clarify'], 'v1', 'Keterbatasan tidak disebut.'),
  ('conclusion_overclaim', 'audit', 'llm', true, 3, array['challenge', 'numbers', 'limitation'], 'v1', 'Kesimpulan melampaui temuan.'),
  ('objective_without_finding', 'audit', 'code', false, 2, array['spot', 'clarify', 'repair'], 'v1', 'Tujuan tanpa temuan.'),
  ('abstract_result_mismatch', 'audit', 'llm', true, 2, array['spot', 'numbers', 'challenge'], 'v1', 'Abstrak tidak cocok dengan hasil.'),
  ('citation_not_found', 'ghost', 'code', true, 2, array['spot', 'clarify'], 'v1', 'Referensi tidak ditemukan.'),
  ('citation_claim_mismatch', 'ghost', 'llm', true, 2, array['spot', 'challenge', 'clarify'], 'v1', 'Referensi tidak mendukung klaim.')
on conflict (slug) do nothing;

insert into public.rubrics (id, weakness_type, criteria, scale_max, version)
values
  ('gap', 'gap_unsupported', '[{"id":"gap_identified","label":"Gap disebutkan dengan jelas"},{"id":"gap_supported","label":"Gap didukung referensi"},{"id":"gap_relevant","label":"Gap relevan dengan tujuan"}]', 2, 'v1'),
  ('align', 'problem_objective_gap', '[{"id":"link_explicit","label":"Hubungan masalah–tujuan eksplisit"},{"id":"link_logical","label":"Hubungan logis dan koheren"},{"id":"no_overclaim","label":"Tujuan tidak melampaui masalah"}]', 2, 'v1'),
  ('method', 'rq_method_mismatch', '[{"id":"method_appropriate","label":"Metode sesuai RQ"},{"id":"method_justified","label":"Pilihan metode dibenarkan"},{"id":"no_overclaim","label":"Klaim metode tidak berlebihan"}]', 2, 'v1'),
  ('audit', 'conclusion_overclaim', '[{"id":"no_overclaim","label":"Kesimpulan tidak melampaui temuan"},{"id":"numbers_consistent","label":"Angka konsisten"},{"id":"scope_accurate","label":"Cakupan generalisasi sesuai data"}]', 2, 'v1'),
  ('ghost', 'citation_not_found', '[{"id":"ref_exists","label":"Referensi ditemukan"},{"id":"ref_accessible","label":"Detail cukup untuk verifikasi"},{"id":"ref_relevant","label":"Referensi relevan"}]', 2, 'v1'),
  ('final', 'conclusion_overclaim', '[{"id":"no_overclaim","label":"Tidak ada klaim berlebih"},{"id":"link_logical","label":"Mata rantai logis"},{"id":"scope_accurate","label":"Cakupan tepat"}]', 2, 'v1')
on conflict (id) do nothing;

insert into public.bosses (slug, name, floor_order, dimension, base_hp, rubric_id, sprite_key)
values
  ('gap_hunter', 'Gap Hunter', 1, 'gap', 100, 'gap', 'boss-gap'),
  ('aligner', 'The Aligner', 2, 'align', 100, 'align', 'boss-align'),
  ('methodologist', 'Methodologist', 3, 'method', 100, 'method', 'boss-method'),
  ('auditor', 'The Auditor', 4, 'audit', 100, 'audit', 'boss-audit'),
  ('ghost', 'The Ghost', 5, 'ghost', 100, 'ghost', 'boss-ghost'),
  ('sir_actually', 'Sir, Actually', 6, 'final', 100, 'final', 'boss-sir')
on conflict (slug) do nothing;
