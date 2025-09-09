import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { authAPI, setTokens, clearTokens } from '../services/api';

// Auth context
const AuthContext = createContext();

// Action types
const AUTH_ACTIONS = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  REGISTER_START: 'REGISTER_START',
  REGISTER_SUCCESS: 'REGISTER_SUCCESS',
  REGISTER_FAILURE: 'REGISTER_FAILURE',
  REFRESH_TOKEN: 'REFRESH_TOKEN',
  UPDATE_PROFILE: 'UPDATE_PROFILE',
  SET_LOADING: 'SET_LOADING',
  CLEAR_ERROR: 'CLEAR_ERROR',
};

// Initial state
const initialState = {
  user: null,
  tenant: null,
  tokens: {
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
  },
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Auth reducer
const authReducer = (state, action) => {

  let newState;
  switch (action.type) {
    case AUTH_ACTIONS.LOGIN_START:
    case AUTH_ACTIONS.REGISTER_START:
      newState = {
        ...state,
        isLoading: true,
        error: null,
      };
      break;

    case AUTH_ACTIONS.LOGIN_SUCCESS:
    case AUTH_ACTIONS.REGISTER_SUCCESS:
      newState = {
        ...state,
        user: action.payload.user,
        tenant: action.payload.tenant,
        tokens: action.payload.tokens,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
      break;

    case AUTH_ACTIONS.LOGIN_FAILURE:
    case AUTH_ACTIONS.REGISTER_FAILURE:
      newState = {
        ...state,
        user: null,
        tenant: null,
        tokens: {
          accessToken: null,
          refreshToken: null,
          expiresIn: null,
        },
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
      break;

    case AUTH_ACTIONS.LOGOUT:
      newState = {
        ...state,
        user: null,
        tenant: null,
        tokens: {
          accessToken: null,
          refreshToken: null,
          expiresIn: null,
        },
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
      break;

    case AUTH_ACTIONS.REFRESH_TOKEN:
      newState = {
        ...state,
        tokens: {
          ...state.tokens,
          accessToken: action.payload.accessToken,
          expiresIn: action.payload.expiresIn,
        },
      };
      break;

    case AUTH_ACTIONS.UPDATE_PROFILE:
      newState = {
        ...state,
        user: {
          ...state.user,
          ...action.payload,
        },
      };
      break;

    case AUTH_ACTIONS.SET_LOADING:
      newState = {
        ...state,
        isLoading: action.payload,
      };
      break;

    case AUTH_ACTIONS.CLEAR_ERROR:
      newState = {
        ...state,
        error: null,
      };
      break;

    default:
      newState = state;
  }

  return newState;
};

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'process_mind_access_token',
  REFRESH_TOKEN: 'process_mind_refresh_token',
  USER: 'process_mind_user',
  TENANT: 'process_mind_tenant',
  EXPIRES_IN: 'process_mind_expires_in',
};

// Helper functions
const saveToStorage = (user, tenant, tokens) => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.TENANT, JSON.stringify(tenant));
    localStorage.setItem(STORAGE_KEYS.EXPIRES_IN, tokens.expiresIn);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to save auth data to storage:', error);
    }
  }
};

const loadFromStorage = () => {
  try {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const tenantStr = localStorage.getItem(STORAGE_KEYS.TENANT);
    const expiresIn = localStorage.getItem(STORAGE_KEYS.EXPIRES_IN);

    if (!accessToken || !refreshToken || !userStr || !tenantStr) {
      return null;
    }

    // Basic token validation - check if refresh token is expired
    try {
      if (refreshToken) {
        // Decode JWT without verification to check expiry
        const tokenParts = refreshToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            clearStorage();
            return null;
          }
          // Also validate that token contains required fields
          if (!payload.userId || !payload.tenantId) {
            clearStorage();
            return null;
          }
        } else {
          clearStorage();
          return null;
        }
      }
    } catch (tokenError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Invalid token format, clearing storage:', tokenError);
      }
      clearStorage();
      return null;
    }

    const user = JSON.parse(userStr);
    const tenant = JSON.parse(tenantStr);

    return {
      user,
      tenant,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn,
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to load auth data from storage:', error);
    }
    // Clear corrupted data
    clearStorage();
    return null;
  }
};

const clearStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to clear auth data from storage:', error);
    }
  }
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  // const { showNotification } = useNotification();

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });

      const storedAuth = loadFromStorage();
      
      if (storedAuth) {
        
        // Set tokens in API service before attempting refresh
        setTokens(storedAuth.tokens.accessToken, storedAuth.tokens.refreshToken);
        
        // Verify token validity by trying to refresh
        try {
          const response = await authAPI.refresh(storedAuth.tokens.refreshToken);
          
          const newTokens = {
            ...storedAuth.tokens,
            accessToken: response.data.data.accessToken,
            expiresIn: response.data.data.expiresIn,
          };

          // Sync tokens with API service
          setTokens(newTokens.accessToken, newTokens.refreshToken);

          // CRITICAL FIX: Verify user profile to ensure the user/tenant is still valid
          try {
            const profileResponse = await authAPI.getProfile();
            
            const updatedUser = profileResponse.data.data.user;
            const updatedTenant = profileResponse.data.data.tenant;

            dispatch({
              type: AUTH_ACTIONS.LOGIN_SUCCESS,
              payload: {
                user: updatedUser,
                tenant: updatedTenant,
                tokens: newTokens,
              },
            });

            // Update storage with new tokens and verified user data
            saveToStorage(updatedUser, updatedTenant, newTokens);
          } catch (profileError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Profile verification failed:', profileError);
            }
            // Profile verification failed, clear everything and logout
            clearStorage();
            clearTokens();
            dispatch({ type: AUTH_ACTIONS.LOGOUT });
            dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Token refresh failed:', error);
          }
          // Token refresh failed, clear storage and stay logged out
          clearStorage();
          clearTokens(); // Clear API service tokens too
          dispatch({ type: AUTH_ACTIONS.LOGOUT });
          dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        }
      } else {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = useCallback(async (email, password) => {
    dispatch({ type: AUTH_ACTIONS.LOGIN_START });

    try {
      const response = await authAPI.login(email, password);
      
      const { user, tenant, tokens } = response.data.data;

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { user, tenant, tokens },
      });

      saveToStorage(user, tenant, tokens);
      // Sync tokens with API service (authAPI.login already sets them, but ensure sync)
      setTokens(tokens.accessToken, tokens.refreshToken);

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed';
      if (process.env.NODE_ENV === 'development') {
        console.error('Login failed:', error);
      }
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_FAILURE,
        payload: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }, []);

  // Register function - First step of two-step registration
  const register = useCallback(async (userData) => {
    dispatch({ type: AUTH_ACTIONS.REGISTER_START });

    try {
      const response = await authAPI.register(userData);
      
      // First step doesn't return tokens, just success confirmation
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      
      return { 
        success: true, 
        email: userData.email,
        message: response.data.message 
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed';
      
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  }, []);

  // Verify registration - Second step of two-step registration
  const verifyRegistration = useCallback(async (email, code) => {
    dispatch({ type: AUTH_ACTIONS.REGISTER_START });

    try {
      const response = await authAPI.verifyRegistration(email, code);
      const { user, tenant, tokens } = response.data.data;

      dispatch({
        type: AUTH_ACTIONS.REGISTER_SUCCESS,
        payload: { user, tenant, tokens },
      });

      saveToStorage(user, tenant, tokens);
      // showNotification('Registration successful', 'success');

      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Invalid verification code';
      
      dispatch({
        type: AUTH_ACTIONS.REGISTER_FAILURE,
        payload: errorMessage,
      });

      // showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  }, []);

  // Force refresh user data
  const refreshUserData = useCallback(async () => {
    if (!state.isAuthenticated || !state.tokens?.accessToken) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Cannot refresh - user not authenticated');
      }
      return false;
    }

    try {
      const profileResponse = await authAPI.getProfile();
      const updatedUser = profileResponse.data.data.user;
      const updatedTenant = profileResponse.data.data.tenant;

      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: {
          user: updatedUser,
          tenant: updatedTenant,
          tokens: state.tokens,
        },
      });

      saveToStorage(updatedUser, updatedTenant, state.tokens);
      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to refresh user data:', error);
      }
      return false;
    }
  }, [state.isAuthenticated, state.tokens]);

  // Logout function
  const logout = useCallback(async () => {
    try {
      if (state.tokens?.refreshToken) {
        await authAPI.logout(state.tokens.refreshToken);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Logout API call failed:', error);
      }
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      clearStorage();
      clearTokens(); // Clear API service tokens
      // showNotification('Logged out successfully', 'info');
    }
  }, [state.tokens?.refreshToken]);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    if (!state.tokens?.refreshToken) {
      return false;
    }

    try {
      const response = await authAPI.refresh(state.tokens.refreshToken);
      
      dispatch({
        type: AUTH_ACTIONS.REFRESH_TOKEN,
        payload: {
          accessToken: response.data.data.accessToken,
          expiresIn: response.data.data.expiresIn,
        },
      });

      // Update storage
      saveToStorage(state.user, state.tenant, {
        ...state.tokens,
        accessToken: response.data.data.accessToken,
        expiresIn: response.data.data.expiresIn,
      });

      return true;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Token refresh failed:', error);
      }
      logout();
      return false;
    }
  }, [state.tokens?.refreshToken, state.user, state.tenant, logout]);

  // Update profile function
  const updateProfile = useCallback(async (updates) => {
    try {
      const response = await authAPI.updateProfile(updates);
      
      dispatch({
        type: AUTH_ACTIONS.UPDATE_PROFILE,
        payload: response.data.user,
      });

      // Update storage
      const updatedUser = { ...state.user, ...response.data.user };
      saveToStorage(updatedUser, state.tenant, state.tokens);

      // showNotification('Profile updated successfully', 'success');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      // showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  }, [state.user, state.tenant, state.tokens]);

  // Change password function
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      
      // Force logout after password change for security
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      clearStorage();
      
      // showNotification('Password changed successfully. Please login again.', 'success');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to change password';
      // showNotification(errorMessage, 'error');
      return { success: false, error: errorMessage };
    }
  }, []);

  // Accept invitation function
  const acceptInvitation = useCallback((user, tenant, tokens) => {
    // Update auth state
    dispatch({
      type: AUTH_ACTIONS.LOGIN_SUCCESS,
      payload: { user, tenant, tokens },
    });

    // Save to storage
    saveToStorage(user, tenant, tokens);
    
    // Sync tokens with API service
    setTokens(tokens.accessToken, tokens.refreshToken);
  }, []);

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  }, []);

  // Context value
  const value = {
    ...state,
    login,
    register,
    verifyRegistration,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    acceptInvitation,
    clearError,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};