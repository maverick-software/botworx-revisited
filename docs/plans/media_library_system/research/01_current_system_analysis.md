# Current Document Ingestion System Analysis
**Date**: August 29, 2025  
**Research Phase**: STEP 2 - Understanding Existing Architecture

## Executive Summary

Agentopia currently has a **functional but limited document ingestion system** that operates on an agent-centric model. The system allows documents to be uploaded and processed for individual agents via the "What I Know" modal, with storage in Supabase buckets and processing through Pinecone/GetZep datastores. However, there is **no centralized media library** or user-level document management system.

## Current System Architecture

### 1. Database Schema - `datastore_documents` Table

**Location**: `supabase/migrations/20250125000005_create_datastore_documents_storage.sql`

```sql
CREATE TABLE datastore_documents (
    id TEXT PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    text_content TEXT,
    chunk_count INTEGER DEFAULT 0,
    processed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Characteristics**:
- **Agent-Centric**: Every document is tied to a specific agent (agent_id foreign key)
- **Storage Path**: `bucket_name/user_name/agent_name/file.pdf`
- **Processing Pipeline**: Text extraction → chunking → embedding → vector storage
- **Status Tracking**: pending, processing, completed, error states
- **RLS Policies**: Users can only access documents for agents they own

### 2. Storage Infrastructure

**Supabase Bucket**: `datastore-documents`
- **File Size Limit**: 50MB per file
- **Allowed Types**: PDF, TXT, DOC, DOCX, PPT, PPTX
- **Storage Path Structure**: `{userName}/{agentName}/{fileName}`
- **Public Access**: False (secure, authenticated access only)

### 3. Document Processing Pipeline

**Location**: `supabase/functions/process-datastore-document/index.ts`

**Processing Flow**:
```
1. Upload → Storage: bucket_name/user_name/agent_name/file.pdf
2. Trigger → Edge Function: process-datastore-document  
3. Text Extraction → Different methods per file type
4. Text Chunking → 1000 chars with 200 char overlap
5. Embedding Generation → OpenAI text-embedding-3-small
6. Vector Storage → Pinecone with metadata (source, timestamp, etc.)
7. Knowledge Graph → GetZep integration (if connected)
```

**Text Extraction Support**:
- **.txt files**: Full text extraction 
- **.pdf files**: Structured placeholder with metadata
- **.docx/.doc files**: Structured placeholder with metadata  
- **.ppt/.pptx files**: Structured placeholder with metadata

### 4. Frontend Integration

**Location**: `src/components/modals/WhatIKnowModal.tsx`

**Current Upload Interface**:
- **Access**: Via agent chat page → "What I Know" modal
- **Upload Process**: File selection → Supabase upload → Processing trigger
- **Progress Tracking**: Upload progress (0-100%) → Processing status
- **Agent Assignment**: Automatic assignment to current agent
- **Memory Integration**: Direct integration with agent's datastore connections

**File Path Generation**:
```typescript
const userName = (user?.user_metadata?.full_name || user?.email || user?.id || 'unknown_user')
  .replace(/[^a-zA-Z0-9._-]/g, '_');
const agentName = (agentData?.name || 'unknown_agent')
  .replace(/[^a-zA-Z0-9._-]/g, '_');
