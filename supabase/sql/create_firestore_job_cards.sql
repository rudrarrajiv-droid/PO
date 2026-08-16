create table if not exists public.job_cards (
  firestore_document_id text primary key,
  job_card_no text,
  target_date_raw text,
  target_date date,
  po_id_raw text,
  po_no text,
  resolved_po_id text,
  customer_id_raw text,
  customer_name text,
  resolved_customer_id text,
  product_id_raw text,
  product_name text,
  resolved_product_id text,
  order_qty numeric,
  one_box_weight numeric,
  total_weight numeric,
  paper_quantity numeric,
  ply_quantity numeric,
  priority text,
  remarks jsonb,
  product_snapshot jsonb not null,
  reel_allocation_skipped boolean,
  approval_status text,
  approval_reason text,
  approval_requested_by text,
  approval_requested_at timestamptz,
  approval_expires_at timestamptz,
  status text,
  is_archived boolean,
  issued_by text,
  issued_at timestamptz,
  expected_delivery_at timestamptz,
  completed_at timestamptz,
  completed_by text,
  completion_status text,
  fg_qty numeric,
  produced_qty numeric,
  deleted_at timestamptz,
  deleted_by text,
  created_by text,
  updated_by text,
  created_at timestamptz,
  updated_at timestamptz,
  raw_data jsonb not null,
  imported_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);

-- Design notes (verified against the full 79-document backup + application
-- source before writing this schema):
--
-- * No foreign keys anywhere, and no UNIQUE constraint on job_card_no.
--   job_card_no is expected to be unique in practice but this has not been
--   independently verified, so it is not enforced at migration time.
--
-- * status has NO CHECK constraint. Observed values in the current 79 docs:
--   PENDING, IN_PROCESS, COMPLETED, DELETED. The application code also
--   supports "PENDING APPROVAL" (oversize-reel approval workflow), which
--   does not happen to appear in the current data but is a real, reachable
--   value — the column must not be restricted to only what's been observed.
--
-- * po_id_raw / po_no are preserved exactly as-is (nullable). resolved_po_id
--   is included for schema symmetry with the other resolved_* columns but
--   is intentionally left NULL for all current rows: 0/79 documents have a
--   real poId/poNo value today (all are null or the key is entirely absent),
--   so there is nothing to safely resolve against public.purchase_orders yet.
--
-- * resolved_customer_id is populated ONLY via the same conservative,
--   exact-name-match rule already established for public.purchase_orders
--   (trimmed, case-insensitive match of customer_name against
--   public.customers.name; any name matching more than one customers row,
--   or matching none, resolves to NULL). customer_id_raw itself is bimodal
--   in the source data (sometimes a real customers Firestore ID, sometimes
--   a short lowercase code copied from the linked product's customerId) and
--   is never used directly as the resolution key.
--
-- * resolved_product_id is populated ONLY via an exact EXISTENCE check of
--   product_id_raw against public.products.firestore_document_id (not a
--   name match — product_id_raw in this collection is consistently a real
--   Firestore products document ID, unlike purchaseOrders). If the ID does
--   not exist in public.products, resolved_product_id stays NULL.
--
-- * product_snapshot is NOT NULL and stores the complete nested
--   product-at-creation-time snapshot (product fields -> layers[] ->
--   allocatedReels[]) exactly as stored in Firestore.
--
-- * remarks is nullable JSONB and preserves either historical shape found
--   in the data: a plain string ("" on most docs) or an array of
--   { text, date, by } objects (appended by the "Add Remark" feature).
--   Never coerced to a single shape.
--
-- * fg_qty (legacy field name) and produced_qty (current field name) are
--   two DIFFERENT columns, both nullable, and are never merged or
--   defaulted from one another. In the current data they are mutually
--   exclusive (a completed job card has one or the other, never both).
--
-- * completion_status ("DELAYED" / "ON TIME") and completed_by are
--   distinct from the top-level status/updated_by fields and are only
--   populated on finalized (COMPLETED) job cards.

create index if not exists idx_job_cards_job_card_no
  on public.job_cards (job_card_no);

create index if not exists idx_job_cards_resolved_customer_id
  on public.job_cards (resolved_customer_id);

create index if not exists idx_job_cards_resolved_product_id
  on public.job_cards (resolved_product_id);

create index if not exists idx_job_cards_status
  on public.job_cards (status);
