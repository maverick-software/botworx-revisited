-- Migration: Create Contact Management Functions
-- Purpose: Core database functions for contact operations and MCP tools
-- Dependencies: All previous contact tables
-- File: 20250916000007_create_contact_functions.sql

-- Function to search contacts for agent (MCP tool support)
CREATE OR REPLACE FUNCTION search_contacts_for_agent(
  p_agent_id UUID,
  p_user_id UUID,
  p_query TEXT DEFAULT NULL,
  p_contact_type TEXT DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_channel_type TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  contact_id UUID,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  organization TEXT,
  job_title TEXT,
  contact_type TEXT,
  contact_status TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  tags TEXT[],
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  interaction_count BIGINT,
  has_channel BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate agent ownership
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Check agent permissions
  IF NOT check_agent_contact_permission(p_agent_id, NULL, 'view') THEN
    RAISE EXCEPTION 'Agent does not have contact access permissions';
  END IF;
  
  -- Return filtered contacts based on permissions and search criteria
  RETURN QUERY
  SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.display_name,
    c.organization,
    c.job_title,
    c.contact_type,
    c.contact_status,
    -- Get primary email
    (SELECT ccc.channel_identifier 
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id 
       AND ccc.channel_type = 'email' 
       AND ccc.is_primary = TRUE 
       AND ccc.is_active = TRUE 
     LIMIT 1) as primary_email,
    -- Get primary phone
    (SELECT ccc.channel_identifier 
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id 
       AND ccc.channel_type IN ('phone', 'mobile') 
       AND ccc.is_primary = TRUE 
       AND ccc.is_active = TRUE 
     LIMIT 1) as primary_phone,
    c.tags,
    c.last_contacted_at,
    c.created_at,
    -- Count interactions
    (SELECT COUNT(*) 
     FROM contact_interactions ci 
     WHERE ci.contact_id = c.id) as interaction_count,
    -- Check if contact has specified channel type
    CASE 
      WHEN p_channel_type IS NULL THEN TRUE
      ELSE EXISTS (
        SELECT 1 FROM contact_communication_channels ccc 
        WHERE ccc.contact_id = c.id 
          AND ccc.channel_type = p_channel_type 
          AND ccc.is_active = TRUE
      )
    END as has_channel
  FROM contacts c
  WHERE c.user_id = p_user_id
    AND c.contact_status = 'active'
    AND c.deleted_at IS NULL
    -- Text search filter
    AND (p_query IS NULL OR 
         c.display_name ILIKE '%' || p_query || '%' OR
         c.organization ILIKE '%' || p_query || '%' OR
         c.job_title ILIKE '%' || p_query || '%' OR
         c.notes ILIKE '%' || p_query || '%')
    -- Contact type filter
    AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
    -- Tags filter
    AND (p_tags IS NULL OR c.tags && p_tags)
    -- Group membership filter
    AND (p_group_id IS NULL OR EXISTS (
      SELECT 1 FROM contact_group_memberships cgm 
      WHERE cgm.contact_id = c.id AND cgm.group_id = p_group_id
    ))
    -- Channel type filter
    AND (p_channel_type IS NULL OR EXISTS (
      SELECT 1 FROM contact_communication_channels ccc 
      WHERE ccc.contact_id = c.id 
        AND ccc.channel_type = p_channel_type 
        AND ccc.is_active = TRUE
    ))
    -- Apply agent-specific access controls
    AND (
      -- Agent has all_contacts permission
      EXISTS (
        SELECT 1 FROM agent_contact_permissions acp
        WHERE acp.agent_id = p_agent_id 
          AND acp.permission_type = 'all_contacts'
          AND (acp.expires_at IS NULL OR acp.expires_at > CURRENT_TIMESTAMP)
      ) OR
      -- Agent has specific access to this contact
      EXISTS (
        SELECT 1 FROM agent_specific_contact_access asca
        WHERE asca.agent_id = p_agent_id 
          AND asca.contact_id = c.id
          AND asca.access_level != 'no_access'
          AND (asca.expires_at IS NULL OR asca.expires_at > CURRENT_TIMESTAMP)
      ) OR
      -- Agent has group access to this contact
      EXISTS (
        SELECT 1 FROM agent_group_access aga
        INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
        WHERE aga.agent_id = p_agent_id 
          AND cgm.contact_id = c.id
          AND (aga.expires_at IS NULL OR aga.expires_at > CURRENT_TIMESTAMP)
      )
    )
  ORDER BY 
    CASE WHEN p_query IS NOT NULL THEN
      ts_rank(to_tsvector('english', c.display_name || ' ' || COALESCE(c.organization, '')), 
               plainto_tsquery('english', p_query))
    ELSE 0 END DESC,
    c.last_contacted_at DESC NULLS LAST,
    c.display_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to get contact details for agent (MCP tool support)
CREATE OR REPLACE FUNCTION get_contact_details_for_agent(
  p_agent_id UUID,
  p_user_id UUID,
  p_contact_id UUID
)
RETURNS TABLE (
  contact_id UUID,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  organization TEXT,
  job_title TEXT,
  department TEXT,
  contact_type TEXT,
  contact_status TEXT,
  notes TEXT,
  tags TEXT[],
  custom_fields JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_contacted_at TIMESTAMPTZ,
  communication_channels JSONB,
  recent_interactions JSONB,
  groups JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate agent ownership
  IF NOT EXISTS (
    SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Check agent permission for this specific contact
  IF NOT check_agent_contact_permission(p_agent_id, p_contact_id, 'view') THEN
    RAISE EXCEPTION 'Agent does not have permission to view this contact';
  END IF;
  
  -- Return contact details
  RETURN QUERY
  SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.display_name,
    c.organization,
    c.job_title,
    c.department,
    c.contact_type,
    c.contact_status,
    c.notes,
    c.tags,
    c.custom_fields,
    c.created_at,
    c.updated_at,
    c.last_contacted_at,
    -- Get communication channels as JSONB
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', ccc.id,
         'type', ccc.channel_type,
         'identifier', ccc.channel_identifier,
         'label', ccc.display_label,
         'is_primary', ccc.is_primary,
         'is_verified', ccc.is_verified,
         'can_receive_marketing', ccc.can_receive_marketing
       )
     )
     FROM contact_communication_channels ccc 
     WHERE ccc.contact_id = c.id AND ccc.is_active = TRUE
    ) as communication_channels,
    -- Get recent interactions as JSONB
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', ci.id,
         'type', ci.interaction_type,
         'channel', ci.channel_type,
         'direction', ci.direction,
         'summary', ci.interaction_summary,
         'date', ci.interaction_at,
         'agent_name', a.name
       ) ORDER BY ci.interaction_at DESC
     )
     FROM contact_interactions ci
     INNER JOIN agents a ON ci.agent_id = a.id
     WHERE ci.contact_id = c.id
     LIMIT 10
    ) as recent_interactions,
    -- Get groups as JSONB
    (SELECT jsonb_agg(
       jsonb_build_object(
         'id', cg.id,
         'name', cg.name,
         'type', cg.group_type
       )
     )
     FROM contact_group_memberships cgm
     INNER JOIN contact_groups cg ON cgm.group_id = cg.id
     WHERE cgm.contact_id = c.id
    ) as groups
  FROM contacts c
  WHERE c.id = p_contact_id 
    AND c.user_id = p_user_id
    AND c.deleted_at IS NULL;
