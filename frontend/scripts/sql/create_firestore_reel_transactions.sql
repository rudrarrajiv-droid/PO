create table if not exists public.reel_transactions (
  firestore_document_id text primary key,
  reel_id text,
  reel_number text,
  type text,
  quantity numeric,
  remaining_balance numeric,
  job_card_id text,
  performed_by text,
  notes text,
  transaction_date text,
  is_archived boolean,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_reel_transactions_reel_id
  on public.reel_transactions (reel_id);

create index if not exists idx_reel_transactions_type_date
  on public.reel_transactions (type, transaction_date);

alter table public.reel_transactions enable row level security;

revoke all on table public.reel_transactions from anon, authenticated;
grant select, insert, delete on table public.reel_transactions to anon, authenticated;
revoke truncate, references, trigger, update on table public.reel_transactions from anon, authenticated;

drop policy if exists reel_transactions_select on public.reel_transactions;
create policy reel_transactions_select
  on public.reel_transactions
  for select
  to anon, authenticated
  using (true);

drop policy if exists reel_transactions_insert on public.reel_transactions;
create policy reel_transactions_insert
  on public.reel_transactions
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists reel_transactions_delete on public.reel_transactions;
create policy reel_transactions_delete
  on public.reel_transactions
  for delete
  to anon, authenticated
  using (true);
