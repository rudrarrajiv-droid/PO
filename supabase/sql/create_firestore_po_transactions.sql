create table if not exists public.po_transactions (
  firestore_document_id text primary key,
  po_id text not null,
  type text not null,
  quantity numeric not null,
  transaction_date text not null,
  remarks text,
  reference_id text,
  performed_by text not null,
  created_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

create index if not exists idx_po_transactions_po_id
  on public.po_transactions (po_id);

alter table public.po_transactions enable row level security;

revoke all on table public.po_transactions from anon, authenticated;
grant select, insert on table public.po_transactions to anon, authenticated;
revoke update, delete, truncate, references, trigger on table public.po_transactions from anon, authenticated;

drop policy if exists po_transactions_select on public.po_transactions;
create policy po_transactions_select
  on public.po_transactions
  for select
  to anon, authenticated
  using (true);

drop policy if exists po_transactions_insert on public.po_transactions;
create policy po_transactions_insert
  on public.po_transactions
  for insert
  to anon, authenticated
  with check (true);