END;
$$;

-- Function for GDPR data export
CREATE OR REPLACE FUNCTION export_contact_data_for_subject(
  p_contact_id UUID,
  p_user_id UUID
) 
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  contact_data JSONB;
  channels_data JSONB;
  interactions_data JSONB;
  groups_data JSONB;
  result JSONB;
BEGIN
  -- Validate contact ownership
  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Get contact data
  SELECT jsonb_build_object(
    'id', id,
    'first_name', first_name,
    'last_name', last_name,
    'organization', organization,
    'job_title', job_title,
    'department', department,
    'notes', notes,
    'tags', tags,
    'contact_type', contact_type,
    'contact_status', contact_status,
    'custom_fields', custom_fields,
    'consent_status', consent_status,
    'consent_date', consent_date,
    'legal_basis', legal_basis,
    'data_processing_purpose', data_processing_purpose,
    'created_at', created_at,
    'updated_at', updated_at,
    'last_contacted_at', last_contacted_at
  ) INTO contact_data
  FROM contacts WHERE id = p_contact_id;
  
  -- Get communication channels
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'channel_type', channel_type,
      'channel_identifier', channel_identifier,
      'display_label', display_label,
      'is_primary', is_primary,
      'is_verified', is_verified,
      'marketing_consent', marketing_consent,
      'marketing_consent_date', marketing_consent_date,
      'created_at', created_at,
      'last_used_at', last_used_at
    )
  ) INTO channels_data
  FROM contact_communication_channels 
  WHERE contact_id = p_contact_id;
  
  -- Get interaction history (summary only for privacy)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'interaction_type', interaction_type,
      'channel_type', channel_type,
      'direction', direction,
      'interaction_summary', interaction_summary,
      'interaction_at', interaction_at,
      'delivery_status', delivery_status
    )
  ) INTO interactions_data
  FROM contact_interactions 
  WHERE contact_id = p_contact_id;
  
  -- Get group memberships
  SELECT jsonb_agg(
    jsonb_build_object(
      'group_name', cg.name,
      'group_type', cg.group_type,
      'added_at', cgm.added_at
    )
  ) INTO groups_data
  FROM contact_group_memberships cgm
  INNER JOIN contact_groups cg ON cgm.group_id = cg.id
  WHERE cgm.contact_id = p_contact_id;
  
  -- Build complete export
  result := jsonb_build_object(
    'export_date', NOW(),
    'contact_info', contact_data,
    'communication_channels', COALESCE(channels_data, '[]'::jsonb),
    'interaction_history', COALESCE(interactions_data, '[]'::jsonb),
    'group_memberships', COALESCE(groups_data, '[]'::jsonb),
    'data_controller', 'Gofr Agents Platform',
    'export_reason', 'GDPR Article 15 - Right of Access'
  );
  
  RETURN result;
