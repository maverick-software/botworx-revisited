# Database Schema & Architecture

Agentopia uses PostgreSQL managed by Supabase with a comprehensive schema designed for multi-tenant collaboration, security, and scalability.

## 🏗️ Core Architecture

### Database Platform
- **PostgreSQL**: Advanced relational database with JSON support
- **Supabase**: Managed PostgreSQL with real-time subscriptions
- **Row Level Security (RLS)**: User-scoped data access control
- **Edge Functions**: Serverless PostgreSQL functions for business logic

### Schema Organization
The database schema is organized into logical domains:

- **User Management**: Authentication, profiles, and permissions
- **Agent System**: Agent definitions, configurations, and relationships
- **Workspace Collaboration**: Workspaces, teams, channels, and messages
- **Integration System**: OAuth providers, credentials, and permissions
- **Tool Infrastructure**: MCP servers, tool catalogs, and execution logs
- **Knowledge Management**: Datastores, memories, and content processing
- **Task Automation**: Scheduled tasks, workflows, and execution tracking

## 👥 User & Authentication Tables

### Core User Tables
```sql
-- Supabase auth.users (managed by Supabase Auth)
-- Extended by profiles table for additional user data

profiles {
  id: uuid,                    -- References auth.users.id
  full_name: text,
  avatar_url: text,
  created_at: timestamptz,
  updated_at: timestamptz
}

-- User preferences and settings
user_preferences {
  user_id: uuid,
  theme: text DEFAULT 'light',
  timezone: text DEFAULT 'UTC',
  notification_settings: jsonb,
  ui_preferences: jsonb
}
```

## 🤖 Agent Management System

### Core Agent Tables
```sql
-- Main agent definitions
agents {
  id: uuid,
  user_id: uuid,               -- Agent owner
  name: text,
  instructions: text,          -- Agent personality and behavior
  avatar_url: text,
  is_active: boolean,
  context_window_size: integer DEFAULT 4000,
  max_tokens: integer DEFAULT 1000,
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Agent-specific datastore connections
agent_datastores {
  agent_id: uuid,
  datastore_id: uuid,
  is_active: boolean DEFAULT true
}

-- Agent integration permissions
agent_integration_permissions {
  id: uuid,
  agent_id: uuid,
  connection_id: uuid,         -- References user_integration_credentials
  allowed_scopes: jsonb,       -- Specific permissions granted
  permission_level: text DEFAULT 'custom',
  is_active: boolean DEFAULT true,
  created_at: timestamptz
}
```

## 🏢 Team & Workspace Organization

### Team Management
```sql
-- Team definitions
teams {
  id: uuid,
  name: text,
  description: text,
  parent_team_id: uuid,        -- NEW: Hierarchical organization (references teams.id)
  owner_user_id: uuid,
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Team membership
team_members {
  id: uuid,
  team_id: uuid,
  agent_id: uuid,
  team_role: text DEFAULT 'member',
  reports_to_user: boolean DEFAULT false,
  created_at: timestamptz
}

-- Visual team organization (DEPRECATED - removed from UI as of Dec 31, 2025)
team_canvas_layouts {
  id: uuid,
  user_id: uuid,
  workspace_id: uuid,
  positions: jsonb,            -- Team positions on canvas
  connections: jsonb,          -- Team relationships
  view_settings: jsonb,        -- Canvas view preferences
  created_at: timestamptz,
  updated_at: timestamptz
}

team_connections {
  id: uuid,
  from_team_id: uuid,
  to_team_id: uuid,
  connection_type: team_connection_type,
  label: text,
  color: text,
  style: text,
  created_by_user_id: uuid
}
```

### Workspace Collaboration
```sql
-- Workspace definitions
workspaces {
  id: uuid,
  name: text,
  description: text,
  owner_user_id: uuid,
  is_public: boolean DEFAULT false,
  settings: jsonb,
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Workspace membership
workspace_members {
  id: uuid,
  workspace_id: uuid,
  user_id: uuid,
  agent_id: uuid,
  team_id: uuid,
  role: workspace_member_role DEFAULT 'member',
  joined_at: timestamptz
}

-- Communication channels
chat_channels {
  id: uuid,
  workspace_id: uuid,
  name: text,
  description: text,
  is_public: boolean DEFAULT true,
  created_by_user_id: uuid,
  created_at: timestamptz
}

-- Chat messages
chat_messages {
  id: uuid,
  channel_id: uuid,
  user_id: uuid,
  agent_id: uuid,
  content: text,
  message_type: message_type DEFAULT 'text',
  metadata: jsonb,
  created_at: timestamptz
}
```

## 🔐 Integration & Security System

