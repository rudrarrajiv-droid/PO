import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

// NOTE: Some legacy "finishGoods" documents (createdBy/updatedBy ===
// "MigrationScript") carry a productId that does NOT correspond to any
// document in the "products" collection (slug-style legacy IDs such as
// "7-bazaari-bark-10"). There is no foreign key on product_id, and every
// finishGoods document is migrated as-is regardless of whether its
// productId currently resolves to a real product. Nothing is filtered
// or dropped.

type NormalizedRow = {
  firestore_document_id: string;
  product_id: string | null;
  product_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  opening_qty: number | null;
  in_qty: number | null;
  out_qty: number | null;
  closing_balance: number | null;
  non_moving_balance: number | null;
  rate: number | null;
  is_archived: boolean | null;
  created_by: string | null;
  updated_by: string | null;
  created_at_iso: string | null;
  updated_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "finishGoods";
const TABLE_NAME = "public.finish_goods";

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

function normalizeDoc(
  id: string,
  data: Record<string, unknown>
): NormalizedRow {
  const productId = typeof data.productId === "string" ? data.productId : null;
  const productName = typeof data.productName === "string" ? data.productName : null;
  const customerId = typeof data.customerId === "string" ? data.customerId : null;
  const customerName = typeof data.customerName === "string" ? data.customerName : null;
  const openingQty = typeof data.openingQty === "number" ? data.openingQty : null;
  const inQty = typeof data.inQty === "number" ? data.inQty : null;
  const outQty = typeof data.outQty === "number" ? data.outQty : null;
  const closingBalance =
    typeof data.closingBalance === "number" ? data.closingBalance : null;
  const nonMovingBalance =
    typeof data.nonMovingBalance === "number" ? data.nonMovingBalance : null;
  const rate = typeof data.rate === "number" ? data.rate : null;
  const isArchived = typeof data.isArchived === "boolean" ? data.isArchived : null;
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const updatedBy = typeof data.updatedBy === "string" ? data.updatedBy : null;

  return {
    firestore_document_id: id,
    product_id: productId,
    product_name: productName,
    customer_id: customerId,
    customer_name: customerName,
    opening_qty: openingQty,
    in_qty: inQty,
    out_qty: outQty,
    closing_balance: closingBalance,
    non_moving_balance: nonMovingBalance,
    rate,
    is_archived: isArchived,
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
  const sqlPath = path.join(currentDir, "sql", "create_firestore_finish_goods.sql");
  return readFile(sqlPath, "utf8");
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL && applyMode) {
    throw new Error("DATABASE_URL is required when using --apply");
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GCLOUD_PROJECT && !process.env.GOOGLE_CLOUD_PROJECT) {
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
    "firestore_document_id, product_id, product_name, customer_id, customer_name, opening_qty, in_qty, out_qty, closing_balance, non_moving_balance, rate, is_archived, created_by, updated_by, created_at, updated_at, raw_data, imported_at, synced_at" +
    ") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, now(), now()) " +
    "on conflict (firestore_document_id) do update set " +
    "product_id = excluded.product_id, " +
    "product_name = excluded.product_name, " +
    "customer_id = excluded.customer_id, " +
    "customer_name = excluded.customer_name, " +
    "opening_qty = excluded.opening_qty, " +
    "in_qty = excluded.in_qty, " +
    "out_qty = excluded.out_qty, " +
    "closing_balance = excluded.closing_balance, " +
    "non_moving_balance = excluded.non_moving_balance, " +
    "rate = excluded.rate, " +
    "is_archived = excluded.is_archived, " +
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

    for (const row of rows) {
      await client.query(upsertSql, [
        row.firestore_document_id,
        row.product_id,
        row.product_name,
        row.customer_id,
        row.customer_name,
        row.opening_qty,
        row.in_qty,
        row.out_qty,
        row.closing_balance,
        row.non_moving_balance,
        row.rate,
        row.is_archived,
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
