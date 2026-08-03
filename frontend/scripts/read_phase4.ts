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
  const sheet = workbook.Sheets['DFG'];
  
  const sourceData = [];
  let blankProduct = 0;
  let zeroBalance = 0;
  let invalidRate = 0;
  
  const productsSet = new Set();
  let duplicates = 0;

  for (let r = 4; r <= 44; r++) {
    const product = sheet['A' + r] ? sheet['A' + r].v : '';
    const closingBalance = sheet['E' + r] ? sheet['E' + r].v : '';
    const rate = sheet['F' + r] ? sheet['F' + r].v : '';
    
    const p = String(product).trim();
    const q = Number(closingBalance);
    const rat = Number(rate);
    
    if (!p || p === 'undefined') blankProduct++;
    if (q === 0) zeroBalance++;
    if (rate !== '' && isNaN(rat)) invalidRate++;
    
    if (p && p !== 'undefined') {
      if (productsSet.has(p)) {
        duplicates++;
      }
      productsSet.add(p);
      
      sourceData.push({
        row: r,
        product: p,
        openingQty: q,
        rate: rat,
        totalValue: q * rat,
        category: 'NON-MOVING (REJECTED)'
      });
    }
  }

  // Fetch Firestore
  const fgSnap = await getDocs(collection(db, 'finishGoods'));
  const existingRecords = fgSnap.docs.map(d => d.data());
  let existingMatches = 0;
  
  for (const item of sourceData) {
    const exists = existingRecords.some(r => r.productName === item.product);
    if (exists) {
      existingMatches++;
    }
  }

  console.log(JSON.stringify({
    totalRows: 41,
    validRows: sourceData.length,
    blankProduct,
    zeroBalance,
    duplicates,
    existingMatches,
    preview: sourceData.slice(0, 5)
  }, null, 2));
  
  process.exit(0);
}

run().catch(console.error);
