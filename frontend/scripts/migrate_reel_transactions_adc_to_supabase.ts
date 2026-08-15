import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

// NOTE: "reelTransactions" contains two historical document shapes:
//   Legacy/import shape: reelId, type, quantity, date (plain "YYYY-MM-DD"),
//     notes, isArchived, createdAt only (no reelNumber/remainingBalance/
//     performedBy/jobCardId/updatedAt/updatedBy/createdBy).
//   Live-app shape: reelId, reelNumber, type (INWARD/OUTWARD/ALLOCATION),
//     quantity, remainingBalance, jobCardId, performedBy, date (full ISO
//     timestamp string), createdAt/updatedAt, createdBy/updatedBy, isArchived.
// "date" uses two incompatible string formats across the collection, so
// transaction_date is kept as TEXT (not date/timestamptz) to avoid parse
// failures. All fields are nullable to cover both shapes.

type NormalizedRow = {
  firestore_document_id: string;
  reel_id: string | null;
  reel_number: string | null;
  type: string | null;
  quantity: number | null;
  remaining_balance: number | null;
  job_card_id: string | null;
  performed_by: string | null;
  notes: string | null;
  transaction_date: string | null;
  is_archived: boolean | null;
  created_by: string | null;
  updated_by: string | null;
  created_at_iso: string | null;
  updated_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "reelTransactions";
const TABLE_NAME = "public.reel_transactions";

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
  const reelId = typeof data.reelId === "string" ? data.reelId : null;
  const reelNumber = typeof data.reelNumber === "string" ? data.reelNumber : null;
  const type = typeof data.type === "string" ? data.type : null;
  const quantity = typeof data.quantity === "number" ? data.quantity : null;
  const remainingBalance =
    typeof data.remainingBalance === "number" ? data.remainingBalance : null;
  const jobCardId = typeof data.jobCardId === "string" ? data.jobCardId : null;
  const performedBy = typeof data.performedBy === "string" ? data.performedBy : null;
  const notes = typeof data.notes === "string" ? data.notes : null;
  // transaction_date: kept as the raw string exactly as stored (two
  // incompatible formats exist in the source collection).
  const transactionDate = typeof data.date === "string" ? data.date : null;
  const isArchived = typeof data.isArchived === "boolean" ? data.isArchived : null;
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const updatedBy = typeof data.updatedBy === "string" ? data.updatedBy : null;

  return {
    firestore_document_id: id,
    reel_id: reelId,
    reel_number: reelNumber,
    type,
    quantity,
    remaining_balance: remainingBalance,
    job_card_id: jobCardId,
    performed_by: performedBy,
    notes,
    transaction_date: transactionDate,
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
  const sqlPath = path.join(currentDir, "sql", "create_firestore_reel_transactions.sql");
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
    "firestore_document_id, reel_id, reel_number, type, quantity, remaining_balance, job_card_id, performed_by, notes, transaction_date, is_archived, created_by, updated_by, created_at, updated_at, raw_data, imported_at, synced_at" +
    ") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, now(), now()) " +
    "on conflict (firestore_document_id) do update set " +
    "reel_id = excluded.reel_id, " +
    "reel_number = excluded.reel_number, " +
    "type = excluded.type, " +
    "quantity = excluded.quantity, " +
    "remaining_balance = excluded.remaining_balance, " +
    "job_card_id = excluded.job_card_id, " +
    "performed_by = excluded.performed_by, " +
    "notes = excluded.notes, " +
    "transaction_date = excluded.transaction_date, " +
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
        row.reel_id,
        row.reel_number,
        row.type,
        row.quantity,
        row.remaining_balance,
        row.job_card_id,
        row.performed_by,
        row.notes,
        row.transaction_date,
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