### Service Providers & Credentials
```sql
-- Unified service provider definitions
service_providers {
  id: uuid,
  name: text,                  -- 'gmail', 'microsoft-outlook', 'smtp', etc.
  display_name: text,
  provider_type: provider_type, -- 'oauth', 'api_key', 'smtp'
  authorization_endpoint: text,
  token_endpoint: text,
  scopes_supported: jsonb,
  configuration_metadata: jsonb,
  is_active: boolean DEFAULT true
}

-- Unified credential storage (replaces user_oauth_connections)
user_integration_credentials {
  id: uuid,
  user_id: uuid,
  service_provider_id: uuid,
  credential_type: credential_type, -- 'oauth', 'api_key'
  
  -- SECURE: Only vault UUIDs stored
  vault_access_token_id: text,
  vault_refresh_token_id: text,
  encrypted_access_token: text, -- DEPRECATED: Always NULL
  encrypted_refresh_token: text, -- DEPRECATED: Always NULL
  
  connection_name: text,
  connection_status: text DEFAULT 'active',
  connection_metadata: jsonb,
  scopes_granted: jsonb,
  token_expires_at: timestamptz,
  created_at: timestamptz
}

-- Integration capabilities (database-driven tool definitions)
integration_capabilities {
  id: uuid,
  integration_id: uuid,
  capability_key: text,        -- Tool name (e.g., 'smtp_send_email')
  display_label: text,         -- Human-readable label
  display_order: integer,
  created_at: timestamptz,
  updated_at: timestamptz
}
```

## 🛠️ Tool Infrastructure

### MCP & Tool Management
```sql
-- MCP server connections per agent
agent_mcp_connections {
  id: uuid,
  agent_id: uuid,
  connection_name: text,
  server_url: text,
  is_active: boolean DEFAULT true,
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Cached MCP tools for performance
mcp_tools_cache {
  id: uuid,
  connection_id: uuid,
  tool_name: text,
  tool_schema: jsonb,          -- Original MCP schema
  openai_schema: jsonb,        -- Converted OpenAI format
  last_updated: timestamptz,
  created_at: timestamptz
}

-- Tool catalog for deployable tools
tool_catalog {
  id: uuid,
  name: text,
  display_name: text,
  description: text,
  category: text,
  docker_image: text,
  default_config: jsonb,
  resource_requirements: jsonb,
  is_active: boolean DEFAULT true
}

-- Account-level tool environments (DigitalOcean droplets)
account_tool_environments {
  id: uuid,
  user_id: uuid,
  environment_name: text DEFAULT 'default',
  do_droplet_id: bigint,
  do_droplet_name: text,
  region_slug: text NOT NULL DEFAULT 'nyc3',
  size_slug: text NOT NULL DEFAULT 's-1vcpu-1gb',
  image_slug: text NOT NULL DEFAULT 'ubuntu-22-04-x64',
  status_on_toolbox: account_tool_installation_status_enum,
  created_at: timestamptz,
  updated_at: timestamptz
}
```

## 📚 Knowledge & Content Management

### Datastores & Memory Systems
```sql
-- Datastore configurations (Pinecone, GetZep, etc.)
datastores {
  id: uuid,
  name: text,
  type: datastore_type,        -- 'pinecone', 'getzep'
  config: jsonb,               -- Provider-specific credentials
  created_by_user_id: uuid,
  created_at: timestamptz
}

-- Media library for document management
media_library {
  id: uuid,
  user_id: uuid,
  file_name: text,
  display_name: text,
  file_type: text,
  file_size: bigint,
  storage_path: text,
  bucket: text DEFAULT 'media-library',
  category: text,
  description: text,
  tags: text[],
  processing_status: processing_status,
  assigned_agents_count: integer DEFAULT 0,
  chunk_count: integer DEFAULT 0,
  file_url: text,
  is_archived: boolean DEFAULT false,
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Agent-document assignments
agent_media_assignments {
  id: uuid,
  agent_id: uuid,
  media_id: uuid,
  assignment_type: assignment_type, -- 'training', 'reference', 'context'
  assigned_by_user_id: uuid,
  created_at: timestamptz
}

-- Document processing logs
media_processing_logs {
  id: uuid,
  media_id: uuid,
  processing_step: text,
  status: processing_log_status,
  details: jsonb,
  created_at: timestamptz
}
```

## ⏰ Task Automation System

