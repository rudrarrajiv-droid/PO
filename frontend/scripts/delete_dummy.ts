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
  const collections = ['finishGoods', 'reels', 'jobCards', 'finishGoodTransactions', 'reelTransactions'];
  let deletedTotal = 0;

  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    let deleted = 0;
    
    for (const d of snap.docs) {
      const data = d.data();
      if (data.createdBy !== 'MigrationScript') {
        await deleteDoc(doc(db, col, d.id));
        deleted++;
      }
    }
    console.log(`Deleted ${deleted} dummy records from ${col}`);
    deletedTotal += deleted;
  }

  console.log(`Total dummy records deleted: ${deletedTotal}`);
  process.exit(0);
}

run().catch(console.error);
