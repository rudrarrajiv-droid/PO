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
  test_field: string | null;
  timestamp_iso: string | null;
  timestamp_seconds: number | null;
  timestamp_nanoseconds: number | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = "job-card-cd56f";
const FIRESTORE_COLLECTION = "testCollection";
const TABLE_NAME = "public.firestore_testcollection";

const args = process.argv.slice(2);
const applyMode = args.includes("--apply");
const dryRunMode = args.includes("--dry-run") || !applyMode;

function getTimestampParts(value: unknown): {
  iso: string | null;
  seconds: number | null;
  nanoseconds: number | null;
} {
  if (!value || typeof value !== "object") {
    return { iso: null, seconds: null, nanoseconds: null };
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
    const dateValue = maybeAny.toDate();
    const seconds =
      typeof maybeAny.seconds === "number"
        ? maybeAny.seconds
        : typeof maybeAny._seconds === "number"
        ? maybeAny._seconds
        : Math.floor(dateValue.getTime() / 1000);

    const nanoseconds =
      typeof maybeAny.nanoseconds === "number"
        ? maybeAny.nanoseconds
        : typeof maybeAny._nanoseconds === "number"
        ? maybeAny._nanoseconds
        : 0;

    return {
      iso: dateValue.toISOString(),
      seconds,
      nanoseconds,
    };
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
      : null;

  let iso: string | null = null;
  if (typeof maybeAny.iso === "string") {
    iso = maybeAny.iso;
  } else if (seconds !== null) {
    const ms = seconds * 1000 + Math.floor((nanoseconds ?? 0) / 1000000);
    iso = new Date(ms).toISOString();
  }

  return { iso, seconds, nanoseconds };
}

function normalizeDoc(
  id: string,
  data: Record<string, unknown>
): NormalizedRow {
  const ts = getTimestampParts(data.timestamp);
  const testField =
    typeof data.testField === "string" ? data.testField : null;

  return {
    firestore_document_id: id,
    test_field: testField,
    timestamp_iso: ts.iso,
    timestamp_seconds: ts.seconds,
    timestamp_nanoseconds: ts.nanoseconds,
    raw_data: data,
  };
}

async function loadCreateTableSql(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const sqlPath = path.join(currentDir, "sql", "create_firestore_testcollection.sql");
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
    "firestore_document_id, test_field, timestamp_iso, timestamp_seconds, timestamp_nanoseconds, raw_data, imported_at, updated_at" +
    ") values ($1, $2, $3, $4, $5, $6::jsonb, now(), now()) " +
    "on conflict (firestore_document_id) do update set " +
    "test_field = excluded.test_field, " +
    "timestamp_iso = excluded.timestamp_iso, " +
    "timestamp_seconds = excluded.timestamp_seconds, " +
    "timestamp_nanoseconds = excluded.timestamp_nanoseconds, " +
    "raw_data = excluded.raw_data, " +
    "updated_at = now()";

  await client.connect();
  try {
    await client.query("begin");
    await client.query(createTableSql);

    for (const row of rows) {
      await client.query(upsertSql, [
        row.firestore_document_id,
        row.test_field,
        row.timestamp_iso,
        row.timestamp_seconds,
        row.timestamp_nanoseconds,
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