END;
$$;

-- Function for GDPR compliant contact deletion
CREATE OR REPLACE FUNCTION gdpr_delete_contact(
  p_contact_id UUID,
  p_user_id UUID,
  p_deletion_reason TEXT DEFAULT 'User requested deletion'
) 
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  contact_record RECORD;
BEGIN
  -- Validate contact ownership
  SELECT * INTO contact_record
  FROM contacts 
  WHERE id = p_contact_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Log the deletion in audit trail
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, operation_details
  ) VALUES (
    p_contact_id, p_user_id, 'gdpr_request', 
    jsonb_build_object(
      'action', 'delete',
      'reason', p_deletion_reason,
      'contact_name', contact_record.display_name,
      'deletion_date', NOW()
    )
  );
  
  -- Soft delete first (mark as deleted)
  UPDATE contacts 
  SET 
    deleted_at = NOW(),
    deletion_reason = p_deletion_reason,
    contact_status = 'archived'
  WHERE id = p_contact_id;
  
  -- Hard delete after audit log (CASCADE will handle related records)
  DELETE FROM contacts WHERE id = p_contact_id;
  
  RETURN TRUE;
END;
$$;

-- Function to apply data retention policies
CREATE OR REPLACE FUNCTION apply_retention_policies()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  contact_record RECORD;
BEGIN
  -- Find contacts that should be deleted based on retention policies
  FOR contact_record IN
    SELECT id, user_id, display_name, data_retention_date
    FROM contacts
    WHERE data_retention_date IS NOT NULL 
      AND data_retention_date <= CURRENT_TIMESTAMP
      AND deleted_at IS NULL
  LOOP
    -- Log retention deletion
    INSERT INTO contact_audit_log (
      contact_id, user_id, operation_type, operation_details
    ) VALUES (
      contact_record.id, contact_record.user_id, 'gdpr_request',
      jsonb_build_object(
        'action', 'retention_delete',
        'retention_date', contact_record.data_retention_date,
        'contact_name', contact_record.display_name,
        'deletion_date', NOW()
      )
    );
    
    -- Perform deletion
    DELETE FROM contacts WHERE id = contact_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;
  
  RETURN deleted_count;
