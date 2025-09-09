import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api/v1';

// Create a dedicated axios instance for super admin
const superAdminAxios = axios.create({
  baseURL: `${API_BASE_URL}/super-admin`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
superAdminAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('superAdminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
superAdminAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('superAdminToken');
      window.location.href = '/super-admin/login';
    }
    return Promise.reject(error);
  }
);

export const superAdminService = {
  // Auth
  async login(email, password) {
    try {
      const response = await superAdminAxios.post('/auth/login', {
        email,
        password
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async verifySession() {
    try {
      const response = await superAdminAxios.get('/auth/verify');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Dashboard
  async getDashboardStats() {
    try {
      const response = await superAdminAxios.get('/dashboard/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async getRecentActivity(limit = 20) {
    try {
      const response = await superAdminAxios.get('/dashboard/activity', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async getGrowthMetrics(period = 30) {
    try {
      const response = await superAdminAxios.get('/dashboard/growth', {
        params: { period }
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Tenants
  async getTenants(params = {}) {
    try {
      const response = await superAdminAxios.get('/tenants', { params });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async getTenantDetails(tenantId) {
    try {
      const response = await superAdminAxios.get(`/tenants/${tenantId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async updateTenantPricing(tenantId, pricing) {
    try {
      const response = await superAdminAxios.put(
        `/tenants/${tenantId}/pricing`,
        pricing
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async updateTenantPlan(tenantId, planData) {
    try {
      const response = await superAdminAxios.put(
        `/tenants/${tenantId}/plan`,
        planData
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async updateTenantStatus(tenantId, status) {
    try {
      const response = await superAdminAxios.put(
        `/tenants/${tenantId}/status`,
        status
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async getTenantStats(tenantId, period = 30) {
    try {
      const response = await superAdminAxios.get(
        `/tenants/${tenantId}/stats`,
        { params: { period } }
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async sendMessageToTenant(tenantId, message) {
    try {
      const response = await superAdminAxios.post(
        `/tenants/${tenantId}/send-message`,
        message
      );
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Global Settings
  async getGlobalPricingSettings() {
    try {
      const response = await superAdminAxios.get('/settings/pricing');
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async updateGlobalPricingSettings(settings) {
    try {
      const response = await superAdminAxios.put('/settings/pricing', settings);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // Export
  async exportTenantData() {
    try {
      const response = await superAdminAxios.get('/export/tenants', {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tenants-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return { success: true };
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  async exportAnalytics(startDate, endDate) {
    try {
      const response = await superAdminAxios.get('/export/analytics', {
        params: { startDate, endDate },
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'analytics-export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return { success: true };
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};