# Database Schema Implementation - Advanced JSON Chat System

## Overview

This document details the implementation of the new database schema for the advanced JSON-based chat system. The schema supports memory management, state persistence, and structured message storage.

## Migration Files Created

### 1. Forward Migration
**File**: `supabase/migrations/20250805074444_create_advanced_json_chat_schema.sql`
- Creates all new tables with proper constraints
- Establishes indexes for performance
- Sets up triggers for automatic updates
- Implements Row Level Security (RLS)
- Includes helper functions for data migration

### 2. Rollback Migration
**File**: `supabase/migrations/20250805074445_rollback_advanced_json_chat_schema.sql`
- Safely removes all new schema elements
- Preserves option to backup data
- Drops in correct dependency order
- Includes verification step

## Schema Components

### Core Tables

#### 1. `chat_messages_v2`
- **Purpose**: Stores structured messages with full metadata
- **Key Features**:
  - UUID-based identification
  - Version tracking
  - JSONB content structure
  - Relationship tracking
  - Audit support

#### 2. `agent_memories`
- **Purpose**: Multi-type memory storage with embeddings
- **Memory Types**:
  - Episodic: Event-based memories
  - Semantic: Knowledge and concepts
  - Procedural: Skills and procedures
  - Working: Active memory items
- **Features**:
  - Vector embeddings (1536 dimensions)
  - Importance scoring
  - Decay tracking
  - Relationship mapping

#### 3. `agent_states`
- **Purpose**: Versioned state management
- **State Types**:
  - Local: Agent-specific state
  - Shared: Cross-agent state
  - Session: Active session state
  - Persistent: Long-term state
- **Features**:
  - State hashing for integrity
  - Version control
  - Current state tracking

### Supporting Tables

#### 4. `conversation_sessions`
- Tracks active conversations
- Metrics collection
- Session state management

#### 5. `context_snapshots`
- Point-in-time context saves
- Performance metrics
- Optimization tracking

#### 6. `state_checkpoints`
- Recovery points
- Different checkpoint types
- Retention policies

## Index Strategy

### Performance Indexes
1. **Primary Access Patterns**:
   - `conversation_id` + `created_at` for message retrieval
   - `agent_id` + `memory_type` for memory access
   - `agent_id` + current state flag

2. **Search Indexes**:
   - GIN indexes on JSONB columns
   - IVFFlat for vector similarity
   - Partial indexes for filtered queries

3. **Maintenance Considerations**:
   - Regular VACUUM for GIN indexes
   - Index usage monitoring
   - Periodic reindexing for vectors

## Security Implementation

### Row Level Security (RLS)
- Enabled on all tables
- User-based access control
- Agent ownership verification

### Policies
1. **Message Access**: Users see their own messages
2. **Memory Management**: Users manage their agents' memories
3. **State Control**: Users control their agents' states

## Migration Strategy

### Phase 1: Parallel Operation (Weeks 1-2)
1. Deploy new schema alongside existing
2. Implement dual-write in application:
   ```typescript
   // Example dual-write pattern
   async function saveMessage(content: string) {
     // Write to old table
     await saveToOldMessages(content);
     
     // Write to new table
     await saveToMessagesV2({
       content: { type: 'text', text: content },
       metadata: { tokens: estimateTokens(content) }
     });
   }
   ```

3. Monitor for consistency
4. Fix any issues

### Phase 2: Gradual Migration (Weeks 3-4)
1. Start reading from new tables:
   ```typescript
   // Feature flag approach
   const messages = featureFlags.useNewSchema 
     ? await getMessagesV2() 
     : await getOldMessages();
   ```

2. Migrate historical data in batches
3. Verify data integrity
4. Update dependent services

### Phase 3: Cutover (Week 5)
1. Stop writes to old tables
2. Final data sync
3. Update all references
4. Remove dual-write code

### Phase 4: Cleanup (Week 6)
1. Archive old tables
2. Remove deprecated code
3. Update documentation
4. Performance optimization

## Data Migration Scripts

### Basic Migration Function
```sql
-- Already included in migration file
SELECT migrate_chat_messages();
```

