create table if not exists public.customers (
  firestore_document_id text primary key,
  name text,
  is_archived boolean,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_customers_name
  on public.customers (name);
