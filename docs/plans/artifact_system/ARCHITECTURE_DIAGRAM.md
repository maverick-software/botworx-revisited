# Artifact System - Architecture Diagrams

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                 │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Agent Chat Page                               │   │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐        │   │
│  │  │  Chat Message │  │  Artifact    │  │   Artifact   │        │   │
│  │  │   Component   │→ │    Card      │→ │    Modal     │        │   │
│  │  └───────────────┘  └──────────────┘  └──────────────┘        │   │
│  │         ↑                    ↑                  ↑               │   │
│  │         │                    └──────────────────┘               │   │
│  │         │                            │                          │   │
│  │         │                    ┌───────▼──────────┐              │   │
│  │         │                    │ ArtifactViewer   │              │   │
│  │         │                    │  (Type Router)   │              │   │
│  │         │                    └───────┬──────────┘              │   │
│  │         │                            │                          │   │
│  │         │       ┌────────────────────┼────────────────────┐    │   │
│  │         │       │         │          │          │         │    │   │
│  │         │   ┌───▼───┐ ┌──▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼──┐ │   │
│  │         │   │ Code  │ │ Doc  │ │ Image │ │ Chart │ │ JSON │ │   │
│  │         │   └───────┘ └──────┘ └───────┘ └───────┘ └──────┘ │   │
│  └─────────┼────────────────────────────────────────────────────┘   │
└────────────┼──────────────────────────────────────────────────────────┘
             │
             │ sendMessage()
             │
┌────────────▼──────────────────────────────────────────────────────────┐
│                        BACKEND - EDGE FUNCTIONS                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      chat/index.ts                               │ │
│  │  ┌───────────────┐          ┌──────────────────┐               │ │
│  │  │   LLM Call    │────────→ │  Function Call   │               │ │
│  │  │  (OpenAI)     │          │  (create_artifact)│               │ │
│  │  └───────────────┘          └────────┬─────────┘               │ │
│  └──────────────────────────────────────┼──────────────────────────┘ │
│                                          │                             │
│  ┌──────────────────────────────────────▼──────────────────────────┐ │
│  │           universal-tool-executor.ts                            │ │
│  │                 (Route to artifact-mcp)                         │ │
│  └──────────────────────────────────────┬──────────────────────────┘ │
│                                          │                             │
│  ┌──────────────────────────────────────▼──────────────────────────┐ │
│  │                    artifact-mcp/index.ts                        │ │
│  │  ┌────────────────┬─────────────────┬──────────────────────┐  │ │
│  │  │ create_artifact│ list_artifacts  │ get_artifact         │  │ │
│  │  │ update_artifact│ delete_artifact │ get_version_history  │  │ │
│  │  └────────┬───────┴─────────┬───────┴──────────┬───────────┘  │ │
│  └───────────┼─────────────────┼──────────────────┼──────────────┘ │
└──────────────┼─────────────────┼──────────────────┼────────────────┘
               │                 │                  │
               │ INSERT          │ SELECT           │ SELECT + JOIN
               │                 │                  │
