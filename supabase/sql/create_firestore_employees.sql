create table if not exists public.employees (
  firestore_document_id text primary key,
  name text,
  category text,
  contractor_name text,
  designation text,
  basic_salary numeric,
  is_active boolean,
  employee_code integer,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
