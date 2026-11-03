-- One row per video patched in the desktop app. Anonymous: a random install id, never file names or contents.
create table if not exists public.patch_events (
  id          bigint generated always as identity primary key,
  install_id  text not null,
  app_version text not null,
  os          text not null,
  codec       text not null,
  ok          boolean not null,
  size_mb     integer not null,
  country     text,
  created_at  timestamptz not null default now()
);

create index if not exists patch_events_created_at on public.patch_events (created_at);
create index if not exists patch_events_install_id on public.patch_events (install_id, created_at);

-- Row level security on with no policies: only the site's server (service role) can use it.
alter table public.patch_events enable row level security;
