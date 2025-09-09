import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const UploadContext = createContext();

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within UploadProvider');
  }
  return context;
};

export const UploadProvider = ({ children }) => {
  const { user, tenant } = useAuth();
  
  // Generate unique storage key for each tenant/user combination
  const getStorageKey = () => {
    if (tenant?.id && user?.id) {
      return `uploadState_${tenant.id}_${user.id}`;
    }
    return null;
  };

  // Clean up old upload states from other users/tenants
  const cleanupOldStates = () => {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('uploadState_')) {
        // Remove all upload states except the current user's
        if (key !== getStorageKey()) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  };

  // Persistent upload state
  const [uploadState, setUploadState] = useState(() => {
    const storageKey = getStorageKey();
    if (storageKey) {
      // Clean up old states on initialization
      cleanupOldStates();
      
      // Try to restore from localStorage for current user
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsedState = JSON.parse(saved);
          // Validate that the process belongs to the current tenant
          if (parsedState.currentProcess && parsedState.currentProcess.tenantId !== tenant.id) {
            console.warn('Found upload state for different tenant, resetting...');
            return {
              isUploading: false,
              uploadProgress: 0,
              processingStatus: null,
              currentProcess: null,
              selectedFile: null,
              cancelTokenSource: null
            };
          }
          return parsedState;
        } catch (e) {
          console.error('Failed to parse saved upload state:', e);
        }
      }
    }
    return {
      isUploading: false,
      uploadProgress: 0,
      processingStatus: null,
      currentProcess: null,
      selectedFile: null,
      cancelTokenSource: null
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(uploadState));
    }
  }, [uploadState, tenant?.id, user?.id]);

  // Clean up when user/tenant changes
  useEffect(() => {
    if (user?.id && tenant?.id) {
      // Clean up old states when user logs in
      cleanupOldStates();
    } else {
      // Reset state when user logs out
      resetUploadState();
    }
  }, [user?.id, tenant?.id]);

  // Update functions
  const updateUploadProgress = (progress) => {
    setUploadState(prev => ({ ...prev, uploadProgress: progress }));
  };

  const setIsUploading = (isUploading) => {
    setUploadState(prev => ({ ...prev, isUploading }));
  };

  const setProcessingStatus = (status) => {
    setUploadState(prev => ({ ...prev, processingStatus: status }));
  };

  const setCurrentProcess = (process) => {
    setUploadState(prev => ({ ...prev, currentProcess: process }));
  };

  const setSelectedFile = (file) => {
    setUploadState(prev => ({ 
      ...prev, 
      selectedFile: file ? {
        name: file.name,
        size: file.size,
        type: file.type
      } : null 
    }));
  };

  const setCancelTokenSource = (tokenSource) => {
    setUploadState(prev => ({ ...prev, cancelTokenSource: tokenSource }));
  };

  const cancelUpload = () => {
    if (uploadState.cancelTokenSource) {
      uploadState.cancelTokenSource.cancel('Upload cancelled by user');
    }
    // Always reset the upload state completely when cancelling
    const resetState = {
      isUploading: false,
      uploadProgress: 0,
      processingStatus: null,
      currentProcess: null,
      selectedFile: null,
      cancelTokenSource: null
    };
    setUploadState(resetState);
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  };

  const resetUploadState = () => {
    const resetState = {
      isUploading: false,
      uploadProgress: 0,
      processingStatus: null,
      currentProcess: null,
      selectedFile: null,
      cancelTokenSource: null
    };
    setUploadState(resetState);
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  };
  
  // Clean up all upload states for current user
  const clearAllUploadStates = () => {
    resetUploadState();
    cleanupOldStates();
  };

  const value = {
    ...uploadState,
    updateUploadProgress,
    setIsUploading,
    setProcessingStatus,
    setCurrentProcess,
    setSelectedFile,
    setCancelTokenSource,
    cancelUpload,
    resetUploadState,
    clearAllUploadStates
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};