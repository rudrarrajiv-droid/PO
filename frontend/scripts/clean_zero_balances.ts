import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
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
  const fgCol = collection(db, 'finishGoods');
  const snap = await getDocs(fgCol);
  
  let deleted = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (data.createdBy === 'MigrationScript') {
      if (data.closingBalance === 0 && data.nonMovingBalance === 0) {
        await deleteDoc(doc(db, 'finishGoods', d.id));
        deleted++;
      }
    }
  }
  console.log(`Deleted ${deleted} zero-balance FinishGoods records.`);
  process.exit(0);
}
run().catch(console.error);
