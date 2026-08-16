create table if not exists public.activity_logs (
  firestore_document_id text primary key,
  app_user text,
  action text,
  entity text,
  reference_id text,
  count numeric,
  details text,
  logged_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
