import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

// NOTE on "purchaseOrders" (verified against the full 100-document
// collection + application source before writing this script):
//
// 1. One Firestore document = one PO LINE ITEM, not one whole PO. Many
//    documents intentionally share the same poNo. po_no is therefore NOT
//    unique and must never get a UNIQUE constraint.
//
// 2. poDate is stored in two incompatible shapes:
//      - Excel-serial-like numeric string, e.g. "46120.00011574074"
//        (98/100 current docs). The fractional part is a consistent
//        ~10-second artifact from the source spreadsheet and carries no
//        real meaning — it is ignored, not preserved.
//      - Plain ISO "YYYY-MM-DD" string (2/100 docs — these were manually
//        corrected via the Edit PO screen after import).
//    po_date_raw preserves the original string untouched; po_date is a
//    best-effort derived DATE using the epoch 1899-12-30 rule for the
//    Excel-serial shape, or a direct parse for the ISO shape. If a value
//    matches neither shape, po_date is left NULL — never guessed.
//
// 3. customerId / productId are NOT Firestore document IDs for any of the
//    100 documents that exist today (all were created via the Excel import
//    path, which literally sets customerId = customerName and
//    productId = productName as a known shortcut — see
//    ExcelImportPreviewModal.tsx). The manual "Add PO" UI path *does* set
//    real customers.id / products.id, so the field's meaning is genuinely
//    bimodal by design, not just messy data. customer_id_raw / product_id_raw
//    preserve the original values completely untouched, no matter which
//    shape they are.
//
// 4. resolved_customer_id / resolved_product_id are ADDITIVE, best-effort
//    columns populated ONLY via an exact (trimmed, case-insensitive) match:
//      - resolved_customer_id: customerName -> public.customers.name
//      - resolved_product_id: productName -> public.products.item_name
//    If a name matches more than one row in the target table, or matches
//    nothing, the resolved column is left NULL. No fuzzy matching, ever.
//    Resolution requires reading already-migrated Postgres tables, so (to
//    keep --dry-run free of any Postgres dependency, matching the rest of
//    this migration suite) resolution only actually runs in --apply mode.
//    In --dry-run, resolved_customer_id/resolved_product_id are shown as
//    null placeholders with an explicit note.
//
// 5. rate is kept as nullable NUMERIC. A present-but-non-finite (NaN/Inf)
//    or entirely-missing rate is stored as SQL NULL — it is never defaulted
//    to 0, since 0 is itself a legitimate real value seen in this data.
//
// 6. history is always [] in the current data and is preserved as JSONB
//    exactly as-is (no code path in the app ever appends to it).

