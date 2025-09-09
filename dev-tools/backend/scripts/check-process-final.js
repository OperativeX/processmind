const mongoose = require('mongoose');
const Process = require('./src/models/Process');
require('dotenv').config();

async function checkProcessFinal(processId) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const processDoc = await Process.findById(processId);
    if (!processDoc) {
      console.error('❌ Process not found:', processId);
      return;
    }

    console.log('\n🤖 PROCESS FINAL RESULTS');
    console.log('========================');
    console.log(`📁 Process ID: ${processDoc._id}`);
    console.log(`📝 Title: ${processDoc.title || '❌ Not generated'}`);
    console.log(`📊 Status: ${processDoc.status}`);
    console.log(`⏱️  Progress: ${processDoc.progress?.percentage || 0}%`);
    console.log(`🔄 Current Step: ${processDoc.progress?.currentStep || 'N/A'}`);

    console.log('\n🏷️  TAGS:');
    if (processDoc.tags && processDoc.tags.length > 0) {
      processDoc.tags.forEach((tag, index) => {
        console.log(`  ${index + 1}. ${tag}`);
      });
    } else {
      console.log('  ❌ No tags generated');
    }

    console.log('\n📋 TODO LIST:');
    if (processDoc.todoList && processDoc.todoList.length > 0) {
      processDoc.todoList.forEach((todo, index) => {
        const timestamp = todo.timestamp ? `[${Math.floor(todo.timestamp / 60)}:${String(todo.timestamp % 60).padStart(2, '0')}]` : '';
        console.log(`  ${index + 1}. ${timestamp} ${todo.task}`);
      });
    } else {
      console.log('  ❌ No todo items generated');
    }

    console.log('\n🎤 TRANSCRIPTION:');
    if (processDoc.transcript?.text) {
      console.log(`  📝 Text: "${processDoc.transcript.text}"`);
      console.log(`  🎯 Confidence: ${processDoc.transcript.confidence ? (processDoc.transcript.confidence * 100).toFixed(1) + '%' : 'Unknown'}`);
      console.log(`  📊 Word Count: ${processDoc.transcript.text.split(' ').length} words`);
    } else {
      console.log('  ❌ No transcription available');
    }

    console.log('\n📈 JOB TRACKING:');
    console.log(`  Video Processing: ${processDoc.jobs?.videoProcessing || 'N/A'}`);
    console.log(`  Audio Extraction: ${processDoc.jobs?.audioExtraction || 'N/A'}`);
    console.log(`  Transcription: ${processDoc.jobs?.transcription ? processDoc.jobs.transcription.join(', ') : 'N/A'}`);
    if (processDoc.jobs?.aiAnalysis) {
      console.log(`  AI Analysis:`);
      console.log(`    • Tags: ${processDoc.jobs.aiAnalysis.tags || 'N/A'}`);
      console.log(`    • Todo: ${processDoc.jobs.aiAnalysis.todo || 'N/A'}`);
      console.log(`    • Title: ${processDoc.jobs.aiAnalysis.title || 'N/A'}`);
    } else {
      console.log(`  AI Analysis: N/A`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

const processId = process.argv[2] || '68b03b82813726681761c994';
checkProcessFinal(processId);