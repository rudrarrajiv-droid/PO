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
  const reelsSnap = await getDocs(collection(db, 'reels'));
  const txSnap = await getDocs(collection(db, 'reelTransactions'));
  
  const reels = reelsSnap.docs.map(d => ({id: d.id, ...d.data()})) as any[];
  const txs = txSnap.docs.map(d => d.data()) as any[];

  let allOpening = 0;
  let activeOpening = 0;

  for (const r of reels) {
    if (r.isArchived) continue;
    
    let currentBal = Number(r.currentBalance) || 0;
    const futureTxs = txs.filter(tx => !tx.isArchived && tx.reelId === r.id && tx.date && tx.date >= '2026-08-01');
    
    let openingBal = currentBal;
    futureTxs.forEach(tx => {
       if (tx.type === 'INWARD') openingBal -= (Number(tx.quantity) || 0);
       else if (tx.type === 'OUTWARD') openingBal += (Number(tx.quantity) || 0);
    });

    if (openingBal > 0) {
      allOpening += openingBal;
      if (currentBal > 0) {
        activeOpening += openingBal;
      }
    }
  }

  console.log(`Total Opening Weight of ALL reels: ${allOpening}`);
  console.log(`Total Opening Weight of reels that are STILL ACTIVE: ${activeOpening}`);
}
run().catch(console.error);
