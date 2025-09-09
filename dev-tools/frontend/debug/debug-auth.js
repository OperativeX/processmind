// Debug authentication storage
console.log('🔍 AUTH DEBUG - Checking localStorage:');
console.log('=====================================');

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'process_mind_access_token',
  REFRESH_TOKEN: 'process_mind_refresh_token',
  USER: 'process_mind_user',
  TENANT: 'process_mind_tenant',
  EXPIRES_IN: 'process_mind_expires_in',
};

Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
  const value = localStorage.getItem(storageKey);
  console.log(`${key}:`, value ? value.substring(0, 50) + '...' : 'null');
});

console.log('\n🧹 Clearing localStorage...');
Object.values(STORAGE_KEYS).forEach(key => {
  localStorage.removeItem(key);
});

console.log('✅ localStorage cleared. Refresh the page to test login.');