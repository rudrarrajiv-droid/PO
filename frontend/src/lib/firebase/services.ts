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
  runTransaction,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  setDoc
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

export const deleteJobCardAndRecycleNo = async (id: string, user: string = 'System') => {
  try {
    const docRef = doc(db, 'jobCards', id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Job Card not found');
    }
    
    const jobCardNo = docSnap.data().jobCardNo;
    
    // Hard delete the job card
    await deleteDoc(docRef);
    
    // Add job card number to recycled array in metadata
    const metadataRef = doc(db, 'metadata', 'jobCardsConfig');
    await setDoc(metadataRef, { recycledNumbers: arrayUnion(jobCardNo) }, { merge: true });
    
    await logActivity({
      user,
      action: 'Deleted & Recycled',
      entity: 'jobCards',
      referenceId: id,
      details: `Deleted job card ${jobCardNo}`,
      timestamp: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error deleting and recycling job card:', error);
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
    console.error('Error executing outward transaction:', error);
    throw error;
  }
};

export const executeJobCardTransaction = async (
  jobId: string | null,
  newPayload: any,
  oldJobCard: any | null,
  user: string = 'System'
) => {
  try {
    const reservedDeltas: Record<string, { delta: number, reelNumber: string }> = {};

    const addAllocation = (layer: any, multiplier: number, targetDeltas: Record<string, { delta: number, reelNumber: string }>) => {
      if (layer.allocatedReels && Array.isArray(layer.allocatedReels)) {
        layer.allocatedReels.forEach((r: any) => {
          if (!r.reelId) return;
          const w = Number(r.allocatedWeight) || 0;
          if (!targetDeltas[r.reelId]) targetDeltas[r.reelId] = { delta: 0, reelNumber: r.reelNumber || '' };
          targetDeltas[r.reelId].delta += (w * multiplier);
        });
      }
    };

    // Merge oldJobCard and newPayload to get the full final document state
    const finalNewState = { ...(oldJobCard || {}), ...newPayload };

    // ACTIVE for reservation means it is PENDING
    // The user wants ALL Job Card allocations to be strictly "imaginary" (Virtual).
    // They ONLY block weight when PENDING. When issued, the block is removed and NO inventory is deducted automatically.
    const isNewActive = finalNewState && finalNewState.status === 'PENDING';
    const isOldActive = oldJobCard && oldJobCard.status === 'PENDING';

    if (isOldActive && oldJobCard.productSnapshot?.layers) {
      oldJobCard.productSnapshot.layers.forEach((l: any) => addAllocation(l, -1, reservedDeltas));
    }
    if (isNewActive && finalNewState.productSnapshot?.layers) {
      finalNewState.productSnapshot.layers.forEach((l: any) => addAllocation(l, 1, reservedDeltas));
    }

    let resultingJobId = jobId;

    await runTransaction(db, async (transaction) => {
      const reelsCol = collection(db, 'reels');
      const jcCol = collection(db, 'jobCards');
      if (!resultingJobId) {
        resultingJobId = doc(jcCol).id;
      }
      const readDocs = [];

      // 1. Read all affected reels for reservation
      const allReelIds = Object.keys(reservedDeltas);

      for (const reelId of allReelIds) {
        const resDelta = reservedDeltas[reelId]?.delta || 0;
        
        if (Math.abs(resDelta) < 0.001) continue;
        
        const reelNumber = reservedDeltas[reelId]?.reelNumber || '';
        
        const reelRef = doc(reelsCol, reelId);
        const reelSnap = await transaction.get(reelRef);
        if (!reelSnap.exists()) {
          throw new Error(`Reel ${reelNumber} does not exist.`);
        }
        
        const data = reelSnap.data();
        const currentBalance = data.currentBalance || 0;
        const currentReserved = data.activeReservedWeight || 0;
        
        const newReserved = currentReserved + resDelta;
        
        if (newReserved > currentBalance + 0.1) { // 0.1 float tolerance
           throw new Error(`Insufficient available weight for Reel ${data.reelNumber}. Available: ${currentBalance - currentReserved} Kg, Requested Extra: ${resDelta} Kg.\n\nReel availability has changed. Please review the reel allocation.`);
        }

        readDocs.push({
          ref: reelRef,
          newReserved: Math.max(0, newReserved)
        });
      }

      // 2. Write all reel updates
      for (const item of readDocs) {
        transaction.update(item.ref, {
          activeReservedWeight: item.newReserved,
          updatedAt: serverTimestamp(),
          updatedBy: user
        });
      }

      // 3. Write Job Card
      const jcRef = doc(jcCol, resultingJobId);
      const safePayload = Object.fromEntries(Object.entries(newPayload).filter(([_, v]) => v !== undefined));
      if (jobId) { // It was an update
         transaction.update(jcRef, {
           ...safePayload,
           updatedAt: serverTimestamp(),
           updatedBy: user
         });
      } else { // It is a new creation
         transaction.set(jcRef, {
           ...safePayload,
           createdAt: serverTimestamp(),
           updatedAt: serverTimestamp(),
           createdBy: user,
           updatedBy: user,
           isArchived: false,
         });
         
         // Remove from recycled numbers if applicable
         if (newPayload.jobCardNo) {
           const metadataRef = doc(db, 'metadata', 'jobCardsConfig');
           transaction.set(metadataRef, { 
             recycledNumbers: arrayRemove(newPayload.jobCardNo) 
           }, { merge: true });
         }
      }
    });

    await logActivity({
      user,
      action: jobId ? 'Updated Job Card with Reservation' : 'Created Job Card with Reservation',
      entity: 'jobCards',
      referenceId: resultingJobId,
      timestamp: serverTimestamp()
    });

    return resultingJobId;
  } catch (error) {
    console.error('Error executing job card transaction:', error);
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

export interface FinishGoodInwardPayload {
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  quantity: number;
  category: 'REGULAR' | 'REJECTED';
  date: string;
  rate: number;
  jobCardAllocations?: { jobCardId: string, quantity: number }[];
}

export const executeFinishGoodInwardTransaction = async (
  payloads: FinishGoodInwardPayload[],
  user: string
) => {
  try {
    await runTransaction(db, async (transaction) => {
      const timestamp = serverTimestamp();
      const txCol = collection(db, 'finishGoodTransactions');
      const jcCol = collection(db, 'jobCards');
      
      const fgRefs = payloads.map(p => ({
        payload: p,
        ref: doc(db, 'finishGoods', p.productId) // Use productId as document ID for FinishGood
      }));

      // Gather all required Job Card references
      const jcRefs = payloads.flatMap(p => 
        (p.jobCardAllocations || []).map(alloc => ({
          ref: doc(jcCol, alloc.jobCardId),
          alloc
        }))
      );

      // 1. Read all required docs (FinishGoods AND JobCards)
      const readDocs = [];
      for (const item of fgRefs) {
        const snap = await transaction.get(item.ref);
        readDocs.push({
          ...item,
          snap,
          data: snap.exists() ? snap.data() : null
        });
      }

      const jcReadDocs = [];
      for (const item of jcRefs) {
        const snap = await transaction.get(item.ref);
        if (snap.exists()) {
          jcReadDocs.push({
            ...item,
            snap,
            data: snap.data()
          });
        }
      }

      // 2. Perform all writes
      for (const item of readDocs) {
        const p = item.payload;
        let newClosingBalance = 0;
        let newNonMovingBalance = 0;
        let newInQty = p.quantity;
        let newOpeningQty = 0;
        let newOutQty = 0;

        if (item.snap.exists() && item.data) {
          const existing = item.data;
          newOpeningQty = existing.openingQty || 0;
          newInQty = (existing.inQty || 0) + p.quantity;
          newOutQty = existing.outQty || 0;
          newClosingBalance = existing.closingBalance || 0;
          newNonMovingBalance = existing.nonMovingBalance || 0;
        } else {
          // Creating a new finish goods record
          newOpeningQty = 0; // Or we could say it's 0
        }

        if (p.category === 'REGULAR') {
          newClosingBalance += p.quantity;
        } else if (p.category === 'REJECTED') {
          newNonMovingBalance += p.quantity;
        }

        const fgData = {
          productId: p.productId,
          productName: p.productName,
          customerId: p.customerId,
          customerName: p.customerName,
          openingQty: newOpeningQty,
          inQty: newInQty,
          outQty: newOutQty,
          closingBalance: newClosingBalance,
          nonMovingBalance: newNonMovingBalance,
          rate: p.rate,
          updatedAt: timestamp,
          updatedBy: user,
          isArchived: false,
        };

        if (!item.snap.exists()) {
          transaction.set(item.ref, {
            ...fgData,
            createdAt: timestamp,
            createdBy: user,
          });
        } else {
          transaction.update(item.ref, fgData);
        }

        // Insert Transaction Log
        const newTxRef = doc(txCol);
        transaction.set(newTxRef, {
          finishGoodId: p.productId, // Since finishGood ID === productId
          type: 'IN',
          category: p.category,
          quantity: p.quantity,
          remainingBalance: p.category === 'REGULAR' ? newClosingBalance : newNonMovingBalance,
          date: p.date,
          performedBy: user,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: user,
          updatedBy: user,
          isArchived: false,
        });
      }

      // 3. Update Job Cards (Close them)
      for (const item of jcReadDocs) {
        const existing = item.data;
        const newProduced = (existing.producedQuantity || 0) + item.alloc.quantity;
        const reqQty = existing.quantity || 0;
        
        const jcData: any = {
          producedQuantity: newProduced,
          updatedAt: timestamp,
          updatedBy: user
        };
        
        // If produced meets or exceeds required, mark COMPLETED
        if (newProduced >= reqQty) {
          jcData.status = 'COMPLETED';
          // Find the related payload date for completionDate
          const relatedPayload = payloads.find(p => p.jobCardAllocations?.some(a => a.jobCardId === item.ref.id));
          jcData.completionDate = relatedPayload?.date || new Date().toISOString().split('T')[0];
        }

        transaction.update(item.ref, jcData);
      }
    });

    await logActivity({
      user,
      action: 'Finish Goods Bulk Inward',
      entity: 'finishGoods',
      referenceId: 'BULK',
      timestamp: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error(`Error executing Finish Goods Inward:`, error);
    throw error;
  }
};

export interface FinishGoodOutwardPayload {
  productId: string;
  quantity: number;
  category: 'DISPATCH' | 'NON-MOVING';
}

export interface LogisticsPayload {
  date: string;
  invoiceNo: string;
  place: string;
  transporterName: string;
  vehicleNo: string;
  vehicleSize: string;
  freight: number;
  holding: number;
  point: string;
  others: string;
}

export const executeFinishGoodOutwardTransaction = async (
  logistics: LogisticsPayload,
  payloads: FinishGoodOutwardPayload[],
  user: string
) => {
  try {
    await runTransaction(db, async (transaction) => {
      const timestamp = serverTimestamp();
      const txCol = collection(db, 'finishGoodTransactions');
      
      const fgRefs = payloads.map(p => ({
        payload: p,
        ref: doc(db, 'finishGoods', p.productId)
      }));

      // 1. Read all required docs
      const readDocs = [];
      for (const item of fgRefs) {
        const snap = await transaction.get(item.ref);
        if (!snap.exists()) {
          throw new Error(`Finish Good record not found for product ${item.payload.productId}`);
        }
        readDocs.push({
          ...item,
          snap,
          data: snap.data()
        });
      }

      // 2. Perform all writes
      for (const item of readDocs) {
        const p = item.payload;
        const existing = item.data!;
        
        let newClosingBalance = existing.closingBalance || 0;
        let newNonMovingBalance = existing.nonMovingBalance || 0;
        const newOutQty = (existing.outQty || 0) + p.quantity;

        if (p.category === 'DISPATCH') {
          if (newClosingBalance < p.quantity) {
            throw new Error(`Insufficient Regular Balance for product ${existing.productName}`);
          }
          newClosingBalance -= p.quantity;
        } else if (p.category === 'NON-MOVING') {
          if (newNonMovingBalance < p.quantity) {
            throw new Error(`Insufficient Non-Moving Balance for product ${existing.productName}`);
          }
          newNonMovingBalance -= p.quantity;
        }

        const fgData = {
          outQty: newOutQty,
          closingBalance: newClosingBalance,
          nonMovingBalance: newNonMovingBalance,
          updatedAt: timestamp,
          updatedBy: user,
        };

        transaction.update(item.ref, fgData);

        // Insert Transaction Log
        const newTxRef = doc(txCol);
        transaction.set(newTxRef, {
          finishGoodId: p.productId,
          type: 'OUT',
          category: p.category,
          quantity: p.quantity,
          remainingBalance: p.category === 'DISPATCH' ? newClosingBalance : newNonMovingBalance,
          performedBy: user,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: user,
          updatedBy: user,
          isArchived: false,
          ...logistics,
          referenceNo: logistics.invoiceNo,
        });
      }
    });

    await logActivity({
      user,
      action: 'Finish Goods Bulk Outward',
      entity: 'finishGoods',
      referenceId: logistics.invoiceNo || 'BULK_OUT',
      timestamp: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error(`Error executing Finish Goods Outward:`, error);
    throw error;
  }
};

export const markFreightReceived = async (invoiceNo: string, user: string) => {
  try {
    const q = query(
      collection(db, 'finishGoodTransactions'),
      where('invoiceNo', '==', invoiceNo),
      where('type', '==', 'OUT')
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    
    const batch = writeBatch(db);
    const timestamp = serverTimestamp();
    
    snap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, {
        receivingStatus: 'RECEIVED',
        receivingConfirmedAt: timestamp,
        receivingConfirmedBy: user,
        updatedAt: timestamp,
        updatedBy: user
      });
    });

    await batch.commit();

    await logActivity({
      user,
      action: 'Mark Freight Received',
      entity: 'finishGoodTransactions',
      referenceId: invoiceNo,
      timestamp
    });

    return true;
  } catch (error) {
    console.error('Error marking freight as received:', error);
    throw error;
  }
};

export const deleteFinishGoodTransaction = async (transactionId: string, finishGoodId: string, type: 'IN' | 'OUT', category: string, quantity: number, user: string) => {
  try {
    await runTransaction(db, async (transaction) => {
      const fgRef = doc(db, 'finishGoods', finishGoodId);
      const txRef = doc(db, 'finishGoodTransactions', transactionId);

      const fgSnap = await transaction.get(fgRef);
      if (!fgSnap.exists()) throw new Error('Finish Good not found');
      
      const fgData = fgSnap.data();
      const isRegular = category === 'REGULAR' || category === 'DISPATCH';
      
      let closingBalance = Number(fgData.closingBalance) || 0;
      let nonMovingBalance = Number(fgData.nonMovingBalance) || 0;
      let inQty = Number(fgData.inQty) || 0;
      let outQty = Number(fgData.outQty) || 0;

      if (type === 'IN') {
        inQty -= quantity;
        if (isRegular) closingBalance -= quantity;
        else nonMovingBalance -= quantity;
      } else if (type === 'OUT') {
        outQty -= quantity;
        if (isRegular) closingBalance += quantity;
        else nonMovingBalance += quantity;
      }

      transaction.update(fgRef, {
        inQty,
        outQty,
        closingBalance,
        nonMovingBalance,
        updatedAt: serverTimestamp(),
        updatedBy: user
      });

      transaction.delete(txRef);
    });
    
    await logActivity({ user, action: 'Delete Finish Good Transaction', entity: 'finishGoodTransactions', referenceId: transactionId, timestamp: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Error deleting FG transaction:', error);
    throw error;
  }
};

export const deleteReelTransaction = async (transactionId: string, reelId: string, type: 'INWARD' | 'OUTWARD', quantity: number, user: string) => {
  try {
    await runTransaction(db, async (transaction) => {
      const reelRef = doc(db, 'reels', reelId);
      const txRef = doc(db, 'reelTransactions', transactionId);

      const reelSnap = await transaction.get(reelRef);
      if (!reelSnap.exists()) throw new Error('Reel not found');
      
      let currentBalance = Number(reelSnap.data().currentBalance) || 0;

      if (type === 'OUTWARD') {
        currentBalance += quantity; // Reverse outward
      } else if (type === 'INWARD') {
        currentBalance -= quantity; // Reverse inward
      }

      transaction.update(reelRef, {
        currentBalance,
        updatedAt: serverTimestamp(),
        updatedBy: user
      });

      transaction.delete(txRef);
    });
    
    await logActivity({ user, action: 'Delete Reel Transaction', entity: 'reelTransactions', referenceId: transactionId, timestamp: serverTimestamp() });
    return true;
  } catch (error) {
    console.error('Error deleting Reel transaction:', error);
    throw error;
  }
};
