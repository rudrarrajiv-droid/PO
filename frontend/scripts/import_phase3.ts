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
  const sheet = workbook.Sheets['FG Stock'];
  
  const sourceData = [];

  for (let r = 5; r <= 43; r++) {
    const customer = sheet['A' + r] ? sheet['A' + r].v : '';
    const product = sheet['B' + r] ? sheet['B' + r].v : '';
    const openingQty = sheet['F' + r] ? sheet['F' + r].v : '';
    const rate = sheet['G' + r] ? sheet['G' + r].v : '';
    
    const c = String(customer).trim();
    const p = String(product).trim();
    const q = Number(openingQty);
    const rat = Number(rate);
    
    if (c && p && c !== 'undefined' && p !== 'undefined') {
      sourceData.push({
        customerName: c,
        customerId: c.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        productName: p,
        openingQty: q,
        rate: rat,
      });
    }
  }

  // Double check existing
  const fgCol = collection(db, 'finishGoods');
  const fgSnap = await getDocs(fgCol);
  const existingRecords = fgSnap.docs.map(d => d.data());
  
  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  let count = 0;

  for (const item of sourceData) {
    const exists = existingRecords.some(r => r.customerName === item.customerName && r.productName === item.productName);
    if (!exists) {
      const newDocRef = doc(fgCol);
      batch.set(newDocRef, {
        productId: newDocRef.id,
        productName: item.productName,
        customerId: item.customerId,
        customerName: item.customerName,
        openingQty: item.openingQty,
        inQty: 0,
        outQty: 0,
        closingBalance: item.openingQty,
        nonMovingBalance: 0,
        rate: item.rate,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'MigrationScript',
        updatedBy: 'MigrationScript',
        isArchived: false
      });
      count++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully imported ${count} records into finishGoods.`);
  } else {
    console.log(`No records needed to be imported (maybe they already exist?).`);
  }
  
  // Verify final count
  const finalSnap = await getDocs(fgCol);
  console.log(`Total finishGoods in Firestore now: ${finalSnap.size}`);
  
  // Output a few random records for verification
  const importedSamples = finalSnap.docs.slice(0, 3).map(d => d.data());
  console.log('Sample records in Firestore:');
  console.log(JSON.stringify(importedSamples, null, 2));

  process.exit(0);
}

run().catch(console.error);
