create table if not exists public.firestore_testcollection (
  firestore_document_id text primary key,
  test_field text,
  timestamp_iso timestamptz,
  timestamp_seconds bigint,
  timestamp_nanoseconds integer,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_firestore_testcollection_timestamp_iso
  on public.firestore_testcollection (timestamp_iso);
