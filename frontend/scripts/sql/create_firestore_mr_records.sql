create table if not exists public.mr_records (
  firestore_document_id text primary key,
  material_name text,
  opn_stock numeric,
  opn_amt numeric,
  purchase_qty numeric,
  purchase_amt numeric,
  consumption_qty numeric,
  consumption_amt numeric,
  closing_qty numeric,
  closing_amt numeric,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
