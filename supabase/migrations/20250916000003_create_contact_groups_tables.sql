-- Migration: Create Contact Groups Tables
-- Purpose: Contact organization and grouping functionality
-- Dependencies: contacts table
-- File: 20250916000003_create_contact_groups_tables.sql

-- Create contact groups table
CREATE TABLE IF NOT EXISTS contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Group information
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6', -- Hex color for UI
  icon TEXT DEFAULT 'users', -- Icon identifier for UI
  
  -- Group settings
  is_system_group BOOLEAN DEFAULT FALSE, -- System-generated groups (e.g., "All Contacts")
  is_smart_group BOOLEAN DEFAULT FALSE, -- Dynamic groups based on criteria
  smart_criteria JSONB, -- Criteria for smart groups
  
  -- Group categorization
  group_type TEXT DEFAULT 'custom' CHECK (group_type IN (
    'custom', 'department', 'project', 'location', 'role', 'status', 'system'
  )),
  parent_group_id UUID REFERENCES contact_groups(id) ON DELETE SET NULL, -- For nested groups
  
  -- Group metadata
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  
  -- Statistics (updated via triggers)
  member_count INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_group_name CHECK (
    LENGTH(TRIM(name)) > 0 AND LENGTH(name) <= 100
  ),
  CONSTRAINT valid_description CHECK (
    description IS NULL OR LENGTH(description) <= 500
  ),
  CONSTRAINT valid_color CHECK (
    color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT smart_group_criteria CHECK (
    (is_smart_group = TRUE AND smart_criteria IS NOT NULL) OR
    (is_smart_group = FALSE)
  ),
  CONSTRAINT no_self_parent CHECK (id != parent_group_id)
);

-- Unique constraint for group names per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_group_name 
  ON contact_groups(user_id, LOWER(name));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_contact_groups_user_id ON contact_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_type ON contact_groups(group_type);
CREATE INDEX IF NOT EXISTS idx_contact_groups_parent ON contact_groups(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_contact_groups_smart ON contact_groups(user_id) 
  WHERE is_smart_group = TRUE;
CREATE INDEX IF NOT EXISTS idx_contact_groups_system ON contact_groups(user_id) 
  WHERE is_system_group = TRUE;
CREATE INDEX IF NOT EXISTS idx_contact_groups_tags ON contact_groups USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contact_groups_custom_fields ON contact_groups USING GIN(custom_fields);
CREATE INDEX IF NOT EXISTS idx_contact_groups_created_at ON contact_groups(created_at);

-- JSONB index for smart criteria
CREATE INDEX IF NOT EXISTS idx_contact_groups_smart_criteria ON contact_groups USING GIN(smart_criteria)
  WHERE smart_criteria IS NOT NULL;

-- Create contact group memberships table
CREATE TABLE IF NOT EXISTS contact_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Membership details
  added_by_user_id UUID REFERENCES auth.users(id),
  membership_type TEXT DEFAULT 'manual' CHECK (membership_type IN (
    'manual', 'automatic', 'imported', 'smart_rule'
  )),
  
  -- Membership metadata
  membership_metadata JSONB DEFAULT '{}',
  notes TEXT,
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_notes CHECK (
    notes IS NULL OR LENGTH(notes) <= 1000
  )
);

-- Unique constraint to prevent duplicate memberships
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_contact_group_membership 
  ON contact_group_memberships(contact_id, group_id);

