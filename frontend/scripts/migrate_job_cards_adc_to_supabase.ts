import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

// NOTE on "jobCards" (verified against the full 79-document collection +
// application source before writing this script):
//
// 1. One Firestore document = one job card. job_card_no is expected to be
//    unique in practice but this is not enforced (no UNIQUE constraint).
//
// 2. poId / poNo are null or entirely absent on ALL 79 current documents.
//    po_id_raw / po_no preserve whatever is there (normalized so "absent"
//    and "null" both become SQL NULL, one representation). resolved_po_id
//    is never computed by this script and always stays NULL — there is
//    no trustworthy non-null poId data to resolve against public.purchase_orders
//    yet.
//
// 3. customerId is bimodal (sometimes a real customers Firestore ID,
//    sometimes a short lowercase code copied from the linked product's
//    customerId at job-card-creation time). resolved_customer_id is
//    populated ONLY in --apply, via the same conservative exact-name-match
//    rule already used for public.purchase_orders: trimmed, case-insensitive
//    match of customer_name against public.customers.name; a name matching
//    more than one customers row, or matching none, resolves to NULL.
//    Never fuzzy-matched.
//
// 4. productId is consistently a genuine Firestore products document ID in
//    this collection (unlike purchaseOrders). resolved_product_id is
//    populated ONLY in --apply, via a plain EXISTENCE check of
//    product_id_raw against public.products.firestore_document_id — not a
//    name match. If the ID isn't found, resolved_product_id stays NULL.
//
// 5. productSnapshot is always present (79/79) and is stored as-is in the
//    NOT NULL product_snapshot JSONB column (product fields -> layers[] ->
//    allocatedReels[]). In the extremely unlikely case a fetched document
//    is missing it entirely, an empty JSON object is stored instead of
//    failing the whole migration — never invented business data, just a
//    structurally valid placeholder so the NOT NULL constraint can hold
//    while still migrating every document with no filtering.
//
// 6. remarks has two real historical shapes: a plain string ("" on most
//    docs) or an array of { text, date, by } objects. Stored as-is in the
//    nullable remarks JSONB column, never coerced to one shape.
//
// 7. fg_qty (legacy field name) and produced_qty (current field name) are
//    two separate nullable NUMERIC columns and are never merged or used to
//    default one another.
//
// 8. Temporal fields are inconsistently typed in the source: createdAt,
//    updatedAt and deletedAt are Firestore Timestamps; issuedAt,
//    expectedDeliveryAt, completedAt, approvalRequestedAt and
//    approvalExpiresAt are plain ISO strings. normalizeTemporal() below
//    handles both shapes uniformly.
//
// 9. targetDate is always a plain "YYYY-MM-DD" string in the current data
//    (no Excel-serial risk observed here, unlike purchaseOrders.poDate).
//    target_date_raw preserves the original string; target_date is only
//    populated when it matches that exact shape — never guessed otherwise.
//
// 10. DELETED job cards (soft-deleted via a partial updateDoc that only
//     adds status/isArchived/deletedAt/deletedBy) are migrated identically
//     to active job cards — no filtering, no special-casing.

