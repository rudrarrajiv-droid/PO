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
  const collections = ['finishGoods', 'reels', 'jobCards', 'finishGoodTransactions', 'reelTransactions', 'products', 'customers'];
  const stats = {};

  for (const col of collections) {
    const snap = await getDocs(collection(db, col));
    let dummyCount = 0;
    let migrationCount = 0;
    
    snap.forEach(doc => {
      const data = doc.data();
      if (data.createdBy === 'MigrationScript') {
        migrationCount++;
      } else {
        dummyCount++;
      }
    });

    stats[col] = { dummyCount, migrationCount };
  }

  console.log(JSON.stringify(stats, null, 2));
  process.exit(0);
}

run().catch(console.error);