### Advanced Migration with Progress Tracking
```sql
CREATE OR REPLACE FUNCTION migrate_with_progress(
    batch_size INTEGER DEFAULT 1000
) RETURNS TABLE (
    batch_number INTEGER,
    records_migrated INTEGER,
    total_migrated INTEGER
) AS $$
DECLARE
    v_offset INTEGER := 0;
    v_batch_count INTEGER := 0;
    v_total INTEGER := 0;
    v_batch_number INTEGER := 1;
BEGIN
    LOOP
        INSERT INTO chat_messages_v2 (...)
        SELECT ... 
        FROM chat_messages
        ORDER BY created_at
        LIMIT batch_size
        OFFSET v_offset;
        
        GET DIAGNOSTICS v_batch_count = ROW_COUNT;
        
        EXIT WHEN v_batch_count = 0;
        
        v_total := v_total + v_batch_count;
        v_offset := v_offset + batch_size;
        
        RETURN QUERY SELECT v_batch_number, v_batch_count, v_total;
        
        v_batch_number := v_batch_number + 1;
        
        -- Allow for interruption
        PERFORM pg_sleep(0.1);
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

## Monitoring and Validation

### Health Checks
```sql
-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE '%chat_messages%'
   OR tablename LIKE '%agent_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Data Integrity Checks
```sql
-- Verify message migration
SELECT 
    'old' as source,
    COUNT(*) as count,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM chat_messages
UNION ALL
SELECT 
    'new' as source,
    COUNT(*) as count,
    MIN(created_at) as earliest,
    MAX(created_at) as latest
FROM chat_messages_v2;

-- Check for orphaned memories
SELECT COUNT(*)
FROM agent_memories am
WHERE NOT EXISTS (
    SELECT 1 FROM agents a WHERE a.id = am.agent_id
);
```

## Performance Considerations

### Expected Impact
1. **Storage**: ~20% increase due to metadata
2. **Write Performance**: Slight decrease due to triggers
3. **Read Performance**: Improved with better indexing
4. **Query Complexity**: Reduced with structured data

### Optimization Tips
1. Use partial indexes for common filters
2. Implement connection pooling
3. Consider read replicas for analytics
4. Monitor slow query log

## Rollback Procedure

### Emergency Rollback
```bash
# Stop application
kubectl scale deployment chat-api --replicas=0

# Run rollback migration
supabase db push --file supabase/migrations/20250805074445_rollback_advanced_json_chat_schema.sql

# Restore application with old schema flag
kubectl set env deployment/chat-api USE_OLD_SCHEMA=true
kubectl scale deployment chat-api --replicas=3
```

### Partial Rollback
- Keep new tables but revert to old code
- Maintain dual-write for investigation
- Gradual rollback with feature flags

## Testing Plan

### Unit Tests
1. Constraint validation
2. Trigger functionality
3. Migration functions
4. RLS policies

### Integration Tests
1. Dual-write consistency
2. Migration accuracy
3. Performance benchmarks
4. Rollback procedures

### Load Tests
1. Concurrent message creation
2. Memory retrieval at scale
3. State update contention
4. Vector search performance

## Success Metrics

### Technical Metrics
- Zero data loss during migration
- < 5% performance degradation
- 100% backward compatibility
- All tests passing

### Business Metrics
- No user-facing downtime
- Improved response accuracy
- Reduced context loss
- Enhanced agent capabilities

## Next Steps

1. **Review**: Database team review
2. **Testing**: Run migration in staging
3. **Benchmarking**: Performance testing
4. **Documentation**: Update API docs
5. **Training**: Team knowledge transfer
6. **Deployment**: Production rollout

## Appendix

### Common Queries

#### Get agent's current state
```sql
SELECT * FROM agent_states
WHERE agent_id = ? AND is_current = true;
```

#### Retrieve relevant memories
```sql
SELECT * FROM agent_memories
WHERE agent_id = ?
  AND memory_type IN ('semantic', 'episodic')
  AND importance > 0.7
ORDER BY embeddings <-> ? -- vector similarity
LIMIT 10;
```

#### Get conversation context
```sql
SELECT m.*, s.session_state
FROM chat_messages_v2 m
JOIN conversation_sessions s ON m.session_id = s.id
WHERE m.conversation_id = ?
ORDER BY m.created_at DESC
LIMIT 50;
```

### Troubleshooting

#### Issue: Migration too slow
- Increase batch size
- Run during off-peak hours
- Use parallel workers

#### Issue: RLS blocking access
- Check policy definitions
- Verify auth tokens
- Test with service role

#### Issue: Vector search errors
- Ensure pgvector extension
- Check embedding dimensions
- Verify index creation