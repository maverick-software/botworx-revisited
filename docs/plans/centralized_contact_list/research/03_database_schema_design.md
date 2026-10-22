# Database Schema Design for Centralized Contact List

## Research Date: September 15, 2025

## Schema Design Philosophy

Following Agentopia's existing patterns:
- **User Isolation**: Strong RLS policies for data security
- **Encrypted Storage**: Sensitive data in Supabase Vault
- **JSONB Flexibility**: Extensible metadata storage
- **Audit Trails**: Comprehensive change tracking
- **GDPR Compliance**: Privacy-first design

## Core Contact Tables

### 1. contacts Table

```sql
CREATE TABLE contacts (
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
  contact_source TEXT, -- 'manual', 'csv_import', 'api_sync', etc.
  
  -- Privacy and consent
  consent_status TEXT DEFAULT 'unknown' CHECK (consent_status IN ('granted', 'denied', 'unknown', 'withdrawn')),
  consent_date TIMESTAMPTZ,
  data_processing_purpose TEXT[] DEFAULT '{}', -- ['marketing', 'support', 'sales']
  
  -- Status and categorization
  contact_status TEXT DEFAULT 'active' CHECK (contact_status IN ('active', 'inactive', 'blocked', 'archived')),
  contact_type TEXT DEFAULT 'external' CHECK (contact_type IN ('internal', 'external', 'partner', 'vendor')),
  priority_level TEXT DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'critical')),
  
  -- Flexible metadata storage
  custom_fields JSONB DEFAULT '{}',
  integration_metadata JSONB DEFAULT '{}', -- External system IDs, sync data
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_contacted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_names CHECK (
    LENGTH(TRIM(first_name)) > 0 AND 
    LENGTH(first_name) <= 100 AND
    (last_name IS NULL OR LENGTH(last_name) <= 100)
  )
);

-- Indexes for performance
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_display_name ON contacts(display_name);
CREATE INDEX idx_contacts_organization ON contacts(organization);
CREATE INDEX idx_contacts_status ON contacts(contact_status);
CREATE INDEX idx_contacts_type ON contacts(contact_type);
CREATE INDEX idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX idx_contacts_custom_fields ON contacts USING GIN(custom_fields);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_contacts_last_contacted ON contacts(last_contacted_at);

-- Full-text search index
CREATE INDEX idx_contacts_search ON contacts USING GIN(
  to_tsvector('english', 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(organization, '') || ' ' || 
    COALESCE(job_title, '') || ' ' || 
    COALESCE(notes, '')
  )
);
```

### 2. contact_communication_channels Table

```sql
CREATE TABLE contact_communication_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Channel identification
  channel_type TEXT NOT NULL CHECK (channel_type IN (
    'email', 'phone', 'mobile', 'whatsapp', 'telegram', 
    'slack', 'discord', 'teams', 'sms', 'fax'
  )),
  channel_identifier TEXT NOT NULL, -- email address, phone number, username, etc.
  display_label TEXT, -- "Work Email", "Personal Phone", etc.
  
  -- Channel status and preferences
  is_primary BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  can_receive_marketing BOOLEAN DEFAULT FALSE,
  can_receive_notifications BOOLEAN DEFAULT TRUE,
  
  -- Verification and validation
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN (
    'unverified', 'pending', 'verified', 'failed', 'expired'
  )),
  verified_at TIMESTAMPTZ,
  verification_method TEXT, -- 'email_click', 'sms_code', 'voice_call', etc.
  
  -- Channel-specific metadata
  channel_metadata JSONB DEFAULT '{}', -- Provider-specific data
  formatting_metadata JSONB DEFAULT '{}', -- Display preferences, formatting rules
  
  -- Privacy settings
  opt_in_date TIMESTAMPTZ,
  opt_out_date TIMESTAMPTZ,
  last_consent_update TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_channel_identifier CHECK (LENGTH(TRIM(channel_identifier)) > 0),
  CONSTRAINT unique_primary_per_type UNIQUE (contact_id, channel_type, is_primary) 
    DEFERRABLE INITIALLY DEFERRED -- Allow temporary violations during updates
);

-- Indexes
CREATE INDEX idx_channels_contact_id ON contact_communication_channels(contact_id);
CREATE INDEX idx_channels_user_id ON contact_communication_channels(user_id);
CREATE INDEX idx_channels_type ON contact_communication_channels(channel_type);
CREATE INDEX idx_channels_identifier ON contact_communication_channels(channel_identifier);
CREATE INDEX idx_channels_primary ON contact_communication_channels(contact_id, channel_type) WHERE is_primary = TRUE;
CREATE INDEX idx_channels_active ON contact_communication_channels(contact_id) WHERE is_active = TRUE;
CREATE INDEX idx_channels_verified ON contact_communication_channels(contact_id) WHERE is_verified = TRUE;
```

### 3. contact_groups Table