END;
$$;

-- Function to create contact with validation
CREATE OR REPLACE FUNCTION create_contact_with_validation(
  p_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT DEFAULT NULL,
  p_organization TEXT DEFAULT NULL,
  p_job_title TEXT DEFAULT NULL,
  p_contact_type TEXT DEFAULT 'external',
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
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
      contact_id, user_id, channel_type, channel_identifier, 
      is_primary, display_label
    ) VALUES (
      contact_id, p_user_id, 'email', TRIM(p_email), 
      TRUE, 'Primary Email'
    ) RETURNING id INTO email_channel_id;
  END IF;
  
  -- Add phone channel if provided
  IF p_phone IS NOT NULL AND LENGTH(TRIM(p_phone)) > 0 THEN
    INSERT INTO contact_communication_channels (
      contact_id, user_id, channel_type, channel_identifier, 
      is_primary, display_label
    ) VALUES (
      contact_id, p_user_id, 'phone', TRIM(p_phone), 
      TRUE, 'Primary Phone'
    ) RETURNING id INTO phone_channel_id;
  END IF;
  
  -- Log creation
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, operation_details
  ) VALUES (
    contact_id, p_user_id, 'create',
    jsonb_build_object(
      'first_name', p_first_name,
      'last_name', p_last_name,
      'organization', p_organization,
      'email_added', email_channel_id IS NOT NULL,
      'phone_added', phone_channel_id IS NOT NULL
    )
  );
  
  RETURN contact_id;
END;
$$;

-- Function to update contact with audit trail
CREATE OR REPLACE FUNCTION update_contact_with_audit(
  p_contact_id UUID,
  p_user_id UUID,
  p_updates JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_values JSONB;
  field_name TEXT;
  field_value TEXT;
  update_sql TEXT := 'UPDATE contacts SET updated_at = NOW()';
  where_clause TEXT := ' WHERE id = $1 AND user_id = $2';
BEGIN
  -- Validate contact ownership
  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Get current values for audit
  SELECT jsonb_build_object(
    'first_name', first_name,
    'last_name', last_name,
    'organization', organization,
    'job_title', job_title,
    'department', department,
    'notes', notes,
    'tags', tags,
    'contact_type', contact_type,
    'custom_fields', custom_fields
  ) INTO old_values
  FROM contacts WHERE id = p_contact_id;
  
  -- Build dynamic update query
  FOR field_name IN SELECT jsonb_object_keys(p_updates)
  LOOP
    field_value := p_updates ->> field_name;
    update_sql := update_sql || ', ' || field_name || ' = ' || quote_literal(field_value);
  END LOOP;
  
  -- Execute update
  EXECUTE update_sql || where_clause USING p_contact_id, p_user_id;
  
  -- Log the update
  INSERT INTO contact_audit_log (
    contact_id, user_id, operation_type, old_values, new_values, operation_details
  ) VALUES (
    p_contact_id, p_user_id, 'update', old_values, p_updates,
    jsonb_build_object('updated_fields', jsonb_object_keys(p_updates))
  );
  
  RETURN TRUE;
END;
$$;

-- Add function comments
COMMENT ON FUNCTION search_contacts_for_agent IS 'MCP tool function to search contacts with agent permission validation';
COMMENT ON FUNCTION get_contact_details_for_agent IS 'MCP tool function to get detailed contact information for agents';
COMMENT ON FUNCTION export_contact_data_for_subject IS 'GDPR Article 15 compliant data export function';
COMMENT ON FUNCTION gdpr_delete_contact IS 'GDPR compliant contact deletion with audit trail';
COMMENT ON FUNCTION apply_retention_policies IS 'Automated data retention policy enforcement';
COMMENT ON FUNCTION create_contact_with_validation IS 'Contact creation with validation and audit logging';
COMMENT ON FUNCTION update_contact_with_audit IS 'Contact update with comprehensive audit trail';