┌──────────────▼─────────────────▼──────────────────▼────────────────┐
│                         DATABASE LAYER                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Table: artifacts (Metadata & References)                    │  │
│  │  ┌────────┬──────────┬─────────────┬───────────────────┐    │  │
│  │  │   id   │  title   │ artifact_   │ media_library_id  │    │  │
│  │  │ (PK)   │          │   type      │     (FK)          │    │  │
│  │  ├────────┼──────────┼─────────────┼───────────────────┤    │  │
│  │  │ uuid1  │ "Auth.ts"│   code      │  media-uuid-1     │────┼──┐
│  │  │ uuid2  │ "Report" │  document   │  media-uuid-2     │────┼──┼─┐
│  │  └────────┴──────────┴─────────────┴───────────────────┘    │  │ │
│  │     ↑                                                         │  │ │
│  │     │ References conversation, message, agent                │  │ │
│  │     │ Stores: version, tags, metadata, analytics            │  │ │
│  └─────┼─────────────────────────────────────────────────────────┘  │
│        │                                                             │
│  ┌─────┼─────────────────────────────────────────────────────────┐  │
│  │     │  Table: media_library (Content Storage)               │  │
│  │  ┌──▼──────┬─────────────┬───────────────┬────────────────┐ │  │
│  │  │   id    │  file_name  │ text_content  │  storage_path  │ │  │
│  │  │  (PK)   │             │               │                │ │  │
│  │  ├─────────┼─────────────┼───────────────┼────────────────┤ │  │
│  │◄─┤media-1  │ auth-svc.ts │ "export..."   │ /user/art/...  │ │  │
│  │  ├─────────┼─────────────┼───────────────┼────────────────┤ │  │
│  │◄─┤media-2  │ report.md   │ "# Report..." │ /user/art/...  │ │  │
│  │  └─────────┴─────────────┴───────────────┴────────────────┘ │  │
│  │     ↑                                                        │  │
│  │     │ Stores actual file content                            │  │
│  │     │ Handles storage bucket, URLs, processing              │  │
│  └─────┼──────────────────────────────────────────────────────────┘  │
└────────┼────────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────────┐
│                    SUPABASE STORAGE                                  │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Bucket: media-library                                        │  │
│  │  /user-id/artifacts/                                          │  │
│  │    ├─ timestamp_auth-service.ts                               │  │
│  │    ├─ timestamp_report.md                                     │  │
│  │    └─ timestamp_chart.png                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow: Creating an Artifact

```
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 1: User asks agent to create code                             │
│  "Can you create a user authentication module in TypeScript?"       │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│  STEP 2: LLM decides to create artifact                             │
│  Function Call: create_artifact({                                   │
│    title: "User Authentication Module",                             │
│    artifact_type: "code",                                           │
│    language: "typescript",                                          │
│    content: "export class AuthService { ... }"                      │
│  })                                                                  │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│  STEP 3: artifact-mcp processes request                             │
│                                                                      │
│  A. Insert into media_library:                                      │
│     ┌──────────────────────────────────────┐                       │
│     │ INSERT INTO media_library            │                       │
│     │ VALUES (                             │                       │
│     │   id: 'media-abc-123',               │                       │
│     │   file_name: 'auth-service.ts',      │                       │
│     │   text_content: 'export class...',   │                       │
│     │   source_type: 'agent_created'       │                       │
│     │ )                                    │                       │
│     └──────────────┬───────────────────────┘                       │
│                    │ Returns media_library_id                       │
│                    ▼                                                 │
│  B. Insert into artifacts:                                          │
│     ┌──────────────────────────────────────┐                       │
│     │ INSERT INTO artifacts                │                       │
│     │ VALUES (                             │                       │
│     │   id: 'artifact-xyz-789',            │                       │
│     │   title: 'User Auth Module',         │                       │
│     │   artifact_type: 'code',             │                       │
│     │   language: 'typescript',            │                       │
│     │   media_library_id: 'media-abc-123'  │◄──── Links to content│
│     │ )                                    │                       │
│     └──────────────┬───────────────────────┘                       │
└────────────────────┼────────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────────────┐
│  STEP 4: Response sent to chat function                             │
│  {                                                                   │
│    success: true,                                                    │
│    artifact_id: 'artifact-xyz-789',                                 │
│    title: 'User Authentication Module',                             │
│    type: 'code',                                                     │
│    preview: 'export class AuthService {...'                         │
│  }                                                                   │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────────────┐
│  STEP 5: Chat saves message with artifact metadata                  │
│  INSERT INTO chat_messages (                                        │
│    content: "I've created a TypeScript authentication module...",   │
│    metadata: {                                                       │
│      artifacts: [{                                                   │
│        id: 'artifact-xyz-789',                                      │
│        title: 'User Authentication Module',                         │
│        artifact_type: 'code',                                       │
│        language: 'typescript',                                      │
│        preview_content: 'export class AuthService...'               │
│      }]                                                              │
│    }                                                                 │
│  )                                                                   │
└────────────────────┬─────────────────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────────────────┐
│  STEP 6: Frontend receives message and renders                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  Agent Message                                              │    │
│  │  "I've created a TypeScript authentication module for you"  │    │
│  │  ┌──────────────────────────────────────────────────────┐  │    │
│  │  │  📄 User Authentication Module                        │  │    │
│  │  │  TypeScript • 5.2 KB • Code                          │  │    │
│  │  │  [View] [Copy] [Download]                            │  │    │
│  │  └──────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔍 Query Patterns Comparison

### Fast Query (Metadata Only)

```sql
-- Get artifacts in conversation (NO JOIN)
-- Returns in ~10ms, doesn't load content

