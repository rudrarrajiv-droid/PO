import { collection, doc, setDoc, deleteDoc, getDocs, query, where, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from './config';

export interface UserSession {
  id: string; // Session ID (uuid)
  userId: string;
  deviceInfo: string;
  loginTime: any; // Firestore timestamp or string
  lastActive: any;
}

const COLLECTION = 'user_sessions';

export const createSession = async (userId: string, sessionId: string, deviceInfo: string) => {
  const sessionRef = doc(db, COLLECTION, sessionId);
  const newSession = {
    id: sessionId,
    userId,
    deviceInfo,
    loginTime: serverTimestamp(),
    lastActive: serverTimestamp()
  };
  await setDoc(sessionRef, newSession);
};

export const deleteSession = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, COLLECTION, sessionId);
    await deleteDoc(sessionRef);
  } catch (error) {
    console.error("Error deleting session:", error);
  }
};

export const updateSessionActivity = async (sessionId: string) => {
  try {
    const sessionRef = doc(db, COLLECTION, sessionId);
    // Use setDoc with merge:true to update just lastActive
    await setDoc(sessionRef, { lastActive: serverTimestamp() }, { merge: true });
  } catch (error) {
    // Ignore errors for activity updates (might be deleted already)
  }
};

export const getActiveSessions = async (userId: string): Promise<UserSession[]> => {
  const q = query(collection(db, COLLECTION), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UserSession);
};

export const deleteAllOtherSessions = async (userId: string, currentSessionId: string) => {
  const sessions = await getActiveSessions(userId);
  const otherSessions = sessions.filter(s => s.id !== currentSessionId);
  
  const promises = otherSessions.map(session => deleteSession(session.id));
  await Promise.all(promises);
};

export const listenToSession = (sessionId: string, onDeleted: () => void) => {
  const sessionRef = doc(db, COLLECTION, sessionId);
  return onSnapshot(sessionRef, (docSnap) => {
    if (!docSnap.exists()) {
      onDeleted();
    }
  });
};
