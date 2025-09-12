const mongoose = require('mongoose');
require('dotenv').config();

async function checkProcess() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Process = require('./src/models/Process');
  
  const proc = await Process.findById('68c2b9af931ec7fb6faf8722');
  if (proc) {
    console.log('Process Status:', proc.status);
    console.log('Progress:', proc.progress);
    console.log('Video Path:', proc.videoPath);
    console.log('S3 Video Key:', proc.s3VideoKey);
    console.log('Has Transcript:', !!proc.transcript);
    console.log('Processing Errors:', proc.processingErrors.length);
    if (proc.processingErrors.length > 0) {
      console.log('Last Error:', proc.processingErrors[proc.processingErrors.length - 1]);
    }
    
    // Check processing history
    if (proc.processingHistory && proc.processingHistory.length > 0) {
      console.log('\nProcessing History:');
      proc.processingHistory.forEach((h, i) => {
        console.log(`${i + 1}. Step: ${h.step}, Status: ${h.status}, Time: ${h.timestamp}`);
        if (h.error) console.log('   Error:', h.error);
      });
    }
  } else {
    console.log('Process not found');
  }
  
  await mongoose.disconnect();
}

checkProcess().catch(console.error);