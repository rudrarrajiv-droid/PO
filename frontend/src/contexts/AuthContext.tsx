import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AppUser } from '../lib/auth/users';

interface AuthContextType {
  user: AppUser | null;
  login: (user: AppUser) => void;
  logout: () => void;
  isLoading: boolean;
  hasRole: (role: 'ADMIN' | 'LIMITED') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session on load
    const storedUser = localStorage.getItem('packwell_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to restore session');
        localStorage.removeItem('packwell_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newUser: AppUser) => {
    localStorage.setItem('packwell_user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('packwell_user');
    setUser(null);
  };

  const hasRole = (role: 'ADMIN' | 'LIMITED') => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, hasRole }}>
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