```sql
CREATE TABLE contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Group information
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6', -- Hex color for UI
  icon TEXT DEFAULT 'users', -- Icon identifier
  
  -- Group settings
  is_system_group BOOLEAN DEFAULT FALSE, -- System-generated groups
  is_smart_group BOOLEAN DEFAULT FALSE, -- Dynamic groups based on criteria
  smart_criteria JSONB, -- Criteria for smart groups
  
  -- Group metadata
  group_type TEXT DEFAULT 'custom' CHECK (group_type IN (
    'custom', 'department', 'project', 'location', 'role'
  )),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_group_name CHECK (LENGTH(TRIM(name)) > 0 AND LENGTH(name) <= 100),
  CONSTRAINT unique_user_group_name UNIQUE (user_id, name)
);

-- Indexes
CREATE INDEX idx_contact_groups_user_id ON contact_groups(user_id);
CREATE INDEX idx_contact_groups_type ON contact_groups(group_type);
CREATE INDEX idx_contact_groups_smart ON contact_groups(user_id) WHERE is_smart_group = TRUE;
```

### 4. contact_group_memberships Table

```sql
CREATE TABLE contact_group_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES contact_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Membership details
  added_by_user_id UUID REFERENCES auth.users(id),
  membership_type TEXT DEFAULT 'manual' CHECK (membership_type IN ('manual', 'automatic', 'imported')),
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_contact_group UNIQUE (contact_id, group_id)
);

-- Indexes
CREATE INDEX idx_group_memberships_contact ON contact_group_memberships(contact_id);
CREATE INDEX idx_group_memberships_group ON contact_group_memberships(group_id);
CREATE INDEX idx_group_memberships_user ON contact_group_memberships(user_id);
```

## Agent Access Control Tables

### 5. agent_contact_permissions Table

```sql
CREATE TABLE agent_contact_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Permission scope
  permission_type TEXT DEFAULT 'specific_contacts' CHECK (permission_type IN (
    'all_contacts', 'specific_contacts', 'contact_groups', 'filtered_access'
  )),
  
  -- Access levels
  can_view BOOLEAN DEFAULT TRUE,
  can_contact BOOLEAN DEFAULT TRUE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  
  -- Channel restrictions
  allowed_channels TEXT[] DEFAULT '{}', -- Empty array means all channels
  restricted_channels TEXT[] DEFAULT '{}',
  
  -- Time restrictions
  access_schedule JSONB, -- Business hours, timezone restrictions
  
  -- Filter criteria (for filtered_access type)
  access_filters JSONB DEFAULT '{}', -- Dynamic filtering criteria
  
  -- Metadata
  permission_metadata JSONB DEFAULT '{}',
  granted_by_user_id UUID REFERENCES auth.users(id),
  
  -- Timestamps
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT unique_agent_permission UNIQUE (agent_id, permission_type)
);

-- Indexes
CREATE INDEX idx_agent_permissions_agent ON agent_contact_permissions(agent_id);
CREATE INDEX idx_agent_permissions_user ON agent_contact_permissions(user_id);
CREATE INDEX idx_agent_permissions_active ON agent_contact_permissions(agent_id) 
  WHERE expires_at IS NULL OR expires_at > NOW();
```

### 6. agent_specific_contact_access Table

```sql
CREATE TABLE agent_specific_contact_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES agent_contact_permissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Specific permissions for this contact
  access_level TEXT DEFAULT 'view_and_contact' CHECK (access_level IN (
    'view_only', 'view_and_contact', 'full_access'
  )),
  
  -- Channel-specific overrides
  channel_permissions JSONB DEFAULT '{}',
  
  -- Timestamps
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_agent_contact_access UNIQUE (agent_id, contact_id)
);

-- Indexes
CREATE INDEX idx_specific_access_agent ON agent_specific_contact_access(agent_id);
CREATE INDEX idx_specific_access_contact ON agent_specific_contact_access(contact_id);
CREATE INDEX idx_specific_access_permission ON agent_specific_contact_access(permission_id);
```

## Communication History Tables

### 7. contact_interactions Table

```sql
CREATE TABLE contact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Interaction details
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'message_sent', 'message_received', 'call_made', 'call_received', 
    'meeting_scheduled', 'meeting_completed', 'email_sent', 'email_received',
    'note_added', 'status_changed'
  )),
  
  channel_type TEXT, -- Which communication channel was used
  channel_identifier TEXT, -- Specific channel used
  
  -- Content (encrypted for sensitive data)
  interaction_summary TEXT,
  full_content_vault_id TEXT, -- Supabase Vault ID for encrypted content
  
  -- Metadata
  interaction_metadata JSONB DEFAULT '{}',
  external_message_id TEXT, -- ID from external system
  
  -- Status tracking
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN (
    'pending', 'sent', 'delivered', 'read', 'failed', 'bounced'
  )),
  
  -- Timestamps
  interaction_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_interaction_summary CHECK (
    interaction_summary IS NULL OR LENGTH(interaction_summary) <= 500
  )
);

-- Indexes
CREATE INDEX idx_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX idx_interactions_agent ON contact_interactions(agent_id);
CREATE INDEX idx_interactions_user ON contact_interactions(user_id);
CREATE INDEX idx_interactions_type ON contact_interactions(interaction_type);
CREATE INDEX idx_interactions_channel ON contact_interactions(channel_type);
CREATE INDEX idx_interactions_date ON contact_interactions(interaction_at);
CREATE INDEX idx_interactions_delivery ON contact_interactions(delivery_status);
```

