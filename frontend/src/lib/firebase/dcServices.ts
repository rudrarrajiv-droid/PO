import { collection, query, where, getDocs, doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from './config';
import type { ReelTransaction, Reel } from '../types/models';
import { logActivity } from './services';

export interface DCRecord {
  date: string; // YYYY-MM-DD
  totalPly: number;
  scrap: number;
}

// Fetch all outward reel transactions for a specific month prefix
export const getOutwardReelTransactionsByMonth = async (monthPrefix: string): Promise<ReelTransaction[]> => {
  try {
    const q = query(
      collection(db, 'reelTransactions'),
      where('type', '==', 'OUTWARD')
      // Note: We might need to filter by date string in JS if we don't have a specific month field,
      // because Firestore doesn't support startsWith on ISO dates easily without `>=` and `<` hacks.
      // But we can just fetch all OUTWARD transactions and filter them, or use the hack.
      // Since data might grow, let's use string range:
    );
    const startStr = `${monthPrefix}-01`;
    // For end date, we increment the month
    const year = parseInt(monthPrefix.split('-')[0]);
    const month = parseInt(monthPrefix.split('-')[1]);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    const qWithDate = query(
      collection(db, 'reelTransactions'),
      where('type', '==', 'OUTWARD'),
      where('isArchived', '==', false)
    );

    const snap = await getDocs(qWithDate);
    const allTx = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReelTransaction));
    
    // Filter in JS to avoid requiring a composite index in Firestore
    return allTx.filter(tx => tx.date && tx.date >= startStr && tx.date < nextMonthStr);
  } catch (error) {
    console.error("Error fetching outward transactions:", error);
    throw error;
  }
};

// Fetch reels by their IDs
export const getReelsByIds = async (reelIds: string[]): Promise<Record<string, Reel>> => {
  try {
    // We will just fetch all reels for simplicity since inventory isn't huge.
    const snap = await getDocs(collection(db, 'reels'));
    const map: Record<string, Reel> = {};
    snap.docs.forEach(d => {
      map[d.id] = { id: d.id, ...d.data() } as Reel;
    });
    return map;
  } catch (error) {
    console.error("Error fetching reels for DC:", error);
    throw error;
  }
};

// Fetch DC Records for a month
export const getDCRecordsByMonth = async (monthPrefix: string): Promise<Record<string, DCRecord>> => {
  try {
    // We can fetch all and filter, or just rely on a naming convention like id = date
    const snap = await getDocs(collection(db, 'dc_records'));
    const map: Record<string, DCRecord> = {};
    snap.docs.forEach(d => {
      const data = d.data() as DCRecord;
      if (data.date.startsWith(monthPrefix)) {
        map[data.date] = data;
      }
    });
    return map;
  } catch (error) {
    console.error("Error fetching DC records:", error);
    throw error;
  }
};

// Save DC Record
export const saveDCRecord = async (record: DCRecord, user: string): Promise<void> => {
  try {
    const docRef = doc(db, 'dc_records', record.date);
    await setDoc(docRef, record, { merge: true });
    
    await logActivity({
      user,
      action: `Updated DC Record for ${record.date}`,
      entity: 'dc_records',
      referenceId: record.date,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error saving DC record:", error);
    throw error;
  }
};
