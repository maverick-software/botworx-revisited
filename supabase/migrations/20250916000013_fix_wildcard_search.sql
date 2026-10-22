-- Migration: Fix Wildcard Search for Contact Management
-- Purpose: Handle "*" as a wildcard to return all contacts
-- Dependencies: search_contacts_for_agent_enhanced function
-- File: 20250916000013_fix_wildcard_search.sql

-- Update the enhanced search function to handle "*" as a wildcard
CREATE OR REPLACE FUNCTION search_contacts_for_agent_enhanced(
  p_agent_id UUID,
  p_user_id UUID,
  p_query TEXT DEFAULT NULL,
  p_contact_type TEXT DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_channel_type TEXT DEFAULT NULL,
  p_organization_filter TEXT DEFAULT NULL,
  p_job_title_filter TEXT DEFAULT NULL,
  p_phone_pattern TEXT DEFAULT NULL,
  p_email_pattern TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
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
  -- Validate agent ownership and permissions
  IF NOT check_agent_contact_permission(p_agent_id, NULL, 'view') THEN
    RAISE EXCEPTION 'Agent does not have contact access permissions';
  END IF;

  RETURN QUERY
  SELECT 
    c.id as contact_id,
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
    -- Enhanced text search filter - treat "*" as wildcard for all contacts
    AND (p_query IS NULL OR p_query = '' OR p_query = '*' OR 
         c.display_name ILIKE '%' || p_query || '%' OR
         c.organization ILIKE '%' || p_query || '%' OR
         c.job_title ILIKE '%' || p_query || '%' OR
         c.notes ILIKE '%' || p_query || '%' OR
         c.first_name ILIKE '%' || p_query || '%' OR
         c.last_name ILIKE '%' || p_query || '%')
    -- Contact type filter
    AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
    -- Organization filter
    AND (p_organization_filter IS NULL OR c.organization ILIKE '%' || p_organization_filter || '%')
    -- Job title filter
    AND (p_job_title_filter IS NULL OR c.job_title ILIKE '%' || p_job_title_filter || '%')
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
    -- Phone pattern filter
    AND (p_phone_pattern IS NULL OR EXISTS (
      SELECT 1 FROM contact_communication_channels ccc 
      WHERE ccc.contact_id = c.id 
        AND ccc.channel_type IN ('phone', 'mobile', 'sms') 
        AND ccc.is_active = TRUE
        AND (
          ccc.channel_identifier LIKE p_phone_pattern || '%' OR
          ccc.channel_identifier LIKE '%' || p_phone_pattern || '%' OR
          REGEXP_REPLACE(ccc.channel_identifier, '[^0-9]', '', 'g') LIKE p_phone_pattern || '%'
        )
    ))
    -- Email pattern filter
    AND (p_email_pattern IS NULL OR EXISTS (
      SELECT 1 FROM contact_communication_channels ccc 
      WHERE ccc.contact_id = c.id 
        AND ccc.channel_type = 'email' 
        AND ccc.is_active = TRUE
        AND ccc.channel_identifier ILIKE '%' || p_email_pattern || '%'
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
    -- Prioritize exact matches
    CASE 
      WHEN p_query IS NOT NULL AND p_query != '' AND p_query != '*' THEN
        CASE 
          WHEN c.display_name ILIKE p_query THEN 1
          WHEN c.display_name ILIKE p_query || '%' THEN 2
          WHEN c.organization ILIKE p_query THEN 3
          WHEN c.job_title ILIKE p_query THEN 4
          ELSE 5
        END
      ELSE 0 
    END,
    -- Full text search ranking
    CASE WHEN p_query IS NOT NULL AND p_query != '' AND p_query != '*' THEN
      ts_rank(to_tsvector('english', c.display_name || ' ' || COALESCE(c.organization, '') || ' ' || COALESCE(c.job_title, '')), 
               plainto_tsquery('english', p_query))
    ELSE 0 END DESC,
    -- Recent contact priority
    c.last_contacted_at DESC NULLS LAST,
    -- Alphabetical fallback
    c.display_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Add comment about wildcard support
COMMENT ON FUNCTION search_contacts_for_agent_enhanced IS 'Enhanced contact search with natural language parsing support, phone pattern matching, advanced filtering, and "*" wildcard support for listing all contacts';
