import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
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
  const snap = await getDocs(reelsCol);
  
  const batch = writeBatch(db);
  let count = 0;

  for (const d of snap.docs) {
    const data = d.data();
    if (data.createdBy === 'MigrationScript') {
      batch.update(doc(reelsCol, d.id), {
        supplierName: data.supplierName || '',
        manufacturerName: data.manufacturerName || '',
        inwardDate: data.inwardDate || new Date().toISOString().split('T')[0],
        reelSize: String(data.reelSize || ''),
        bf: String(data.bf || ''),
        gsm: String(data.gsm || '')
      });
      count++;
    }
  }

  await batch.commit();
  console.log(`Fixed ${count} reel records.`);
  process.exit(0);
}

run().catch(console.error);
