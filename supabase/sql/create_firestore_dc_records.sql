create table if not exists public.dc_records (
  firestore_document_id text primary key,
  record_date date,
  total_ply numeric,
  scrap numeric,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
