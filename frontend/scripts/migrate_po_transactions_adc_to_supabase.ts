import 'dotenv/config';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type NormalizedRow = {
  firestore_document_id: string;
  po_id: string | null;
  type: string | null;
  quantity: number | null;
  transaction_date: string | null;
  remarks: string | null;
  reference_id: string | null;
  performed_by: string | null;
  created_at_iso: string | null;
  raw_data: Record<string, unknown>;
};

const FIREBASE_PROJECT_ID = 'job-card-cd56f';
const FIRESTORE_COLLECTION = 'poTransactions';
const TABLE_NAME = 'public.po_transactions';

const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const dryRunMode = args.includes('--dry-run') || !applyMode;

function getTimestampIso(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
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

  if (typeof maybeAny.toDate === 'function') {
    return maybeAny.toDate().toISOString();
  }

  const seconds =
    typeof maybeAny.seconds === 'number'
      ? maybeAny.seconds
      : typeof maybeAny._seconds === 'number'
        ? maybeAny._seconds
        : null;

  const nanoseconds =
    typeof maybeAny.nanoseconds === 'number'
      ? maybeAny.nanoseconds
      : typeof maybeAny._nanoseconds === 'number'
        ? maybeAny._nanoseconds
        : 0;

  if (typeof maybeAny.iso === 'string') {
    return maybeAny.iso;
  }

  if (seconds !== null) {
    return new Date(seconds * 1000 + Math.floor(nanoseconds / 1000000)).toISOString();
  }

  return null;
}

function normalizeDoc(id: string, data: Record<string, unknown>): NormalizedRow {
  return {
    firestore_document_id: id,
    po_id: typeof data.poId === 'string' ? data.poId : null,
    type: typeof data.type === 'string' ? data.type : null,
    quantity: typeof data.quantity === 'number' ? data.quantity : null,
    transaction_date: typeof data.date === 'string' ? data.date : null,
    remarks: typeof data.remarks === 'string' ? data.remarks : null,
    reference_id: typeof data.referenceId === 'string' ? data.referenceId : null,
    performed_by: typeof data.performedBy === 'string' ? data.performedBy : null,
    created_at_iso: getTimestampIso(data.createdAt),
    raw_data: data,
  };
}

async function loadCreateTableSql(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const sqlPath = path.join(currentDir, 'sql', 'create_firestore_po_transactions.sql');
  return readFile(sqlPath, 'utf8');
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL && applyMode) {
    throw new Error('DATABASE_URL is required when using --apply');
  }

  const app = initializeApp({
    projectId: FIREBASE_PROJECT_ID,
    credential: applicationDefault(),
  });

  const db = getFirestore(app);
  console.log('Reading only Firestore collection: ' + FIRESTORE_COLLECTION);
  const snapshot = await db.collection(FIRESTORE_COLLECTION).get();

  const rows = snapshot.docs.map((doc) => normalizeDoc(doc.id, doc.data() as Record<string, unknown>));
  console.log('Fetched documents: ' + rows.length.toString());

  const invalidRows = rows.filter((row) => {
    return !row.po_id || !row.type || row.quantity === null || !row.transaction_date || !row.performed_by;
  });

  if (invalidRows.length > 0) {
    throw new Error(
      'Found poTransactions documents missing required fields: ' +
      invalidRows.map((row) => row.firestore_document_id).join(', ')
    );
  }

  if (dryRunMode) {
    console.log('Dry run mode enabled. No PostgreSQL writes performed.');
    if (rows.length > 0) {
      console.log('Sample normalized row:');
      console.log(JSON.stringify(rows[0], null, 2));
    }
    return;
  }

  const pgModule = await import('pg');
  const { Client } = pgModule.default ?? pgModule;
  const connectionString = (process.env.DATABASE_URL || '')
    .replace('?sslmode=require&uselibpqcompat=true', '')
    .replace('?sslmode=require', '')
    .replace('&uselibpqcompat=true', '');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const createTableSql = await loadCreateTableSql();
  const upsertSql =
    'insert into ' +
    TABLE_NAME +
    ' (' +
    'firestore_document_id, po_id, type, quantity, transaction_date, remarks, reference_id, performed_by, created_at, raw_data, imported_at, synced_at' +
    ') values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now(), now()) ' +
    'on conflict (firestore_document_id) do update set ' +
    'po_id = excluded.po_id, ' +
    'type = excluded.type, ' +
    'quantity = excluded.quantity, ' +
    'transaction_date = excluded.transaction_date, ' +
    'remarks = excluded.remarks, ' +
    'reference_id = excluded.reference_id, ' +
    'performed_by = excluded.performed_by, ' +
    'created_at = excluded.created_at, ' +
    'raw_data = excluded.raw_data, ' +
    'synced_at = now()';

  await client.connect();
  try {
    await client.query('begin');
    await client.query(createTableSql);

    for (const row of rows) {
      await client.query(upsertSql, [
        row.firestore_document_id,
        row.po_id,
        row.type,
        row.quantity,
        row.transaction_date,
        row.remarks,
        row.reference_id,
        row.performed_by,
        row.created_at_iso,
        JSON.stringify(row.raw_data),
      ]);
    }

    await client.query('commit');
    console.log('Upsert complete for collection: ' + FIRESTORE_COLLECTION);
    console.log('Rows written: ' + rows.length.toString());
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});