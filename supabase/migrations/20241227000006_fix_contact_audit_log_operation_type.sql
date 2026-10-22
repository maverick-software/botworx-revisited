-- Migration: Fix Contact Audit Log Operation Type
-- Purpose: Fix the operation_type value in create_contact_with_validation function
-- Issue: Function uses 'created' but constraint only allows 'create'
-- File: 20241227000006_fix_contact_audit_log_operation_type.sql

-- Update the contact creation function to use correct operation_type
CREATE OR REPLACE FUNCTION create_contact_with_validation(
  p_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_organization TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL,
  p_contact_type TEXT DEFAULT 'external',
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_mobile TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT '{}',
  p_custom_fields JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  contact_id UUID;
  email_channel_id UUID;
  phone_channel_id UUID;
  mobile_channel_id UUID;
BEGIN
  -- Validate required fields
  IF LENGTH(TRIM(p_first_name)) = 0 THEN
    RAISE EXCEPTION 'First name is required';
  END IF;
  
  -- Create contact
  INSERT INTO contacts (
    user_id, first_name, last_name, organization, job_title, 
    contact_type, notes, tags, custom_fields
  ) VALUES (
    p_user_id, TRIM(p_first_name), NULLIF(TRIM(p_last_name), ''), 
    NULLIF(TRIM(p_organization), ''), NULLIF(TRIM(p_job_title), ''),
    p_contact_type, NULLIF(TRIM(p_notes), ''), p_tags, p_custom_fields
  ) RETURNING id INTO contact_id;
  
  -- Add email channel if provided
  IF p_email IS NOT NULL AND LENGTH(TRIM(p_email)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, is_primary, is_active
    ) VALUES (
      contact_id, p_user_id, 'email', TRIM(p_email), true, true
    ) RETURNING id INTO email_channel_id;
  END IF;
  
  -- Add phone channel if provided
  IF p_phone IS NOT NULL AND LENGTH(TRIM(p_phone)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, is_primary, is_active
    ) VALUES (
      contact_id, p_user_id, 'phone', TRIM(p_phone), true, true
    ) RETURNING id INTO phone_channel_id;
  END IF;
  
  -- Add mobile channel if provided
  IF p_mobile IS NOT NULL AND LENGTH(TRIM(p_mobile)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, 
      is_primary, is_active
    ) VALUES (
      contact_id, p_user_id, 'mobile', TRIM(p_mobile), 
      -- Set as primary if no phone channel exists
      (phone_channel_id IS NULL), true
    ) RETURNING id INTO mobile_channel_id;
  END IF;
  
  -- Log contact creation (FIXED: use 'create' not 'created')
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, operation_details
  ) VALUES (
    contact_id, p_user_id, 'create', 
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'organization', p_organization,
      'email_added', email_channel_id IS NOT NULL,
      'phone_added', phone_channel_id IS NOT NULL,
      'mobile_added', mobile_channel_id IS NOT NULL
    )
  );
  
  RETURN contact_id;
END;
$$;

-- Add function comment
COMMENT ON FUNCTION create_contact_with_validation(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB) IS 'Contact creation with validation, audit logging, and mobile number support - fixed operation_type value';
