import axios from 'axios';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds timeout for most requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth token management
let accessToken = null;
let refreshToken = null;

export const setTokens = (access, refresh) => {
  accessToken = access;
  refreshToken = refresh;
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh with enhanced error logging
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Enhanced error logging for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('🔍 API Error Details:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.config?.headers,
        message: error.message
      });
    }

    // If error is 401 and we have a refresh token, try to refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      refreshToken &&
      !originalRequest.url.includes('/auth/')
    ) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken } = response.data.data;
        setTokens(newAccessToken, refreshToken);

        // Retry the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        if (process.env.NODE_ENV === 'development') {
          console.error('🔍 Token refresh failed:', refreshError);
        }
        // Refresh failed, redirect to login
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { tokens } = response.data.data;
    setTokens(tokens.accessToken, tokens.refreshToken);
    return response;
  },

  // New two-step registration process
  register: async (userData) => {
    // First step: Start registration (sends verification email)
    const response = await api.post('/auth/register', userData);
    // No tokens yet - user needs to verify email first
    return response;
  },

  verifyRegistration: async (email, code) => {
    const response = await api.post('/auth/verify-registration', { email, code });
    if (response.data.success && response.data.data.tokens) {
      const { tokens } = response.data.data;
      setTokens(tokens.accessToken, tokens.refreshToken);
    }
    return response;
  },

  resendVerificationCode: async (email) => {
    return await api.post('/auth/resend-code', { email });
  },

  checkTenant: async (email) => {
    return await api.post('/auth/check-tenant', { email });
  },

  checkSubdomain: async (subdomain) => {
    return await api.post('/auth/check-subdomain', { subdomain });
  },

  logout: async (refreshTokenValue) => {
    const response = await api.post('/auth/logout', {
      refreshToken: refreshTokenValue,
    });
    clearTokens();
    return response;
  },

  refresh: async (refreshTokenValue) => {
    return await api.post('/auth/refresh', {
      refreshToken: refreshTokenValue,
    });
  },

  forgotPassword: async (email) => {
    return await api.post('/auth/forgot-password', { email });
  },

  resetPassword: async (token, password) => {
    return await api.post('/auth/reset-password', { token, password });
  },

  getProfile: async () => {
    return await api.get('/auth/me');
  },

  updateProfile: async (updates) => {
    return await api.put('/auth/profile', updates);
  },

  changePassword: async (currentPassword, newPassword) => {
    return await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  },
};

// Process API endpoints
export const processAPI = {
  getProcesses: async (tenantId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/tenants/${tenantId}/processes?${queryString}`);
  },

  getProcess: async (tenantId, processId) => {
    return await api.get(`/tenants/${tenantId}/processes/${processId}`);
  },

  createProcess: async (tenantId, formData, onUploadProgress, cancelTokenSource) => {
    // Handle both cancelToken and custom cancel wrapper
    const cancelToken = cancelTokenSource?.cancelToken?.token || cancelTokenSource?.token;
    
    return await api.post(`/tenants/${tenantId}/processes`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
      timeout: 1800000, // 30 minutes for large file uploads (up to 2GB)
      cancelToken: cancelToken,
    });
  },

  updateProcess: async (tenantId, processId, updates) => {
    return await api.put(`/tenants/${tenantId}/processes/${processId}`, updates);
  },

  deleteProcess: async (tenantId, processId) => {
    return await api.delete(`/tenants/${tenantId}/processes/${processId}`);
  },

  getProcessStatus: async (tenantId, processId) => {
    return await api.get(`/tenants/${tenantId}/processes/${processId}/status`);
  },

  generateShareLink: async (tenantId, processId, expiresAt = null) => {
    return await api.post(`/tenants/${tenantId}/processes/${processId}/share`, {
      expiresAt,
    });
  },

  disableSharing: async (tenantId, processId) => {
    return await api.delete(`/tenants/${tenantId}/processes/${processId}/share`);
  },

  searchProcesses: async (tenantId, query, limit = 50) => {
    return await api.get(`/tenants/${tenantId}/processes/search`, {
      params: { q: query, limit },
    });
  },

  getTags: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/processes/tags`);
  },

  getGraphData: async (tenantId, mode = 'tags', threshold = 0.7) => {
    // Removed debug logging
    
    return await api.get(`/tenants/${tenantId}/processes/graph-data`, {
      params: { 
        mode, 
        threshold: threshold.toString() // Ensure threshold is sent as string
      }
    });
  },

  getVideoToken: async (tenantId, processId) => {
    return await api.get(`/tenants/${tenantId}/processes/${processId}/video-token`);
  },

  getVideoUrl: (tenantId, processId, token) => {
    return `${API_BASE_URL}/video/${tenantId}/${processId}?token=${token}`;
  },
};

