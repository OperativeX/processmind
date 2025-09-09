import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

// Create a public axios instance without auth interceptors
const publicApi = axios.create({
  baseURL: `${API_URL}/public`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Public API endpoints
export const publicService = {
  // Get shared process data
  getSharedProcess: async (shareId) => {
    try {
      const response = await publicApi.get(`/processes/${shareId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching shared process:', error);
      throw error;
    }
  },

  // Get shared process video URL
  getSharedVideoUrl: (shareId) => {
    return `${API_URL}/public/processes/${shareId}/video`;
  },

  // Get public statistics
  getPublicStats: async () => {
    try {
      const response = await publicApi.get('/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching public stats:', error);
      throw error;
    }
  },

  // Health check
  checkHealth: async () => {
    try {
      const response = await publicApi.get('/health');
      return response.data;
    } catch (error) {
      console.error('Error checking health:', error);
      throw error;
    }
  },
};

export default publicService;