create table if not exists public.purchase_orders (
  firestore_document_id text primary key,
  po_no text,
  po_date_raw text,
  po_date date,
  delivery_date_raw text,
  customer_id_raw text,
  customer_name text,
  resolved_customer_id text,
  consignee text,
  artwork_no text,
  size text,
  product_id_raw text,
  product_name text,
  resolved_product_id text,
  rate numeric,
  order_qty numeric,
  in_qty numeric,
  out_qty numeric,
  status text,
  history jsonb,
  is_archived boolean,
  import_run_id text,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

-- No foreign keys and no unique constraint on po_no by design: a single
-- Firestore purchaseOrders document represents one line item, and many
-- documents intentionally share the same po_no (one PO = many line items).
-- resolved_customer_id / resolved_product_id are plain text soft-references
-- (no FK) to public.customers.firestore_document_id / public.products.firestore_document_id,
-- populated only on a safe exact-name match; never guessed.

create index if not exists idx_purchase_orders_po_no
  on public.purchase_orders (po_no);

create index if not exists idx_purchase_orders_resolved_customer_id
  on public.purchase_orders (resolved_customer_id);

create index if not exists idx_purchase_orders_resolved_product_id
  on public.purchase_orders (resolved_product_id);
