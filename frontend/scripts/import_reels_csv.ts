import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
import * as dotenv from 'dotenv';
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function importReels() {
  console.log('Starting reel import...');
  const csvContent = fs.readFileSync('d:/po/Storage_file/reel_data.csv', 'utf-8');
  
  // Clean BOM if present
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const records = parse(cleanContent, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Parsed ${records.length} records. Deleting old data...`);

  // Delete all reels
  const reelsSnap = await getDocs(collection(db, 'reels'));
  let dBatch = writeBatch(db);
  let count = 0;
  for (const document of reelsSnap.docs) {
    dBatch.delete(document.ref);
    count++;
    if (count % 400 === 0) {
      await dBatch.commit();
      dBatch = writeBatch(db);
    }
  }
  await dBatch.commit();
  console.log(`Deleted ${reelsSnap.size} old reels.`);

  // Delete all reelTransactions
  const txSnap = await getDocs(collection(db, 'reelTransactions'));
  dBatch = writeBatch(db);
  count = 0;
  for (const document of txSnap.docs) {
    dBatch.delete(document.ref);
    count++;
    if (count % 400 === 0) {
      await dBatch.commit();
      dBatch = writeBatch(db);
    }
  }
  await dBatch.commit();
  console.log(`Deleted ${txSnap.size} old transactions.`);

  console.log('Inserting new data...');
  let wBatch = writeBatch(db);
  let opCount = 0;

  async function commitBatch() {
    if (opCount > 0) {
      await wBatch.commit();
      wBatch = writeBatch(db);
      opCount = 0;
    }
  }

  for (const row of records) {
    const reelNo = row['Reel No'] || '';
    if (!reelNo) continue;

    const openingWeight = Number(row['Opening Weight']) || 0;
    
    // Sum INs and OUTs
    let sumIn = 0;
    let sumOut = 0;
    const dateTxs: { dateStr: string, type: string, qty: number }[] = [];

    for (let i = 1; i <= 9; i++) {
      const dayStr = i.toString().padStart(2, '0');
      const inVal = Number(row[`${dayStr}-IN`]) || 0;
      const outVal = Number(row[`${dayStr}-OUT`]) || 0;

      if (inVal > 0) {
        sumIn += inVal;
        dateTxs.push({ dateStr: `2026-08-${dayStr}`, type: 'INWARD', qty: inVal });
      }
      if (outVal > 0) {
        sumOut += outVal;
        dateTxs.push({ dateStr: `2026-08-${dayStr}`, type: 'OUTWARD', qty: outVal });
      }
    }

    const initialWeight = openingWeight + sumIn;
    const consumedWeight = sumOut;
    const currentBalance = initialWeight - consumedWeight;

    const reelRef = doc(collection(db, 'reels'));
    const reelData = {
      reelNumber: reelNo.toString(),
      paperType: (row['Paper Type'] || '').toUpperCase(),
      reelSize: Number(row['Size']) || 0,
      bf: row['BF'] || '',
      gsm: Number(row['GSM']) || 0,
      weight: initialWeight,
      consumedWeight: consumedWeight,
      currentBalance: currentBalance,
      rate: Number(row['Rate']) || 0,
      supplier: '',
      status: currentBalance > 0 ? 'ACTIVE' : 'EMPTY',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isArchived: false
    };

    wBatch.set(reelRef, reelData);
    opCount++;
    if (opCount >= 400) await commitBatch();

    // Transactions
    if (openingWeight > 0) {
      const txRef = doc(collection(db, 'reelTransactions'));
      wBatch.set(txRef, {
        reelId: reelRef.id,
        type: 'INWARD',
        quantity: openingWeight,
        date: '2026-07-31',
        createdAt: serverTimestamp(),
        notes: 'Opening Balance',
        isArchived: false
      });
      opCount++;
      if (opCount >= 400) await commitBatch();
    }

    for (const tx of dateTxs) {
      const txRef = doc(collection(db, 'reelTransactions'));
      wBatch.set(txRef, {
        reelId: reelRef.id,
        type: tx.type,
        quantity: tx.qty,
        date: tx.dateStr,
        createdAt: serverTimestamp(),
        notes: 'Imported from CSV',
        isArchived: false
      });
      opCount++;
      if (opCount >= 400) await commitBatch();
    }
  }

  await commitBatch();
  console.log('Import completed successfully!');
}

importReels().catch(console.error);
