import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
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

async function run() {
  const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
  const sheet = workbook.Sheets['DFG'];
  
  const sourceData = [];

  for (let r = 4; r <= 44; r++) {
    const product = sheet['A' + r] ? sheet['A' + r].v : '';
    const closingBalance = sheet['E' + r] ? sheet['E' + r].v : '';
    const rate = sheet['F' + r] ? sheet['F' + r].v : '';
    
    const p = String(product).trim();
    const q = Number(closingBalance);
    const rat = Number(rate);
    
    if (p && p !== 'undefined') {
      sourceData.push({
        productName: p,
        openingQty: q,
        rate: rat,
      });
    }
  }

  const fgCol = collection(db, 'finishGoods');
  const fgSnap = await getDocs(fgCol);
  const existingRecords = fgSnap.docs.map(d => d.data());
  
  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  let count = 0;
  let skipped = 0;

  for (const item of sourceData) {
    const exists = existingRecords.some(r => r.productName === item.productName);
    if (!exists) {
      const newDocRef = doc(fgCol);
      batch.set(newDocRef, {
        productId: newDocRef.id,
        productName: item.productName,
        customerId: '',
        customerName: '',
        openingQty: item.openingQty,
        inQty: 0,
        outQty: 0,
        closingBalance: 0,
        nonMovingBalance: item.openingQty,
        rate: item.rate,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'MigrationScript',
        updatedBy: 'MigrationScript',
        isArchived: false
      });
      count++;
    } else {
      skipped++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully imported ${count} NON-MOVING records into finishGoods. Skipped ${skipped} existing records.`);
  } else {
    console.log(`No records imported. Skipped ${skipped} existing records.`);
  }
  
  const finalSnap = await getDocs(fgCol);
  console.log(`Total finishGoods in Firestore now: ${finalSnap.size}`);
  
  process.exit(0);
}

run().catch(console.error);
