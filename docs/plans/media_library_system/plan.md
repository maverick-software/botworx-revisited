# Media Library System Implementation Plan
**Date**: August 29, 2025  
**Project**: Comprehensive Document Ingestion & Management System  
**Protocol**: Following plan_and_execute.md

## Project Overview

**Goal**: Create a comprehensive Media Library system similar to WordPress media management, allowing users to upload, organize, and assign documents to agents with MCP tool integration for enhanced AI capabilities.

**Current System**: Agent-centric document uploads via "What I Know" modal with basic processing pipeline

**Target System**: User-centric media library with centralized management, flexible agent assignments, and MCP tool integration

## Proposed File Structure

### 1. Database Schema Changes

**New Migration Files:**
```
supabase/migrations/
├── 20250829_130000_create_media_library_schema.sql       (~200 lines)
├── 20250829_130001_create_media_mcp_tools.sql           (~150 lines)
└── 20250829_130002_migrate_existing_documents.sql       (~100 lines)
```

**Files to Update:**
```
src/types/database.types.ts                              (+100 lines for media tables)
```

### 2. Frontend Component Structure

**New Media Library Components:**
```
src/pages/
└── MediaPage.tsx                                        (~300 lines)

src/components/media/
├── MediaLibrary.tsx                                     (~280 lines)
├── DocumentUpload.tsx                                   (~250 lines)
├── DocumentGrid.tsx                                     (~200 lines)
├── DocumentCard.tsx                                     (~180 lines)
├── DocumentViewer.tsx                                   (~220 lines)
├── CategoryManager.tsx                                  (~150 lines)
├── DocumentAssignmentModal.tsx                          (~200 lines)
└── types/
    └── media-types.ts                                   (~120 lines)
```

**Files to Update:**
```
src/components/Sidebar.tsx                               (+15 lines for Media navigation)
src/components/modals/WhatIKnowModal.tsx                (+100 lines for media library integration)
src/routing/AppRouter.tsx                               (+10 lines for Media route)
```

### 3. Backend Edge Function Structure

**New Edge Functions:**
```
supabase/functions/
├── media-library/
│   └── index.ts                                        (~300 lines)
├── media-upload/
│   └── index.ts                                        (~250 lines)
├── media-assignment/
│   └── index.ts                                        (~200 lines)
└── media-mcp-tools/
    └── index.ts                                        (~280 lines)
```

**Files to Update:**
```
supabase/functions/chat/function_calling/universal-tool-executor.ts  (+50 lines for media tools)
supabase/functions/get-agent-tools/index.ts                         (+30 lines for media capabilities)
```

### 4. MCP Tool Integration

**New MCP Tools:**
```
src/lib/mcp/
├── media-tools.ts                                      (~200 lines)
└── document-search.ts                                  (~180 lines)
```

## System Architecture Design

### 1. Database Schema Enhancement

**New Tables:**

```sql
-- User-level document storage
user_documents (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT,
    mime_type TEXT,
    category TEXT,
    tags TEXT[],
    description TEXT,
    metadata JSONB,
    status document_status,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);

-- Flexible agent-document assignments
agent_document_assignments (
    id UUID PRIMARY KEY,
    agent_id UUID NOT NULL,
    document_id UUID NOT NULL,
    assignment_type assignment_type_enum,
    assigned_by UUID NOT NULL,
    assigned_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Document processing results
document_processing_results (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL,
    processing_type TEXT NOT NULL,
    result_data JSONB,
    vector_count INTEGER,
    chunk_count INTEGER,
    processed_at TIMESTAMPTZ
);
```

### 2. Storage Architecture

**Enhanced Storage Structure:**
```
Supabase Bucket: media-library
├── {userId}/
│   ├── documents/
│   │   ├── {documentId}/
│   │   │   ├── original.{ext}
│   │   │   ├── processed.txt
│   │   │   └── metadata.json
│   │   └── thumbnails/
│   │       └── {documentId}.webp
│   └── categories/
│       ├── sops/
│       ├── knowledge/
│       └── training/
```

### 3. Media Library Interface Design

**WordPress-Style Interface:**
- **Grid/List View Toggle**: Switch between visual grid and detailed list
- **Category Sidebar**: Hierarchical category organization
- **Search & Filter**: Advanced search with metadata filtering
- **Bulk Operations**: Select multiple documents for batch actions
- **Upload Area**: Drag-and-drop with progress tracking
- **Document Preview**: In-line preview for supported formats

