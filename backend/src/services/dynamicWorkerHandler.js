const logger = require('../utils/logger');
const { jobTypes } = require('../config/bullmq');

// This function will be called instead of the static handleAIAnalysisComplete
async function handleAIAnalysisCompleteDynamic(processDoc, job, result) {
  // Delete the module from cache to force reload
  const modulePath = require.resolve('./queueWorkers');
  delete require.cache[modulePath];
  
  // Re-require the module to get fresh code
  const { handleAIAnalysisComplete } = require('./queueWorkers');
  
  // Call the fresh function
  return handleAIAnalysisComplete(processDoc, job, result);
}

// Export the dynamic handler
module.exports = {
  handleAIAnalysisCompleteDynamic
};