SELECT 
  id,
  title,
  artifact_type,
  language,
  created_at,
  view_count
FROM artifacts
WHERE conversation_id = 'conv-123'
  AND status = 'active'
  AND is_latest_version = true
ORDER BY created_at DESC;

┌─────────┬─────────────┬──────────┬────────────┬─────────────┐
│   id    │    title    │   type   │  language  │  created_at │
├─────────┼─────────────┼──────────┼────────────┼─────────────┤
│ uuid-1  │ Auth Module │  code    │ typescript │ 2025-10-04  │
│ uuid-2  │ Report Doc  │ document │    null    │ 2025-10-03  │
└─────────┴─────────────┴──────────┴────────────┴─────────────┘

✅ Fast! No content loaded
```

### Full Query (With Content)

```sql
-- Get artifact with full content (WITH JOIN)
-- Returns in ~50ms, loads everything

SELECT 
  a.*,
  m.text_content,
  m.file_url,
  m.file_size
FROM artifacts a
JOIN media_library m ON a.media_library_id = m.id
WHERE a.id = 'artifact-uuid-1';

┌──────────┬─────────────┬──────────┬─────────────────┐
│ artifact │ media_lib   │ content  │     file_url    │
├──────────┼─────────────┼──────────┼─────────────────┤
│ All      │ text_content│ "export  │ https://...     │
│ metadata │ file_url    │  class   │                 │
│ fields   │ file_size   │  Auth... │                 │
└──────────┴─────────────┴──────────┴─────────────────┘

✅ Full content loaded on demand
```

## 🗂️ Storage Organization

```
media-library (Supabase Storage Bucket)
│
├── user-id-1/
│   ├── documents/
│   │   ├── 1696000000_report.pdf         ← User upload
│   │   └── 1696000001_notes.txt          ← User upload
│   │
│   └── artifacts/
│       ├── 1696000002_auth-service.ts    ← Agent created ✨
│       ├── 1696000003_user-guide.md      ← Agent created ✨
│       └── 1696000004_dashboard-chart.png ← Agent created ✨
│
└── user-id-2/
    └── artifacts/
        └── 1696000005_api-client.js      ← Agent created ✨

Database: media_library table
┌──────────┬────────────────────┬─────────────┬──────────────┐
│    id    │    storage_path    │ source_type │ created_by_  │
│          │                    │             │  agent_id    │
├──────────┼────────────────────┼─────────────┼──────────────┤
│ media-1  │ user-1/docs/rep... │ user_upload │ null         │
│ media-2  │ user-1/art/auth... │agent_created│ agent-abc    │✨
│ media-3  │ user-1/art/guide...│agent_created│ agent-abc    │✨
└──────────┴────────────────────┴─────────────┴──────────────┘

Database: artifacts table (references media_library)
┌──────────┬────────────────┬──────────────┬──────────────────┐
│    id    │     title      │    type      │ media_library_id │
├──────────┼────────────────┼──────────────┼──────────────────┤
│artifact-1│ Auth Service   │   code       │ media-2          │──┐
│artifact-2│ User Guide     │   document   │ media-3          │──┼─► Links
└──────────┴────────────────┴──────────────┴──────────────────┘  │  to content
                                                                   │
                                                   ┌───────────────┘
                                                   │
                                         Retrieves content from
                                         media_library when needed
