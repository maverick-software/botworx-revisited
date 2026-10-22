# Codebase Analysis for Centralized Contact List

## Research Date: September 15, 2025

## Current Database Schema Analysis

### Existing User Management Structure
- **auth.users**: Supabase managed authentication table
- **profiles**: Extended user information (id, full_name, avatar_url, etc.)
- **user_preferences**: User settings (theme, timezone, notifications, UI preferences)
- **roles**: Application roles (admin, user)

### Agent & Team Management
- **agents**: AI agent configurations with user_id ownership
- **teams**: Team organization with owner_user_id
- **team_members**: Links agents to teams
- **workspaces**: Collaboration spaces
- **workspace_members**: User/agent/team membership in workspaces

### Integration System
- **user_integration_credentials**: OAuth and API credentials (encrypted via Supabase Vault)
- **service_providers**: Unified service provider definitions
- **integration_capabilities**: Database-driven tool definitions
- **agent_integration_permissions**: Agent-specific permissions for integrations

### Key Observations for Contact System
1. **User Isolation**: Strong RLS policies ensure users only access their own data
2. **Vault Integration**: All sensitive credentials stored encrypted (zero plain-text)
3. **Agent Permissions**: Existing pattern for granting agents access to user resources
4. **JSONB Support**: Extensive use of JSONB for flexible metadata storage

## Agent Settings Modal Structure Analysis

### Current Modal Implementation
Located at: `src/components/modals/AgentSettingsModal.tsx`

#### Existing Tabs:
- **General**: Name, role, description
- **Schedule**: Tasks and automation
- **Identity**: Avatar, model, personality
- **Behavior**: Reasoning and instructions
- **Memory**: Context and knowledge sources
- **Media**: SOPs and knowledge documents
- **Tools**: Voice, web search, creation
- **Channels**: Email, SMS, messaging
- **Integrations**: Third-party connections
- **Sources**: Cloud storage connections
- **Team**: Team assignments and collaboration

#### Key Implementation Patterns:
1. **Tab Structure**: Uses TABS array with id, label, icon, description
2. **Component Pattern**: Each tab is a separate component (e.g., `GeneralTab`, `ToolsTab`)
3. **Props Pattern**: Common props passed to all tabs: `agentId`, `agentData`, `onAgentUpdated`
4. **Type Safety**: Strong TypeScript typing with TabId union type

## MCP Tools Implementation Analysis

### Current MCP Tool Patterns

#### Media Library MCP Tools (Reference Implementation)
Located at: `supabase/functions/media-library-mcp/index.ts`

**Existing Tools:**
- `search_documents`: Semantic/keyword search with filters
- `get_document_content`: Retrieve full document content
- `assign_to_agent`: Assign documents to agent
- `search_document_content`: Search within document content

**Key Patterns:**
1. **Tool Registration**: Tools registered with OpenAI schema format
2. **Permission Validation**: Agent ownership validation in every tool
3. **Database Functions**: Uses PostgreSQL functions for complex queries
4. **Response Format**: Standardized MCPToolResponse structure
5. **Error Handling**: Comprehensive error handling and logging

#### Database Function Pattern
```sql
-- Example from media library
CREATE OR REPLACE FUNCTION search_media_documents_for_agent(
    p_agent_id UUID,
    p_user_id UUID,
    p_query TEXT,
    p_search_type TEXT DEFAULT 'semantic',
    p_category TEXT DEFAULT NULL,
    p_assignment_type TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
```

## File Upload & CSV Processing Analysis

### Current File Upload Patterns

#### Media Library Upload Process
1. **Preparation**: POST to `/functions/v1/media-library-api` with metadata
2. **Storage**: Direct upload to Supabase storage bucket
3. **Processing**: Document text extraction and chunking
4. **Assignment**: Optional agent assignment

#### CSV Processing Capability
Located at: `supabase/functions/excel-parser/index.ts`

**Current Features:**
- Manual CSV parsing with fallback to SheetJS
- Support for Excel files (.xlsx, .xls)
- Text extraction and data array conversion
- Error handling with retry logic

**CSV Processing Function:**
```typescript
async function extractCSVManually(fileBuffer: Uint8Array, fileName: string): Promise<{ text: string; data: any[][]; metadata: any }>
```

## Security & Compliance Considerations

### Current Security Implementation
1. **Row Level Security**: All tables have comprehensive RLS policies
2. **Supabase Vault**: Encrypted credential storage
3. **User Isolation**: Strong user-scoped data access
4. **Service Role Functions**: Administrative functions require service role

### GDPR Compliance Patterns
- User data isolation through RLS
- Audit trails in sensitive operations
- Encrypted storage for PII
- User-controlled data access

## Integration Points for Contact System

### 1. Database Integration
- Follow existing RLS patterns for user isolation
- Use JSONB for flexible contact metadata
- Implement audit trails for contact operations
- Consider GDPR compliance for contact data

### 2. Agent Settings Modal Integration
- Add "Contacts" tab following existing pattern
- Create `ContactsTab` component with CRUD interface
- Use existing permission patterns for agent access control
- Follow existing UI/UX patterns for consistency

### 3. MCP Tools Integration
- Create `search_contacts` MCP tool following media library pattern
- Implement database functions for contact search/filtering
- Use existing permission validation patterns
- Return standardized JSON format for agent consumption

### 4. CSV Import Integration
- Leverage existing CSV processing from excel-parser
- Create contact-specific import validation
- Handle duplicate detection and merging
- Provide import preview and confirmation

## Next Steps for Research
1. Research contact data schema best practices
2. Analyze GDPR requirements for contact management
3. Review communication platform APIs for integration
4. Design contact permission/role system
5. Plan database migration strategy
