import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

// NOTE: The "reels" collection contains two historical document shapes:
//   Shape A (legacy, batch-imported reels): reelNumber, paperType, reelSize, bf,
//     gsm, weight, consumedWeight, currentBalance, rate, supplier, status,
//     isArchived, createdAt, updatedAt.
//   Shape B (newer, manually-created inward reels): reelNumber, supplierName,
//     manufacturerName, weight, currentBalance, paperType, reelSize, bf, gsm,
//     rate, inwardDate, createdBy, updatedBy, isArchived, createdAt,
//     activeReservedWeight, updatedAt, reservedForJC.
// All fields from both shapes are normalized here as nullable columns so that
// documents of either shape (or a mix) migrate cleanly without data loss.

type NormalizedRow = {
  firestore_document_id: string;
  reel_number: string | null;
  paper_type: string | null;
  reel_size: number | null;
  bf: string | null;
  gsm: number | null;
  weight: number | null;
  consumed_weight: number | null;
  current_balance: number | null;
  rate: number | null;
  supplier: string | null;
  supplier_name: string | null;
  manufacturer_name: string | null;
  status: string | null;
  inward_date_iso: string | null;
  reserved_for_jc: string | null;
  active_reserved_weight: number | null;
  is_archived: boolean | null;
  created_by: string | null;
  updated_by: string | null;
  created_at_iso: string | null;
  updated_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "reels";
const TABLE_NAME = "public.reels";

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
  const reelNumber = typeof data.reelNumber === "string" ? data.reelNumber : null;
  const paperType = typeof data.paperType === "string" ? data.paperType : null;
  const reelSize = typeof data.reelSize === "number" ? data.reelSize : null;
  // bf must remain TEXT: values are stored as strings in Firestore (e.g. "18").
  const bf = typeof data.bf === "string" ? data.bf : null;
  const gsm = typeof data.gsm === "number" ? data.gsm : null;
  const weight = typeof data.weight === "number" ? data.weight : null;
  const consumedWeight =
    typeof data.consumedWeight === "number" ? data.consumedWeight : null;
  const currentBalance =
    typeof data.currentBalance === "number" ? data.currentBalance : null;
  const rate = typeof data.rate === "number" ? data.rate : null;
  const supplier = typeof data.supplier === "string" ? data.supplier : null;
  const supplierName =
    typeof data.supplierName === "string" ? data.supplierName : null;
  const manufacturerName =
    typeof data.manufacturerName === "string" ? data.manufacturerName : null;
  const status = typeof data.status === "string" ? data.status : null;
  // inwardDate is stored as a plain ISO date string (not a Firestore Timestamp).
  const inwardDateIso =
    typeof data.inwardDate === "string" ? data.inwardDate : null;
  const reservedForJc =
    typeof data.reservedForJC === "string" ? data.reservedForJC : null;
  const activeReservedWeight =
    typeof data.activeReservedWeight === "number" ? data.activeReservedWeight : null;
  const isArchived = typeof data.isArchived === "boolean" ? data.isArchived : null;
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const updatedBy = typeof data.updatedBy === "string" ? data.updatedBy : null;

  return {
    firestore_document_id: id,
    reel_number: reelNumber,
    paper_type: paperType,
    reel_size: reelSize,
    bf,
    gsm,
    weight,
    consumed_weight: consumedWeight,
    current_balance: currentBalance,
    rate,
    supplier,
    supplier_name: supplierName,
    manufacturer_name: manufacturerName,
    status,
    inward_date_iso: inwardDateIso,
    reserved_for_jc: reservedForJc,
    active_reserved_weight: activeReservedWeight,
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
  const sqlPath = path.join(currentDir, "sql", "create_firestore_reels.sql");
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
  const sanitizedDatabaseUrl = process.env.DATABASE_URL
    ?.replace(/[?&]sslmode=require/g, "")
    ?.replace(/[?&]uselibpqcompat=true/g, "")
    ?.replace(/\?&/, "?")
    ?.replace(/[?&]$/, "");
  const client = new Client({
    connectionString: sanitizedDatabaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  const createTableSql = await loadCreateTableSql();

  const upsertSql =
    "insert into " +
    TABLE_NAME +
    " (" +
    "firestore_document_id, reel_number, paper_type, reel_size, bf, gsm, weight, consumed_weight, current_balance, rate, supplier, supplier_name, manufacturer_name, status, inward_date, reserved_for_jc, active_reserved_weight, is_archived, created_by, updated_by, created_at, updated_at, raw_data, imported_at, synced_at" +
    ") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb, now(), now()) " +
    "on conflict (firestore_document_id) do update set " +
    "reel_number = excluded.reel_number, " +
    "paper_type = excluded.paper_type, " +
    "reel_size = excluded.reel_size, " +
    "bf = excluded.bf, " +
    "gsm = excluded.gsm, " +
    "weight = excluded.weight, " +
    "consumed_weight = excluded.consumed_weight, " +
    "current_balance = excluded.current_balance, " +
    "rate = excluded.rate, " +
    "supplier = excluded.supplier, " +
    "supplier_name = excluded.supplier_name, " +
    "manufacturer_name = excluded.manufacturer_name, " +
    "status = excluded.status, " +
    "inward_date = excluded.inward_date, " +
    "reserved_for_jc = excluded.reserved_for_jc, " +
    "active_reserved_weight = excluded.active_reserved_weight, " +
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
        row.reel_number,
        row.paper_type,
        row.reel_size,
        row.bf,
        row.gsm,
        row.weight,
        row.consumed_weight,
        row.current_balance,
        row.rate,
        row.supplier,
        row.supplier_name,
        row.manufacturer_name,
        row.status,
        row.inward_date_iso,
        row.reserved_for_jc,
        row.active_reserved_weight,
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