type NormalizedRow = {
  firestore_document_id: string;
  job_card_no: string | null;
  target_date_raw: string | null;
  target_date: string | null;
  po_id_raw: string | null;
  po_no: string | null;
  resolved_po_id: string | null;
  customer_id_raw: string | null;
  customer_name: string | null;
  resolved_customer_id: string | null;
  product_id_raw: string | null;
  product_name: string | null;
  resolved_product_id: string | null;
  order_qty: number | null;
  one_box_weight: number | null;
  total_weight: number | null;
  paper_quantity: number | null;
  ply_quantity: number | null;
  priority: string | null;
  remarks: unknown;
  product_snapshot: Record<string, unknown>;
  reel_allocation_skipped: boolean | null;
  approval_status: string | null;
  approval_reason: string | null;
  approval_requested_by: string | null;
  approval_requested_at_iso: string | null;
  approval_expires_at_iso: string | null;
  status: string | null;
  is_archived: boolean | null;
  issued_by: string | null;
  issued_at_iso: string | null;
  expected_delivery_at_iso: string | null;
  completed_at_iso: string | null;
  completed_by: string | null;
  completion_status: string | null;
  fg_qty: number | null;
  produced_qty: number | null;
  deleted_at_iso: string | null;
  deleted_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at_iso: string | null;
  updated_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "jobCards";
const TABLE_NAME = "public.job_cards";

const args = process.argv.slice(2);
const applyMode = args.includes("--apply");
const dryRunMode = args.includes("--dry-run") || !applyMode;

// Handles genuine Firestore Timestamp-shaped objects (used by createdAt,
// updatedAt, deletedAt).
function getTimestampIso(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybeAny = value as {
    toDate?: () => Date;
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
    iso?: string;
  };

  if (typeof maybeAny.toDate === "function") {
    return maybeAny.toDate().toISOString();
  }

  const seconds =
    typeof maybeAny.seconds === "number"
      ? maybeAny.seconds
      : typeof maybeAny._seconds === "number"
      ? maybeAny._seconds
      : null;

  const nanoseconds =
    typeof maybeAny.nanoseconds === "number"
      ? maybeAny.nanoseconds
      : typeof maybeAny._nanoseconds === "number"
      ? maybeAny._nanoseconds
      : 0;

  if (typeof maybeAny.iso === "string") {
    return maybeAny.iso;
  }

  if (seconds !== null) {
    const ms = seconds * 1000 + Math.floor(nanoseconds / 1000000);
    return new Date(ms).toISOString();
  }

  return null;
}

// Normalizes a field that may be EITHER a Firestore Timestamp-shaped object
// OR a plain ISO date-time string (both shapes exist across jobCards'
// temporal fields) into a single ISO string suitable for a timestamptz
// column. Returns null for anything unrecognized — never guessed.
function normalizeTemporal(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  if (typeof value === "object") {
    return getTimestampIso(value);
  }

  return null;
}

// target_date: only accepts an exact "YYYY-MM-DD" shape (the only shape
// observed in the source data). Anything else is left NULL rather than
// guessed.
function parseTargetDate(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDoc(
  id: string,
  data: Record<string, unknown>
): NormalizedRow {
  const jobCardNo = typeof data.jobCardNo === "string" ? data.jobCardNo : null;
  const targetDateRaw =
    typeof data.targetDate === "string" ? data.targetDate : null;
  const poIdRaw = typeof data.poId === "string" ? data.poId : null;
  const poNo = typeof data.poNo === "string" ? data.poNo : null;
  const customerIdRaw =
    typeof data.customerId === "string" ? data.customerId : null;
  const customerName =
    typeof data.customerName === "string" ? data.customerName : null;
  const productIdRaw =
    typeof data.productId === "string" ? data.productId : null;
  const productName =
    typeof data.productName === "string" ? data.productName : null;

  const orderQty = typeof data.orderQty === "number" ? data.orderQty : null;
  const oneBoxWeight =
    typeof data.oneBoxWeight === "number" ? data.oneBoxWeight : null;
  const totalWeight =
    typeof data.totalWeight === "number" ? data.totalWeight : null;
  const paperQuantity =
    typeof data.paperQuantity === "number" ? data.paperQuantity : null;
  const plyQuantity =
    typeof data.plyQuantity === "number" ? data.plyQuantity : null;
  const priority = typeof data.priority === "string" ? data.priority : null;

  // remarks: preserve exactly as-is (string "" shape or array-of-objects
  // shape) — never coerced.
  const remarks = data.remarks !== undefined ? data.remarks : null;

  // product_snapshot is NOT NULL. Preserve the full nested object; fall
  // back to an empty object only if the field is genuinely absent, so the
  // document is never skipped/filtered out.
  const productSnapshot =
    data.productSnapshot && typeof data.productSnapshot === "object"
      ? (data.productSnapshot as Record<string, unknown>)
      : {};

  const reelAllocationSkipped =
    typeof data.reelAllocationSkipped === "boolean"
      ? data.reelAllocationSkipped
      : null;

  const approvalStatus =
    typeof data.approvalStatus === "string" ? data.approvalStatus : null;
  const approvalReason =
    typeof data.approvalReason === "string" ? data.approvalReason : null;
  const approvalRequestedBy =
    typeof data.approvalRequestedBy === "string"
      ? data.approvalRequestedBy
      : null;

  const status = typeof data.status === "string" ? data.status : null;
  const isArchived =
    typeof data.isArchived === "boolean" ? data.isArchived : null;

  const issuedBy = typeof data.issuedBy === "string" ? data.issuedBy : null;
  const completedBy =
    typeof data.completedBy === "string" ? data.completedBy : null;
  const completionStatus =
    typeof data.completionStatus === "string" ? data.completionStatus : null;

  // fg_qty (legacy) and produced_qty (current) are independent fields,
  // never merged or defaulted from one another.
  const fgQty = typeof data.fgQty === "number" ? data.fgQty : null;
  const producedQty =
    typeof data.producedQty === "number" ? data.producedQty : null;

  const deletedBy = typeof data.deletedBy === "string" ? data.deletedBy : null;
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const updatedBy = typeof data.updatedBy === "string" ? data.updatedBy : null;

  return {
    firestore_document_id: id,
    job_card_no: jobCardNo,
    target_date_raw: targetDateRaw,
    target_date: parseTargetDate(targetDateRaw),
    po_id_raw: poIdRaw,
    po_no: poNo,
    resolved_po_id: null, // never computed by this script, see run()
    customer_id_raw: customerIdRaw,
    customer_name: customerName,
    resolved_customer_id: null, // populated only in --apply, see run()
    product_id_raw: productIdRaw,
    product_name: productName,
    resolved_product_id: null, // populated only in --apply, see run()
    order_qty: orderQty,
    one_box_weight: oneBoxWeight,
    total_weight: totalWeight,
    paper_quantity: paperQuantity,
    ply_quantity: plyQuantity,
    priority,
    remarks,
    product_snapshot: productSnapshot,
    reel_allocation_skipped: reelAllocationSkipped,
    approval_status: approvalStatus,
    approval_reason: approvalReason,
    approval_requested_by: approvalRequestedBy,
    approval_requested_at_iso: normalizeTemporal(data.approvalRequestedAt),
    approval_expires_at_iso: normalizeTemporal(data.approvalExpiresAt),
    status,
    is_archived: isArchived,
    issued_by: issuedBy,
    issued_at_iso: normalizeTemporal(data.issuedAt),
    expected_delivery_at_iso: normalizeTemporal(data.expectedDeliveryAt),
    completed_at_iso: normalizeTemporal(data.completedAt),
    completed_by: completedBy,
    completion_status: completionStatus,
    fg_qty: fgQty,
    produced_qty: producedQty,
    deleted_at_iso: normalizeTemporal(data.deletedAt),
    deleted_by: deletedBy,
    created_by: createdBy,
    updated_by: updatedBy,
    created_at_iso: getTimestampIso(data.createdAt),
    updated_at_iso: getTimestampIso(data.updatedAt),
    raw_data: data,
  };
}

async function loadCreateTableSql(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const sqlPath = path.join(
    currentDir,
    "sql",
    "create_firestore_job_cards.sql"
  );
  return readFile(sqlPath, "utf8");
}

// Builds a normalized-name -> firestore_document_id map from an already
// migrated Postgres table. If a normalized name maps to more than one row,
// the entry is set to null (ambiguous) so it can never be guessed at.
// Same conservative rule already used for public.purchase_orders.
async function loadCustomerNameResolutionMap(
  client: any
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const result = await client.query(
    "select firestore_document_id, name from public.customers"
  );
  for (const row of result.rows as Array<{
    firestore_document_id: string;
    name: string | null;
  }>) {
    if (!row.name) {
      continue;
    }
    const key = normalizeNameKey(row.name);
    if (map.has(key)) {
      map.set(key, null); // ambiguous match across multiple rows
    } else {
      map.set(key, row.firestore_document_id);
    }
  }
  return map;
}

// Builds the set of all existing public.products.firestore_document_id
// values, used for a plain existence check (not a name match) since
// jobCards.productId is consistently a genuine products document ID.
async function loadProductIdExistenceSet(client: any): Promise<Set<string>> {
  const set = new Set<string>();
  const result = await client.query(
    "select firestore_document_id from public.products"
  );
  for (const row of result.rows as Array<{ firestore_document_id: string }>) {
    set.add(row.firestore_document_id);
  }
  return set;
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL && applyMode) {
    throw new Error("DATABASE_URL is required when using --apply");
  }

  if (
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.GCLOUD_PROJECT &&
    !process.env.GOOGLE_CLOUD_PROJECT
  ) {
    console.warn(
      "Warning: ADC is required. Ensure Application Default Credentials are available in your environment."
    );
  }

  const app = initializeApp({
    projectId: FIREBASE_PROJECT_ID,
    credential: applicationDefault(),
  });

  const db = getFirestore(app);

  console.log("Reading only Firestore collection: " + FIRESTORE_COLLECTION);
  const snapshot = await db.collection(FIRESTORE_COLLECTION).get();

  const rows: NormalizedRow[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;
    rows.push(normalizeDoc(doc.id, data));
  }

  console.log("Fetched documents: " + rows.length.toString());

  if (dryRunMode) {
    console.log("Dry run mode enabled. No PostgreSQL writes performed.");
    console.log(
      "Note: resolved_customer_id / resolved_product_id are not computed " +
        "in --dry-run (resolution reads public.customers / public.products " +
        "and only runs in --apply); resolved_po_id is never computed by " +
        "this script and always stays NULL."
    );
    if (rows.length > 0) {
      console.log("Sample normalized row:");
      console.log(JSON.stringify(rows[0], null, 2));
    }
    return;
  }

  const pgModule = await import("pg");
  const { Client } = pgModule.default ?? pgModule;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  const createTableSql = await loadCreateTableSql();

  const upsertSql =
    "insert into " +
    TABLE_NAME +
    " (" +
    "firestore_document_id, job_card_no, target_date_raw, target_date, " +
    "po_id_raw, po_no, resolved_po_id, " +
    "customer_id_raw, customer_name, resolved_customer_id, " +
    "product_id_raw, product_name, resolved_product_id, " +
    "order_qty, one_box_weight, total_weight, paper_quantity, ply_quantity, priority, " +
    "remarks, product_snapshot, reel_allocation_skipped, " +
    "approval_status, approval_reason, approval_requested_by, approval_requested_at, approval_expires_at, " +
    "status, is_archived, issued_by, issued_at, expected_delivery_at, " +
    "completed_at, completed_by, completion_status, fg_qty, produced_qty, " +
    "deleted_at, deleted_by, created_by, updated_by, created_at, updated_at, " +
    "raw_data, imported_at, synced_at" +
    ") values (" +
    "$1, $2, $3, $4, " +
    "$5, $6, $7, " +
    "$8, $9, $10, " +
    "$11, $12, $13, " +
    "$14, $15, $16, $17, $18, $19, " +
    "$20::jsonb, $21::jsonb, $22, " +
    "$23, $24, $25, $26, $27, " +
    "$28, $29, $30, $31, $32, " +
    "$33, $34, $35, $36, $37, " +
    "$38, $39, $40, $41, $42, $43, " +
    "$44::jsonb, now(), now()" +
    ") " +
    "on conflict (firestore_document_id) do update set " +
    "job_card_no = excluded.job_card_no, " +
    "target_date_raw = excluded.target_date_raw, " +
    "target_date = excluded.target_date, " +
    "po_id_raw = excluded.po_id_raw, " +
    "po_no = excluded.po_no, " +
    "resolved_po_id = excluded.resolved_po_id, " +
    "customer_id_raw = excluded.customer_id_raw, " +
    "customer_name = excluded.customer_name, " +
    "resolved_customer_id = excluded.resolved_customer_id, " +
    "product_id_raw = excluded.product_id_raw, " +
    "product_name = excluded.product_name, " +
    "resolved_product_id = excluded.resolved_product_id, " +
    "order_qty = excluded.order_qty, " +
    "one_box_weight = excluded.one_box_weight, " +
    "total_weight = excluded.total_weight, " +
    "paper_quantity = excluded.paper_quantity, " +
    "ply_quantity = excluded.ply_quantity, " +
    "priority = excluded.priority, " +
    "remarks = excluded.remarks, " +
    "product_snapshot = excluded.product_snapshot, " +
    "reel_allocation_skipped = excluded.reel_allocation_skipped, " +
    "approval_status = excluded.approval_status, " +
    "approval_reason = excluded.approval_reason, " +
    "approval_requested_by = excluded.approval_requested_by, " +
    "approval_requested_at = excluded.approval_requested_at, " +
    "approval_expires_at = excluded.approval_expires_at, " +
    "status = excluded.status, " +
    "is_archived = excluded.is_archived, " +
    "issued_by = excluded.issued_by, " +
    "issued_at = excluded.issued_at, " +
    "expected_delivery_at = excluded.expected_delivery_at, " +
    "completed_at = excluded.completed_at, " +
    "completed_by = excluded.completed_by, " +
    "completion_status = excluded.completion_status, " +
    "fg_qty = excluded.fg_qty, " +
    "produced_qty = excluded.produced_qty, " +
    "deleted_at = excluded.deleted_at, " +
    "deleted_by = excluded.deleted_by, " +
    "created_by = excluded.created_by, " +
    "updated_by = excluded.updated_by, " +
    "created_at = excluded.created_at, " +
    "updated_at = excluded.updated_at, " +
    "raw_data = excluded.raw_data, " +
    "synced_at = now()";

  await client.connect();
  try {
    await client.query("begin");
    await client.query(createTableSql);

    // Resolution sources are already-migrated tables (public.customers,
    // public.products). Read-only SELECTs; no writes to either table.
    const customerNameMap = await loadCustomerNameResolutionMap(client);
    const productIdSet = await loadProductIdExistenceSet(client);

    for (const row of rows) {
      const resolvedCustomerId = row.customer_name
        ? customerNameMap.get(normalizeNameKey(row.customer_name)) ?? null
        : null;
      const resolvedProductId =
        row.product_id_raw && productIdSet.has(row.product_id_raw)
          ? row.product_id_raw
          : null;
      // resolved_po_id is never computed: no trustworthy non-null poId
      // data exists to resolve against public.purchase_orders yet.
      const resolvedPoId: string | null = null;

      await client.query(upsertSql, [
        row.firestore_document_id,
        row.job_card_no,
        row.target_date_raw,
        row.target_date,
        row.po_id_raw,
        row.po_no,
        resolvedPoId,
        row.customer_id_raw,
        row.customer_name,
        resolvedCustomerId,
        row.product_id_raw,
        row.product_name,
        resolvedProductId,
        row.order_qty,
        row.one_box_weight,
        row.total_weight,
        row.paper_quantity,
        row.ply_quantity,
        row.priority,
        JSON.stringify(row.remarks),
        JSON.stringify(row.product_snapshot),
        row.reel_allocation_skipped,
        row.approval_status,
        row.approval_reason,
        row.approval_requested_by,
        row.approval_requested_at_iso,
        row.approval_expires_at_iso,
        row.status,
        row.is_archived,
        row.issued_by,
        row.issued_at_iso,
        row.expected_delivery_at_iso,
        row.completed_at_iso,
        row.completed_by,
        row.completion_status,
        row.fg_qty,
        row.produced_qty,
        row.deleted_at_iso,
        row.deleted_by,
        row.created_by,
        row.updated_by,
        row.created_at_iso,
        row.updated_at_iso,
        JSON.stringify(row.raw_data),
      ]);
    }

    await client.query("commit");
    console.log("Upsert complete for collection: " + FIRESTORE_COLLECTION);
    console.log("Rows written: " + rows.length.toString());
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
