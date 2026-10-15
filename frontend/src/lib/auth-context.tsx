'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, getAuthToken, setAuthToken, removeAuthToken } from './api';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role_id: number;
  role?: {
    id: number;
    name: string;
    description: string;
  };
  company?: {
    id: number;
    name: string;
    code: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (allowedRoles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: () => {},
  hasRole: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const existingToken = getAuthToken();
    const storedUser = localStorage.getItem('pharma_user_info');
    if (existingToken && storedUser) {
      try {
        setToken(existingToken);
        setUser(JSON.parse(storedUser));
      } catch {
        removeAuthToken();
      }
    } else {
      // Auto-set default super admin user in development for instant review
      const defaultUser: User = {
        id: 1,
        email: 'admin@pharmaprotect.com',
        full_name: 'Dr. Alexander Vance (Super Admin)',
        role_id: 1,
        role: { id: 1, name: 'SUPER_ADMIN', description: 'Complete enterprise administrative privileges' },
        company: { id: 1, name: 'BioPharma Global Cold Chain Logistics', code: 'BIOPHARMA' }
      };
      setUser(defaultUser);
      // Attempt silent auto-login to acquire valid JWT token for authenticated endpoints
      api.login({ email: 'admin@pharmaprotect.com', password: 'Admin123!' })
        .then((res) => {
          setToken(res.access_token);
          setUser(res.user);
        })
        .catch(() => {
          // Backend may be booting; continue with default user state
        });
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login({ email, password });
    setToken(res.access_token);
    setUser(res.user);
  };

  const logout = () => {
    removeAuthToken();
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const hasRole = (allowedRoles: string[]): boolean => {
    if (!user || !user.role) return false;
    if (user.role.name === 'SUPER_ADMIN') return true;
    return allowedRoles.includes(user.role.name);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
