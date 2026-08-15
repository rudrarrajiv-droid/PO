create table if not exists public.user_sessions (
  firestore_document_id text primary key,
  user_id text,
  device_info text,
  login_time timestamptz,
  last_active timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
