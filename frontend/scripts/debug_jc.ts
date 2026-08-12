import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "dummy",
  authDomain: "dummy",
  projectId: "rudrarrajiv-droid",
  storageBucket: "dummy",
  messagingSenderId: "dummy",
  appId: "dummy"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  // Try to find job card 1077
  const { collection, getDocs, query, where } = await import('firebase/firestore');
  const jcCol = collection(db, 'jobCards');
  const q = query(jcCol, where('jobCardNumber', '==', 1077));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    console.log("No job card 1077 found");
    return;
  }
  
  const jc = snap.docs[0].data();
  console.log("Job Card Status:", jc.status);
  
  if (jc.productSnapshot && jc.productSnapshot.layers) {
    jc.productSnapshot.layers.forEach((l: any, i: number) => {
      console.log(`\nLayer ${i} (${l.layerName}):`);
      console.log(`  Weight Req (gsm=${l.gsm}): weight calculation not done here`);
      if (l.allocatedReels) {
        l.allocatedReels.forEach((r: any) => {
          console.log(`  - Allocated Reel: ${r.reelNumber} (${r.allocatedWeight} Kg)`);
        });
      } else {
        console.log(`  - No allocated reels.`);
      }
    });
  } else {
    console.log("No layers in productSnapshot");
  }
  process.exit(0);
}

main().catch(console.error);
