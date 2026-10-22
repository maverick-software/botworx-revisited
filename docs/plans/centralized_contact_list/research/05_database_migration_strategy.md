# Database Migration Strategy Research

## Research Date: September 15, 2025

## Migration Planning Overview

### Current Database State Analysis
Based on the existing Supabase migrations structure:
- **167+ migrations** currently applied
- **Sequential numbering** pattern: YYYYMMDD_HHMMSS_description.sql
- **Foreign key dependencies** well-established
- **RLS policies** consistently implemented
- **Supabase-specific features** (Vault, auth.users references)

### Migration Sequence Strategy

#### Migration Dependencies
```
Migration Order (based on foreign key dependencies):
1. contacts (base table)
2. contact_communication_channels (depends on contacts)
3. contact_groups (independent)
4. contact_group_memberships (depends on contacts + contact_groups)
5. agent_contact_permissions (depends on agents + contacts)
6. agent_specific_contact_access (depends on agent_contact_permissions + contacts)
7. contact_interactions (depends on contacts + agents)
8. contact_import_jobs (depends on auth.users only)
```

#### File Size Compliance
Each migration file must be ≤300 lines following project philosophy:

**Proposed Migration Files:**
```sql
-- 20250916000001_create_contacts_table.sql (280 lines)
-- Core contacts table with indexes and constraints

-- 20250916000002_create_contact_channels_table.sql (250 lines)
-- Communication channels table with validation

-- 20250916000003_create_contact_groups_tables.sql (200 lines)
-- Groups and memberships tables

-- 20250916000004_create_agent_contact_permissions.sql (270 lines)
-- Agent permission system tables

-- 20250916000005_create_contact_interactions_table.sql (220 lines)
-- Communication history tracking

-- 20250916000006_create_contact_import_tables.sql (180 lines)
-- CSV import job tracking

-- 20250916000007_create_contact_functions.sql (290 lines)
-- PostgreSQL functions for search and operations

-- 20250916000008_create_contact_rls_policies.sql (260 lines)
-- Row Level Security policies for all tables
```

### Migration Content Strategy

#### 1. Core Table Creation (Migration 1)
```sql
-- contacts table with all fields and constraints
-- Performance indexes
-- JSONB GIN indexes for flexible metadata
-- Full-text search indexes
-- Basic constraints and validation
-- NO RLS policies (separate migration)
-- NO functions (separate migration)
```

#### 2. Communication Channels (Migration 2)
```sql
-- contact_communication_channels table
-- Channel type validation
-- Unique constraints for primary channels
-- Indexes for performance
-- Channel-specific metadata structure
```

#### 3. Group Management (Migration 3)
```sql
-- contact_groups table
-- contact_group_memberships table
-- Smart group criteria support
-- Group hierarchy support
-- Performance indexes
```

#### 4. Agent Permissions (Migration 4)
```sql
-- agent_contact_permissions table
-- agent_specific_contact_access table
-- Permission level validation
-- Time-based access controls
-- Channel restriction support
```

#### 5. Interaction Tracking (Migration 5)
```sql
-- contact_interactions table
-- Message delivery status tracking
-- Channel-specific metadata
-- Audit trail structure
-- Performance indexes for queries
```

#### 6. Import System (Migration 6)
```sql
-- contact_import_jobs table
-- Import status tracking
-- Error reporting structure
-- Statistics collection
-- File reference management
```

#### 7. Database Functions (Migration 7)
```sql
-- search_contacts_for_agent function
-- export_contact_data_for_subject function
-- gdpr_delete_contact function
-- apply_retention_policies function
-- Contact validation functions
```

#### 8. RLS Policies (Migration 8)
```sql
-- Enable RLS on all tables
-- User isolation policies
-- Agent access policies
-- Service role policies
-- Admin access policies
```

### Rollback Strategy

#### Migration Rollback Files
Each migration must include a corresponding rollback:
```sql
-- 20250916000001_create_contacts_table_rollback.sql
DROP TABLE IF EXISTS contacts CASCADE;
DROP INDEX IF EXISTS idx_contacts_user_id;
-- ... all created objects
```

#### Dependency Management
- **CASCADE drops** for tables with foreign key references
- **Conditional drops** using IF EXISTS
- **Data preservation** where possible during rollbacks
- **Audit trail** of rollback operations

### Data Migration Considerations

#### Existing Data Impact
- **No existing contact data** to migrate (new feature)
- **User table references** already established
- **Agent table references** already established
- **Integration with existing auth system**

