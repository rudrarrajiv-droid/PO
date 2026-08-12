import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from './config';
import { logActivity } from './services';

export interface MRRecord {
  id?: string;
  materialName: string;
  opnStock: number;
  opnAmt: number;
  purchaseQty: number;
  purchaseAmt: number;
  consumptionQty: number;
  consumptionAmt: number;
  closingQty: number;
  closingAmt: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

const COLLECTION_NAME = 'mr_records';

export const getMRRecords = async (): Promise<MRRecord[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MRRecord));
  } catch (error) {
    console.error("Error fetching MR records:", error);
    throw error;
  }
};

export const createMRRecord = async (record: Omit<MRRecord, 'id' | 'createdAt' | 'updatedAt'>, user: string): Promise<string> => {
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
      action: `Created MR record for ${record.materialName}`,
      entity: COLLECTION_NAME,
      referenceId: docRef.id,
      timestamp: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating MR record:", error);
    throw error;
  }
};

export const updateMRRecord = async (id: string, record: Partial<Omit<MRRecord, 'id' | 'createdAt' | 'createdBy'>>, user: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...record,
      updatedAt: serverTimestamp(),
      updatedBy: user,
    });
    
    await logActivity({
      user,
      action: `Updated MR record for ${record.materialName || id}`,
      entity: COLLECTION_NAME,
      referenceId: id,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating MR record:", error);
    throw error;
  }
};

export const deleteMRRecord = async (id: string, materialName: string, user: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
    
    await logActivity({
      user,
      action: `Deleted MR record for ${materialName}`,
      entity: COLLECTION_NAME,
      referenceId: id,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Error deleting MR record:", error);
    throw error;
  }
};
