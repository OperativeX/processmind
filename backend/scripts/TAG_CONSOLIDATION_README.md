# Tag Consolidation Migration Guide

## Overview
This migration consolidates the dual tag system (`tags` and `tagWeights`) into a single `tags` array that includes weight information for each tag.

## Changes Made

### Backend
1. **Process Model** - Updated schema to use single `tags` array with objects containing `name` and `weight`
2. **Controller** - Added backward compatibility for both old and new tag formats
3. **AI Service** - Updated to generate tags in the new weighted format
4. **Queue Workers** - Modified to save tags in consolidated format
5. **Indexes** - Updated database indexes for optimized tag queries

### Frontend
1. **TagEditor Component** - New component for editing tags with weights
2. **ProcessPage** - Integrated TagEditor with visual weight indicators
3. **ProcessListPage** - Updated to display tags with weight-based styling
4. **GraphViewPage** - Modified to handle both tag formats

## Running the Migration

### Prerequisites
- Backup your database before running the migration
- Ensure all services are stopped

### Steps

1. **Run the migration script**:
   ```bash
   cd backend/scripts
   node consolidate-tags.js
   ```

2. **Verify the migration**:
   - Check the console output for migration statistics
   - A backup file will be created with timestamp

3. **Restart services**:
   ```bash
   npm run dev
   ```

## Tag Weight System

- **Weight Range**: 0.0 to 1.0
- **Default Weight**: 0.5 for migrated tags
- **Visual Indicators**:
  - Weight >= 0.8: Bold, larger, filled chip
  - Weight >= 0.5: Normal size, outlined chip
  - Weight < 0.5: Small, light appearance

## API Compatibility

The API maintains backward compatibility:
- **GET** endpoints return tags in new format
- **PUT/POST** endpoints accept both formats:
  - Old: `["tag1", "tag2"]`
  - New: `[{name: "tag1", weight: 0.8}, {name: "tag2", weight: 0.5}]`

## Rollback Plan

If issues occur:
1. Restore from the backup JSON file created by the migration
2. Revert code to previous commit
3. Restart services

## Testing Checklist

- [ ] Tag display in process list
- [ ] Tag editing with weights
- [ ] Tag filtering/search
- [ ] Graph visualization
- [ ] API endpoints (GET/PUT/POST)
- [ ] New video uploads with AI-generated tags
- [ ] Existing process compatibility