-- Performance indexes for memberships
CREATE INDEX IF NOT EXISTS idx_group_memberships_contact ON contact_group_memberships(contact_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON contact_group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user ON contact_group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_type ON contact_group_memberships(membership_type);
CREATE INDEX IF NOT EXISTS idx_group_memberships_added_at ON contact_group_memberships(added_at);
CREATE INDEX IF NOT EXISTS idx_group_memberships_metadata ON contact_group_memberships USING GIN(membership_metadata);

-- Create updated_at trigger for groups
CREATE OR REPLACE FUNCTION update_contact_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contact_groups_updated_at
  BEFORE UPDATE ON contact_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_groups_updated_at();

-- Function to update group member count
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
DECLARE
  group_id_to_update UUID;
BEGIN
  -- Determine which group to update
  IF TG_OP = 'DELETE' THEN
    group_id_to_update := OLD.group_id;
  ELSE
    group_id_to_update := NEW.group_id;
  END IF;
  
  -- Update the member count
  UPDATE contact_groups 
  SET 
    member_count = (
      SELECT COUNT(*) 
      FROM contact_group_memberships 
      WHERE group_id = group_id_to_update
    ),
    last_activity_at = NOW()
  WHERE id = group_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain member counts
CREATE TRIGGER trigger_update_group_member_count
  AFTER INSERT OR DELETE ON contact_group_memberships
  FOR EACH ROW
  EXECUTE FUNCTION update_group_member_count();

-- Function to evaluate smart group criteria
CREATE OR REPLACE FUNCTION evaluate_smart_group_criteria(
  p_user_id UUID,
  p_criteria JSONB
) RETURNS TABLE(contact_id UUID) AS $$
DECLARE
  sql_query TEXT;
  condition_parts TEXT[] := '{}';
  criteria_item JSONB;
BEGIN
  -- Build dynamic query based on criteria
  sql_query := 'SELECT id FROM contacts WHERE user_id = $1 AND contact_status = ''active'' AND deleted_at IS NULL';
  
  -- Process each criteria item
  FOR criteria_item IN SELECT * FROM jsonb_array_elements(p_criteria)
  LOOP
    CASE criteria_item->>'field'
      WHEN 'contact_type' THEN
        condition_parts := condition_parts || format('contact_type = %L', criteria_item->>'value');
      WHEN 'organization' THEN
        condition_parts := condition_parts || format('organization ILIKE %L', '%' || (criteria_item->>'value') || '%');
      WHEN 'tags' THEN
        condition_parts := condition_parts || format('%L = ANY(tags)', criteria_item->>'value');
      WHEN 'created_after' THEN
        condition_parts := condition_parts || format('created_at >= %L::timestamptz', criteria_item->>'value');
      WHEN 'last_contacted_after' THEN
        condition_parts := condition_parts || format('last_contacted_at >= %L::timestamptz', criteria_item->>'value');
      -- Add more criteria as needed
    END CASE;
  END LOOP;
  
  -- Add conditions to query
  IF array_length(condition_parts, 1) > 0 THEN
    sql_query := sql_query || ' AND ' || array_to_string(condition_parts, ' AND ');
  END IF;
  
  -- Execute dynamic query
  RETURN QUERY EXECUTE sql_query USING p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh smart group memberships
CREATE OR REPLACE FUNCTION refresh_smart_group_memberships(p_group_id UUID)
RETURNS INTEGER AS $$
DECLARE
  group_record RECORD;
  contact_ids UUID[];
  current_member_ids UUID[];
  to_add UUID[];
  to_remove UUID[];
  changes_made INTEGER := 0;
BEGIN
  -- Get group details
  SELECT * INTO group_record 
  FROM contact_groups 
  WHERE id = p_group_id AND is_smart_group = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Smart group not found: %', p_group_id;
  END IF;
  
  -- Get contacts that should be in this group based on criteria
  SELECT ARRAY(
    SELECT contact_id 
    FROM evaluate_smart_group_criteria(group_record.user_id, group_record.smart_criteria)
  ) INTO contact_ids;
  
  -- Get current members
  SELECT ARRAY(
    SELECT contact_id 
    FROM contact_group_memberships 
    WHERE group_id = p_group_id
  ) INTO current_member_ids;
  
  -- Find contacts to add (in criteria results but not in current members)
  SELECT ARRAY(
    SELECT unnest(contact_ids) 
    EXCEPT 
    SELECT unnest(current_member_ids)
  ) INTO to_add;
  
  -- Find contacts to remove (in current members but not in criteria results)
  SELECT ARRAY(
    SELECT unnest(current_member_ids) 
    EXCEPT 
    SELECT unnest(contact_ids)
  ) INTO to_remove;
  
  -- Add new members
  IF array_length(to_add, 1) > 0 THEN
    INSERT INTO contact_group_memberships (contact_id, group_id, user_id, membership_type)
    SELECT unnest(to_add), p_group_id, group_record.user_id, 'smart_rule';
    changes_made := changes_made + array_length(to_add, 1);
  END IF;
  
  -- Remove members that no longer match
  IF array_length(to_remove, 1) > 0 THEN
    DELETE FROM contact_group_memberships 
    WHERE group_id = p_group_id AND contact_id = ANY(to_remove);
    changes_made := changes_made + array_length(to_remove, 1);
  END IF;
  
  RETURN changes_made;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create system groups for new users
CREATE OR REPLACE FUNCTION create_default_contact_groups(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Create "All Contacts" system group
  INSERT INTO contact_groups (user_id, name, description, group_type, is_system_group, color, icon)
  VALUES (
    p_user_id,
    'All Contacts',
    'System group containing all contacts',
    'system',
    TRUE,
    '#6b7280',
    'users'
  );
  
  -- Create "Favorites" group
  INSERT INTO contact_groups (user_id, name, description, group_type, color, icon)
  VALUES (
    p_user_id,
    'Favorites',
    'Important contacts marked as favorites',
    'custom',
    '#f59e0b',
    'star'
  );
  
  -- Create "Recent" smart group
  INSERT INTO contact_groups (
    user_id, name, description, group_type, is_smart_group, smart_criteria, color, icon
  )
  VALUES (
    p_user_id,
    'Recent',
    'Contacts added in the last 30 days',
    'custom',
    TRUE,
    '[{"field": "created_after", "value": "30 days ago"}]'::jsonb,
    '#10b981',
    'clock'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add table comments
COMMENT ON TABLE contact_groups IS 'Contact organization groups with support for smart/dynamic groups';
COMMENT ON TABLE contact_group_memberships IS 'Many-to-many relationship between contacts and groups';
COMMENT ON COLUMN contact_groups.is_smart_group IS 'Whether this group automatically manages membership based on criteria';
COMMENT ON COLUMN contact_groups.smart_criteria IS 'JSONB criteria for automatic group membership';
COMMENT ON COLUMN contact_groups.member_count IS 'Cached count of group members, updated via triggers';

-- Create view for group hierarchy
CREATE OR REPLACE VIEW contact_group_hierarchy AS
WITH RECURSIVE group_tree AS (
  -- Base case: root groups (no parent)
  SELECT 
    id,
    user_id,
    name,
    parent_group_id,
    0 as level,
    ARRAY[name] as path,
    id::text as path_ids
  FROM contact_groups 
  WHERE parent_group_id IS NULL
  
  UNION ALL
  
  -- Recursive case: child groups
  SELECT 
    cg.id,
    cg.user_id,
    cg.name,
    cg.parent_group_id,
    gt.level + 1,
    gt.path || cg.name,
    gt.path_ids || ',' || cg.id::text
  FROM contact_groups cg
  INNER JOIN group_tree gt ON cg.parent_group_id = gt.id
)
SELECT * FROM group_tree ORDER BY user_id, level, name;

COMMENT ON VIEW contact_group_hierarchy IS 'Hierarchical view of contact groups showing parent-child relationships';
