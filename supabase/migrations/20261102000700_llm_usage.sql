-- LLM token usage audit. Written by lib/llm.ts after every provider call.

create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null,
  model text not null,
  route text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer
);

create index if not exists llm_usage_created_at_idx
  on public.llm_usage (created_at desc);

alter table public.llm_usage enable row level security;
revoke all on public.llm_usage from anon, authenticated;
grant all on public.llm_usage to service_role;