type NormalizedRow = {
  firestore_document_id: string;
  po_no: string | null;
  po_date_raw: string | null;
  po_date: string | null;
  delivery_date_raw: string | null;
  customer_id_raw: string | null;
  customer_name: string | null;
  resolved_customer_id: string | null;
  consignee: string | null;
  artwork_no: string | null;
  size: string | null;
  product_id_raw: string | null;
  product_name: string | null;
  resolved_product_id: string | null;
  rate: number | null;
  order_qty: number | null;
  in_qty: number | null;
  out_qty: number | null;
  status: string | null;
  history: unknown;
  is_archived: boolean | null;
  import_run_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at_iso: string | null;
  updated_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "purchaseOrders";
const TABLE_NAME = "public.purchase_orders";

// Excel serial-date epoch: 1899-12-30 (day 0), matching the rule verified
// against the actual poDate values in this collection.
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

const args = process.argv.slice(2);
const applyMode = args.includes("--apply");
const dryRunMode = args.includes("--dry-run") || !applyMode;

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

// Converts a raw poDate string into a clean "YYYY-MM-DD" date, or null if
// the format is not one of the two known shapes. Never guesses.
function parsePoDateToIsoDate(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();

  // Shape 1: already a clean ISO date (manual Edit-PO corrections).
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Shape 2: Excel-serial-like numeric string, e.g. "46120.00011574074".
  // Only the integer day count is used; the fractional (~10-second)
  // component is a known source-spreadsheet artifact and is discarded.
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serialDays = Math.floor(Number(trimmed));
    if (!Number.isFinite(serialDays)) {
      return null;
    }
    const ms = EXCEL_EPOCH_UTC_MS + serialDays * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  // Unrecognized shape: do not guess.
  return null;
}

function normalizeNameKey(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeDoc(
  id: string,
  data: Record<string, unknown>
): NormalizedRow {
  const poNo = typeof data.poNo === "string" ? data.poNo : null;
  const poDateRaw = typeof data.poDate === "string" ? data.poDate : null;
  const deliveryDateRaw =
    typeof data.deliveryDate === "string" ? data.deliveryDate : null;
  const customerIdRaw =
    typeof data.customerId === "string" ? data.customerId : null;
  const customerName =
    typeof data.customerName === "string" ? data.customerName : null;
  const consignee = typeof data.consignee === "string" ? data.consignee : null;
  const artworkNo = typeof data.artworkNo === "string" ? data.artworkNo : null;
  const size = typeof data.size === "string" ? data.size : null;
  const productIdRaw =
    typeof data.productId === "string" ? data.productId : null;
  const productName =
    typeof data.productName === "string" ? data.productName : null;

  // rate: NUMERIC, nullable. A present-but-non-finite (NaN/Infinity) value
  // or an entirely missing field both become SQL NULL. Never defaulted to 0.
  const rawRate = data.rate;
  const rate =
    typeof rawRate === "number" && Number.isFinite(rawRate) ? rawRate : null;

  const orderQty = typeof data.orderQty === "number" ? data.orderQty : null;
  const inQty = typeof data.inQty === "number" ? data.inQty : null;
  const outQty = typeof data.outQty === "number" ? data.outQty : null;
  const status = typeof data.status === "string" ? data.status : null;
  const history = data.history !== undefined ? data.history : [];
  const isArchived =
    typeof data.isArchived === "boolean" ? data.isArchived : null;
  const importRunId =
    typeof data.importRunId === "string" ? data.importRunId : null;
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const updatedBy = typeof data.updatedBy === "string" ? data.updatedBy : null;

  return {
    firestore_document_id: id,
    po_no: poNo,
    po_date_raw: poDateRaw,
    po_date: parsePoDateToIsoDate(poDateRaw),
    delivery_date_raw: deliveryDateRaw,
    customer_id_raw: customerIdRaw,
    customer_name: customerName,
    resolved_customer_id: null, // populated only in --apply, see run()
    consignee,
    artwork_no: artworkNo,
    size,
    product_id_raw: productIdRaw,
    product_name: productName,
    resolved_product_id: null, // populated only in --apply, see run()
    rate,
    order_qty: orderQty,
    in_qty: inQty,
    out_qty: outQty,
    status,
    history,
    is_archived: isArchived,
    import_run_id: importRunId,
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
    "create_firestore_purchase_orders.sql"
  );
  return readFile(sqlPath, "utf8");
}

// Builds a normalized-name -> firestore_document_id map from an already
// migrated Postgres table. If a normalized name maps to more than one row,
// the entry is set to null (ambiguous) so it can never be guessed at.
async function loadNameResolutionMap(
  client: any,
  selectSql: string
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const result = await client.query(selectSql);
  for (const row of result.rows as Array<{
    firestore_document_id: string;
    name_value: string | null;
  }>) {
    if (!row.name_value) {
      continue;
    }
    const key = normalizeNameKey(row.name_value);
    if (map.has(key)) {
      map.set(key, null); // ambiguous match across multiple rows
    } else {
      map.set(key, row.firestore_document_id);
    }
  }
  return map;
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
        "and only runs in --apply); they are shown as null placeholders here."
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
    "firestore_document_id, po_no, po_date_raw, po_date, delivery_date_raw, " +
    "customer_id_raw, customer_name, resolved_customer_id, consignee, artwork_no, size, " +
    "product_id_raw, product_name, resolved_product_id, rate, order_qty, in_qty, out_qty, " +
    "status, history, is_archived, import_run_id, created_by, updated_by, " +
    "created_at, updated_at, raw_data, imported_at, synced_at" +
    ") values (" +
    "$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, " +
    "$19, $20::jsonb, $21, $22, $23, $24, $25, $26, $27::jsonb, now(), now()" +
    ") " +
    "on conflict (firestore_document_id) do update set " +
    "po_no = excluded.po_no, " +
    "po_date_raw = excluded.po_date_raw, " +
    "po_date = excluded.po_date, " +
    "delivery_date_raw = excluded.delivery_date_raw, " +
    "customer_id_raw = excluded.customer_id_raw, " +
    "customer_name = excluded.customer_name, " +
    "resolved_customer_id = excluded.resolved_customer_id, " +
    "consignee = excluded.consignee, " +
    "artwork_no = excluded.artwork_no, " +
    "size = excluded.size, " +
    "product_id_raw = excluded.product_id_raw, " +
    "product_name = excluded.product_name, " +
    "resolved_product_id = excluded.resolved_product_id, " +
    "rate = excluded.rate, " +
    "order_qty = excluded.order_qty, " +
    "in_qty = excluded.in_qty, " +
    "out_qty = excluded.out_qty, " +
    "status = excluded.status, " +
    "history = excluded.history, " +
    "is_archived = excluded.is_archived, " +
    "import_run_id = excluded.import_run_id, " +
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

    // Resolution maps are built from tables already migrated in prior,
    // approved steps (public.customers, public.products). Read-only
    // SELECTs; no writes to either table.
    const customerNameMap = await loadNameResolutionMap(
      client,
      "select firestore_document_id, name as name_value from public.customers"
    );
    const productItemNameMap = await loadNameResolutionMap(
      client,
      "select firestore_document_id, item_name as name_value from public.products"
    );

    for (const row of rows) {
      const resolvedCustomerId = row.customer_name
        ? customerNameMap.get(normalizeNameKey(row.customer_name)) ?? null
        : null;
      const resolvedProductId = row.product_name
        ? productItemNameMap.get(normalizeNameKey(row.product_name)) ?? null
        : null;

      await client.query(upsertSql, [
        row.firestore_document_id,
        row.po_no,
        row.po_date_raw,
        row.po_date,
        row.delivery_date_raw,
        row.customer_id_raw,
        row.customer_name,
        resolvedCustomerId,
        row.consignee,
        row.artwork_no,
        row.size,
        row.product_id_raw,
        row.product_name,
        resolvedProductId,
        row.rate,
        row.order_qty,
        row.in_qty,
        row.out_qty,
        row.status,
        JSON.stringify(row.history),
        row.is_archived,
        row.import_run_id,
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
