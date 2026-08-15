import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

// NOTE: "entity" is a polymorphic pointer to many different collections
// (products, reels, finishGoods, jobCards, customers, employees, attendance,
// purchaseOrders, reelTransactions, finishGoodTransactions, dc_records, etc.),
// and "referenceId" is not always a real document ID (observed literal
// placeholder values include "BULK" and "BULK_OUT"). reference_id is
// therefore kept as plain TEXT with no foreign key of any kind.
// Firestore's reserved-ish "user" field is renamed to app_user to avoid
// colliding with the Postgres built-in "user" identifier.

type NormalizedRow = {
  firestore_document_id: string;
  app_user: string | null;
  action: string | null;
  entity: string | null;
  reference_id: string | null;
  count: number | null;
  details: string | null;
  logged_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "activityLogs";
const TABLE_NAME = "public.activity_logs";

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
  const appUser = typeof data.user === "string" ? data.user : null;
  const action = typeof data.action === "string" ? data.action : null;
  const entity = typeof data.entity === "string" ? data.entity : null;
  const referenceId = typeof data.referenceId === "string" ? data.referenceId : null;
  const count = typeof data.count === "number" ? data.count : null;
  const details = typeof data.details === "string" ? data.details : null;

  return {
    firestore_document_id: id,
    app_user: appUser,
    action,
    entity,
    reference_id: referenceId,
    count,
    details,
    logged_at_iso: getTimestampIso(data.timestamp),
    raw_data: data,
  };
}

async function loadCreateTableSql(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const sqlPath = path.join(currentDir, "sql", "create_firestore_activity_logs.sql");
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
    "firestore_document_id, app_user, action, entity, reference_id, count, details, logged_at, raw_data, imported_at, synced_at" +
    ") values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now(), now()) " +
    "on conflict (firestore_document_id) do update set " +
    "app_user = excluded.app_user, " +
    "action = excluded.action, " +
    "entity = excluded.entity, " +
    "reference_id = excluded.reference_id, " +
    "count = excluded.count, " +
    "details = excluded.details, " +
    "logged_at = excluded.logged_at, " +
    "raw_data = excluded.raw_data, " +
    "synced_at = now()";

  await client.connect();
  try {
    await client.query("begin");
    await client.query(createTableSql);

    for (const row of rows) {
      await client.query(upsertSql, [
        row.firestore_document_id,
        row.app_user,
        row.action,
        row.entity,
        row.reference_id,
        row.count,
        row.details,
        row.logged_at_iso,
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
