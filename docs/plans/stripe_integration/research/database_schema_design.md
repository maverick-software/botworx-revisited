# Database Schema Design - Stripe Customer Linking Table
## Research Document for WBS Task 3.1.1

### **CONTEXT & PURPOSE**
Design the core table that links Agentopia users to Stripe customer records. This table serves as the foundation for all billing operations and must integrate seamlessly with the existing authentication system.

### **EXISTING SYSTEM ANALYSIS**
- **Current Auth**: Uses standard Supabase auth.users table with UUID primary keys
- **User Profiles**: Existing profiles table with user metadata
- **Organizations**: Has subscription_tier field that needs integration
- **RLS Policies**: Existing row-level security patterns must be followed

### **STRIPE INTEGRATION REQUIREMENTS**
- **Customer Creation**: Automatic customer creation during first subscription
- **Customer Retrieval**: Fast lookup by user_id for billing operations
- **Metadata Storage**: Store Stripe customer metadata for support
- **Audit Trail**: Track customer creation and updates

### **PROPOSED TABLE STRUCTURE**
```sql
CREATE TABLE stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  default_payment_method TEXT, -- Stripe payment method ID
  customer_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_customer UNIQUE(user_id),
  CONSTRAINT valid_stripe_id CHECK (stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$')
);
```

### **INDEXING STRATEGY**
```sql
-- Primary lookup index
CREATE INDEX idx_stripe_customers_user_id ON stripe_customers(user_id);

-- Stripe customer ID lookup
CREATE INDEX idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- Email lookup for admin support
CREATE INDEX idx_stripe_customers_email ON stripe_customers(customer_email);
```

### **ROW LEVEL SECURITY**
```sql
-- Users can only see their own customer records
CREATE POLICY "Users can view own customer data" 
ON stripe_customers FOR SELECT 
USING (auth.uid() = user_id);

-- Users cannot directly modify customer records (API only)
CREATE POLICY "Service role only modifications" 
ON stripe_customers FOR ALL 
USING (auth.role() = 'service_role');
```

### **INTEGRATION POINTS**
1. **User Registration**: Create Stripe customer on first subscription
2. **Profile Updates**: Sync name/email changes to Stripe
3. **Organizations**: Link customer to organization billing
4. **Audit Logging**: Track all customer modifications

### **DATA MIGRATION STRATEGY**
- **Existing Users**: Backfill customers for users with subscriptions
- **New Users**: Create on-demand during checkout
- **Data Validation**: Verify all customers exist in Stripe

### **ERROR HANDLING CONSIDERATIONS**
- **Duplicate Prevention**: UNIQUE constraints prevent duplicates
- **Orphaned Records**: CASCADE delete handles user deletion
- **Invalid IDs**: CHECK constraint validates Stripe ID format
- **Sync Issues**: Metadata field stores sync status

### **PERFORMANCE CONSIDERATIONS**
- **Fast Lookups**: Indexed by user_id for quick access
- **Minimal Columns**: Only essential data stored locally
- **JSONB Metadata**: Flexible storage for additional Stripe data
- **Connection Pooling**: Consider connection limits with high volume

### **SECURITY CONSIDERATIONS**
- **PII Protection**: Email and name are necessary for billing
- **Access Control**: RLS prevents unauthorized access
- **Service Role**: Only backend functions can modify
- **Audit Trail**: All changes logged with timestamps

### **BACKUP INSTRUCTIONS**
Before implementing this table:
1. **Backup current schema**: `pg_dump --schema-only > schema_backup.sql`
2. **Backup user data**: Export auth.users and profiles tables
3. **Store in**: `docs/plans/stripe_integration/backups/pre_customers_table/`

### **TESTING REQUIREMENTS**
- **User Creation**: Test customer creation on subscription
- **RLS Policies**: Verify access control works correctly
- **Constraints**: Test all validation constraints
- **Performance**: Test lookup speed with sample data
- **Integration**: Test with existing authentication system

### **DEPENDENCIES**
- **Stripe Account**: Must be configured before testing
- **Service Role**: Supabase service role key required
- **Auth System**: Existing authentication must be working
- **Migration Order**: Must be first Stripe table created

### **ROLLBACK PLAN**
If issues arise:
1. **Drop Table**: `DROP TABLE stripe_customers CASCADE;`
2. **Remove Indexes**: Indexes drop automatically with table
3. **Remove Policies**: Policies drop automatically with table
4. **Restore Backup**: Restore from backup if needed

### **FUTURE CONSIDERATIONS**
- **Multiple Organizations**: May need org_id if multi-tenant
- **Customer Portal**: May need portal configuration storage
- **Payment Methods**: May need separate table for multiple methods
- **Billing Address**: May need address storage for tax calculation

### **IMPLEMENTATION NOTES**
- **File Size**: Keep migration under 200 lines
- **Error Messages**: Use clear, actionable error messages
- **Documentation**: Include inline comments in migration
- **Testing**: Create test data for validation
