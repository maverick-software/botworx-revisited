-- Migration: Enhance Contact Search Functions
-- Purpose: Add support for advanced search patterns including phone numbers, emails, and natural language queries
-- Dependencies: contact functions from 20250916000007
-- File: 20250916000011_enhance_contact_search_functions.sql

-- Enhanced contact search function with pattern matching
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
    -- Enhanced text search filter
    AND (p_query IS NULL OR p_query = '' OR 
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
      WHEN p_query IS NOT NULL AND p_query != '' THEN
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
    CASE WHEN p_query IS NOT NULL AND p_query != '' THEN
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

-- Function to get contact suggestions based on partial input
CREATE OR REPLACE FUNCTION suggest_contacts_for_agent(
  p_agent_id UUID,
  p_user_id UUID,
  p_partial_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  contact_id UUID,
  display_name TEXT,
  organization TEXT,
  job_title TEXT,
  contact_type TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  match_type TEXT,
  relevance_score INTEGER
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
  WITH contact_matches AS (
    SELECT 
      c.id as contact_id,
      c.display_name,
      c.organization,
      c.job_title,
      c.contact_type,
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
      -- Determine match type and score
      CASE 
        WHEN c.display_name ILIKE p_partial_query || '%' THEN 'name_prefix'
        WHEN c.display_name ILIKE '%' || p_partial_query || '%' THEN 'name_contains'
        WHEN c.organization ILIKE p_partial_query || '%' THEN 'org_prefix'
        WHEN c.organization ILIKE '%' || p_partial_query || '%' THEN 'org_contains'
        WHEN c.job_title ILIKE p_partial_query || '%' THEN 'title_prefix'
        WHEN c.job_title ILIKE '%' || p_partial_query || '%' THEN 'title_contains'
        ELSE 'other'
      END as match_type,
      CASE 
        WHEN c.display_name ILIKE p_partial_query || '%' THEN 100
        WHEN c.display_name ILIKE '%' || p_partial_query || '%' THEN 90
        WHEN c.organization ILIKE p_partial_query || '%' THEN 80
        WHEN c.organization ILIKE '%' || p_partial_query || '%' THEN 70
        WHEN c.job_title ILIKE p_partial_query || '%' THEN 60
        WHEN c.job_title ILIKE '%' || p_partial_query || '%' THEN 50
        ELSE 10
      END as relevance_score
    FROM contacts c
    WHERE c.user_id = p_user_id
      AND c.contact_status = 'active'
      AND c.deleted_at IS NULL
      AND (
        c.display_name ILIKE '%' || p_partial_query || '%' OR
        c.organization ILIKE '%' || p_partial_query || '%' OR
        c.job_title ILIKE '%' || p_partial_query || '%'
      )
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
  )
  SELECT * FROM contact_matches
  ORDER BY relevance_score DESC, display_name ASC
  LIMIT p_limit;
END;
$$;

-- Function to get contact statistics for agent
CREATE OR REPLACE FUNCTION get_contact_stats_for_agent(
  p_agent_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  total_contacts INTEGER,
  contacts_by_type JSONB,
  contacts_with_phone INTEGER,
  contacts_with_email INTEGER,
  contacts_with_whatsapp INTEGER,
  recent_interactions INTEGER,
  top_organizations JSONB
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
  WITH accessible_contacts AS (
    SELECT c.*
    FROM contacts c
    WHERE c.user_id = p_user_id
      AND c.contact_status = 'active'
      AND c.deleted_at IS NULL
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
  )
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM accessible_contacts) as total_contacts,
    (SELECT jsonb_object_agg(contact_type, type_count)
     FROM (
       SELECT contact_type, COUNT(*) as type_count
       FROM accessible_contacts
       GROUP BY contact_type
     ) t) as contacts_by_type,
    (SELECT COUNT(DISTINCT ac.id)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_communication_channels ccc ON ac.id = ccc.contact_id
     WHERE ccc.channel_type IN ('phone', 'mobile') AND ccc.is_active = TRUE) as contacts_with_phone,
    (SELECT COUNT(DISTINCT ac.id)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_communication_channels ccc ON ac.id = ccc.contact_id
     WHERE ccc.channel_type = 'email' AND ccc.is_active = TRUE) as contacts_with_email,
    (SELECT COUNT(DISTINCT ac.id)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_communication_channels ccc ON ac.id = ccc.contact_id
     WHERE ccc.channel_type = 'whatsapp' AND ccc.is_active = TRUE) as contacts_with_whatsapp,
    (SELECT COUNT(*)::INTEGER
     FROM accessible_contacts ac
     INNER JOIN contact_interactions ci ON ac.id = ci.contact_id
     WHERE ci.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days') as recent_interactions,
    (SELECT jsonb_agg(jsonb_build_object('organization', organization, 'count', contact_count))
     FROM (
       SELECT organization, COUNT(*) as contact_count
       FROM accessible_contacts
       WHERE organization IS NOT NULL AND organization != ''
       GROUP BY organization
       ORDER BY contact_count DESC
       LIMIT 10
     ) t) as top_organizations;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_contacts_for_agent_enhanced TO authenticated;
GRANT EXECUTE ON FUNCTION suggest_contacts_for_agent TO authenticated;
GRANT EXECUTE ON FUNCTION get_contact_stats_for_agent TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION search_contacts_for_agent_enhanced IS 'Enhanced contact search with natural language parsing support, phone pattern matching, and advanced filtering';
COMMENT ON FUNCTION suggest_contacts_for_agent IS 'Provides contact suggestions based on partial input for autocomplete functionality';
COMMENT ON FUNCTION get_contact_stats_for_agent IS 'Returns comprehensive contact statistics for agent dashboard';
