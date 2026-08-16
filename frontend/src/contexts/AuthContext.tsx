import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppUser } from '../lib/auth/users';

import { deleteSession, listenToSession, updateSessionActivity } from '../lib/supabase/userSessionService';

interface AuthContextType {
  user: AppUser | null;
  sessionId: string | null;
  login: (user: AppUser, sessionId: string) => void;
  logout: () => void;
  isLoading: boolean;
  hasRole: (role: 'ADMIN' | 'LIMITED') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session on load
    const storedUser = localStorage.getItem('packwell_user');
    const storedSessionId = localStorage.getItem('packwell_session_id');
    
    if (storedUser && storedSessionId) {
      try {
        setUser(JSON.parse(storedUser));
        setSessionId(storedSessionId);
      } catch (e) {
        console.error('Failed to restore session');
        localStorage.removeItem('packwell_user');
        localStorage.removeItem('packwell_session_id');
      }
    }
    setIsLoading(false);
  }, []);

  // Realtime Session Listener
  useEffect(() => {
    if (sessionId && user) {
      const unsubscribe = listenToSession(sessionId, () => {
        // Session was deleted remotely
        logoutLocally();
      });
      return () => unsubscribe();
    }
  }, [sessionId, user]);

  // Idle Timer Auto-Logout
  useEffect(() => {
    if (!user) return;
    
    let throttleTimer: any = null;
    
    const updateActivity = () => {
      if (throttleTimer) return;
      
      localStorage.setItem('packwell_last_active', Date.now().toString());
      
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 60000); // Throttle activity updates to max once per minute locally
    };
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, updateActivity, true));
    
    // Check every minute if 60 mins have passed
    const interval = setInterval(() => {
      const lastActive = parseInt(localStorage.getItem('packwell_last_active') || '0', 10);
      const isIdle = Date.now() - lastActive > 60 * 60 * 1000; // 60 minutes
      
      if (isIdle) {
        logout(); // Logs out on server and locally
      } else if (sessionId) {
        // Keep session alive on server
        updateSessionActivity(sessionId);
      }
    }, 60000);
    
    updateActivity(); // initial
    
    return () => {
      events.forEach(event => document.removeEventListener(event, updateActivity, true));
      clearInterval(interval);
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [user, sessionId]);

  const login = (newUser: AppUser, newSessionId: string) => {
    localStorage.setItem('packwell_user', JSON.stringify(newUser));
    localStorage.setItem('packwell_session_id', newSessionId);
    localStorage.setItem('packwell_last_active', Date.now().toString());
    setUser(newUser);
    setSessionId(newSessionId);
  };

  const logoutLocally = () => {
    localStorage.removeItem('packwell_user');
    localStorage.removeItem('packwell_session_id');
    localStorage.removeItem('packwell_last_active');
    setUser(null);
    setSessionId(null);
  };

  const logout = async () => {
    if (sessionId) {
      await deleteSession(sessionId);
    }
    logoutLocally();
  };

  const hasRole = (role: 'ADMIN' | 'LIMITED') => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{ user, sessionId, login, logout, isLoading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
