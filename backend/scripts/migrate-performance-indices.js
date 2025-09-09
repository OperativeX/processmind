#!/usr/bin/env node

/**
 * MongoDB Performance Index Migration Script
 * Creates optimized compound indices for better query performance
 */

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');

// Migration configuration
const MIGRATION_NAME = 'performance-indices-2024';
const DRY_RUN = process.argv.includes('--dry-run');

// Index definitions for each collection
const indexDefinitions = {
  processes: [
    // Multi-tenant pagination with deletion status
    {
      keys: { tenantId: 1, isDeleted: 1, createdAt: -1 },
      options: { 
        name: 'tenant_deleted_created',
        background: true 
      }
    },
    // Status filtering with tenant isolation
    {
      keys: { tenantId: 1, isDeleted: 1, status: 1 },
      options: { 
        name: 'tenant_deleted_status',
        background: true 
      }
    },
    // User-specific queries
    {
      keys: { tenantId: 1, userId: 1, isDeleted: 1 },
      options: { 
        name: 'tenant_user_deleted',
        background: true 
      }
    },
    // Tag search optimization
    {
      keys: { tenantId: 1, isDeleted: 1, 'tags.name': 1 },
      options: { 
        name: 'tenant_deleted_tags',
        background: true 
      }
    },
    // Embedding queries for graph view
    {
      keys: { tenantId: 1, isDeleted: 1, embedding: 1 },
      options: { 
        name: 'tenant_deleted_embedding',
        background: true,
        sparse: true // Many documents might not have embeddings
      }
    },
    // Weighted tag search
    {
      keys: { tenantId: 1, 'tags.name': 1, 'tags.weight': -1, isDeleted: 1 },
      options: { 
        name: 'tenant_tags_weighted',
        background: true 
      }
    },
    // Share ID lookup (already exists but verify)
    {
      keys: { shareId: 1 },
      options: { 
        name: 'shareId_unique',
        unique: true,
        sparse: true,
        background: true 
      }
    },
    // Text search optimization with weights
    {
      keys: { title: 'text', 'transcript.text': 'text' },
      options: { 
        name: 'text_search_optimized',
        weights: {
          title: 10,
          'transcript.text': 1
        },
        default_language: 'none', // Disable language-specific stemming
        background: true 
      }
    }
  ],
  
  users: [
    // Tenant user listing
    {
      keys: { tenantId: 1, isDeleted: 1, createdAt: -1 },
      options: { 
        name: 'tenant_deleted_created',
        background: true 
      }
    },
    // Email lookup with tenant
    {
      keys: { tenantId: 1, email: 1 },
      options: { 
        name: 'tenant_email_unique',
        unique: true,
        background: true 
      }
    }
  ],
  
  tenants: [
    // Active tenant queries
    {
      keys: { isActive: 1, createdAt: -1 },
      options: { 
        name: 'active_created',
        background: true 
      }
    },
    // Domain lookup
    {
      keys: { domain: 1 },
      options: { 
        name: 'domain_unique',
        unique: true,
        sparse: true,
        background: true 
      }
    }
  ],
  
  favoritelists: [
    // User's favorite lists
    {
      keys: { tenantId: 1, userId: 1, isDeleted: 1 },
      options: { 
        name: 'tenant_user_deleted',
        background: true 
      }
    },
    // Shared lists
    {
      keys: { shareId: 1 },
      options: { 
        name: 'shareId_unique',
        unique: true,
        sparse: true,
        background: true 
      }
    }
  ],
  
  notifications: [
    // User notifications
    {
      keys: { userId: 1, read: 1, createdAt: -1 },
      options: { 
        name: 'user_read_created',
        background: true 
      }
    }
  ]
};

// Migration tracking schema
const MigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now },
  indices: [{
    collection: String,
    indexName: String,
    keys: Object,
    created: Boolean,
    error: String
  }]
});

const Migration = mongoose.model('Migration', MigrationSchema);

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000
    });
    logger.info('Connected to MongoDB for migration');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
}

/**
 * Check if migration has already been applied
 */
async function isMigrationApplied() {
  const migration = await Migration.findOne({ name: MIGRATION_NAME });
  return !!migration;
}

