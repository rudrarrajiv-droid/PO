import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from './config';
import { logActivity } from './services';

export interface RMRecord {
  id?: string;
  rmName: string;
  opn: number;
  rate: number;
  totalIn: number;
  totalOut: number;
  clBal: number;
  opnStockValue: number;
  purchaseValueStock: number;
  consumptionStock: number;
  closingStockValue: number;
  // dayWise is an object mapping day number (1-31) to { in: number, out: number }
  dayWise: Record<string, { in: number, out: number }>;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

const COLLECTION_NAME = 'rm_records';

export const getRMRecords = async (): Promise<RMRecord[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RMRecord));
  } catch (error) {
    console.error("Error fetching RM records:", error);
    throw error;
  }
};

export const createRMRecord = async (record: Omit<RMRecord, 'id' | 'createdAt' | 'updatedAt'>, user: string): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...record,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user,
      updatedBy: user,
    });
    
    await logActivity({
      user,
      action: `Created RM record for ${record.rmName}`,
      entity: COLLECTION_NAME,
      referenceId: docRef.id,
      timestamp: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating RM record:", error);
    throw error;
  }
};

export const updateRMRecord = async (id: string, record: Partial<Omit<RMRecord, 'id' | 'createdAt' | 'createdBy'>>, user: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...record,
      updatedAt: serverTimestamp(),
      updatedBy: user,
    });
    
    await logActivity({
      user,
      action: `Updated RM record for ${record.rmName || id}`,
      entity: COLLECTION_NAME,
      referenceId: id,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating RM record:", error);
    throw error;
  }
};

export const deleteRMRecord = async (id: string, rmName: string, user: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    
    await logActivity({
      user,
      action: `Deleted RM record for ${rmName}`,
      entity: COLLECTION_NAME,
      referenceId: id,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error deleting RM record:", error);
    throw error;
  }
};