// Favorite Lists API endpoints
export const favoriteListAPI = {
  getFavoriteLists: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/favorite-lists`);
  },

  getFavoriteList: async (tenantId, listId) => {
    return await api.get(`/tenants/${tenantId}/favorite-lists/${listId}`);
  },

  createFavoriteList: async (tenantId, listData) => {
    return await api.post(`/tenants/${tenantId}/favorite-lists`, listData);
  },

  updateFavoriteList: async (tenantId, listId, updates) => {
    return await api.put(`/tenants/${tenantId}/favorite-lists/${listId}`, updates);
  },

  deleteFavoriteList: async (tenantId, listId) => {
    return await api.delete(`/tenants/${tenantId}/favorite-lists/${listId}`);
  },

  getProcessesInList: async (tenantId, listId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/tenants/${tenantId}/favorite-lists/${listId}/processes?${queryString}`);
  },

  addProcessToList: async (tenantId, listId, processId) => {
    return await api.post(`/tenants/${tenantId}/favorite-lists/${listId}/processes`, { processId });
  },

  removeProcessFromList: async (tenantId, listId, processId) => {
    return await api.delete(`/tenants/${tenantId}/favorite-lists/${listId}/processes/${processId}`);
  },

  bulkAddProcesses: async (tenantId, listId, processIds) => {
    return await api.post(`/tenants/${tenantId}/favorite-lists/${listId}/processes/bulk`, { processIds });
  },

  getAvailableProcesses: async (tenantId, listId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/tenants/${tenantId}/favorite-lists/${listId}/available-processes?${queryString}`);
  },

  shareList: async (tenantId, listId, shareData) => {
    return await api.post(`/tenants/${tenantId}/favorite-lists/${listId}/share`, shareData);
  },

  removeUserFromList: async (tenantId, listId, userId) => {
    return await api.delete(`/tenants/${tenantId}/favorite-lists/${listId}/share/${userId}`);
  },

  validateAndCleanList: async (tenantId, listId) => {
    return await api.post(`/tenants/${tenantId}/favorite-lists/${listId}/validate`);
  },

  getListsContainingProcess: async (tenantId, processId) => {
    return await api.get(`/tenants/${tenantId}/processes/${processId}/favorite-lists`);
  },
};

// User API endpoints
export const userAPI = {
  getTenantUsers: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/users`);
  },

  checkEmailExists: async (tenantId, email) => {
    return await api.post(`/tenants/${tenantId}/users/check-email`, { email });
  },

  getUserByEmail: async (tenantId, email) => {
    return await api.get(`/tenants/${tenantId}/users/search`, { params: { email } });
  },
};

// Team API endpoints
export const teamAPI = {
  getTeamMembers: async (tenantId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/tenants/${tenantId}/team/members?${queryString}`);
  },

  getBillingStatus: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/team/billing-status`);
  },

  inviteUser: async (tenantId, inviteData) => {
    return await api.post(`/tenants/${tenantId}/team/invite`, inviteData);
  },

  getInvitations: async (tenantId, status = 'pending') => {
    return await api.get(`/tenants/${tenantId}/team/invitations`, { params: { status } });
  },

  cancelInvitation: async (tenantId, invitationId) => {
    return await api.delete(`/tenants/${tenantId}/team/invitations/${invitationId}`);
  },

  resendInvitation: async (tenantId, invitationId) => {
    return await api.post(`/tenants/${tenantId}/team/invitations/${invitationId}/resend`);
  },

  updateUserRole: async (tenantId, userId, role) => {
    return await api.put(`/tenants/${tenantId}/team/members/${userId}/role`, { role });
  },

  removeUser: async (tenantId, userId) => {
    return await api.delete(`/tenants/${tenantId}/team/members/${userId}`);
  },

  getInvitationDetails: async (token) => {
    return await api.get(`/auth/invitation/${token}`);
  },

  acceptInvitation: async (invitationData) => {
    return await api.post('/auth/accept-invitation', invitationData);
  },
};

// Limits API endpoints
export const limitsAPI = {
  getUserLimits: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/limits/user-limits`);
  },

  checkUpload: async (tenantId, fileSizeMB) => {
    return await api.post(`/tenants/${tenantId}/limits/check-upload`, { fileSizeMB });
  },
};

// Notification API endpoints
export const notificationAPI = {
  getNotifications: async (tenantId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return await api.get(`/tenants/${tenantId}/notifications?${queryString}`);
  },

  markAsRead: async (tenantId, notificationId) => {
    return await api.put(`/tenants/${tenantId}/notifications/${notificationId}/read`);
  },

  markAllAsRead: async (tenantId) => {
    return await api.put(`/tenants/${tenantId}/notifications/read-all`);
  },

  archiveNotification: async (tenantId, notificationId) => {
    return await api.put(`/tenants/${tenantId}/notifications/${notificationId}/archive`);
  },

  getPendingShares: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/notifications/pending-shares`);
  },

  getShareDetails: async (tenantId, shareId) => {
    return await api.get(`/tenants/${tenantId}/notifications/shares/${shareId}`);
  },

  acceptShare: async (tenantId, shareId) => {
    return await api.post(`/tenants/${tenantId}/notifications/shares/${shareId}/accept`);
  },

  rejectShare: async (tenantId, shareId) => {
    return await api.post(`/tenants/${tenantId}/notifications/shares/${shareId}/reject`);
  },
};

