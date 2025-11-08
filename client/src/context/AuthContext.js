import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// Configure axios to send cookies with requests
axios.defaults.withCredentials = true;
console.log('⚙️  [AuthContext] axios.defaults.withCredentials =', axios.defaults.withCredentials);

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
    console.log('🔄 [AuthContext] useEffect: Checking initial auth state');
    checkAuth();
  }, []);

  useEffect(() => {
    console.log('🔄 [AuthContext] User state changed:', user);
  }, [user]);

  const checkAuth = async () => {
    try {
      console.log('🔍 [AuthContext] checkAuth() called');
      const response = await axios.get('/api/auth/check');
      console.log('📡 [AuthContext] /api/auth/check response:', response.data);
      console.log('  - response.status:', response.status);
      console.log('  - response.data.success:', response.data.success);
      console.log('  - response.data.data:', response.data.data);
      console.log('  - response.data.data?.authenticated:', response.data.data?.authenticated);

      // Consume standardized envelope format: { success, data: {...}, _meta }
      if (response.data.success && response.data.data) {
        const userData = response.data.data;

        // Map userType field from both 'userType' and 'role' for compatibility
        if (userData && !userData.userType && userData.role) {
          userData.userType = userData.role;
        }

        console.log('✅ [AuthContext] Auth check passed, setting user state to:', userData);
        setUser(userData);
        console.log('✅ [AuthContext] setUser() called');
      } else {
        console.warn('⚠️  [AuthContext] Auth check failed - condition not met');
        console.warn('  - success:', response.data.success);
        console.warn('  - data:', response.data.data);
        console.warn('  - authenticated:', response.data.data?.authenticated);
        // Clear user state if not authenticated
        setUser(null);
      }
    } catch (error) {
      console.error('❌ [AuthContext] Auth check error:', error);
      console.error('  - error.response?.status:', error.response?.status);
      console.error('  - error.response?.data:', error.response?.data);
      console.error('  - error.message:', error.message);
      // Clear user state on error
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials, isClient = false) => {
    console.log('🔐 [AuthContext] login() called');
    console.log('  - isClient:', isClient);
    console.log('  - credentials:', { ...credentials, password: '***' });

    const endpoint = isClient ? '/api/auth/login/client' : '/api/auth/login/user';
    console.log('📡 [AuthContext] Calling endpoint:', endpoint);

    const response = await axios.post(endpoint, credentials);
    console.log('✅ [AuthContext] Login response:', response.data);
    console.log('  - status:', response.status);

    // Extract user data from login response (could be "user", "client", or in "data" field)
    let userData = null;
    if (response.data.user) {
      userData = {
        ...response.data.user,
        authenticated: true,
        userType: response.data.user.role || 'user'
      };
    } else if (response.data.client) {
      userData = {
        ...response.data.client,
        authenticated: true,
        userType: 'client'
      };
    } else if (response.data.data) {
      userData = response.data.data;
    }

    if (userData && response.data.success) {
      console.log('✅ [AuthContext] Setting user state from login response:', userData);
      setUser(userData);
      console.log('✅ [AuthContext] User state set successfully');
    }

    console.log('🔍 [AuthContext] Calling checkAuth() for verification...');
    await checkAuth();
    console.log('✅ [AuthContext] checkAuth() completed');

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
