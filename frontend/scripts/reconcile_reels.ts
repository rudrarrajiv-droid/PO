import xlsx from 'xlsx';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
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
  
  const skSheet = workbook.Sheets['Semi Stock'];
  const vkSheet = workbook.Sheets['Virgin  Stock'];
  const dupSheet = workbook.Sheets['Dup'];

  const extractReels = (sheet, typeStr) => {
    const results = [];
    if (!sheet) return results;
    
    for (let r = 1; r <= 500; r++) {
      const reelNoRaw = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
      const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
      const rateRaw = sheet['J' + r] ? sheet['J' + r].v : '';

      if (reelNoRaw && reelNoRaw.toUpperCase() !== 'UNDEFINED' && reelNoRaw.toUpperCase() !== 'NO.' && reelNoRaw.toUpperCase() !== 'REEL NO.') {
        const balance = Number(balRaw) || 0;
        if (balance > 0) {
          results.push({
            reelNumber: reelNoRaw,
            paperType: typeStr,
            weight: balance,
            rate: Number(rateRaw) || 0
          });
        }
      }
    }
    return results;
  };

  const srcSK = extractReels(skSheet, 'SK');
  const srcVK = extractReels(vkSheet, 'VK');
  const srcDUP = extractReels(dupSheet, 'DUPLEX');

  const allSrc = { 'SK': srcSK, 'VK': srcVK, 'DUPLEX': srcDUP };

  const q = query(collection(db, 'reels'), where('isArchived', '==', false));
  const snap = await getDocs(q);
  const dbReels = snap.docs.map(d => d.data());

  console.log(`\n--- REEL INVENTORY RECONCILIATION ---`);
  
  const checkType = (type, sourceList) => {
    const dbList = dbReels.filter(r => r.paperType === type);
    
    let matched = 0;
    let missing = 0;
    let diff = 0;
    let totalWeight = 0;
    let totalValue = 0;

    const dbUnmatched = [...dbList];

    for (const src of sourceList) {
      // find exact match
      const exactIdx = dbUnmatched.findIndex(r => r.reelNumber === src.reelNumber && Math.abs(Number(r.currentBalance) - src.weight) < 0.1);
      if (exactIdx >= 0) {
        matched++;
        dbUnmatched.splice(exactIdx, 1);
      } else {
        // find name match but diff weight
        const nameIdx = dbUnmatched.findIndex(r => r.reelNumber === src.reelNumber);
        if (nameIdx >= 0) {
          diff++;
          console.log(`[DIFF] ${type} Reel ${src.reelNumber} Qty: src=${src.weight}, db=${dbUnmatched[nameIdx].currentBalance}`);
          dbUnmatched.splice(nameIdx, 1);
        } else {
          missing++;
          console.log(`[MISSING] ${type} Reel ${src.reelNumber}`);
        }
      }
    }

    dbList.forEach(r => {
      const w = Number(r.currentBalance) || 0;
      totalWeight += w;
      totalValue += w * (Number(r.rate) || 0);
    });

    console.log(`\n[${type}]`);
    console.log(`Source Approved: ${sourceList.length}`);
    console.log(`DB Imported: ${dbList.length}`);
    console.log(`Matched: ${matched}, Missing: ${missing}, Different: ${diff}`);
    console.log(`Total Balance Weight (DB): ${totalWeight}`);
    console.log(`Total Stock Value (DB): ${totalValue.toFixed(2)}`);
  };

  checkType('SK', allSrc['SK']);
  checkType('VK', allSrc['VK']);
  checkType('DUPLEX', allSrc['DUPLEX']);

  // Check unique reel numbers
  const reelNumbers = dbReels.map(r => r.reelNumber);
  const duplicates = reelNumbers.filter((item, index) => reelNumbers.indexOf(item) !== index);
  if (duplicates.length > 0) {
    console.log(`\n[WARNING] Duplicate Reel Numbers found in DB: ${[...new Set(duplicates)].join(', ')}`);
  } else {
    console.log(`\n[SUCCESS] All Reel Numbers in DB are unique.`);
  }

  process.exit(0);
}

run().catch(console.error);
