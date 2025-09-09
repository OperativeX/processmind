/**
 * API Response Helper Functions
 * Provides consistent handling of API responses across the application
 */

/**
 * Safely extract data from API response
 * @param {Object} response - Axios response object
 * @param {string} dataPath - Path to data (e.g., 'data', 'data.data', 'data.process')
 * @returns {any} Extracted data or null
 */
export const extractResponseData = (response, dataPath = 'data') => {
  if (!response) return null;
  
  const paths = dataPath.split('.');
  let result = response;
  
  for (const path of paths) {
    if (result && typeof result === 'object' && path in result) {
      result = result[path];
    } else {
      console.warn(`API Response: Path "${dataPath}" not found in response`, response);
      return null;
    }
  }
  
  return result;
};

/**
 * Check if API response indicates success
 * @param {Object} response - Axios response object
 * @returns {boolean}
 */
export const isSuccessResponse = (response) => {
  if (!response || !response.data) return false;
  
  // Check for explicit success field
  if ('success' in response.data) {
    return response.data.success === true;
  }
  
  // Check for status code
  return response.status >= 200 && response.status < 300;
};

/**
 * Extract error message from response
 * @param {Object} error - Error object (axios error or regular error)
 * @returns {string} Human-readable error message
 */
export const extractErrorMessage = (error) => {
  // Check for axios response error
  if (error.response?.data) {
    const data = error.response.data;
    
    // Check common error message fields
    if (data.message) return data.message;
    if (data.error) return data.error;
    if (data.errors && Array.isArray(data.errors)) {
      return data.errors.join(', ');
    }
    if (typeof data === 'string') return data;
  }
  
  // Check for network errors
  if (error.message === 'Network Error') {
    return 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
  }
  
  // Check for timeout
  if (error.code === 'ECONNABORTED') {
    return 'Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.';
  }
  
  // Default error message
  return error.message || 'Ein unerwarteter Fehler ist aufgetreten';
};

/**
 * Safe array extraction with default
 * @param {any} data - Data that should be an array
 * @param {Array} defaultValue - Default value if data is not an array
 * @returns {Array}
 */
export const ensureArray = (data, defaultValue = []) => {
  if (Array.isArray(data)) return data;
  if (!data) return defaultValue;
  console.warn('Expected array but got:', typeof data, data);
  return defaultValue;
};

/**
 * Safe object extraction with default
 * @param {any} data - Data that should be an object
 * @param {Object} defaultValue - Default value if data is not an object
 * @returns {Object}
 */
export const ensureObject = (data, defaultValue = {}) => {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  if (!data) return defaultValue;
  console.warn('Expected object but got:', typeof data, data);
  return defaultValue;
};

/**
 * Create abort controller with timeout
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Object} { controller: AbortController, timeoutId: number }
 */
export const createAbortController = (timeout = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  return {
    controller,
    timeoutId,
    cleanup: () => {
      clearTimeout(timeoutId);
      controller.abort();
    }
  };
};

/**
 * Wrap API call with consistent error handling and abort support
 * @param {Function} apiCall - Async function that makes the API call
 * @param {Object} options - Options for the API call
 * @returns {Promise<Object>} { data, error, aborted }
 */
export const apiCallWrapper = async (apiCall, options = {}) => {
  const { timeout = 30000, signal } = options;
  
  let abortController = null;
  let timeoutId = null;
  
  try {
    // Create abort controller if not provided
    if (!signal && timeout) {
      const abort = createAbortController(timeout);
      abortController = abort.controller;
      timeoutId = abort.timeoutId;
      options.signal = abortController.signal;
    }
    
    const response = await apiCall(options);
    
    return {
      data: response,
      error: null,
      aborted: false
    };
  } catch (error) {
    // Check if request was aborted
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      return {
        data: null,
        error: 'Request aborted',
        aborted: true
      };
    }
    
    return {
      data: null,
      error: extractErrorMessage(error),
      aborted: false
    };
  } finally {
    // Cleanup
    if (timeoutId) clearTimeout(timeoutId);
  }
};