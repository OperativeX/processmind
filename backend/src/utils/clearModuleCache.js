const path = require('path');

/**
 * Recursively clear module cache for a module and its dependencies
 * @param {string} modulePath - Path to the module to clear
 */
function clearModuleCache(modulePath) {
  const resolvedPath = require.resolve(modulePath);
  const module = require.cache[resolvedPath];
  
  if (!module) return;
  
  // Clear children first (dependencies)
  module.children.forEach((child) => {
    // Only clear local modules, not node_modules
    if (!child.filename.includes('node_modules')) {
      delete require.cache[child.filename];
    }
  });
  
  // Clear the module itself
  delete require.cache[resolvedPath];
}

module.exports = clearModuleCache;