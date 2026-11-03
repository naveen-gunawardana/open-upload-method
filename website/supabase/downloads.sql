-- Which signed-in user downloaded which build. Accounts themselves live in Supabase Auth (auth.users).
create table if not exists public.download_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text not null,
  created_at timestamptz not null default now()
);

create index if not exists download_events_user_id on public.download_events (user_id, created_at);

-- Row level security on with no policies: only the site's server (service role) can use it.
alter table public.download_events enable row level security;
