-- One row per download from the website. The IP is kept only as a salted hash.
create table if not exists public.download_events (
  id         bigint generated always as identity primary key,
  platform   text not null,
  ip_hash    text not null,
  country    text,
  created_at timestamptz not null default now()
);

create index if not exists download_events_created_at on public.download_events (created_at);

-- Row level security on with no policies: only the site's server (service role) can use it.
alter table public.download_events enable row level security;
