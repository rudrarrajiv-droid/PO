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
  const sheet = workbook.Sheets['Semi Stock'];
  
  const sourceData = [];

  for (let r = 5; r <= 114; r++) {
    const reelNumber = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
    const reelSize = sheet['C' + r] ? String(sheet['C' + r].v).trim() : '';
    const bf = sheet['D' + r] ? String(sheet['D' + r].v).trim() : '';
    const gsm = sheet['E' + r] ? String(sheet['E' + r].v).trim() : '';
    const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
    const rateRaw = sheet['J' + r] ? sheet['J' + r].v : '';
    
    if (reelNumber && reelNumber !== 'undefined') {
      sourceData.push({
        reelNumber,
        reelSize: Number(reelSize),
        bf: Number(bf),
        gsm: Number(gsm),
        balanceWeight: Number(balRaw),
        inwardRate: Number(rateRaw),
      });
    }
  }

  const reelsCol = collection(db, 'reels');
  const reelsSnap = await getDocs(reelsCol);
  const existingRecords = reelsSnap.docs.map(d => d.data());
  
  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  let count = 0;
  let skipped = 0;

  for (const item of sourceData) {
    const exists = existingRecords.some(r => r.reelNumber === item.reelNumber);
    if (!exists) {
      const newDocRef = doc(reelsCol);
      batch.set(newDocRef, {
        reelNumber: item.reelNumber,
        reelSize: item.reelSize,
        bf: item.bf,
        gsm: item.gsm,
        weight: item.balanceWeight,
        currentBalance: item.balanceWeight,
        rate: item.inwardRate,
        paperType: 'SK',
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'MigrationScript',
        updatedBy: 'MigrationScript'
      });
      count++;
    } else {
      skipped++;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`Successfully imported ${count} SK records into reels. Skipped ${skipped} existing records.`);
  } else {
    console.log(`No records imported. Skipped ${skipped} existing records.`);
  }
  
  const finalSnap = await getDocs(reelsCol);
  console.log(`Total reels in Firestore now: ${finalSnap.size}`);
  
  process.exit(0);
}

run().catch(console.error);
