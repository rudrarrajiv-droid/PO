import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import {
  DocumentReference,
  GeoPoint,
  Timestamp,
  getFirestore,
} from 'firebase-admin/firestore';

const PROJECT_ID = 'job-card-cd56f';

function toSafeTimestampString(date) {
  // Keep filenames portable across OSes.
  return date.toISOString().replace(/[:.]/g, '-');
}

function encodeBytes(value) {
  // firebase-admin versions differ in whether `Bytes` is directly exported.
  // Use capability checks instead of relying on `instanceof Bytes`.
  if (value && typeof value === 'object') {
    if (typeof value.toBase64 === 'function') {
      return value.toBase64();
    }
    if (typeof value.toUint8Array === 'function') {
      return Buffer.from(value.toUint8Array()).toString('base64');
    }
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString('base64');
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(value)).toString('base64');
  }

  return null;
}

function serializeFirestoreValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Timestamp) {
    return {
      __type: 'Timestamp',
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      iso: value.toDate().toISOString(),
    };
  }

  if (value instanceof GeoPoint) {
    return {
      __type: 'GeoPoint',
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (value instanceof DocumentReference) {
    return {
      __type: 'DocumentReference',
      path: value.path,
      id: value.id,
      parentPath: value.parent?.path ?? null,
    };
  }

  const asBase64 = encodeBytes(value);
  if (asBase64 !== null) {
    return {
      __type: 'Bytes',
      base64: asBase64,
    };
  }

  if (value instanceof Date) {
    return {
      __type: 'Date',
      iso: value.toISOString(),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeFirestoreValue(item));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      out[key] = serializeFirestoreValue(nestedValue);
    }
    return out;
  }

  return value;
}

async function main() {
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });

  const db = getFirestore(app);

  // Discover all top-level collections dynamically.
  const collections = await db.listCollections();
  const sortedCollections = collections
    .map((collectionRef) => collectionRef.id)
    .sort((a, b) => a.localeCompare(b));

  const exportPayload = {
    meta: {
      projectId: PROJECT_ID,
      exportedAt: new Date().toISOString(),
      collectionCount: sortedCollections.length,
    },
    collections: {},
    counts: {
      perCollection: {},
      totalDocuments: 0,
    },
  };

  for (const collectionName of sortedCollections) {
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();

    const docs = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      data: serializeFirestoreValue(docSnap.data()),
    }));

    exportPayload.collections[collectionName] = docs;
    exportPayload.counts.perCollection[collectionName] = docs.length;
    exportPayload.counts.totalDocuments += docs.length;
  }

  const timestamp = toSafeTimestampString(new Date());
  const backupDir = path.resolve(process.cwd(), 'firestore-backup');
  const backupFile = path.resolve(
    backupDir,
    `firestore-backup-${timestamp}.json`,
  );

  await mkdir(backupDir, { recursive: true });
  await writeFile(backupFile, JSON.stringify(exportPayload, null, 2), 'utf8');

  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Collections discovered: ${sortedCollections.length}`);
  console.log('Document count by collection:');
  for (const collectionName of sortedCollections) {
    console.log(`- ${collectionName}: ${exportPayload.counts.perCollection[collectionName]}`);
  }
  console.log(`Total documents: ${exportPayload.counts.totalDocuments}`);
  console.log(`Backup file: ${backupFile}`);
}

main().catch((error) => {
  console.error('Firestore read-only backup failed:', error);
  process.exitCode = 1;
});
