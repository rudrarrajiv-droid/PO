import "dotenv/config";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
// "pg" is intentionally NOT statically imported here so that --dry-run
// can run without the package installed. It is dynamically imported
// further below, only inside the --apply code path.

type NormalizedRow = {
  firestore_document_id: string;
  customer_id: string | null;
  customer_name: string | null;
  item_name: string | null;
  artwork_no: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  color: string | null;
  reel_size: number | null;
  cut_size: number | null;
  ply: number | null;
  flute: string | null;
  pin_pasting: string | null;
  pin_type: string | null;
  pin_qty: number | null;
  creasing: string | null;
  ups: number | null;
  packing: string | null;
  special_requirement: string | null;
  layers: unknown[] | null;
  is_archived: boolean | null;
  created_by: string | null;
  updated_by: string | null;
  created_at_iso: string | null;
  updated_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "products";
const TABLE_NAME = "public.products";

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
  const customerId = typeof data.customerId === "string" ? data.customerId : null;
  const customerName = typeof data.customerName === "string" ? data.customerName : null;
  const itemName = typeof data.itemName === "string" ? data.itemName : null;
  const artworkNo = typeof data.artworkNo === "string" ? data.artworkNo : null;
  const length = typeof data.length === "number" ? data.length : null;
  const width = typeof data.width === "number" ? data.width : null;
  const height = typeof data.height === "number" ? data.height : null;
  const color = typeof data.color === "string" ? data.color : null;
  const reelSize = typeof data.reelSize === "number" ? data.reelSize : null;
  const cutSize = typeof data.cutSize === "number" ? data.cutSize : null;
  const ply = typeof data.ply === "number" ? data.ply : null;
  const flute = typeof data.flute === "string" ? data.flute : null;
  const pinPasting = typeof data.pinPasting === "string" ? data.pinPasting : null;
  const pinType = typeof data.pinType === "string" ? data.pinType : null;
  const pinQty = typeof data.pinQty === "number" ? data.pinQty : null;
  const creasing = typeof data.creasing === "string" ? data.creasing : null;
  const ups = typeof data.ups === "number" ? data.ups : null;
  const packing = typeof data.packing === "string" ? data.packing : null;
  const specialRequirement =
    typeof data.specialRequirement === "string" ? data.specialRequirement : null;
  const layers = Array.isArray(data.layers) ? (data.layers as unknown[]) : null;
  const isArchived = typeof data.isArchived === "boolean" ? data.isArchived : null;
  const createdBy = typeof data.createdBy === "string" ? data.createdBy : null;
  const updatedBy = typeof data.updatedBy === "string" ? data.updatedBy : null;

  return {
    firestore_document_id: id,
    customer_id: customerId,
    customer_name: customerName,
    item_name: itemName,
    artwork_no: artworkNo,
    length,
    width,
    height,
    color,
    reel_size: reelSize,
    cut_size: cutSize,
    ply,
    flute,
    pin_pasting: pinPasting,
    pin_type: pinType,
    pin_qty: pinQty,
    creasing,
    ups,
    packing,
    special_requirement: specialRequirement,
    layers,
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
  const sqlPath = path.join(currentDir, "sql", "create_firestore_products.sql");
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
    "firestore_document_id, customer_id, customer_name, item_name, artwork_no, length, width, height, color, reel_size, cut_size, ply, flute, pin_pasting, pin_type, pin_qty, creasing, ups, packing, special_requirement, layers, is_archived, created_by, updated_by, created_at, updated_at, raw_data, imported_at, synced_at" +
    ") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21::jsonb, $22, $23, $24, $25, $26, $27::jsonb, now(), now()) " +
    "on conflict (firestore_document_id) do update set " +
    "customer_id = excluded.customer_id, " +
    "customer_name = excluded.customer_name, " +
    "item_name = excluded.item_name, " +
    "artwork_no = excluded.artwork_no, " +
    "length = excluded.length, " +
    "width = excluded.width, " +
    "height = excluded.height, " +
    "color = excluded.color, " +
    "reel_size = excluded.reel_size, " +
    "cut_size = excluded.cut_size, " +
    "ply = excluded.ply, " +
    "flute = excluded.flute, " +
    "pin_pasting = excluded.pin_pasting, " +
    "pin_type = excluded.pin_type, " +
    "pin_qty = excluded.pin_qty, " +
    "creasing = excluded.creasing, " +
    "ups = excluded.ups, " +
    "packing = excluded.packing, " +
    "special_requirement = excluded.special_requirement, " +
    "layers = excluded.layers, " +
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
        row.customer_id,
        row.customer_name,
        row.item_name,
        row.artwork_no,
        row.length,
        row.width,
        row.height,
        row.color,
        row.reel_size,
        row.cut_size,
        row.ply,
        row.flute,
        row.pin_pasting,
        row.pin_type,
        row.pin_qty,
        row.creasing,
        row.ups,
        row.packing,
        row.special_requirement,
        row.layers !== null ? JSON.stringify(row.layers) : null,
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
