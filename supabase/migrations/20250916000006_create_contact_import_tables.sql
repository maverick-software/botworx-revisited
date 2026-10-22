-- Migration: Create Contact Import Tables
-- Purpose: Track CSV/bulk import operations for contacts
-- Dependencies: auth.users table
-- File: 20250916000006_create_contact_import_tables.sql

-- Create contact import jobs table
CREATE TABLE IF NOT EXISTS contact_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Import details
  import_type TEXT DEFAULT 'csv' CHECK (import_type IN (
    'csv', 'excel', 'json', 'api', 'manual_batch'
  )),
  file_name TEXT,
  file_size BIGINT,
  file_mime_type TEXT,
  storage_bucket TEXT DEFAULT 'contact-imports',
  storage_path TEXT,
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled', 'partially_completed'
  )),
  
  -- Processing progress
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  duplicate_contacts INTEGER DEFAULT 0,
  updated_contacts INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  
  -- Configuration and settings
  import_settings JSONB DEFAULT '{}', -- Column mappings, validation rules, etc.
  duplicate_handling TEXT DEFAULT 'skip' CHECK (duplicate_handling IN (
    'skip', 'update', 'create_duplicate', 'merge'
  )),
  validation_rules JSONB DEFAULT '{}',
  
  -- Column mapping
  column_mapping JSONB DEFAULT '{}', -- Maps CSV columns to contact fields
  required_fields TEXT[] DEFAULT '{}', -- Fields that must be present
  
  -- Results and reporting
  import_results JSONB DEFAULT '{}',
  error_details JSONB DEFAULT '{}',
  validation_errors JSONB DEFAULT '{}',
  preview_data JSONB DEFAULT '{}', -- Sample of imported data for preview
  
  -- Processing metadata
  processing_started_by TEXT, -- User or system identifier
  processing_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_file_size CHECK (file_size IS NULL OR file_size > 0),
  CONSTRAINT valid_row_counts CHECK (
    total_rows >= 0 AND 
    processed_rows >= 0 AND 
    successful_imports >= 0 AND 
    failed_imports >= 0 AND
    duplicate_contacts >= 0 AND
    updated_contacts >= 0 AND
    skipped_rows >= 0
  ),
  CONSTRAINT progress_consistency CHECK (
    processed_rows <= total_rows
  ),
  CONSTRAINT status_timing_consistency CHECK (
    (status IN ('processing', 'completed', 'failed', 'cancelled') AND started_at IS NOT NULL) OR
    (status = 'pending')
  ),
  CONSTRAINT completion_timing_consistency CHECK (
    (status IN ('completed', 'failed', 'cancelled', 'partially_completed') AND completed_at IS NOT NULL) OR
    (status NOT IN ('completed', 'failed', 'cancelled', 'partially_completed'))
  )
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON contact_import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON contact_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_type ON contact_import_jobs(import_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at ON contact_import_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_started_at ON contact_import_jobs(started_at);
CREATE INDEX IF NOT EXISTS idx_import_jobs_completed_at ON contact_import_jobs(completed_at);

-- Partial indexes for active jobs
CREATE INDEX IF NOT EXISTS idx_import_jobs_active ON contact_import_jobs(user_id, created_at) 
  WHERE status IN ('pending', 'processing');
-- Removed time-based index predicate as NOW() is not immutable
CREATE INDEX IF NOT EXISTS idx_import_jobs_recent_completed ON contact_import_jobs(user_id, completed_at) 
  WHERE status IN ('completed', 'partially_completed');

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_import_jobs_settings ON contact_import_jobs USING GIN(import_settings);
CREATE INDEX IF NOT EXISTS idx_import_jobs_results ON contact_import_jobs USING GIN(import_results);
CREATE INDEX IF NOT EXISTS idx_import_jobs_errors ON contact_import_jobs USING GIN(error_details);
CREATE INDEX IF NOT EXISTS idx_import_jobs_mapping ON contact_import_jobs USING GIN(column_mapping);

-- Create contact import errors table for detailed error tracking
CREATE TABLE IF NOT EXISTS contact_import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id UUID NOT NULL REFERENCES contact_import_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Error location
  row_number INTEGER NOT NULL,
  column_name TEXT,
  field_name TEXT, -- Mapped contact field name
  
  -- Error details
  error_type TEXT NOT NULL CHECK (error_type IN (
    'validation_error', 'format_error', 'duplicate_error', 'missing_required', 
    'invalid_email', 'invalid_phone', 'constraint_violation', 'system_error'
  )),
  error_message TEXT NOT NULL,
  error_code TEXT,
  
  -- Data context
  raw_value TEXT, -- The problematic value from import
  suggested_fix TEXT, -- Suggested correction
  row_data JSONB, -- Full row data for context
  
  -- Resolution
  is_resolved BOOLEAN DEFAULT FALSE,
  resolution_action TEXT CHECK (resolution_action IN (
    'ignored', 'fixed_and_imported', 'skipped', 'manual_review_needed'
  )),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for errors
CREATE INDEX IF NOT EXISTS idx_import_errors_job ON contact_import_errors(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_user ON contact_import_errors(user_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_type ON contact_import_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_import_errors_row ON contact_import_errors(import_job_id, row_number);
CREATE INDEX IF NOT EXISTS idx_import_errors_unresolved ON contact_import_errors(import_job_id) 
  WHERE is_resolved = FALSE;

-- Function to start an import job
CREATE OR REPLACE FUNCTION start_contact_import_job(
  p_user_id UUID,
  p_file_name TEXT,
  p_file_size BIGINT,
  p_import_settings JSONB DEFAULT '{}',
  p_column_mapping JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  job_id UUID;
BEGIN
  INSERT INTO contact_import_jobs (
    user_id,
    file_name,
    file_size,
    import_settings,
    column_mapping,
    status,
    started_at
  ) VALUES (
    p_user_id,
    p_file_name,
    p_file_size,
    p_import_settings,
    p_column_mapping,
    'pending',
    NOW()
  ) RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update import job progress
CREATE OR REPLACE FUNCTION update_import_job_progress(
  p_job_id UUID,
  p_user_id UUID,
  p_processed_rows INTEGER,
  p_successful_imports INTEGER DEFAULT NULL,
  p_failed_imports INTEGER DEFAULT NULL,
  p_duplicate_contacts INTEGER DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Validate ownership
  IF NOT EXISTS (SELECT 1 FROM contact_import_jobs WHERE id = p_job_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Import job not found or access denied';
  END IF;
  
  UPDATE contact_import_jobs
  SET 
    processed_rows = p_processed_rows,
    successful_imports = COALESCE(p_successful_imports, successful_imports),
    failed_imports = COALESCE(p_failed_imports, failed_imports),
    duplicate_contacts = COALESCE(p_duplicate_contacts, duplicate_contacts),
    status = CASE 
      WHEN processed_rows >= total_rows THEN 'completed'
      ELSE 'processing'
    END
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete import job
CREATE OR REPLACE FUNCTION complete_import_job(
  p_job_id UUID,
  p_user_id UUID,
  p_status TEXT DEFAULT 'completed',
  p_results JSONB DEFAULT '{}',
  p_error_details JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
BEGIN
  -- Validate ownership and status
  IF NOT EXISTS (SELECT 1 FROM contact_import_jobs WHERE id = p_job_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Import job not found or access denied';
  END IF;
  
  UPDATE contact_import_jobs
  SET 
    status = p_status,
    import_results = p_results,
    error_details = p_error_details,
    completed_at = NOW()
  WHERE id = p_job_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log import error
CREATE OR REPLACE FUNCTION log_import_error(
  p_job_id UUID,
  p_user_id UUID,
  p_row_number INTEGER,
  p_error_type TEXT,
  p_error_message TEXT,
  p_column_name TEXT DEFAULT NULL,
  p_raw_value TEXT DEFAULT NULL,
  p_row_data JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  error_id UUID;
BEGIN
  INSERT INTO contact_import_errors (
    import_job_id,
    user_id,
    row_number,
    column_name,
    error_type,
    error_message,
    raw_value,
    row_data
  ) VALUES (
    p_job_id,
    p_user_id,
    p_row_number,
    p_error_type,
    p_error_message,
    p_column_name,
    p_raw_value,
    p_row_data
  ) RETURNING id INTO error_id;
  
  RETURN error_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get import job summary
CREATE OR REPLACE FUNCTION get_import_job_summary(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  id UUID,
  file_name TEXT,
  status TEXT,
  total_rows INTEGER,
  successful_imports INTEGER,
  failed_imports INTEGER,
  duplicate_contacts INTEGER,
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_duration INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cij.id,
    cij.file_name,
    cij.status,
    cij.total_rows,
    cij.successful_imports,
    cij.failed_imports,
    cij.duplicate_contacts,
    cij.created_at,
    cij.completed_at,
    cij.completed_at - cij.started_at as processing_duration
  FROM contact_import_jobs cij
  WHERE cij.user_id = p_user_id
  ORDER BY cij.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old import jobs
CREATE OR REPLACE FUNCTION cleanup_old_import_jobs(
  p_retention_days INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old completed import jobs and their errors
  WITH deleted_jobs AS (
    DELETE FROM contact_import_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND completed_at < NOW() - INTERVAL '1 day' * p_retention_days
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted_jobs;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add table comments
COMMENT ON TABLE contact_import_jobs IS 'Tracking table for bulk contact import operations';
COMMENT ON TABLE contact_import_errors IS 'Detailed error logging for contact import failures';

COMMENT ON COLUMN contact_import_jobs.column_mapping IS 'JSONB mapping of CSV columns to contact fields';
COMMENT ON COLUMN contact_import_jobs.duplicate_handling IS 'Strategy for handling duplicate contacts during import';
COMMENT ON COLUMN contact_import_jobs.import_results IS 'Summary results and statistics from import process';
COMMENT ON COLUMN contact_import_errors.row_data IS 'Full row data context for debugging import errors';

-- Create view for import job statistics
CREATE OR REPLACE VIEW import_job_statistics AS
SELECT 
  user_id,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
  COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as active_jobs,
  SUM(successful_imports) as total_contacts_imported,
  SUM(failed_imports) as total_import_failures,
  SUM(duplicate_contacts) as total_duplicates_found,
  AVG(completed_at - started_at) FILTER (WHERE completed_at IS NOT NULL) as avg_processing_time,
  MAX(created_at) as last_import_date
FROM contact_import_jobs
GROUP BY user_id;

COMMENT ON VIEW import_job_statistics IS 'Summary statistics for contact import operations by user';

-- Create function to validate CSV column mapping
CREATE OR REPLACE FUNCTION validate_column_mapping(
  p_mapping JSONB,
  p_required_fields TEXT[] DEFAULT '{"first_name"}'
) RETURNS TABLE (
  is_valid BOOLEAN,
  missing_fields TEXT[],
  invalid_mappings TEXT[]
) AS $$
DECLARE
  mapped_fields TEXT[];
  missing TEXT[] := '{}';
  invalid TEXT[] := '{}';
  valid_fields TEXT[] := ARRAY[
    'first_name', 'last_name', 'organization', 'job_title', 'department',
    'email', 'phone', 'mobile', 'notes', 'tags', 'contact_type'
  ];
  field TEXT;
BEGIN
  -- Extract mapped field names
  SELECT ARRAY(SELECT jsonb_object_keys(p_mapping)) INTO mapped_fields;
  
  -- Check for missing required fields
  FOREACH field IN ARRAY p_required_fields
  LOOP
    IF NOT (field = ANY(mapped_fields)) THEN
      missing := missing || field;
    END IF;
  END LOOP;
  
  -- Check for invalid field mappings
  FOREACH field IN ARRAY mapped_fields
  LOOP
    IF NOT (field = ANY(valid_fields)) THEN
      invalid := invalid || field;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    (array_length(missing, 1) IS NULL AND array_length(invalid, 1) IS NULL) as is_valid,
    missing as missing_fields,
    invalid as invalid_mappings;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
