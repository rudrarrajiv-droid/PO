import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc, serverTimestamp, query, where, deleteDoc } from 'firebase/firestore';
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

// generate safe document ID
function generateId(str) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function run() {
  const fgCol = collection(db, 'finishGoods');

  // Cleanup old migration records to be safe
  const q = query(fgCol, where('createdBy', '==', 'MigrationScript'));
  const snap = await getDocs(q);
  let deleted = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'finishGoods', d.id));
    deleted++;
  }
  console.log(`Deleted ${deleted} old FG migration records.`);

  const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
  
  const records = new Map(); // key -> document data

  // 1. Read FG Stock (Rows 5-43) - REGULAR
  const fgSheet = workbook.Sheets['FG Stock'];
  for (let r = 5; r <= 43; r++) {
    const customerName = fgSheet['A' + r] ? String(fgSheet['A' + r].v).trim() : '';
    const productName = fgSheet['B' + r] ? String(fgSheet['B' + r].v).trim() : '';
    const qtyRaw = fgSheet['F' + r] ? fgSheet['F' + r].v : '';
    const rateRaw = fgSheet['G' + r] ? fgSheet['G' + r].v : '';
    const qty = Number(qtyRaw) || 0;
    const rate = Number(rateRaw) || 0;
    
    if (qty > 0 && customerName && productName && customerName.toUpperCase() !== 'UNDEFINED') {
      const id = generateId(`${customerName}-${productName}`);
      if (!records.has(id)) {
        records.set(id, {
          productId: id,
          productName,
          customerName,
          customerId: generateId(customerName),
          openingQty: qty,
          inQty: 0,
          outQty: 0,
          closingBalance: qty,
          nonMovingBalance: 0,
          rate: rate
        });
      } else {
        const existing = records.get(id);
        existing.openingQty += qty;
        existing.closingBalance += qty;
      }
    }
  }

  // 2. Read DFG (Rows 4-44) - NON-MOVING
  const dfgSheet = workbook.Sheets['DFG'];
  for (let r = 4; r <= 44; r++) {
    const productName = dfgSheet['A' + r] ? String(dfgSheet['A' + r].v).trim() : '';
    const qtyRaw = dfgSheet['E' + r] ? dfgSheet['E' + r].v : '';
    const rateRaw = dfgSheet['F' + r] ? dfgSheet['F' + r].v : '';
    const qty = Number(qtyRaw) || 0;
    const rate = Number(rateRaw) || 0;
    
    if (qty > 0 && productName && productName.toUpperCase() !== 'UNDEFINED') {
      const customerName = 'Internal/Unknown';
      const id = generateId(`dfg-${productName}`);
      if (!records.has(id)) {
        records.set(id, {
          productId: id,
          productName,
          customerName,
          customerId: 'internal-unknown',
          openingQty: qty,
          inQty: 0,
          outQty: 0,
          closingBalance: 0,
          nonMovingBalance: qty,
          rate: rate
        });
      } else {
        const existing = records.get(id);
        existing.openingQty += qty;
        existing.nonMovingBalance += qty;
      }
    }
  }

  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  let count = 0;
  
  for (const [id, item] of records.entries()) {
    const newDocRef = doc(fgCol, id);
    batch.set(newDocRef, {
      ...item,
      isArchived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: 'MigrationScript',
      updatedBy: 'MigrationScript'
    });
    count++;
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully imported ${count} Finish Goods records.`);
  }
  
  process.exit(0);
}

run().catch(console.error);
