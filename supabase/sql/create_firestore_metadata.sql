create table if not exists public.metadata (
  firestore_document_id text primary key,
  recycled_numbers jsonb,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