/**
 * Create indices for a collection
 */
async function createIndicesForCollection(collectionName, indices) {
  const collection = mongoose.connection.collection(collectionName);
  const results = [];
  
  // Get existing indices
  const existingIndices = await collection.indexes();
  const existingIndexNames = new Set(existingIndices.map(idx => idx.name));
  
  logger.info(`Processing ${collectionName} collection...`);
  
  for (const indexDef of indices) {
    const result = {
      collection: collectionName,
      indexName: indexDef.options.name,
      keys: indexDef.keys,
      created: false,
      error: null
    };
    
    try {
      // Check if index already exists
      if (existingIndexNames.has(indexDef.options.name)) {
        logger.info(`  ✓ Index ${indexDef.options.name} already exists`);
        continue;
      }
      
      if (DRY_RUN) {
        logger.info(`  [DRY RUN] Would create index: ${indexDef.options.name}`);
        logger.info(`    Keys: ${JSON.stringify(indexDef.keys)}`);
        continue;
      }
      
      // Create the index
      await collection.createIndex(indexDef.keys, indexDef.options);
      result.created = true;
      logger.info(`  ✓ Created index: ${indexDef.options.name}`);
      
    } catch (error) {
      result.error = error.message;
      logger.error(`  ✗ Failed to create index ${indexDef.options.name}:`, error.message);
      
      // If it's a duplicate index error, it's not critical
      if (error.code !== 85) { // 85 = IndexOptionsConflict
        throw error;
      }
    }
    
    results.push(result);
  }
  
  return results;
}

/**
 * Run the migration
 */
async function runMigration() {
  try {
    logger.info(`Starting migration: ${MIGRATION_NAME}`);
    if (DRY_RUN) {
      logger.info('Running in DRY RUN mode - no changes will be made');
    }
    
    // Check if already applied
    if (!DRY_RUN && await isMigrationApplied()) {
      logger.warn('Migration has already been applied');
      return;
    }
    
    const migrationResults = [];
    
    // Process each collection
    for (const [collectionName, indices] of Object.entries(indexDefinitions)) {
      const results = await createIndicesForCollection(collectionName, indices);
      migrationResults.push(...results);
    }
    
    // Save migration record
    if (!DRY_RUN) {
      await Migration.create({
        name: MIGRATION_NAME,
        indices: migrationResults
      });
      logger.info('Migration record saved');
    }
    
    // Summary
    const created = migrationResults.filter(r => r.created).length;
    const failed = migrationResults.filter(r => r.error).length;
    
    logger.info('Migration completed:', {
      totalIndices: migrationResults.length,
      created,
      failed,
      dryRun: DRY_RUN
    });
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Analyze query performance (optional)
 */
async function analyzeQueryPerformance() {
  if (!process.argv.includes('--analyze')) {
    return;
  }
  
  logger.info('\nAnalyzing query performance...');
  
  const Process = mongoose.connection.collection('processes');
  
  // Example query patterns to test
  const queries = [
    {
      name: 'Tenant process listing',
      query: { tenantId: new mongoose.Types.ObjectId(), isDeleted: false },
      sort: { createdAt: -1 }
    },
    {
      name: 'User processes',
      query: { 
        tenantId: new mongoose.Types.ObjectId(), 
        userId: new mongoose.Types.ObjectId(), 
        isDeleted: false 
      }
    },
    {
      name: 'Tag search',
      query: { 
        tenantId: new mongoose.Types.ObjectId(), 
        'tags.name': 'example',
        isDeleted: false 
      }
    }
  ];
  
  for (const test of queries) {
    const explain = await Process.find(test.query)
      .sort(test.sort || {})
      .explain('executionStats');
    
    logger.info(`\nQuery: ${test.name}`);
    logger.info(`  Execution time: ${explain.executionStats.executionTimeMillis}ms`);
    logger.info(`  Documents examined: ${explain.executionStats.totalDocsExamined}`);
    logger.info(`  Index used: ${explain.executionStats.executionStages.indexName || 'NONE'}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await connectDB();
    await runMigration();
    await analyzeQueryPerformance();
    
    logger.info('Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration script failed:', error);
    process.exit(1);
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { runMigration };