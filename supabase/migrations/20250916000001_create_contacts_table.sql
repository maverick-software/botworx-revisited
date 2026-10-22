-- Migration: Create Contacts Table
-- Purpose: Core contact management table with GDPR compliance
-- Dependencies: auth.users table (Supabase managed)
-- File: 20250916000001_create_contacts_table.sql

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic contact information
  first_name TEXT NOT NULL,
  last_name TEXT,
  display_name TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN last_name IS NOT NULL THEN first_name || ' ' || last_name
      ELSE first_name
    END
  ) STORED,
  
  -- Organization details
  organization TEXT,
  job_title TEXT,
  department TEXT,
  
  -- Contact metadata
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  contact_source TEXT DEFAULT 'manual' CHECK (contact_source IN (
    'manual', 'csv_import', 'api_sync', 'integration_import'
  )),
  
  -- Privacy and consent (GDPR compliance)
  consent_status TEXT DEFAULT 'unknown' CHECK (consent_status IN (
    'granted', 'denied', 'unknown', 'withdrawn'
  )),
  consent_date TIMESTAMPTZ,
  consent_method TEXT CHECK (consent_method IN (
    'web_form', 'email_confirmation', 'phone_verification', 'import', 'api'
  )),
  data_processing_purpose TEXT[] DEFAULT '{}', -- ['marketing', 'support', 'sales', 'contract_management']
  legal_basis TEXT DEFAULT 'legitimate_interest' CHECK (legal_basis IN (
    'consent', 'contract', 'legal_obligation', 'vital_interests', 
    'public_task', 'legitimate_interest'
  )),
  
  -- Status and categorization
  contact_status TEXT DEFAULT 'active' CHECK (contact_status IN (
    'active', 'inactive', 'blocked', 'archived'
  )),
  contact_type TEXT DEFAULT 'external' CHECK (contact_type IN (
    'internal', 'external', 'partner', 'vendor', 'customer', 'prospect'
  )),
  priority_level TEXT DEFAULT 'normal' CHECK (priority_level IN (
    'low', 'normal', 'high', 'critical'
  )),
  
  -- Flexible metadata storage
  custom_fields JSONB DEFAULT '{}',
  integration_metadata JSONB DEFAULT '{}', -- External system IDs, sync data
  
  -- GDPR compliance fields
  data_retention_date TIMESTAMPTZ, -- When data should be deleted
  deletion_requested BOOLEAN DEFAULT FALSE,
  deletion_requested_at TIMESTAMPTZ,
  deletion_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ, -- Soft delete for audit trail
  
  -- Constraints
  CONSTRAINT valid_names CHECK (
    LENGTH(TRIM(first_name)) > 0 AND 
    LENGTH(first_name) <= 100 AND
    (last_name IS NULL OR LENGTH(last_name) <= 100)
  ),
  CONSTRAINT valid_organization CHECK (
    organization IS NULL OR LENGTH(organization) <= 200
  ),
  CONSTRAINT valid_job_title CHECK (
    job_title IS NULL OR LENGTH(job_title) <= 150
  ),
  CONSTRAINT valid_notes CHECK (
    notes IS NULL OR LENGTH(notes) <= 5000
  ),
  CONSTRAINT consent_data_consistency CHECK (
    (consent_status = 'granted' AND consent_date IS NOT NULL) OR
    (consent_status != 'granted')
  ),
  CONSTRAINT deletion_consistency CHECK (
    (deletion_requested = TRUE AND deletion_requested_at IS NOT NULL) OR
    (deletion_requested = FALSE)
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name);
CREATE INDEX IF NOT EXISTS idx_contacts_organization ON contacts(organization);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(contact_status);
CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields ON contacts USING GIN(custom_fields);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted ON contacts(last_contacted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(updated_at);

-- Partial indexes for active contacts (performance optimization)
CREATE INDEX IF NOT EXISTS idx_contacts_active_user ON contacts(user_id, display_name) 
  WHERE contact_status = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_active_org ON contacts(user_id, organization, display_name) 
  WHERE contact_status = 'active' AND deleted_at IS NULL AND organization IS NOT NULL;

-- Full-text search index for contact search functionality
CREATE INDEX IF NOT EXISTS idx_contacts_search ON contacts USING GIN(
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(organization, '') || ' ' || 
    COALESCE(job_title, '') || ' ' || 
    COALESCE(department, '') || ' ' || 
    COALESCE(notes, '')
  )
) WHERE contact_status = 'active' AND deleted_at IS NULL;

-- GDPR compliance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_retention_date ON contacts(data_retention_date) 
  WHERE data_retention_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deletion_requested ON contacts(deletion_requested_at) 
  WHERE deletion_requested = TRUE;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Add comments for documentation
COMMENT ON TABLE contacts IS 'Core contact management table with GDPR compliance features';
COMMENT ON COLUMN contacts.display_name IS 'Generated column combining first_name and last_name';
COMMENT ON COLUMN contacts.consent_status IS 'GDPR consent status for data processing';
COMMENT ON COLUMN contacts.legal_basis IS 'Legal basis for processing personal data under GDPR';
COMMENT ON COLUMN contacts.custom_fields IS 'Flexible JSONB storage for user-defined fields';
COMMENT ON COLUMN contacts.integration_metadata IS 'Metadata for external system integrations';
COMMENT ON COLUMN contacts.deleted_at IS 'Soft delete timestamp for audit trail';

-- Create contact audit log table for GDPR compliance
CREATE TABLE IF NOT EXISTS contact_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  
  -- Operation details
  operation_type TEXT NOT NULL CHECK (operation_type IN (
    'create', 'read', 'update', 'delete', 'export', 'gdpr_request'
  )),
  operation_details JSONB DEFAULT '{}',
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Data changes (for update operations)
  old_values JSONB,
  new_values JSONB,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_contact_audit_contact_id ON contact_audit_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_audit_user_id ON contact_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_audit_operation ON contact_audit_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_contact_audit_created_at ON contact_audit_log(created_at);

-- Add comment
COMMENT ON TABLE contact_audit_log IS 'Audit trail for all contact operations (GDPR compliance)';

-- Grant necessary permissions
-- Note: RLS policies will be created in a separate migration