// Public API endpoints (no auth required)
export const publicAPI = {
  getSharedProcess: async (shareId) => {
    return await axios.get(`${API_BASE_URL}/public/processes/${shareId}`);
  },

  getSharedVideo: (shareId) => {
    return `${API_BASE_URL}/public/processes/${shareId}/video`;
  },

  getPublicStats: async () => {
    return await axios.get(`${API_BASE_URL}/public/stats`);
  },

  getRateLimitInfo: async () => {
    return await axios.get(`${API_BASE_URL}/public/rate-limit`);
  },
};

// File upload helper with cancellation support and chunking for large files
export const uploadFile = async (tenantId, file, onProgress, cancelTokenSource) => {
  console.log('🔍 uploadFile called with:', {
    tenantId,
    fileName: file.name,
    fileSize: file.size,
    fileSizeMB: (file.size / 1024 / 1024).toFixed(2) + 'MB',
    fileType: file.type,
    hasProgress: !!onProgress,
    hasCancelToken: !!cancelTokenSource
  });

  // Import ChunkedUploader
  const ChunkedUploader = (await import('../utils/ChunkedUploader')).default;

  // Use chunked upload for files over 500MB (temporarily increased to disable for most files)
  if (file.size > 500 * 1024 * 1024) {
    console.log('📦 Using CHUNKED upload for large file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
    
    const uploader = new ChunkedUploader({
      chunkSize: 5 * 1024 * 1024, // 5MB chunks
      maxRetries: 3,
      concurrentUploads: 1, // Changed from 3 to 1 as per our fix
      onProgress: onProgress,
      onStatusChange: (status) => {
        console.log('Upload status:', status);
      },
      axiosInstance: api // Use the configured axios instance with auth interceptors
    });

    // Initialize upload
    await uploader.init(file, tenantId);
    
    // Store uploader instance in the cancel wrapper
    if (cancelTokenSource && typeof cancelTokenSource === 'object') {
      cancelTokenSource.uploader = uploader;
    }

    // Start upload
    console.log('🚀 Starting chunked upload...');
    const result = await uploader.upload();
    
    console.log('📊 Chunked upload result:', result);
    
    if (result.success) {
      // Return in the expected format
      return {
        data: {
          success: true,
          data: {
            process: {
              id: result.processId,
              _id: result.processId,
              status: 'uploaded',
              originalFilename: file.name
            }
          }
        }
      };
    } else {
      throw new Error('Chunked upload failed');
    }
  }

  // Use regular upload for smaller files
  console.log('📤 Using REGULAR upload for file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2) + 'MB');
  
  const formData = new FormData();
  formData.append('video', file);

  console.log('📨 Sending to API endpoint:', `/tenants/${tenantId}/processes`);

  return await processAPI.createProcess(tenantId, formData, (progressEvent) => {
    if (onProgress && progressEvent.total) {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      onProgress(percentCompleted);
    }
  }, cancelTokenSource);
};

// WebSocket connection for real-time updates
export class ProcessWebSocket {
  constructor(tenantId, processId) {
    this.tenantId = tenantId;
    this.processId = processId;
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 20; // Increased from 5 for better reliability
    this.reconnectDelay = 1000;
  }

  connect() {
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/processes/${this.processId}/status`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('WebSocket connected');
        }
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('update', data);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Failed to parse WebSocket message:', error);
          }
        }
      };

      this.ws.onclose = (event) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('WebSocket disconnected', event.code, event.reason);
        }
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnect();
        }
      };

      this.ws.onerror = (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('WebSocket error:', error);
        }
        this.emit('error', error);
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to connect WebSocket:', error);
      }
      this.emit('error', error);
    }
  }

  reconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Reconnecting WebSocket (attempt ${this.reconnectAttempts})...`);
      }
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.error(`Error in WebSocket ${event} callback:`, error);
          }
        }
      });
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('WebSocket not connected, cannot send data');
      }
    }
  }
}

// Billing API endpoints
export const billingAPI = {
  // Pricing configuration
  getPricingConfig: async () => {
    return await api.get('/billing/pricing-config');
  },

  createCheckoutSession: async (tenantId) => {
    return await api.post(`/tenants/${tenantId}/billing/checkout-session`);
  },

  createPortalSession: async (tenantId) => {
    return await api.post(`/tenants/${tenantId}/billing/portal-session`);
  },

  getSubscriptionStatus: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/billing/subscription-status`);
  },
  
  getLicenseStatus: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/billing/license-status`);
  },
  
  purchaseLicenses: async (tenantId, quantity) => {
    return await api.post(`/tenants/${tenantId}/billing/purchase-licenses`, { quantity });
  },
  
  updateLicenses: async (tenantId, newLicenseCount) => {
    return await api.put(`/tenants/${tenantId}/billing/update-licenses`, { newLicenseCount });
  },
  
  getInvoices: async (tenantId) => {
    return await api.get(`/tenants/${tenantId}/billing/invoices`);
  },
  
  cancelProMembership: async (tenantId) => {
    return await api.post(`/tenants/${tenantId}/billing/downgrade-to-free`);
  },
  
  verifyUpgrade: async (tenantId) => {
    return await api.post(`/tenants/${tenantId}/billing/verify-upgrade`);
  },
};

// Export default api instance
export default api;