#### Future Data Migration
- **CSV import capability** for initial data population
- **API import** from external systems
- **Bulk operations** for large datasets
- **Data validation** during import

### Performance Considerations

#### Index Strategy
```sql
-- Primary performance indexes
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_display_name ON contacts(display_name);
CREATE INDEX idx_contacts_search ON contacts USING GIN(to_tsvector('english', display_name || ' ' || organization));

-- Channel lookup indexes
CREATE INDEX idx_channels_contact_id ON contact_communication_channels(contact_id);
CREATE INDEX idx_channels_type_identifier ON contact_communication_channels(channel_type, channel_identifier);

-- Permission system indexes
CREATE INDEX idx_agent_permissions_agent ON agent_contact_permissions(agent_id);
CREATE INDEX idx_specific_access_agent_contact ON agent_specific_contact_access(agent_id, contact_id);
```

#### Query Optimization
- **Partial indexes** for active records only
- **Composite indexes** for common query patterns
- **JSONB indexes** for metadata searches
- **Text search indexes** for contact search functionality

### Security Migration Strategy

#### RLS Policy Implementation
```sql
-- User isolation (primary security boundary)
CREATE POLICY "users_own_contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id);

-- Agent access (controlled by permissions)
CREATE POLICY "agents_permitted_contacts" ON contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agent_contact_permissions acp
      WHERE acp.agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid())
      AND (acp.permission_type = 'all_contacts' OR 
           EXISTS (SELECT 1 FROM agent_specific_contact_access asca 
                   WHERE asca.agent_id = acp.agent_id AND asca.contact_id = contacts.id))
    )
  );
```

#### Vault Integration
- **Sensitive data encryption** using existing Vault patterns
- **API key storage** for communication channels
- **Contact data anonymization** for GDPR compliance

### Testing Strategy

#### Migration Testing
1. **Shadow database testing** on empty database
2. **Production-like data** testing with sample contacts
3. **Rollback testing** for each migration
4. **Performance testing** with large datasets
5. **RLS policy validation** with different user scenarios

#### Validation Queries
```sql
-- Verify table creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'contact%';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies WHERE tablename LIKE 'contact%';

-- Verify indexes
SELECT indexname, tablename FROM pg_indexes 
WHERE tablename LIKE 'contact%';
```

### Monitoring and Alerting

#### Migration Monitoring
- **Execution time tracking** for each migration
- **Lock detection** for concurrent access issues
- **Error logging** with detailed context
- **Success validation** after each migration

#### Post-Migration Monitoring
- **Query performance** monitoring
- **RLS policy effectiveness** validation
- **Index usage** analysis
- **Storage growth** tracking

### Documentation Requirements

#### Migration Documentation
- **Change log** for each migration
- **Dependency mapping** between migrations
- **Rollback procedures** for each migration
- **Testing results** and validation

#### Schema Documentation
- **Table relationships** diagram
- **Index strategy** explanation
- **RLS policy** documentation
- **Performance characteristics** analysis

## Implementation Checklist

### Pre-Migration
- [ ] Review existing database schema
- [ ] Validate migration sequence
- [ ] Create rollback scripts
- [ ] Set up monitoring
- [ ] Prepare test data

### Migration Execution
- [ ] Execute migrations in sequence
- [ ] Validate each migration
- [ ] Test rollback procedures
- [ ] Monitor performance impact
- [ ] Document results

### Post-Migration
- [ ] Validate all functionality
- [ ] Run performance tests
- [ ] Update documentation
- [ ] Train development team
- [ ] Set up ongoing monitoring

## Risk Mitigation

### Technical Risks
- **Migration failures**: Comprehensive testing and rollback procedures
- **Performance degradation**: Index optimization and query analysis
- **Data corruption**: Backup and validation procedures
- **Lock contention**: Migration timing and monitoring

### Operational Risks
- **Downtime**: Zero-downtime migration strategy
- **Data loss**: Comprehensive backup procedures
- **Security issues**: RLS policy validation
- **Compliance**: GDPR requirement verification

## Success Criteria

### Functional Success
- [ ] All tables created successfully
- [ ] All indexes performing as expected
- [ ] RLS policies enforcing security
- [ ] Functions executing correctly

### Performance Success
- [ ] Contact search < 200ms response time
- [ ] Large contact list support (1000+ contacts)
- [ ] Efficient permission checking
- [ ] Scalable import operations

### Security Success
- [ ] User data isolation verified
- [ ] Agent permission system functional
- [ ] GDPR compliance validated
- [ ] Audit trails operational
