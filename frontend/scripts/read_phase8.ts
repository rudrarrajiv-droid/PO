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
  const sheet = workbook.Sheets['Semi Stock'];
  
  const sourceData = [];
  
  let blankReelNumbers = 0;
  let duplicateReelsXlsx = 0;
  let existingMatches = 0;
  
  let blankInvalidSize = 0;
  let blankInvalidBF = 0;
  let blankInvalidGSM = 0;
  
  let blankBalance = 0;
  let zeroBalance = 0;
  let negativeBalance = 0;
  let missingRate = 0;
  
  const reelsSet = new Set();
  
  let totalVKStockWeight = 0;
  let totalVKStockValue = 0;

  for (let r = 121; r <= 141; r++) {
    const reelNumber = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
    const reelSize = sheet['C' + r] ? String(sheet['C' + r].v).trim() : '';
    const bf = sheet['D' + r] ? String(sheet['D' + r].v).trim() : '';
    const gsm = sheet['E' + r] ? String(sheet['E' + r].v).trim() : '';
    const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
    const rateRaw = sheet['J' + r] ? sheet['J' + r].v : '';
    
    if (!reelNumber || reelNumber === 'undefined') blankReelNumbers++;
    if (!reelSize || reelSize === 'undefined') blankInvalidSize++;
    if (!bf || bf === 'undefined') blankInvalidBF++;
    if (!gsm || gsm === 'undefined') blankInvalidGSM++;
    if (balRaw === '' || balRaw === undefined) blankBalance++;
    if (rateRaw === '' || rateRaw === undefined) missingRate++;
    
    const balance = Number(balRaw);
    const rate = Number(rateRaw);
    
    if (balRaw !== '' && balRaw !== undefined) {
      if (balance === 0) zeroBalance++;
      if (balance < 0) negativeBalance++;
    }
    
    if (reelNumber && reelNumber !== 'undefined') {
      if (reelsSet.has(reelNumber)) {
        duplicateReelsXlsx++;
      }
      reelsSet.add(reelNumber);
      
      const val = balance * rate;
      if (!isNaN(balance)) totalVKStockWeight += balance;
      if (!isNaN(val)) totalVKStockValue += val;
      
      sourceData.push({
        row: r,
        reelNumber,
        reelSize,
        bf,
        gsm,
        balanceWeight: balance,
        inwardRate: rate,
        reelValue: val,
        paperType: 'VK'
      });
    }
  }

  const reelsSnap = await getDocs(collection(db, 'reels'));
  const existingRecords = reelsSnap.docs.map(d => d.data());
  
  for (const item of sourceData) {
    const exists = existingRecords.some(r => r.reelNumber === item.reelNumber);
    if (exists) {
      existingMatches++;
    }
  }

  console.log(JSON.stringify({
    totalRowsProcessed: 141 - 121 + 1,
    validRows: sourceData.length,
    validation: {
      blankReelNumbers,
      duplicateReelsXlsx,
      existingMatches,
      blankInvalidSize,
      blankInvalidBF,
      blankInvalidGSM,
      blankBalance,
      zeroBalance,
      negativeBalance,
      missingRate
    },
    summary: {
      totalVKStockWeight,
      totalVKStockValue
    },
    preview: sourceData.slice(0, 5)
  }, null, 2));
  
  process.exit(0);
}

run().catch(console.error);
