import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
  
  // 1. Read FG Stock (Rows 5-43)
  const fgSheet = workbook.Sheets['FG Stock'];
  const fgSource = [];
  for (let r = 5; r <= 43; r++) {
    const customerName = fgSheet['A' + r] ? String(fgSheet['A' + r].v).trim() : '';
    const productName = fgSheet['B' + r] ? String(fgSheet['B' + r].v).trim() : '';
    const qtyRaw = fgSheet['F' + r] ? fgSheet['F' + r].v : '';
    const rateRaw = fgSheet['G' + r] ? fgSheet['G' + r].v : '';
    const qty = Number(qtyRaw) || 0;
    const rate = Number(rateRaw) || 0;
    if (qty > 0 && customerName && productName && customerName.toUpperCase() !== 'UNDEFINED') {
      fgSource.push({
        customerName,
        productName,
        qty,
        rate,
        totalValue: qty * rate,
        category: 'DISPATCH (SALE)'
      });
    }
  }

  // 2. Read DFG (Rows 4-44)
  const dfgSheet = workbook.Sheets['DFG'];
  const dfgSource = [];
  for (let r = 4; r <= 44; r++) {
    const productName = dfgSheet['A' + r] ? String(dfgSheet['A' + r].v).trim() : '';
    const qtyRaw = dfgSheet['E' + r] ? dfgSheet['E' + r].v : '';
    const rateRaw = dfgSheet['F' + r] ? dfgSheet['F' + r].v : '';
    const qty = Number(qtyRaw) || 0;
    const rate = Number(rateRaw) || 0;
    if (qty > 0 && productName && productName.toUpperCase() !== 'UNDEFINED') {
      dfgSource.push({
        customerName: 'Internal/Unknown',
        productName,
        qty,
        rate,
        totalValue: qty * rate,
        category: 'NON-MOVING (REJECTED)'
      });
    }
  }

  // 3. Read Firestore
  const fgCol = collection(db, 'finishGoods');
  const snap = await getDocs(fgCol);
  const dbRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  function reconcile(sourceData, categoryName) {
    let matched = 0;
    let missing = 0;
    let different = 0;

    const dbItems = dbRecords.filter(item => {
      if (categoryName === 'DISPATCH (SALE)') return item.closingBalance > 0;
      if (categoryName === 'NON-MOVING (REJECTED)') return item.nonMovingBalance > 0;
      return false;
    });
    
    console.log(`\n--- ${categoryName} RECONCILIATION ---`);
    console.log(`Source Approved Records: ${sourceData.length}`);
    console.log(`Imported Records in DB: ${dbItems.length}`);

    for (const src of sourceData) {
      const found = dbItems.find(item => item.productName === src.productName && (src.category === 'DISPATCH (SALE)' ? item.customerName === src.customerName : true));
      if (!found) {
        missing++;
        console.log(`[MISSING] Product: ${src.productName}, Qty: ${src.qty}`);
      } else {
        // compare fields
        let isDiff = false;
        let diffMsg = `[DIFFERENT] Product: ${src.productName} -> `;
        const dbQty = src.category === 'DISPATCH (SALE)' ? found.closingBalance : found.nonMovingBalance;
        if (Math.abs(dbQty - src.qty) > 0.01) {
          isDiff = true; diffMsg += `Qty (src:${src.qty}, db:${dbQty}) `;
        }
        if (Math.abs(found.rate - src.rate) > 0.01) {
          isDiff = true; diffMsg += `Rate (src:${src.rate}, db:${found.rate}) `;
        }
        if (Math.abs(found.totalValue - src.totalValue) > 0.01) {
          isDiff = true; diffMsg += `Value (src:${src.totalValue}, db:${found.totalValue}) `;
        }
        if (isDiff) {
          different++;
          console.log(diffMsg);
        } else {
          matched++;
        }
      }
    }
    console.log(`Matched: ${matched}`);
    console.log(`Missing: ${missing}`);
    console.log(`Different: ${different}`);
  }

  reconcile(fgSource, 'DISPATCH (SALE)');
  reconcile(dfgSource, 'NON-MOVING (REJECTED)');

  process.exit(0);
}

run().catch(console.error);