const filePath = `${userName}/${agentName}/${file.name}`;
```

### 5. Memory Architecture Integration

**Datastore Connections**: `agent_datastores` table links agents to:
- **Pinecone** (Episodic Memory): Vector search for document chunks
- **GetZep** (Semantic Memory): Knowledge graph integration

**Context Retrieval**: Documents are retrieved during chat via:
- Vector similarity search (Pinecone)
- Knowledge graph queries (GetZep) 
- Context injection into agent prompts

## Current System Limitations

### 1. **No Centralized Media Library**
- Documents are scattered across agent-specific folders
- No user-level view of all uploaded documents
- Cannot reuse documents across multiple agents
- No document management interface

### 2. **Agent-Centric Model Only**
- Every document must be tied to a specific agent
- No concept of "user documents" or "shared documents"
- Cannot upload documents for later assignment

### 3. **Limited UI Access Points**
- Only accessible via agent chat page modal
- No dedicated media management page
- No bulk operations or advanced search

### 4. **No MCP Tool Integration**
- Documents are only accessible via memory injection during chat
- No agent tools for document search/retrieval
- Cannot programmatically access document library

### 5. **Inflexible Storage Structure**
- Hardcoded path structure: `user/agent/file`
- Cannot reorganize or categorize documents
- No metadata management beyond basic file info

## Sidebar Navigation Analysis

**Location**: `src/components/Sidebar.tsx`

**Current Navigation Structure** (lines 59-71):
```typescript
const navItems: NavItem[] = [
  { to: '/agents', icon: Users, label: 'Agents', isCustom: true },
  { to: '/teams', icon: Building2, label: 'Teams' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/workflows', icon: GitBranch, label: 'Workflows' },
  { to: '/workflows/automations', icon: Zap, label: 'Automations' },
  { to: '/graph-settings', icon: Network, label: 'Knowledge Graph' },
];
```

**Integration Point**: Need to add Media navigation item to this array

## MCP Tool Architecture Analysis

**Location**: `supabase/functions/chat/function_calling/universal-tool-executor.ts`

**Current Tool Routing**:
- Gmail tools: `gmail_send_email`, `gmail_read_emails`
- SMTP tools: `smtp_send_email`
- Web search: `web_search`, `scrape_url`
- **Missing**: Document management tools

**Tool Registration**: `supabase/functions/get-agent-tools/index.ts`
- Database-driven tool discovery via `integration_capabilities` table
- No document-related capabilities currently exist

## Requirements for Media Library System

### 1. **Database Schema Enhancements**
- New `user_documents` table for user-level document management
- New `agent_document_assignments` table for flexible agent-document relationships
- Enhanced metadata fields (categories, tags, descriptions)
- Document versioning support

### 2. **Storage Architecture Improvements**
- User-level storage: `{userId}/media/{documentId}/{fileName}`
- Support for document categories/folders
- Improved metadata storage and indexing

### 3. **Frontend Components Needed**
- New MediaPage component with WordPress-like interface
- Document upload, management, and assignment interfaces
- Integration with existing WhatIKnowModal for agent assignments
- Sidebar navigation addition

### 4. **MCP Tool Development**
- `media_search_documents` - Search user's document library
- `media_get_document` - Retrieve specific document content
- `media_list_documents` - List available documents for agent
- Integration with universal tool executor

### 5. **API Enhancements**
- New Edge Functions for media management
- Enhanced document processing with user-level storage
- Document assignment and unassignment APIs

## Technical Constraints & Considerations

### 1. **Philosophy #1 Compliance**
- All new components must be ≤500 lines
- Modular architecture required for media management system
- Component separation: MediaPage, DocumentUpload, DocumentManager, etc.

### 2. **Existing Patterns**
- Follow established UI patterns (modals, cards, tables)
- Use existing theming system (CSS variables)
- Integrate with current authentication and RLS policies
- Maintain backward compatibility with agent-centric system

### 3. **Database Migration Strategy**
- Preserve existing `datastore_documents` table
- Add new tables without breaking current functionality
- Provide migration path for existing documents

### 4. **Performance Considerations**
- Efficient document indexing and search
- Lazy loading for large document libraries
- Optimized vector storage and retrieval

## Next Steps for Implementation

1. **Design enhanced database schema** with user-level document management
2. **Create Media Library frontend components** with WordPress-like interface  
3. **Develop MCP tools** for document search and retrieval
4. **Enhance WhatIKnowModal** for document assignment from media library
5. **Implement document processing pipeline** for user-level storage
6. **Add sidebar navigation** for Media page access

## References

- **Current Implementation**: `docs/features/DOCUMENT_KNOWLEDGE_IMPLEMENTATION.md`
- **Database Schema**: `supabase/migrations/20250125000005_create_datastore_documents_storage.sql`
- **Processing Function**: `supabase/functions/process-datastore-document/index.ts`
- **Frontend Modal**: `src/components/modals/WhatIKnowModal.tsx`
- **Sidebar Navigation**: `src/components/Sidebar.tsx`
- **MCP Architecture**: `supabase/functions/chat/function_calling/universal-tool-executor.ts`