```

## 🔄 Versioning Flow

```
Version 1 (Original)
┌──────────────────────────────────────┐
│ artifacts                             │
│ ┌────────────────────────────────┐  │
│ │ id: artifact-v1                │  │
│ │ title: "Auth Module"           │  │
│ │ version: 1                     │  │
│ │ version_parent_id: null        │  │
│ │ is_latest_version: true ✓      │  │
│ │ media_library_id: media-v1     │──┼─────┐
│ └────────────────────────────────┘  │     │
└──────────────────────────────────────┘     │
                                             │
User edits artifact                          │
       ↓                                     │
                                             ▼
Version 2 (Updated)                  ┌──────────────────┐
┌──────────────────────────────────────┐   │ media_library│
│ artifacts (NEW ROW)                   │   ├──────────────┤
│ ┌────────────────────────────────┐  │   │ media-v1     │
│ │ id: artifact-v2                │  │   │ content: ... │
│ │ title: "Auth Module"           │  │   ├──────────────┤
│ │ version: 2                     │  │   │ media-v2     │
│ │ version_parent_id: artifact-v1 │──┼───│ content: ... │
│ │ is_latest_version: true ✓      │  │   └──────────────┘
│ │ media_library_id: media-v2     │──┼─────┐
│ └────────────────────────────────┘  │     │
└──────────────────────────────────────┘     │
                                             │
Trigger Updates Version 1                    │
       ↓                                     │
┌──────────────────────────────────────┐     │
│ artifacts (UPDATED)                   │     │
│ ┌────────────────────────────────┐  │     │
│ │ id: artifact-v1                │  │     │
│ │ is_latest_version: false ✗     │  │     │
│ └────────────────────────────────┘  │     │
└──────────────────────────────────────┘     │
                                             ▼
Get version history:                  ┌──────────────────┐
SELECT * FROM artifacts               │ Both versions    │
WHERE id = 'artifact-v2'              │ preserved with   │
   OR version_parent_id = 'artifact-v1'│ full content    │
ORDER BY version DESC;                └──────────────────┘
```

## 📱 Component Hierarchy

```
AgentChatPage
│
├── ChatHeader
│
├── MessageList
│   └── Message (for each message)
│       ├── MessageContent
│       │
│       └── Artifacts (if metadata.artifacts exists)
│           └── ArtifactCard (for each artifact)
│               ├── Icon (based on type)
│               ├── Title
│               ├── Metadata (type, size, date)
│               └── QuickActions
│                   ├── View Button → opens ArtifactModal
│                   ├── Copy Button
│                   └── Download Button
│
└── ArtifactModal (when clicked)
    ├── ModalHeader
    │   ├── Title
    │   ├── Type Badge
    │   └── Close Button
    │
    ├── ArtifactViewer (type router)
    │   ├── CodeArtifact (if type === 'code')
    │   │   ├── SyntaxHighlighter
    │   │   ├── Line Numbers
    │   │   └── Language Badge
    │   │
    │   ├── DocumentArtifact (if type === 'document')
    │   │   └── ReactMarkdown
    │   │
    │   ├── ImageArtifact (if type === 'image')
    │   │   ├── Image Display
    │   │   └── Zoom Controls
    │   │
    │   ├── ChartArtifact (if type === 'chart')
    │   │   └── Recharts Component
    │   │
    │   └── JsonArtifact (if type === 'json')
    │       └── ReactJsonView
    │
    └── ArtifactActions
        ├── Copy to Clipboard
        ├── Download
        ├── View History
        └── Export Options
```

---

**Last Updated**: October 4, 2025  
**Version**: 1.0  
**Status**: Complete

