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

async function run() {
  const reelsCol = collection(db, 'reels');

  // First cleanup any previously imported DUPLEX reels by MigrationScript to avoid dupes
  const q = query(reelsCol, where('paperType', '==', 'DUPLEX'));
  const snap = await getDocs(q);
  let deleted = 0;
  for (const d of snap.docs) {
    if (d.data().createdBy === 'MigrationScript') {
      await deleteDoc(doc(db, 'reels', d.id));
      deleted++;
    }
  }
  console.log(`Deleted ${deleted} old DUPLEX reels.`);

  const workbook = xlsx.readFile('../Storage_file/Inventory July 2026.xlsx');
  const sheet = workbook.Sheets['Dup'];

  const sourceData = [];
  let totalWeight = 0;
  let totalValue = 0;

  for (let r = 4; r <= 13; r++) {
    const reelNumber = sheet['B' + r] ? String(sheet['B' + r].v).trim() : '';
    const size = sheet['C' + r] ? String(sheet['C' + r].v).trim() : '';
    const bf = sheet['D' + r] ? String(sheet['D' + r].v).trim() : '';
    const gsm = sheet['E' + r] ? String(sheet['E' + r].v).trim() : '';
    const balRaw = sheet['I' + r] ? sheet['I' + r].v : '';
    const rateRaw = sheet['J' + r] ? sheet['J' + r].v : '';
    
    const balance = Number(balRaw) || 0;
    const rate = Number(rateRaw) || 0;
    
    if (balance > 0 && reelNumber && reelNumber.toUpperCase() !== 'UNDEFINED') {
      sourceData.push({
        reelNumber,
        reelSize: size,
        bf,
        gsm,
        balanceWeight: balance,
        inwardRate: rate
      });
      totalWeight += balance;
      totalValue += balance * rate;
    }
  }

  const batch = writeBatch(db);
  const timestamp = serverTimestamp();
  let count = 0;
  
  for (const item of sourceData) {
    const newDocRef = doc(reelsCol);
    batch.set(newDocRef, {
      reelNumber: item.reelNumber,
      reelSize: item.reelSize,
      bf: item.bf,
      gsm: item.gsm,
      weight: item.balanceWeight,
      currentBalance: item.balanceWeight,
      rate: item.inwardRate,
      paperType: 'DUPLEX',
      supplierName: '',
      manufacturerName: '',
      inwardDate: new Date().toISOString().split('T')[0],
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
    console.log(`Successfully imported ${count} DUPLEX records.`);
    console.log(`Total DUPLEX Balance Weight: ${totalWeight} kg`);
    console.log(`Total DUPLEX Value: Rs. ${totalValue}`);
  }
  
  process.exit(0);
}

run().catch(console.error);
