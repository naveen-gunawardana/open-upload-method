-- Separate from the public counter. No video bytes, filenames, raw errors or raw IP addresses.
create table if not exists public.conversion_analytics (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  event text not null check (event in ('started','succeeded','check_failed','failed','cancelled','downloaded')),
  mode text not null check (mode in ('single','ab')),
  preset text not null,
  settings jsonb not null,
  source jsonb not null,
  result jsonb,
  elapsed_ms bigint,
  failure_category text,
  ip_hash text not null,
  country text,
  browser text not null,
  os text not null,
  created_at timestamptz not null default now(),
  unique (run_id,event)
);
create index if not exists conversion_analytics_created_at on public.conversion_analytics(created_at);
create index if not exists conversion_analytics_ip_created on public.conversion_analytics(ip_hash,created_at);
alter table public.conversion_analytics enable row level security;
revoke all on public.conversion_analytics from anon, authenticated;
grant all on public.conversion_analytics to service_role;
grant usage, select on sequence public.conversion_analytics_id_seq to service_role;
