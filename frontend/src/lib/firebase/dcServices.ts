import { doc, setDoc } from 'firebase/firestore';
import { db } from './config';
import type { ReelTransaction, Reel } from '../types/models';
import { logActivity } from './services';
import {
  getOutwardReelTransactionsByMonth as getOutwardReelTransactionsByMonthFromSupabase,
  getReelsByIds as getReelsByIdsFromSupabase,
} from '../supabase/reelService';

export interface DCRecord {
  date: string; // YYYY-MM-DD
  totalPly: number;
  scrap: number;
}

export const getOutwardReelTransactionsByMonth = async (monthPrefix: string): Promise<ReelTransaction[]> => {
  return getOutwardReelTransactionsByMonthFromSupabase(monthPrefix) as unknown as Promise<ReelTransaction[]>;
};

export const getReelsByIds = async (reelIds: string[]): Promise<Record<string, Reel>> => {
  return getReelsByIdsFromSupabase(reelIds) as unknown as Promise<Record<string, Reel>>;
};

// Fetch DC Records for a month
export const getDCRecordsByMonth = async (monthPrefix: string): Promise<Record<string, DCRecord>> => {
  try {
    // We can fetch all and filter, or just rely on a naming convention like id = date
    const { getDocs, collection } = await import('firebase/firestore');
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