### Task Scheduling & Workflows
```sql
-- Main task definitions
agent_tasks {
  id: uuid,
  user_id: uuid,
  agent_id: uuid,
  name: text,
  description: text,
  task_type: task_type DEFAULT 'scheduled',
  status: task_status DEFAULT 'active',
  instructions: text,
  
  -- Multi-step workflow support
  is_multi_step: boolean DEFAULT false,
  step_count: integer DEFAULT 1,
  
  -- Scheduling configuration
  cron_expression: text,
  timezone: text DEFAULT 'UTC',
  next_run_at: timestamptz,
  start_date: date,
  end_date: date,
  max_executions: integer,
  total_executions: integer DEFAULT 0,
  
  -- Conversation integration
  target_conversation_id: uuid,
  
  created_at: timestamptz,
  updated_at: timestamptz
}

-- Individual task steps for workflows
task_steps {
  id: uuid,
  task_id: uuid,
  step_order: integer,
  step_name: text,
  instructions: text,
  include_previous_context: boolean DEFAULT false,
  status: task_step_status DEFAULT 'pending',
  execution_result: jsonb,
  execution_started_at: timestamptz,
  execution_completed_at: timestamptz,
  execution_duration_ms: integer,
  error_message: text,
  retry_count: integer DEFAULT 0,
  created_at: timestamptz,
  updated_at: timestamptz
}
```

## 🔧 Database Functions & Procedures

### Core RPC Functions
```sql
-- Vault security functions
create_vault_secret(p_secret TEXT, p_name TEXT, p_description TEXT) RETURNS TEXT
vault_decrypt(vault_id TEXT) RETURNS TEXT

-- Agent permission management
grant_agent_integration_permission(p_agent_id uuid, p_connection_id uuid, p_allowed_scopes text[], p_permission_level text)
revoke_agent_integration_permission(p_permission_id uuid)
get_agent_integration_permissions(p_agent_id uuid) RETURNS TABLE(...)

-- Task management functions
create_task_step(p_task_id uuid, p_step_order integer, p_step_name text, p_instructions text) RETURNS uuid
update_task_step(p_step_id uuid, p_step_name text, p_instructions text, p_include_previous_context boolean)
delete_task_step(p_step_id uuid)

-- Canvas layout functions
save_team_canvas_layout(p_user_id uuid, p_workspace_id uuid, p_positions jsonb, p_connections jsonb, p_view_settings jsonb)
create_team_connection(p_from_team_id uuid, p_to_team_id uuid, p_connection_type text, p_created_by_user_id uuid)
```

## 🔒 Security & RLS Policies

### Row Level Security Implementation
All tables implement comprehensive RLS policies:

```sql
-- Example: Users can only access their own agents
CREATE POLICY "Users can view their own agents"
  ON agents FOR SELECT
  USING (auth.uid() = user_id);

-- Example: Workspace members can access workspace data
CREATE POLICY "Workspace members can access channels"
  ON chat_channels FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );
```

### Security Features
- **User Isolation**: RLS ensures users only access their own data
- **Workspace Boundaries**: Members only access authorized workspace content
- **Service Role Access**: Administrative functions require service role
- **Audit Trails**: Comprehensive logging of all sensitive operations

## 📊 Indexes & Performance

### Key Indexes
```sql
-- Performance-critical indexes
CREATE INDEX idx_agents_user_id ON agents(user_id);
CREATE INDEX idx_chat_messages_channel_id ON chat_messages(channel_id);
CREATE INDEX idx_user_integration_credentials_user_id ON user_integration_credentials(user_id);
CREATE INDEX idx_agent_tasks_next_run_at ON agent_tasks(next_run_at) WHERE status = 'active';

-- Composite indexes for complex queries
CREATE INDEX idx_workspace_members_composite ON workspace_members(workspace_id, user_id, agent_id);
CREATE INDEX idx_agent_permissions_composite ON agent_integration_permissions(agent_id, is_active);
```

### Performance Optimizations
- **Partial Indexes**: Only index active/relevant records
- **Composite Indexes**: Optimize multi-column queries
- **JSONB Indexes**: Efficient querying of JSON data
- **Materialized Views**: Pre-computed aggregations for dashboards

## 🔄 Migrations & Versioning

### Migration Strategy
- **Sequential Migrations**: Numbered migration files for version control
- **Rollback Support**: All migrations include down migration scripts
- **Data Integrity**: Foreign key constraints and validation rules
- **Zero-Downtime**: Migrations designed for production deployment

### Current Schema Version
- **Migration Count**: 167+ migrations applied
- **Last Updated**: September 2025
- **Schema Stability**: Production-ready with comprehensive testing

## 🚀 Future Enhancements

### Planned Schema Updates
- **Advanced Analytics**: Event tracking and metrics tables
- **Multi-Language Support**: Internationalization tables
- **Enhanced Security**: Additional audit and compliance tables
- **Performance**: Query optimization and caching layers

### Scalability Considerations
- **Partitioning**: Table partitioning for large datasets
- **Read Replicas**: Database scaling for read-heavy workloads
- **Archiving**: Historical data management strategies
- **Monitoring**: Database performance and health tracking

---

For implementation details and specific table relationships, see:
- [Getting Started](getting-started.md) - Database setup and configuration
- [Security Updates](security-updates.md) - Security implementation details
- [Deployment](deployment.md) - Production database deployment