### 4. MCP Tool Architecture

**New MCP Tools:**

1. **`media_search_documents`**
   ```typescript
   parameters: {
     query: string,
     categories?: string[],
     agent_id?: string,
     limit?: number
   }
   ```

2. **`media_get_document`**
   ```typescript
   parameters: {
     document_id: string,
     include_content?: boolean
   }
   ```

3. **`media_list_assigned_documents`**
   ```typescript
   parameters: {
     agent_id: string,
     category?: string
   }
   ```

### 5. Integration Points

**WhatIKnowModal Enhancement:**
- **Media Library Tab**: Browse and assign existing documents
- **Upload Tab**: Upload new documents with automatic library storage
- **Assignment Management**: View and manage agent-document assignments

**Memory Architecture Integration:**
- **Vector Submission**: Option to submit documents to Pinecone
- **Knowledge Graph**: Option to submit to GetZep
- **Context Enhancement**: MCP tools provide additional document context

## Technical Specifications

### 1. Component Architecture (Philosophy #1 Compliant)

**MediaPage.tsx** (~300 lines):
- Main orchestrator component
- Layout management and routing
- State coordination between child components

**MediaLibrary.tsx** (~280 lines):
- Document grid/list display
- Search and filtering interface
- Category management integration

**DocumentUpload.tsx** (~250 lines):
- Drag-and-drop upload interface
- Progress tracking and error handling
- Metadata collection during upload

### 2. API Design

**Media Library API** (`/supabase/functions/media-library`):
- `GET /documents` - List user documents with filtering
- `POST /documents` - Upload new document
- `PUT /documents/{id}` - Update document metadata
- `DELETE /documents/{id}` - Delete document
- `POST /documents/{id}/assign` - Assign to agent
- `DELETE /assignments/{id}` - Remove assignment

### 3. MCP Integration Pattern

**Tool Registration**:
```typescript
// Add to TOOL_ROUTING_MAP in universal-tool-executor.ts
'media_': {
  edgeFunction: 'media-mcp-tools',
  actionMapping: (toolName: string) => {
    const actionMap = {
      'media_search_documents': 'search_documents',
      'media_get_document': 'get_document',
      'media_list_assigned_documents': 'list_assigned'
    };
    return actionMap[toolName] || 'unknown_action';
  }
}
```

### 4. Migration Strategy

**Phase 1**: Create new tables and functions
**Phase 2**: Implement media library interface
**Phase 3**: Add MCP tools and integration
**Phase 4**: Enhance WhatIKnowModal with media library
**Phase 5**: Optional migration of existing agent documents

## Implementation Phases

### Phase 1: Database Foundation
- Create new database schema
- Set up RLS policies
- Create storage bucket structure

### Phase 2: Media Library Interface
- Build MediaPage and core components
- Implement upload and management features
- Add sidebar navigation

### Phase 3: MCP Tool Development
- Create media MCP tools
- Integrate with universal tool executor
- Add tool capabilities to database

### Phase 4: Agent Integration
- Enhance WhatIKnowModal with media library
- Implement document assignment workflow
- Add memory architecture integration

### Phase 5: Advanced Features
- Document categorization and tagging
- Bulk operations and advanced search
- Document versioning and history

## Success Criteria

1. **Centralized Management**: Users can upload and manage documents in a dedicated Media page
2. **Flexible Assignment**: Documents can be assigned to multiple agents
3. **MCP Integration**: Agents can search and access documents via MCP tools
4. **Memory Enhancement**: Documents can be submitted to vector/knowledge graph systems
5. **Backward Compatibility**: Existing agent documents continue to work
6. **WordPress-like UX**: Intuitive interface similar to WordPress media library

## Risk Mitigation

1. **Philosophy #1 Compliance**: All components designed to stay under 500 lines
2. **Database Performance**: Proper indexing and query optimization
3. **Storage Costs**: Efficient file organization and cleanup processes
4. **Migration Complexity**: Gradual rollout with fallback options
5. **User Adoption**: Maintain existing workflows while adding new capabilities

## Next Steps

1. **Research Phase**: Complete analysis of existing system and requirements
2. **WBS Creation**: Develop detailed work breakdown structure
3. **Database Design**: Finalize schema and migration strategy
4. **Component Design**: Create detailed component specifications
5. **Implementation**: Begin development following WBS checklist
