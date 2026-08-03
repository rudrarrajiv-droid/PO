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
  const sheet = workbook.Sheets['FG Stock'];
  
  const sourceData = [];
  let blankCustomer = 0;
  let blankProduct = 0;
  let blankQuantity = 0;
  let zeroQuantityRows = [];
  let invalidRate = 0;
  
  const combos = new Set();
  let duplicates = 0;

  for (let r = 5; r <= 43; r++) {
    const customer = sheet['A' + r] ? sheet['A' + r].v : '';
    const product = sheet['B' + r] ? sheet['B' + r].v : '';
    const openingQty = sheet['F' + r] ? sheet['F' + r].v : '';
    const rate = sheet['G' + r] ? sheet['G' + r].v : '';
    const totalValue = sheet['H' + r] ? sheet['H' + r].v : '';
    
    // Trim strings
    const c = String(customer).trim();
    const p = String(product).trim();
    const q = Number(openingQty);
    const rat = Number(rate);
    
    if (!c || c === 'undefined') blankCustomer++;
    if (!p || p === 'undefined') blankProduct++;
    if (openingQty === '') blankQuantity++;
    if (q === 0) zeroQuantityRows.push(r);
    if (rate !== '' && isNaN(rat)) invalidRate++;
    
    const combo = `${c}|${p}`;
    if (c && p && c !== 'undefined' && p !== 'undefined') {
      if (combos.has(combo)) {
        duplicates++;
      }
      combos.add(combo);
    }

    sourceData.push({ row: r, customer: c === 'undefined' ? '' : c, product: p === 'undefined' ? '' : p, openingQty: q, rate: rat, totalValue, category: 'DISPATCH (SALE)' });
  }

  // Fetch Firestore
  const fgSnap = await getDocs(collection(db, 'finishGoods'));
  const existingRecords = fgSnap.docs.map(d => d.data());
  let existingMatches = 0;
  
  for (const item of sourceData) {
    if (!item.customer || !item.product) continue;
    const exists = existingRecords.some(r => r.customerName === item.customer && r.productName === item.product);
    if (exists) {
      existingMatches++;
    }
  }

  console.log(JSON.stringify({
    totalRows: 39,
    blankCustomer,
    blankProduct,
    blankQuantity,
    zeroQuantityRows,
    invalidRate,
    duplicates,
    existingMatches,
    preview: sourceData.slice(0, 5)
  }, null, 2));
  
  process.exit(0);
}

run().catch(console.error);
