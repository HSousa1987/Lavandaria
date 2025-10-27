import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Configure axios to send cookies with requests
axios.defaults.withCredentials = true;

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/check');
      // Consume standardized envelope format: { success, data: {...}, _meta }
      if (response.data.success && response.data.data?.authenticated) {
        setUser(response.data.data);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials, isClient = false) => {
    const endpoint = isClient ? '/api/auth/login/client' : '/api/auth/login/user';
    const response = await axios.post(endpoint, credentials);
    await checkAuth();
    return response.data;
  };

  const logout = async () => {
    try {
      const response = await axios.post('/api/auth/logout');
      // Verify standardized envelope response
      if (response.data.success) {
        setUser(null);
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Still clear user state on error to avoid stuck sessions
      setUser(null);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    const response = await axios.post('/api/auth/change-password', {
      currentPassword,
      newPassword
    });
    await checkAuth();
    return response.data;
  };

  const value = {
    user,
    loading,
    login,
    logout,
    changePassword,
    isAuthenticated: !!user,
    isMaster: user?.userType === 'master',
    isAdmin: user?.userType === 'admin',
    isWorker: user?.userType === 'worker',
    isClient: user?.userType === 'client'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