## Import/Export Tables

### 8. contact_import_jobs Table

```sql
CREATE TABLE contact_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Import details
  import_type TEXT DEFAULT 'csv' CHECK (import_type IN ('csv', 'excel', 'api', 'manual')),
  file_name TEXT,
  file_size BIGINT,
  storage_path TEXT,
  
  -- Processing status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'cancelled'
  )),
  
  -- Statistics
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  duplicate_contacts INTEGER DEFAULT 0,
  
  -- Configuration
  import_settings JSONB DEFAULT '{}', -- Column mappings, validation rules
  duplicate_handling TEXT DEFAULT 'skip' CHECK (duplicate_handling IN (
    'skip', 'update', 'create_duplicate'
  )),
  
  -- Results
  import_results JSONB DEFAULT '{}',
  error_details JSONB DEFAULT '{}',
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_file_size CHECK (file_size IS NULL OR file_size > 0)
);

-- Indexes
CREATE INDEX idx_import_jobs_user ON contact_import_jobs(user_id);
CREATE INDEX idx_import_jobs_status ON contact_import_jobs(status);
CREATE INDEX idx_import_jobs_started ON contact_import_jobs(started_at);
```

## Row Level Security Policies

### RLS Policies for contacts Table

```sql
-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Users can only access their own contacts
CREATE POLICY "Users can view their own contacts"
  ON contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contacts"
  ON contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON contacts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON contacts FOR DELETE
  USING (auth.uid() = user_id);

-- Service role has full access for system operations
CREATE POLICY "Service role has full access to contacts"
  ON contacts FOR ALL
  USING (current_setting('role') = 'service_role');
```

### RLS Policies for Communication Channels

```sql
ALTER TABLE contact_communication_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access channels for their contacts"
  ON contact_communication_channels FOR ALL
  USING (auth.uid() = user_id);
```

### RLS Policies for Agent Access

```sql
ALTER TABLE agent_contact_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their agent permissions"
  ON agent_contact_permissions FOR ALL
  USING (auth.uid() = user_id);

-- Agents can view permissions granted to them
CREATE POLICY "Agents can view their contact permissions"
  ON agent_contact_permissions FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE user_id = auth.uid()
    )
  );
```

## Database Functions

### Contact Search Function

```sql
CREATE OR REPLACE FUNCTION search_contacts_for_agent(
  p_agent_id UUID,
  p_user_id UUID,
  p_query TEXT DEFAULT NULL,
  p_group_id UUID DEFAULT NULL,
  p_contact_type TEXT DEFAULT NULL,
  p_channel_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  contact_id UUID,
  first_name TEXT,
  last_name TEXT,
  display_name TEXT,
  organization TEXT,
  job_title TEXT,
  contact_type TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  tags TEXT[],
  last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
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
  IF NOT EXISTS (
    SELECT 1 FROM agent_contact_permissions acp
    WHERE acp.agent_id = p_agent_id 
    AND acp.user_id = p_user_id
    AND (acp.expires_at IS NULL OR acp.expires_at > NOW())
  ) THEN
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
    (SELECT channel_identifier FROM contact_communication_channels 
     WHERE contact_id = c.id AND channel_type = 'email' AND is_primary = TRUE LIMIT 1),
    (SELECT channel_identifier FROM contact_communication_channels 
     WHERE contact_id = c.id AND channel_type IN ('phone', 'mobile') AND is_primary = TRUE LIMIT 1),
    c.tags,
    c.last_contacted_at,
    c.created_at
  FROM contacts c
  WHERE c.user_id = p_user_id
    AND c.contact_status = 'active'
    AND (p_query IS NULL OR c.display_name ILIKE '%' || p_query || '%' 
         OR c.organization ILIKE '%' || p_query || '%'
         OR c.job_title ILIKE '%' || p_query || '%')
    AND (p_contact_type IS NULL OR c.contact_type = p_contact_type)
    AND (p_group_id IS NULL OR EXISTS (
      SELECT 1 FROM contact_group_memberships cgm 
      WHERE cgm.contact_id = c.id AND cgm.group_id = p_group_id
    ))
    -- Apply agent-specific access controls here
  ORDER BY c.display_name
  LIMIT p_limit;
END;
$$;
```

## Next Steps

1. **Migration Planning**: Create sequential migration files
2. **RLS Testing**: Validate security policies
3. **Function Testing**: Test search and permission functions
4. **Performance Optimization**: Analyze query performance
5. **Integration Points**: Plan MCP tool integration
