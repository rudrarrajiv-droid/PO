import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
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
  const q = query(reelsCol, where('paperType', '==', 'VK'));
  const snap = await getDocs(q);
  
  let count = 0;
  for (const d of snap.docs) {
    if (d.data().createdBy === 'MigrationScript') {
      await deleteDoc(doc(db, 'reels', d.id));
      count++;
    }
  }
  console.log(`Deleted ${count} mistakenly imported VK reels.`);
  process.exit(0);
}
run().catch(console.error);
