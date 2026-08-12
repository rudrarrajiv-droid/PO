import { collection, doc, getDocs, setDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './config';
import { logActivity } from './services';

export interface Employee {
  id?: string;
  employeeCode?: number; // Numeric code for sorting
  name: string;
  category: 'COMPANY' | 'WAGES';
  contractorName?: 'Dinesh' | 'Vikas';
  designation: string;
  basicSalary: number;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
}

export interface AttendanceRecord {
  id?: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  present: number; // 1, 0.5, 0
  otHours: number;
  refreshment: number; // e.g. 70
  perDayAmount: number; // Calculated based on month days
  otAmount: number; // Calculated based on month days and 8-hour shift
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const q = query(collection(db, 'employees'), where('isActive', '==', true));
    const snap = await getDocs(q);
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
    // Sort by employeeCode ascending (nulls last)
    return list.sort((a, b) => {
      const ca = a.employeeCode ?? 99999;
      const cb = b.employeeCode ?? 99999;
      return ca - cb;
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    throw error;
  }
};

export const createEmployee = async (employee: Omit<Employee, 'id'>, user: string): Promise<string> => {
  try {
    const newRef = doc(collection(db, 'employees'));
    const data = {
      ...employee,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user,
      updatedBy: user,
    };
    await setDoc(newRef, data);
    
    await logActivity({
      user,
      action: `Added Employee: ${employee.name}`,
      entity: 'employees',
      referenceId: newRef.id,
      timestamp: serverTimestamp()
    });

    return newRef.id;
  } catch (error) {
    console.error("Error creating employee:", error);
    throw error;
  }
};

export const deleteEmployee = async (employeeId: string, user: string): Promise<void> => {
  try {
    const empRef = doc(db, 'employees', employeeId);
    await setDoc(empRef, { isActive: false, updatedAt: serverTimestamp(), updatedBy: user }, { merge: true });
    await logActivity({ user, action: `Deleted Employee`, entity: 'employees', referenceId: employeeId, timestamp: serverTimestamp() });
  } catch (error) {
    console.error("Error deleting employee:", error);
    throw error;
  }
};

export const updateEmployee = async (employeeId: string, updates: Partial<Employee>, user: string): Promise<void> => {
  try {
    const empRef = doc(db, 'employees', employeeId);
    await setDoc(empRef, { ...updates, updatedAt: serverTimestamp(), updatedBy: user }, { merge: true });
    await logActivity({ user, action: `Updated Employee`, entity: 'employees', referenceId: employeeId, timestamp: serverTimestamp() });
  } catch (error) {
    console.error("Error updating employee:", error);
    throw error;
  }
};

export const getAttendanceByDate = async (date: string): Promise<AttendanceRecord[]> => {
  try {
    const q = query(collection(db, 'attendance'), where('date', '==', date));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
  } catch (error) {
    console.error(`Error fetching attendance for ${date}:`, error);
    throw error;
  }
};

export const getAttendanceByMonth = async (yearMonth: string): Promise<AttendanceRecord[]> => {
  try {
    const startStr = `${yearMonth}-01`;
    const year = parseInt(yearMonth.split('-')[0]);
    const month = parseInt(yearMonth.split('-')[1]);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonthStr = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

    const snap = await getDocs(collection(db, 'attendance'));
    const allAtt = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
    return allAtt.filter(a => a.date >= startStr && a.date < nextMonthStr);
  } catch (error) {
    console.error(`Error fetching attendance for month ${yearMonth}:`, error);
    throw error;
  }
};

export const getAttendanceByDateRange = async (startDate: string, endDate: string): Promise<AttendanceRecord[]> => {
  try {
    const snap = await getDocs(collection(db, 'attendance'));
    const allAtt = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
    return allAtt.filter(a => a.date >= startDate && a.date <= endDate);
  } catch (error) {
    console.error(`Error fetching attendance from ${startDate} to ${endDate}:`, error);
    throw error;
  }
};

export const saveDailyAttendance = async (
  date: string, 
  records: Omit<AttendanceRecord, 'id'>[], 
  user: string
) => {
  try {
    const batch = writeBatch(db);
    const month = date.substring(0, 7); // 'YYYY-MM'

    // First delete existing records for this date to support overwrites
    const existingSnap = await getDocs(query(collection(db, 'attendance'), where('date', '==', date)));
    existingSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Add new records
    records.forEach(record => {
      const newRef = doc(collection(db, 'attendance'));
      batch.set(newRef, {
        ...record,
        month,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: user
      });
    });

    await batch.commit();

    await logActivity({
      user,
      action: `Saved daily attendance for ${date}`,
      entity: 'attendance',
      referenceId: date,
      timestamp: serverTimestamp()
    });

    return true;
  } catch (error) {
    console.error("Error saving daily attendance:", error);
    throw error;
  }
};
