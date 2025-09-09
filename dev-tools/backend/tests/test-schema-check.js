#!/usr/bin/env node

const mongoose = require('mongoose');

// Clear module cache to force reload
delete require.cache[require.resolve('./src/models/Process.js')];

// Load model fresh
const Process = require('./src/models/Process');

// Check schema
console.log('\n🔍 Checking Process Schema...\n');

// Check pendingVideoResult
const pendingVideoResultPath = Process.schema.path('pendingVideoResult');
console.log(`✅ pendingVideoResult in schema: ${pendingVideoResultPath ? 'YES' : 'NO'}`);

if (pendingVideoResultPath) {
  console.log('   Schema type:', pendingVideoResultPath.instance);
  console.log('   Nested paths:');
  const nested = Process.schema.path('pendingVideoResult').schema;
  if (nested) {
    nested.eachPath((pathname, schematype) => {
      if (pathname !== '_id') {
        console.log(`     - ${pathname}: ${schematype.instance}`);
      }
    });
  }
}

// Check audio in files
const audioPath = Process.schema.path('files.audio');
console.log(`\n✅ files.audio in schema: ${audioPath ? 'YES' : 'NO'}`);

// Check transcriptSegments
const transcriptSegmentsPath = Process.schema.path('transcriptSegments');
console.log(`✅ transcriptSegments in schema: ${transcriptSegmentsPath ? 'YES' : 'NO'}`);

// Check status enum
const statusEnum = Process.schema.path('status').enumValues;
console.log('\n📋 Status enum values:');
statusEnum.forEach(status => {
  const isNew = ['video_compressing', 'finalizing'].includes(status);
  console.log(`   ${isNew ? '🆕' : '  '} ${status}`);
});

// Check if video_compressing is included
const hasVideoCompressing = statusEnum.includes('video_compressing');
console.log(`\n✅ video_compressing in status enum: ${hasVideoCompressing ? 'YES' : 'NO'}`);

// Check processingErrors enum
const errorStepEnum = Process.schema.path('processingErrors.0.step').enumValues;
console.log('\n📋 Error step enum values:');
console.log(`   Total: ${errorStepEnum.length} values`);
console.log(`   Includes video_compression_validation: ${errorStepEnum.includes('video_compression_validation') ? 'YES' : 'NO'}`);
console.log(`   Includes pipeline_progression: ${errorStepEnum.includes('pipeline_progression') ? 'YES' : 'NO'}`);

console.log('\n✅ Schema check complete!\n');

process.exit(0);