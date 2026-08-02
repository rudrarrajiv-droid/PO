import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  query, 
  where,
  QueryConstraint,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { db } from './config';

// Generic service for Firestore CRUD operations with centralized error handling

export const createDocument = async <T extends object>(
  collectionName: string, 
  data: T, 
  user: string = 'System'
) => {
  try {
    const enrichedData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user,
      updatedBy: user,
      isArchived: false,
    };
    
    const docRef = await addDoc(collection(db, collectionName), enrichedData);
    
    // Log activity (async, non-blocking if possible)
    await logActivity({
      user,
      action: 'Created',
      entity: collectionName,
      referenceId: docRef.id,
      timestamp: serverTimestamp()
    });

    return docRef.id;
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

export const getDocument = async (collectionName: string, id: string) => {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error(`Error getting document ${id} from ${collectionName}:`, error);
    throw error;
  }
};

export const updateDocument = async (
  collectionName: string, 
  id: string, 
  data: any, 
  user: string = 'System'
) => {
  try {
    const docRef = doc(db, collectionName, id);
    const enrichedData = {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: user,
    };
    await updateDoc(docRef, enrichedData);
    
    await logActivity({
      user,
      action: 'Updated',
      entity: collectionName,
      referenceId: id,
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error(`Error updating document ${id} in ${collectionName}:`, error);
    throw error;
  }
};

export const softDeleteDocument = async (
  collectionName: string, 
  id: string, 
  user: string = 'System'
) => {
  try {
    await updateDocument(collectionName, id, { isArchived: true }, user);
    
    await logActivity({
      user,
      action: 'Archived',
      entity: collectionName,
      referenceId: id,
      timestamp: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error(`Error archiving document ${id} in ${collectionName}:`, error);
    throw error;
  }
};

export const queryDocuments = async (collectionName: string, constraints: QueryConstraint[]) => {
  try {
    const q = query(collection(db, collectionName), ...constraints, where('isArchived', '==', false));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error querying documents in ${collectionName}:`, error);
    throw error;
  }
};

export const logActivity = async (activity: any) => {
  try {
    await addDoc(collection(db, 'activityLogs'), activity);
  } catch (error) {
    console.error(`Error logging activity:`, error);
  }
};

export const executeBatchCreate = async <T extends object>(
  collectionName: string,
  items: T[],
  user: string = 'System'
) => {
  try {
    const batch = writeBatch(db);
    const colRef = collection(db, collectionName);
    const timestamp = serverTimestamp();

    items.forEach((item) => {
      const docRef = doc(colRef); // Auto-generate ID
      batch.set(docRef, {
        ...item,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: user,
        updatedBy: user,
        isArchived: false,
      });
    });

    await batch.commit();

    await logActivity({
      user,
      action: 'Batch Created',
      entity: collectionName,
      count: items.length,
      timestamp: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error(`Error executing batch create in ${collectionName}:`, error);
    throw error;
  }
};

export interface OutwardPayload {
  reelId: string;
  reelNumber: string;
  consumedWeight: number;
  jobCardId?: string;
  outwardDate?: string;
}

export const executeOutwardTransaction = async (
  payloads: OutwardPayload[],
  user: string = 'System'
) => {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read all reels first to ensure they exist and have enough balance
      const reelsCol = collection(db, 'reels');
      const txCol = collection(db, 'reelTransactions');
      const timestamp = serverTimestamp();
      
      const readDocs = [];
      for (const payload of payloads) {
        const reelRef = doc(reelsCol, payload.reelId);
        const reelSnap = await transaction.get(reelRef);
        if (!reelSnap.exists()) {
          throw new Error(`Reel ${payload.reelNumber} does not exist.`);
        }
        
        const data = reelSnap.data();
        if (data.currentBalance < payload.consumedWeight) {
          throw new Error(`Reel ${payload.reelNumber} has insufficient balance. Available: ${data.currentBalance}, Requested: ${payload.consumedWeight}`);
        }
        
        readDocs.push({
          ref: reelRef,
          data,
          payload
        });
      }

      // 2. Perform all writes
      for (const item of readDocs) {
        const newBalance = item.data.currentBalance - item.payload.consumedWeight;
        
        // Update Reel
        transaction.update(item.ref, {
          currentBalance: newBalance,
          updatedAt: timestamp,
          updatedBy: user
        });

        // Insert Transaction Log
        const newTxRef = doc(txCol);
        transaction.set(newTxRef, {
          reelId: item.payload.reelId,
          reelNumber: item.payload.reelNumber,
          type: 'OUTWARD',
          quantity: item.payload.consumedWeight, // Quantity Consumed
          remainingBalance: newBalance,
          jobCardId: item.payload.jobCardId || null,
          performedBy: user,
          date: item.payload.outwardDate ? new Date(item.payload.outwardDate).toISOString() : new Date().toISOString(),
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: user,
          updatedBy: user,
          isArchived: false,
        });
      }
    });

    await logActivity({
      user,
      action: 'Batch Outward Issue',
      entity: 'reels',
      count: payloads.length,
      timestamp: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error(`Error executing outward transaction:`, error);
    throw error;
  }
};

export interface AllocationPayload {
  reelId: string;
  reelNumber: string;
  allocatedWeight: number;
}

export const executeReelAllocation = async (
  jobCardId: string,
  allocations: AllocationPayload[],
  user: string = 'System'
) => {
  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read Job Card and Reels
      const jcRef = doc(db, 'jobCards', jobCardId);
      const jcSnap = await transaction.get(jcRef);
      if (!jcSnap.exists()) {
        throw new Error(`Job Card does not exist.`);
      }

      const reelsCol = collection(db, 'reels');
      const txCol = collection(db, 'reelTransactions');
      const timestamp = serverTimestamp();
      
      const readDocs = [];
      for (const payload of allocations) {
        const reelRef = doc(reelsCol, payload.reelId);
        const reelSnap = await transaction.get(reelRef);
        if (!reelSnap.exists()) {
          throw new Error(`Reel ${payload.reelNumber} does not exist.`);
        }
        
        const data = reelSnap.data();
        if (data.currentBalance < payload.allocatedWeight) {
          throw new Error(`Reel ${payload.reelNumber} has insufficient balance. Available: ${data.currentBalance}, Requested: ${payload.allocatedWeight}`);
        }
        
        readDocs.push({
          ref: reelRef,
          data,
          payload
        });
      }

      // 2. Perform all writes
      const jcData = jcSnap.data();
      const existingAllocations = jcData.allocations || [];
      const newAllocations = [...existingAllocations, ...allocations.map(a => ({
        ...a,
        allocatedAt: new Date().toISOString(),
        allocatedBy: user
      }))];

      // Update Job Card
      transaction.update(jcRef, {
        allocations: newAllocations,
        updatedAt: timestamp,
        updatedBy: user
      });

      for (const item of readDocs) {
        const newBalance = item.data.currentBalance - item.payload.allocatedWeight;
        
        // Update Reel
        transaction.update(item.ref, {
          currentBalance: newBalance,
          updatedAt: timestamp,
          updatedBy: user
        });

        // Insert Transaction Log
        const newTxRef = doc(txCol);
        transaction.set(newTxRef, {
          reelId: item.payload.reelId,
          reelNumber: item.payload.reelNumber,
          type: 'ALLOCATION',
          quantity: item.payload.allocatedWeight,
          remainingBalance: newBalance,
          jobCardId: jobCardId,
          performedBy: user,
          date: new Date().toISOString(),
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: user,
          updatedBy: user,
          isArchived: false,
        });
      }
    });

    await logActivity({
      user,
      action: 'Reel Allocation',
      entity: 'jobCards',
      referenceId: jobCardId,
      timestamp: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error(`Error executing reel allocation:`, error);
    throw error;
  }
};
