#!/usr/bin/env node

// Clear all related modules from cache
Object.keys(require.cache).forEach(key => {
  if (key.includes('/models/')) {
    delete require.cache[key];
  }
});

// Now load fresh
const mongoose = require('mongoose');
const Process = require('./src/models/Process');

console.log('\n🔍 Debugging Schema Structure...\n');

// Check top-level paths
console.log('Top-level schema paths:');
Process.schema.eachPath((pathname, schematype) => {
  if (!pathname.startsWith('_') && pathname !== '__v') {
    console.log(`  - ${pathname}`);
  }
});

// Check files structure
console.log('\n📁 Files structure:');
const filesPath = Process.schema.path('files');
if (filesPath && filesPath.schema) {
  filesPath.schema.eachPath((pathname, schematype) => {
    if (pathname !== '_id') {
      console.log(`  - files.${pathname}`);
    }
  });
}

// Check if pendingVideoResult exists
console.log('\n🎯 Checking pendingVideoResult:');
const pendingPath = Process.schema.path('pendingVideoResult');
console.log(`  Direct path check: ${pendingPath ? 'EXISTS' : 'MISSING'}`);

// Try to find it in the tree
Process.schema.eachPath((pathname) => {
  if (pathname.includes('pendingVideoResult')) {
    console.log(`  Found in tree: ${pathname}`);
  }
});

// Check the raw schema object
console.log('\n📊 Raw schema obj keys (first 20):');
const schemaObj = Process.schema.obj;
Object.keys(schemaObj).slice(0, 20).forEach(key => {
  console.log(`  - ${key}`);
});

console.log('\n✅ Debug complete!\n');
process.exit(0);