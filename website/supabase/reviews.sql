-- Reviews left on the website. Collected only for now; nothing reads them back.
create table if not exists public.reviews (
  id         bigint generated always as identity primary key,
  rating     smallint not null check (rating between 1 and 5),
  text       text not null check (char_length(text) between 1 and 1000),
  name       text check (name is null or char_length(name) <= 60),
  approved   boolean not null default false,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists reviews_ip_hash_created_at on public.reviews (ip_hash, created_at);

-- Row level security on with no policies: the public anon key can't read or write.
-- The site's server uses the service role key, which bypasses this.
alter table public.reviews enable row level security;
