import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

// NOTE: "finishGoodTransactions" field presence varies significantly by
// type (IN/OUT) and category (REGULAR/REJECTED/DISPATCH/NON-MOVING):
// production-linked IN entries carry referenceId/referenceNo/rate; bulk
// OUT/DISPATCH entries carry a spread-in logistics payload (invoiceNo,
// place, transporterName, vehicleNo, vehicleSize, freight, holding, point,
// others) plus later-added receiving confirmation fields. Every column is
// therefore nullable. "date" is kept as TEXT (transaction_date) for
// consistency with the source's plain date strings.

type NormalizedRow = {
  firestore_document_id: string;
  finish_good_id: string | null;
  type: string | null;
  category: string | null;
  quantity: number | null;
  remaining_balance: number | null;
  rate: number | null;
  transaction_date: string | null;
  reference_id: string | null;
  reference_no: string | null;
  invoice_no: string | null;
  place: string | null;
  transporter_name: string | null;
  vehicle_no: string | null;
  vehicle_size: string | null;
  freight: number | null;
  holding: number | null;
  point: string | null;
  others: string | null;
  receiving_status: string | null;
  receiving_confirmed_at_iso: string | null;
  receiving_confirmed_by: string | null;
  performed_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at_iso: string | null;
  updated_at_iso: string | null;
  is_archived: boolean | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "finishGoodTransactions";
const TABLE_NAME = "public.finish_good_transactions";

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
  const finishGoodId = typeof data.finishGoodId === "string" ? data.finishGoodId : null;
  const type = typeof data.type === "string" ? data.type : null;
  const category = typeof data.category === "string" ? data.category : null;
  const quantity = typeof data.quantity === "number" ? data.quantity : null;
  const remainingBalance =
    typeof data.remainingBalance === "number" ? data.remainingBalance : null;
  const rate = typeof data.rate === "number" ? data.rate : null;
  const transactionDate = typeof data.date === "string" ? data.date : null;
  const referenceId = typeof data.referenceId === "string" ? data.referenceId : null;
  const referenceNo = typeof data.referenceNo === "string" ? data.referenceNo : null;
  const invoiceNo = typeof data.invoiceNo === "string" ? data.invoiceNo : null;
  const place = typeof data.place === "string" ? data.place : null;
  const transporterName =
    typeof data.transporterName === "string" ? data.transporterName : null;
  const vehicleNo = typeof data.vehicleNo === "string" ? data.vehicleNo : null;
  const vehicleSize = typeof data.vehicleSize === "string" ? data.vehicleSize : null;
  const freight = typeof data.freight === "number" ? data.freight : null;
  const holding = typeof data.holding === "number" ? data.holding : null;
  const point = typeof data.point === "string" ? data.point : null;
  const others = typeof data.others === "string" ? data.others : null;
  const receivingStatus =
    typeof data.receivingStatus === "string" ? data.receivingStatus : null;
  const receivingConfirmedBy =
    typeof data.receivingConfirmedBy === "string" ? data.receivingConfirmedBy : null;
  const performedBy = typeof data.performedBy === "string" ? data.performedBy : null;
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const updatedBy = typeof data.updatedBy === "string" ? data.updatedBy : null;
  const isArchived = typeof data.isArchived === "boolean" ? data.isArchived : null;

  return {
    firestore_document_id: id,
    finish_good_id: finishGoodId,
    type,
    category,
    quantity,
    remaining_balance: remainingBalance,
    rate,
    transaction_date: transactionDate,
    reference_id: referenceId,
    reference_no: referenceNo,
    invoice_no: invoiceNo,
    place,
    transporter_name: transporterName,
    vehicle_no: vehicleNo,
    vehicle_size: vehicleSize,
    freight,
    holding,
    point,
    others,
    receiving_status: receivingStatus,
    receiving_confirmed_at_iso: getTimestampIso(data.receivingConfirmedAt),
    receiving_confirmed_by: receivingConfirmedBy,
    performed_by: performedBy,
    created_by: createdBy,
    updated_by: updatedBy,
    created_at_iso: getTimestampIso(data.createdAt),
    updated_at_iso: getTimestampIso(data.updatedAt),
    is_archived: isArchived,
    raw_data: data,
  };
}

async function loadCreateTableSql(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const sqlPath = path.join(
    currentDir,
    "sql",
    "create_firestore_finish_good_transactions.sql"
  );
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
    "firestore_document_id, finish_good_id, type, category, quantity, remaining_balance, rate, transaction_date, reference_id, reference_no, invoice_no, place, transporter_name, vehicle_no, vehicle_size, freight, holding, point, others, receiving_status, receiving_confirmed_at, receiving_confirmed_by, performed_by, created_by, updated_by, created_at, updated_at, is_archived, raw_data, imported_at, synced_at" +
    ") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29::jsonb, now(), now()) " +
    "on conflict (firestore_document_id) do update set " +
    "finish_good_id = excluded.finish_good_id, " +
    "type = excluded.type, " +
    "category = excluded.category, " +
    "quantity = excluded.quantity, " +
    "remaining_balance = excluded.remaining_balance, " +
    "rate = excluded.rate, " +
    "transaction_date = excluded.transaction_date, " +
    "reference_id = excluded.reference_id, " +
    "reference_no = excluded.reference_no, " +
    "invoice_no = excluded.invoice_no, " +
    "place = excluded.place, " +
    "transporter_name = excluded.transporter_name, " +
    "vehicle_no = excluded.vehicle_no, " +
    "vehicle_size = excluded.vehicle_size, " +
    "freight = excluded.freight, " +
    "holding = excluded.holding, " +
    "point = excluded.point, " +
    "others = excluded.others, " +
    "receiving_status = excluded.receiving_status, " +
    "receiving_confirmed_at = excluded.receiving_confirmed_at, " +
    "receiving_confirmed_by = excluded.receiving_confirmed_by, " +
    "performed_by = excluded.performed_by, " +
    "created_by = excluded.created_by, " +
    "updated_by = excluded.updated_by, " +
    "created_at = excluded.created_at, " +
    "updated_at = excluded.updated_at, " +
    "is_archived = excluded.is_archived, " +
    "raw_data = excluded.raw_data, " +
    "synced_at = now()";

  await client.connect();
  try {
    await client.query("begin");
    await client.query(createTableSql);

    for (const row of rows) {
      await client.query(upsertSql, [
        row.firestore_document_id,
        row.finish_good_id,
        row.type,
        row.category,
        row.quantity,
        row.remaining_balance,
        row.rate,
        row.transaction_date,
        row.reference_id,
        row.reference_no,
        row.invoice_no,
        row.place,
        row.transporter_name,
        row.vehicle_no,
        row.vehicle_size,
        row.freight,
        row.holding,
        row.point,
        row.others,
        row.receiving_status,
        row.receiving_confirmed_at_iso,
        row.receiving_confirmed_by,
        row.performed_by,
        row.created_by,
        row.updated_by,
        row.created_at_iso,
        row.updated_at_iso,
        row.is_archived,
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
