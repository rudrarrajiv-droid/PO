create table if not exists public.attendance (
  firestore_document_id text primary key,
  employee_id text,
  attendance_date date,
  present numeric,
  ot_hours numeric,
  refreshment numeric,
  per_day_amount numeric,
  ot_amount numeric,
  month text,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
