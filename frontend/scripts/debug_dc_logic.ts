import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
dotenv.config();

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);

async function run() {
  const txsSnap = await getDocs(collection(db, 'reelTransactions'));
  const reelsSnap = await getDocs(collection(db, 'reels'));
  
  const allReels: any = {};
  reelsSnap.forEach(d => { allReels[d.id] = d.data(); });
  
  const txs = txsSnap.docs.map(d => d.data()).filter(tx => !tx.isArchived && tx.type === 'OUTWARD' && tx.date >= '2026-08-01' && tx.date <= '2026-08-09');

  const daily: any = {};

  txs.forEach(tx => {
    const reel = allReels[tx.reelId];
    if (!reel) return;
    
    const qty = tx.quantity || 0;
    const date = tx.date.substring(0, 10);
    
    if (!daily[date]) daily[date] = { sk: 0, vk20: 0, vk22: 0, vk25: 0, vk28: 0, dup: 0, totalAmt: 0, totalQty: 0, lostQty: 0 };
    
    const pt = String(reel.paperType || '').toUpperCase();
    const bfNum = Number(reel.bf) || 0;
    
    let matched = false;

    if (pt.includes('SK') || pt.includes('SEMI') || (pt.includes('CHENNAI') && !pt.includes('DUP') && !pt.includes('HWC'))) {
      daily[date].sk += qty;
      matched = true;
    } else if (pt.includes('VK') || pt.includes('VIRGIN')) {
      if (bfNum <= 20) daily[date].vk20 += qty;
      else if (bfNum > 20 && bfNum <= 22) daily[date].vk22 += qty;
      else if (bfNum > 22 && bfNum <= 25) daily[date].vk25 += qty;
      else daily[date].vk28 += qty;
      matched = true;
    } else if (pt.includes('DUPLEX') || pt.includes('HWC') || pt.includes('DUP')) {
      daily[date].dup += qty;
      matched = true;
    } else {
      daily[date].sk += qty; // fallback
      daily[date].lostQty += qty;
    }

    daily[date].totalQty += qty;
    daily[date].totalAmt += (qty * (reel.rate || 0));
  });

  console.log(daily);
}

run().catch(console.error);
