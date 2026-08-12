import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';
import { parse } from 'csv-parse/sync';
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

// Simple delay function to avoid overwhelming Firestore
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function commitBatch(batch: any, count: number) {
  if (count > 0) {
    await batch.commit();
    await delay(200);
  }
}

async function run() {
  console.log("Starting Salary & Wages Import...");
  const csvContent = fs.readFileSync('d:/po/Storage_file/salary_data.csv', 'utf-8');
  const cleanContent = csvContent.replace(/^\uFEFF/, '');
  const records = parse(cleanContent, { columns: true, skip_empty_lines: true, trim: true });

  console.log(`Parsed ${records.length} employee records.`);

  // 1. Delete all existing employees and attendance
  console.log("Deleting old employees...");
  const empSnap = await getDocs(collection(db, 'employees'));
  let batch = writeBatch(db);
  let opCount = 0;
  for (const d of empSnap.docs) {
    batch.delete(d.ref);
    opCount++;
    if (opCount >= 400) {
      await commitBatch(batch, opCount);
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  await commitBatch(batch, opCount);
  console.log(`Deleted ${empSnap.size} old employees.`);

  console.log("Deleting old attendance...");
  const attSnap = await getDocs(collection(db, 'attendance'));
  batch = writeBatch(db);
  opCount = 0;
  for (const d of attSnap.docs) {
    batch.delete(d.ref);
    opCount++;
    if (opCount >= 400) {
      await commitBatch(batch, opCount);
      batch = writeBatch(db);
      opCount = 0;
    }
  }
  await commitBatch(batch, opCount);
  console.log(`Deleted ${attSnap.size} old attendance records.`);

  // 2. Insert new employees and attendance
  console.log("Inserting new data...");
  batch = writeBatch(db);
  opCount = 0;

  for (const row of records) {
    if (!row['Name']) continue;

    const basicRaw = (row['Basic Salary'] || '').replace(/,/g, '');
    const basicSalary = Number(basicRaw) || 0;
    
    // Per day amount (August has 31 days)
    const perDayAmount = basicSalary / 31;
    const perHourAmount = perDayAmount / 8; // 8-hour shift

    // Create Employee
    const empRef = doc(collection(db, 'employees'));
    
    let cat = (row['Category'] || '').toUpperCase();
    if (cat !== 'COMPANY' && cat !== 'WAGES') {
      cat = 'COMPANY';
    }

    const contractorRaw = (row['Contractor'] || '').trim();
    let contractorName = '';
    if (cat === 'WAGES') {
        if (contractorRaw.toLowerCase().includes('dinesh')) contractorName = 'Dinesh';
        else if (contractorRaw.toLowerCase().includes('vikas')) contractorName = 'Vikas';
    }

    batch.set(empRef, {
      name: row['Name'].trim(),
      category: cat,
      contractorName: contractorName,
      designation: (row['Designation'] || '').trim(),
      basicSalary: basicSalary,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: 'System (Import)',
      updatedBy: 'System (Import)',
    });
    opCount++;
    if (opCount >= 400) { await commitBatch(batch, opCount); batch = writeBatch(db); opCount = 0; }

    // Insert Attendance for Day 1 to 9
    for (let day = 1; day <= 9; day++) {
      const dStr = day.toString().padStart(2, '0');
      const dateStr = `2026-08-${dStr}`;
      
      const prKey = `${dStr}-PR`;
      const otKey = `${dStr}-OT`;

      const prRaw = (row[prKey] || '').trim();
      const otRaw = (row[otKey] || '').trim();

      const present = Number(prRaw) || 0;
      const otHours = Number(otRaw) || 0;

      // If they were absent and had 0 OT, we might skip, but better to insert if it has an explicit 0
      if (prRaw === '' && otRaw === '') continue; // Skip if completely blank

      let refreshment = 0;
      // Sunday logic: 2026-08-02 and 2026-08-09 are Sundays
      if ((dateStr === '2026-08-02' || dateStr === '2026-08-09') && otHours > 6) {
        refreshment = 70;
      }

      const totalDayAmt = present * perDayAmount;
      const totalOtAmt = otHours * perHourAmount;

      const attRef = doc(collection(db, 'attendance'));
      batch.set(attRef, {
        employeeId: empRef.id,
        date: dateStr,
        present: present,
        otHours: otHours,
        refreshment: refreshment,
        perDayAmount: totalDayAmt,
        otAmount: totalOtAmt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: 'System (Import)',
        updatedBy: 'System (Import)'
      });
      
      opCount++;
      if (opCount >= 400) { await commitBatch(batch, opCount); batch = writeBatch(db); opCount = 0; }
    }
  }

  await commitBatch(batch, opCount);
  console.log("Import completed successfully!");
}

run().catch(console.error);
