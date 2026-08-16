create table if not exists public.reels (
  firestore_document_id text primary key,
  reel_number text,
  paper_type text,
  reel_size numeric,
  bf text,
  gsm numeric,
  weight numeric,
  consumed_weight numeric,
  current_balance numeric,
  rate numeric,
  supplier text,
  supplier_name text,
  manufacturer_name text,
  status text,
  inward_date timestamptz,
  reserved_for_jc text,
  active_reserved_weight numeric,
  is_archived boolean,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_reels_reel_number
  on public.reels (reel_number);

create index if not exists idx_reels_reserved_for_jc
  on public.reels (reserved_for_jc);

alter table public.reels enable row level security;

revoke all on table public.reels from anon, authenticated;
grant select, insert, update on table public.reels to anon, authenticated;
revoke truncate, references, trigger, delete on table public.reels from anon, authenticated;

drop policy if exists reels_select on public.reels;
create policy reels_select
  on public.reels
  for select
  to anon, authenticated
  using (true);

drop policy if exists reels_insert on public.reels;
create policy reels_insert
  on public.reels
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists reels_update on public.reels;
create policy reels_update
  on public.reels
  for update
  to anon, authenticated
  using (true)
  with check (true);
