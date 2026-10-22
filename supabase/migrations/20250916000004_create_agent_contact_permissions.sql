-- Migration: Create Agent Contact Permissions Tables
-- Purpose: Role-based access control for agent-contact interactions
-- Dependencies: contacts, contact_groups, agents tables
-- File: 20250916000004_create_agent_contact_permissions.sql

-- Create agent contact permissions table
CREATE TABLE IF NOT EXISTS agent_contact_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Permission scope
  permission_type TEXT DEFAULT 'specific_contacts' CHECK (permission_type IN (
    'all_contacts', 'specific_contacts', 'contact_groups', 'filtered_access', 'no_access'
  )),
  
  -- Access levels
  can_view BOOLEAN DEFAULT TRUE,
  can_contact BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_export BOOLEAN DEFAULT FALSE,
  
  -- Channel restrictions
  allowed_channels TEXT[] DEFAULT '{}', -- Empty array means all channels allowed
  restricted_channels TEXT[] DEFAULT '{}', -- Channels explicitly blocked
  
  -- Time restrictions
  access_schedule JSONB DEFAULT '{}', -- Business hours, timezone restrictions
  max_contacts_per_day INTEGER, -- Rate limiting
  max_messages_per_contact INTEGER, -- Message limits per contact
  
  -- Filter criteria (for filtered_access type)
  access_filters JSONB DEFAULT '{}', -- Dynamic filtering criteria
  
  -- Permission metadata
  permission_notes TEXT,
  permission_metadata JSONB DEFAULT '{}',
  granted_by_user_id UUID REFERENCES auth.users(id),
  
  -- Timestamps and expiration
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  
  -- Usage tracking
  total_contacts_accessed INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  last_contact_accessed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_permission_notes CHECK (
    permission_notes IS NULL OR LENGTH(permission_notes) <= 1000
  ),
  CONSTRAINT valid_rate_limits CHECK (
    max_contacts_per_day IS NULL OR max_contacts_per_day > 0
  ),
  CONSTRAINT valid_message_limits CHECK (
    max_messages_per_contact IS NULL OR max_messages_per_contact > 0
  ),
  CONSTRAINT channel_restrictions_valid CHECK (
    NOT (allowed_channels && restricted_channels) -- No overlap between allowed and restricted
  )
);

-- Unique constraint to prevent duplicate permissions for same agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_agent_permission 
  ON agent_contact_permissions(agent_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_agent_permissions_agent ON agent_contact_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_user ON agent_contact_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_type ON agent_contact_permissions(permission_type);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_granted_by ON agent_contact_permissions(granted_by_user_id);

-- Index for active permissions (removed NOW() as it's not immutable in index predicates)
CREATE INDEX IF NOT EXISTS idx_agent_permissions_active ON agent_contact_permissions(agent_id, user_id) 
  WHERE expires_at IS NULL;

-- JSONB indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_agent_permissions_schedule ON agent_contact_permissions USING GIN(access_schedule);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_filters ON agent_contact_permissions USING GIN(access_filters);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_metadata ON agent_contact_permissions USING GIN(permission_metadata);

-- Array indexes for channel restrictions
CREATE INDEX IF NOT EXISTS idx_agent_permissions_allowed_channels ON agent_contact_permissions USING GIN(allowed_channels);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_restricted_channels ON agent_contact_permissions USING GIN(restricted_channels);

-- Create agent specific contact access table
CREATE TABLE IF NOT EXISTS agent_specific_contact_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES agent_contact_permissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Specific permissions for this contact
  access_level TEXT DEFAULT 'view_and_contact' CHECK (access_level IN (
    'view_only', 'view_and_contact', 'full_access', 'no_access'
  )),
  
  -- Channel-specific overrides
  channel_permissions JSONB DEFAULT '{}', -- Override channel restrictions for this contact
  
  -- Contact-specific restrictions
  message_limit INTEGER, -- Override global message limit for this contact
  contact_frequency TEXT CHECK (contact_frequency IN (
    'unlimited', 'daily', 'weekly', 'monthly', 'as_needed'
  )),
  
  -- Access metadata
  access_reason TEXT,
  access_metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  
  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  
  -- Constraints
  CONSTRAINT valid_access_reason CHECK (
    access_reason IS NULL OR LENGTH(access_reason) <= 500
  ),
  CONSTRAINT valid_message_limit CHECK (
    message_limit IS NULL OR message_limit > 0
  )
);

-- Unique constraint to prevent duplicate access records
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_agent_contact_access 
  ON agent_specific_contact_access(agent_id, contact_id);

-- Performance indexes for specific access
CREATE INDEX IF NOT EXISTS idx_specific_access_agent ON agent_specific_contact_access(agent_id);
CREATE INDEX IF NOT EXISTS idx_specific_access_contact ON agent_specific_contact_access(contact_id);
CREATE INDEX IF NOT EXISTS idx_specific_access_permission ON agent_specific_contact_access(permission_id);
CREATE INDEX IF NOT EXISTS idx_specific_access_user ON agent_specific_contact_access(user_id);
CREATE INDEX IF NOT EXISTS idx_specific_access_level ON agent_specific_contact_access(access_level);

-- Index for active access records
CREATE INDEX IF NOT EXISTS idx_specific_access_active ON agent_specific_contact_access(agent_id, contact_id) 
  WHERE expires_at IS NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_specific_access_channel_perms ON agent_specific_contact_access USING GIN(channel_permissions);
CREATE INDEX IF NOT EXISTS idx_specific_access_metadata ON agent_specific_contact_access USING GIN(access_metadata);

-- Create agent group access table for group-based permissions
CREATE TABLE IF NOT EXISTS agent_group_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES agent_contact_permissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Group access level
  access_level TEXT DEFAULT 'view_and_contact' CHECK (access_level IN (
    'view_only', 'view_and_contact', 'full_access'
  )),
  
  -- Timestamps
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Unique constraint for agent-group access
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_agent_group_access 
  ON agent_group_access(agent_id, group_id);

-- Performance indexes for group access
CREATE INDEX IF NOT EXISTS idx_group_access_agent ON agent_group_access(agent_id);
CREATE INDEX IF NOT EXISTS idx_group_access_group ON agent_group_access(group_id);
CREATE INDEX IF NOT EXISTS idx_group_access_permission ON agent_group_access(permission_id);

-- Function to check if agent has permission to access contact
CREATE OR REPLACE FUNCTION check_agent_contact_permission(
  p_agent_id UUID,
  p_contact_id UUID,
  p_permission_type TEXT DEFAULT 'view'
) RETURNS BOOLEAN AS $$
DECLARE
  agent_user_id UUID;
  contact_user_id UUID;
  permission_record RECORD;
  specific_access_record RECORD;
  has_permission BOOLEAN := FALSE;
BEGIN
  -- Get agent owner
  SELECT user_id INTO agent_user_id FROM agents WHERE id = p_agent_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get contact owner (if specific contact is provided)
  IF p_contact_id IS NOT NULL THEN
    SELECT user_id INTO contact_user_id FROM contacts WHERE id = p_contact_id;
    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;
    
    -- Agents can only access contacts owned by the same user
    IF agent_user_id != contact_user_id THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  -- Get agent permissions
  SELECT * INTO permission_record
  FROM agent_contact_permissions
  WHERE agent_id = p_agent_id 
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check permission type
  CASE permission_record.permission_type
    WHEN 'no_access' THEN
      RETURN FALSE;
    WHEN 'all_contacts' THEN
      has_permission := TRUE;
    WHEN 'specific_contacts' THEN
      -- For general search (p_contact_id IS NULL), allow if agent has any specific contact access
      -- For specific contact, check specific access table
      IF p_contact_id IS NULL THEN
        has_permission := EXISTS (
          SELECT 1 FROM agent_specific_contact_access
          WHERE agent_id = p_agent_id 
            AND (expires_at IS NULL OR expires_at > NOW())
            AND access_level != 'no_access'
        );
      ELSE
        SELECT * INTO specific_access_record
        FROM agent_specific_contact_access
        WHERE agent_id = p_agent_id 
          AND contact_id = p_contact_id
          AND (expires_at IS NULL OR expires_at > NOW());
        
        has_permission := FOUND AND specific_access_record.access_level != 'no_access';
      END IF;
    WHEN 'contact_groups' THEN
      -- For general search (p_contact_id IS NULL), allow if agent has any group access
      -- For specific contact, check if contact is in any group the agent has access to
      IF p_contact_id IS NULL THEN
        has_permission := EXISTS (
          SELECT 1 FROM agent_group_access
          WHERE agent_id = p_agent_id
            AND (expires_at IS NULL OR expires_at > NOW())
        );
      ELSE
        has_permission := EXISTS (
          SELECT 1
          FROM agent_group_access aga
          INNER JOIN contact_group_memberships cgm ON aga.group_id = cgm.group_id
          WHERE aga.agent_id = p_agent_id
            AND cgm.contact_id = p_contact_id
            AND (aga.expires_at IS NULL OR aga.expires_at > NOW())
        );
      END IF;
    WHEN 'filtered_access' THEN
      -- Apply filters from access_filters JSONB
      -- This would need custom logic based on filter criteria
      has_permission := TRUE; -- Simplified for now
  END CASE;
  
  -- Check specific permission type
  IF has_permission THEN
    CASE p_permission_type
      WHEN 'view' THEN
        has_permission := permission_record.can_view;
      WHEN 'contact' THEN
        has_permission := permission_record.can_contact;
      WHEN 'edit' THEN
        has_permission := permission_record.can_edit;
      WHEN 'delete' THEN
        has_permission := permission_record.can_delete;
      WHEN 'export' THEN
        has_permission := permission_record.can_export;
    END CASE;
  END IF;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to grant agent access to specific contact
CREATE OR REPLACE FUNCTION grant_agent_contact_access(
  p_agent_id UUID,
  p_contact_id UUID,
  p_user_id UUID,
  p_access_level TEXT DEFAULT 'view_and_contact',
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  permission_id UUID;
  access_id UUID;
BEGIN
  -- Validate inputs
  IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Contact not found or access denied';
  END IF;
  
  -- Get or create agent permission record
  SELECT id INTO permission_id
  FROM agent_contact_permissions
  WHERE agent_id = p_agent_id;
  
  IF NOT FOUND THEN
    INSERT INTO agent_contact_permissions (agent_id, user_id, permission_type)
    VALUES (p_agent_id, p_user_id, 'specific_contacts')
    RETURNING id INTO permission_id;
  END IF;
  
  -- Insert or update specific access
  INSERT INTO agent_specific_contact_access (
    agent_id, contact_id, permission_id, user_id, access_level, expires_at
  ) VALUES (
    p_agent_id, p_contact_id, permission_id, p_user_id, p_access_level, p_expires_at
  )
  ON CONFLICT (agent_id, contact_id)
  DO UPDATE SET
    access_level = EXCLUDED.access_level,
    expires_at = EXCLUDED.expires_at,
    granted_at = NOW()
  RETURNING id INTO access_id;
  
  RETURN access_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to revoke agent access to contact
CREATE OR REPLACE FUNCTION revoke_agent_contact_access(
  p_agent_id UUID,
  p_contact_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Validate ownership
  IF NOT EXISTS (SELECT 1 FROM agents WHERE id = p_agent_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'Agent not found or access denied';
  END IF;
  
  -- Remove specific access
  DELETE FROM agent_specific_contact_access
  WHERE agent_id = p_agent_id 
    AND contact_id = p_contact_id 
    AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update permission usage statistics
CREATE OR REPLACE FUNCTION update_permission_usage()
RETURNS TRIGGER AS $$
BEGIN
  -- Update permission statistics
  UPDATE agent_contact_permissions
  SET 
    last_used_at = NOW(),
    total_contacts_accessed = total_contacts_accessed + 1,
    last_contact_accessed_at = NOW()
  WHERE agent_id = NEW.agent_id;
  
  -- Update specific access statistics
  UPDATE agent_specific_contact_access
  SET 
    last_accessed_at = NOW(),
    access_count = access_count + 1
  WHERE agent_id = NEW.agent_id AND contact_id = NEW.contact_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add table comments
COMMENT ON TABLE agent_contact_permissions IS 'Base permission settings for agent access to contacts';
COMMENT ON TABLE agent_specific_contact_access IS 'Specific contact access permissions for agents';
COMMENT ON TABLE agent_group_access IS 'Group-based contact access permissions for agents';

COMMENT ON COLUMN agent_contact_permissions.permission_type IS 'Type of permission scope (all, specific, groups, filtered)';
COMMENT ON COLUMN agent_contact_permissions.access_schedule IS 'JSONB schedule defining when agent can access contacts';
COMMENT ON COLUMN agent_contact_permissions.access_filters IS 'JSONB criteria for filtered access permissions';

-- Create view for agent permission summary
CREATE OR REPLACE VIEW agent_permission_summary AS
SELECT 
  acp.agent_id,
  a.name as agent_name,
  acp.user_id,
  acp.permission_type,
  acp.can_view,
  acp.can_contact,
  acp.can_edit,
  acp.can_delete,
  acp.expires_at,
  acp.total_contacts_accessed,
  acp.total_messages_sent,
  acp.last_used_at,
  -- Count specific contacts
  (SELECT COUNT(*) FROM agent_specific_contact_access asca 
   WHERE asca.agent_id = acp.agent_id) as specific_contacts_count,
  -- Count accessible groups
  (SELECT COUNT(*) FROM agent_group_access aga 
   WHERE aga.agent_id = acp.agent_id) as accessible_groups_count
FROM agent_contact_permissions acp
INNER JOIN agents a ON acp.agent_id = a.id;

COMMENT ON VIEW agent_permission_summary IS 'Summary view of agent contact permissions with statistics';
