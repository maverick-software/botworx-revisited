# Agentopia Application Flowchart
**Version:** 2.0  
**Date:** May 11, 2025  
**Architecture Analysis Date:** May 11, 2025  
**Technology Stack:** React 18 + TypeScript + Supabase  

This document provides a comprehensive flowchart of user journeys and system architecture for Agentopia's modern web application.

## Main Application Flow

```mermaid
flowchart TD
    Start([User Access Platform]) --> Auth{Authentication Status}
    
    Auth -->|Not Authenticated| LoginPage[Login Page - Supabase Auth]
    Auth -->|Authenticated| Dashboard[Dashboard Page - 224 lines]
    
    LoginPage --> AuthOptions{Authentication Method}
    AuthOptions -->|Email/Password| EmailAuth[Email Authentication]
    AuthOptions -->|OAuth| OAuthFlow[OAuth Flow]
    
    OAuthFlow --> GoogleAuth[Google OAuth]
    OAuthFlow --> DiscordAuth[Discord OAuth]
    OAuthFlow --> GitHubAuth[GitHub OAuth]
    
    EmailAuth --> Supabase[(Supabase Auth)]
    GoogleAuth --> Supabase
    DiscordAuth --> Supabase
    GitHubAuth --> Supabase
    
    Supabase --> Dashboard
    
    Dashboard --> Navigation{Navigation Choice}
    
    Navigation -->|Agents| AgentsFlow[Agent Management Flow]
    Navigation -->|Workspaces| WorkspaceFlow[Workspace Collaboration Flow]
    Navigation -->|Teams| TeamsFlow[Team Management Flow]
    Navigation -->|Datastores| DatastoreFlow[Knowledge Base Flow]
    Navigation -->|Toolboxes| ToolboxFlow[Tool Management Flow]
    Navigation -->|Admin| AdminFlow[Administrative Flow]
    
    %% Agent Management Flow
    AgentsFlow --> AgentsPage[Agents Page - 298 lines]
    AgentsPage --> AgentActions{Agent Actions}
    AgentActions -->|Create New| AgentCreate[Create Agent Form]
    AgentActions -->|Edit Existing| AgentEdit[Agent Edit - 531 lines ⚠️]
    AgentActions -->|View List| AgentList[Agent List View]
    AgentActions -->|Deploy to Discord| DiscordDeploy[Discord Bot Deployment]
    
    %% Workspace Collaboration Flow
    WorkspaceFlow --> WorkspacePage[Workspace Page - 287 lines]
    WorkspacePage --> WorkspaceActions{Workspace Features}
    WorkspaceActions -->|Real-time Chat| ChatInterface[Chat Interface - WebSocket]
    WorkspaceActions -->|File Sharing| FileUpload[File Upload & Sharing]
    WorkspaceActions -->|Member Management| MemberMgmt[Member Management]
    WorkspaceActions -->|Agent Interaction| AgentMention[Agent @mention System]
    
    %% Knowledge Base Flow
    DatastoreFlow --> DatastorePage[Datastores Page - 664 lines 🔴]
    DatastorePage --> DatastoreActions{Datastore Operations}
    DatastoreActions -->|Upload Documents| DocUpload[Document Upload]
    DatastoreActions -->|Vector Search| VectorSearch[Pinecone Vector Search]
    DatastoreActions -->|RAG Processing| RAGSystem[RAG Implementation]
    
    %% Tool Management Flow
    ToolboxFlow --> ToolboxPage[Toolboxes Page - 312 lines]
    ToolboxPage --> ToolActions{Tool Operations}
    ToolActions -->|Install Tools| ToolInstall[MCP Tool Installation]
    ToolActions -->|Configure Tools| ToolConfig[Tool Configuration]
    ToolActions -->|Marketplace| ToolMarketplace[Tool Marketplace]
```

## Authentication & Authorization Flow

```mermaid
flowchart TD
    UserAccess([User Accesses Platform]) --> CheckAuth{Check Authentication}
    
    CheckAuth -->|No JWT Token| LoginRequired[Redirect to Login]
    CheckAuth -->|Valid JWT| CheckRBAC{Check User Role}
    
    LoginRequired --> AuthMethods{Choose Auth Method}
    AuthMethods -->|Email/Password| EmailForm[Email/Password Form]
    AuthMethods -->|OAuth Google| GoogleOAuth[Google OAuth Flow]
    AuthMethods -->|OAuth Discord| DiscordOAuth[Discord OAuth Flow]
    AuthMethods -->|OAuth GitHub| GitHubOAuth[GitHub OAuth Flow]
    
    EmailForm --> SupabaseAuth[(Supabase Authentication)]
    GoogleOAuth --> SupabaseAuth
    DiscordOAuth --> SupabaseAuth
    GitHubOAuth --> SupabaseAuth
    
    SupabaseAuth -->|Success| JWTToken[JWT Token Generated]
    SupabaseAuth -->|Failure| AuthError[Authentication Error]
    
    JWTToken --> CheckRBAC
    AuthError --> LoginRequired
    
    CheckRBAC -->|Admin| AdminAccess[Full System Access]
    CheckRBAC -->|Team Lead| TeamLeadAccess[Team Management Access]
    CheckRBAC -->|Member| MemberAccess[Standard User Access]
    CheckRBAC -->|Viewer| ViewerAccess[Read-only Access]
    
    AdminAccess --> AdminDashboard[Admin Dashboard]
    TeamLeadAccess --> TeamDashboard[Team Management Dashboard]
    MemberAccess --> UserDashboard[User Dashboard]
    ViewerAccess --> ReadOnlyDashboard[Read-only Dashboard]
```

## Agent Lifecycle & Discord Integration Flow

```mermaid
flowchart TD
    AgentCreate([Create New Agent]) --> AgentForm[Agent Creation Form]
    AgentForm --> PersonalityConfig[Personality Configuration]
    PersonalityConfig --> AgentDB[(Save to PostgreSQL)]
    
    AgentDB --> AgentManagement{Agent Management Options}
    
    AgentManagement -->|Activate| AgentActive[Agent Status: Active]
    AgentManagement -->|Deploy to Discord| DiscordFlow[Discord Integration Flow]
    AgentManagement -->|Configure Workspace| WorkspaceAssign[Workspace Assignment]
    AgentManagement -->|Edit Settings| AgentEditFlow[Agent Edit Interface]
    
    %% Discord Integration Detailed Flow
    DiscordFlow --> DiscordAuth{Discord Bot Authorization}
    DiscordAuth -->|New Bot| CreateBot[Create Discord Application]
    DiscordAuth -->|Existing Bot| UseExisting[Use Existing Bot Token]
    
    CreateBot --> BotToken[Generate Bot Token]
    UseExisting --> BotToken
    BotToken --> GuildSetup[Discord Guild Configuration]
    
    GuildSetup --> ChannelConfig[Channel-specific Assignment]
    ChannelConfig --> SlashCommands[Slash Command Registration]
    SlashCommands --> WebhookSetup[Webhook Configuration]
    
    WebhookSetup --> DiscordLive[Discord Bot Live]
    DiscordLive --> MessageFlow{Message Handling}
    
    MessageFlow -->|User Message| ProcessMessage[Process Discord Message]
    MessageFlow -->|Agent Mention| MentionHandler[Handle @agent Mention]
    MessageFlow -->|Slash Command| CommandHandler[Handle Slash Command]
    
    ProcessMessage --> LLMProcessing[OpenAI API Processing]
    MentionHandler --> LLMProcessing
    CommandHandler --> LLMProcessing
    
    LLMProcessing --> ResponseGen[Generate Response]
    ResponseGen --> DiscordReply[Send Reply to Discord]
    DiscordReply --> MessageFlow
    
    %% Workspace Integration
    WorkspaceAssign --> WorkspaceChat[Workspace Chat Integration]
    WorkspaceChat --> RealtimeSync[Real-time Synchronization]
    RealtimeSync --> SupabaseRealtime[(Supabase Realtime)]
```

## Knowledge Base & RAG System Flow

```mermaid
flowchart TD
    KnowledgeStart([Knowledge Base Access]) --> DatastoreSelect{Select Datastore}
    
    DatastoreSelect -->|Create New| CreateDatastore[Create New Datastore]
    DatastoreSelect -->|Use Existing| ExistingDatastore[Access Existing Datastore]
    
    CreateDatastore --> DatastoreConfig[Configure Datastore Settings]
    DatastoreConfig --> PineconeSetup[Pinecone Vector DB Setup]
    
    ExistingDatastore --> DatastoreOps{Datastore Operations}
    PineconeSetup --> DatastoreOps
    
    DatastoreOps -->|Upload Documents| DocUpload[Document Upload Interface]
    DatastoreOps -->|Search Knowledge| SearchInterface[Search Interface]
    DatastoreOps -->|Manage Content| ContentMgmt[Content Management]
    
    DocUpload --> FileValidation[File Type Validation]
    FileValidation --> TextExtraction[Text Extraction & Processing]
    TextExtraction --> ChunkingProcess[Document Chunking]
    ChunkingProcess --> EmbeddingGen[Generate Embeddings - OpenAI]
    
    EmbeddingGen --> PineconeStore[(Store in Pinecone Vector DB)]
    PineconeStore --> IndexComplete[Indexing Complete]
    
    SearchInterface --> QueryEmbedding[Generate Query Embedding]
    QueryEmbedding --> VectorSearch[Pinecone Vector Search]
    VectorSearch --> RetrieveContext[Retrieve Relevant Context]
    RetrieveContext --> RAGResponse[Generate RAG Response]
    
    RAGResponse --> AgentResponse[Agent Uses Context for Response]
    AgentResponse --> UserReceivesAnswer[User Receives Enhanced Answer]
    
    ContentMgmt --> ViewDocs[View Documents]
    ContentMgmt --> DeleteDocs[Delete Documents]
    ContentMgmt --> UpdateDocs[Update Documents]
    ViewDocs --> PineconeStore
    DeleteDocs --> PineconeStore
    UpdateDocs --> EmbeddingGen
```

## Workspace Collaboration & Real-time Features Flow

```mermaid
flowchart TD
    WorkspaceEntry([Enter Workspace]) --> WorkspaceAuth{Check Workspace Access}
    
    WorkspaceAuth -->|Authorized| WorkspaceInterface[Workspace Interface - 287 lines]
    WorkspaceAuth -->|Unauthorized| AccessDenied[Access Denied]
    
    WorkspaceInterface --> RealtimeConnection[Establish WebSocket Connection]
    RealtimeConnection --> SupabaseRealtime[(Supabase Realtime)]
    
    SupabaseRealtime --> WorkspaceFeatures{Workspace Features}
    
    WorkspaceFeatures -->|Chat| ChatFlow[Real-time Chat Flow]
    WorkspaceFeatures -->|File Sharing| FileFlow[File Sharing Flow]
    WorkspaceFeatures -->|Agent Interaction| AgentFlow[Agent Interaction Flow]
    WorkspaceFeatures -->|Member Management| MemberFlow[Member Management Flow]
    
    %% Chat Flow
    ChatFlow --> MessageCompose[Compose Message Interface]
    MessageCompose --> MessageSend[Send Message]
    MessageSend --> MessageDB[(Store in PostgreSQL)]
    MessageDB --> BroadcastMessage[Broadcast via WebSocket]
    BroadcastMessage --> AllConnectedUsers[All Connected Users Receive]
    
    %% Agent Mention Flow
    AgentFlow --> AgentMention[Type @agent-name]
    AgentMention --> MentionDetection[Detect Agent Mention]
    MentionDetection --> AgentNotification[Notify Agent System]
    AgentNotification --> AgentProcessing[Agent Processes Message]
    AgentProcessing --> AgentResponse[Agent Generates Response]
    AgentResponse --> MessageDB
    
    %% File Sharing Flow
    FileFlow --> FileSelect[Select File to Share]
    FileSelect --> FileUpload[Upload to Supabase Storage]
    FileUpload --> FileMetadata[Store File Metadata]
    FileMetadata --> ShareNotification[Notify Workspace Members]
    ShareNotification --> FileAvailable[File Available to Members]
    
    %% Member Management Flow
    MemberFlow --> InviteMembers[Invite New Members]
    MemberFlow --> ManageRoles[Manage Member Roles]
    MemberFlow --> RemoveMembers[Remove Members]
    
    InviteMembers --> InviteEmail[Send Invitation Email]
    ManageRoles --> UpdatePermissions[Update User Permissions]
    RemoveMembers --> RevokeAccess[Revoke Workspace Access]
```

## Tool Integration & MCP Framework Flow

```mermaid
flowchart TD
    ToolStart([Access Tool Management]) --> ToolboxPage[Toolboxes Page - 312 lines]
    
    ToolboxPage --> ToolOperations{Tool Operations}
    
    ToolOperations -->|Browse Marketplace| ToolMarketplace[Tool Marketplace Browser]
    ToolOperations -->|Install Tool| ToolInstall[Tool Installation Flow]
    ToolOperations -->|Configure Tool| ToolConfig[Tool Configuration]
    ToolOperations -->|Use Tool| ToolExecution[Tool Execution Flow]
    
    %% Marketplace Flow
    ToolMarketplace --> BrowseTools[Browse Available Tools]
    BrowseTools --> ToolDetails[View Tool Details]
    ToolDetails --> InstallFromMarketplace[Install Selected Tool]
    InstallFromMarketplace --> ToolInstall
    
    %% Installation Flow
    ToolInstall --> ValidateTool[Validate Tool Compatibility]
    ValidateTool --> DownloadTool[Download Tool Package]
    DownloadTool --> SecurityCheck[Security & Permission Check]
    SecurityCheck --> InstallTool[Install Tool in Environment]
    InstallTool --> ToolRegistration[Register Tool in Database]
    
    %% Configuration Flow
    ToolConfig --> LoadToolConfig[Load Tool Configuration Interface]
    LoadToolConfig --> SetCredentials[Set Tool Credentials]
    SetCredentials --> ConfigurePermissions[Configure Tool Permissions]
    ConfigurePermissions --> TestConnection[Test Tool Connection]
    TestConnection --> SaveConfig[Save Configuration]
    
    %% Execution Flow
    ToolExecution --> AgentRequestsTool[Agent Requests Tool Usage]
    AgentRequestsTool --> ValidatePermissions[Validate Tool Permissions]
    ValidatePermissions --> PrepareToolCall[Prepare Tool API Call]
    PrepareToolCall --> ExecuteTool[Execute Tool Function]
    ExecuteTool --> ProcessResponse[Process Tool Response]
    ProcessResponse --> ReturnToAgent[Return Results to Agent]
    
    %% MCP Framework Integration
    ToolRegistration --> MCPFramework[MCP Framework Integration]
    MCPFramework --> ToolInterface[Standardized Tool Interface]
    ToolInterface --> ToolCommunication[Tool Communication Protocol]
    ToolCommunication --> AgentRequestsTool
```

## System Architecture & Data Flow

```mermaid
flowchart TD
    Frontend[React 18 Frontend] --> APILayer[Supabase API Layer]
    
    APILayer --> Database[(PostgreSQL 14+ with pgvector)]
    APILayer --> Auth[Supabase Auth]
    APILayer --> EdgeFunctions[Supabase Edge Functions]
    APILayer --> Realtime[Supabase Realtime]
    APILayer --> Storage[Supabase Storage]
    
    EdgeFunctions --> ExternalAPIs{External API Integrations}
    
    ExternalAPIs --> OpenAI[OpenAI API - LLM Processing]
    ExternalAPIs --> Pinecone[Pinecone Vector Database]
    ExternalAPIs --> Discord[Discord API]
    ExternalAPIs --> MCPTools[MCP Tool Ecosystem]
    
    Database --> Tables{Database Tables}
    Tables --> UserProfiles[user_profiles]
    Tables --> Agents[agents]
    Tables --> Workspaces[workspaces]
    Tables --> ChatMessages[chat_messages]
    Tables --> Datastores[datastores]
    Tables --> Tools[tools]
    
    Frontend --> Components{React Components}
    Components --> DashboardComp[Dashboard - 224 lines ✅]
    Components --> AgentsComp[Agents - 298 lines ✅]
    Components --> AgentEditComp[AgentEdit - 531 lines ⚠️]
    Components --> WorkspaceComp[Workspace - 287 lines ✅]
    Components --> DatastoreComp[Datastores - 664 lines 🔴]
    Components --> ToolboxComp[Toolboxes - 312 lines ✅]
    
    %% Infrastructure Layer
    Database --> Infrastructure[Infrastructure Layer]
    Infrastructure --> DigitalOcean[DigitalOcean Hosting]
    Infrastructure --> PM2[PM2 Process Management]
    Infrastructure --> Docker[Docker Containers]
    Infrastructure --> LoadBalancer[Load Balancer]
```

## Error Handling & Monitoring Flow

```mermaid
flowchart TD
    UserAction([User Performs Action]) --> TryOperation{Execute Operation}
    
    TryOperation -->|Success| SuccessResponse[Return Success Response]
    TryOperation -->|Error| ErrorHandling[Error Handling System]
    
    ErrorHandling --> ErrorType{Error Type Classification}
    
    ErrorType -->|Authentication| AuthError[Authentication Error]
    ErrorType -->|Authorization| AuthZError[Authorization Error]
    ErrorType -->|Validation| ValidationError[Input Validation Error]
    ErrorType -->|Network| NetworkError[Network/API Error]
    ErrorType -->|System| SystemError[System/Server Error]
    
    AuthError --> LoginRedirect[Redirect to Login]
    AuthZError --> AccessDenied[Show Access Denied]
    ValidationError --> ValidationMessage[Show Validation Message]
    NetworkError --> RetryMechanism[Retry Mechanism]
    SystemError --> SystemAlert[System Alert]
    
    %% Logging Flow (Currently Missing - Critical Issue)
    ErrorHandling --> LoggingSystem[Logging System - ⚠️ MISSING]
    LoggingSystem --> LogTypes{Log Types}
    LogTypes --> ErrorLogs[Error Logs]
    LogTypes --> AccessLogs[Access Logs]
    LogTypes --> PerformanceLogs[Performance Logs]
    LogTypes --> AuditLogs[Audit Logs]
    
    ErrorLogs --> LogStorage[(Log Storage - NEEDED)]
    AccessLogs --> LogStorage
    PerformanceLogs --> LogStorage
    AuditLogs --> LogStorage
    
    LogStorage --> MonitoringDashboard[Monitoring Dashboard - NEEDED]
    MonitoringDashboard --> AlertSystem[Alert System - NEEDED]
```

## Critical Issues Identified in Current Flow

### 🔴 High Priority Issues
1. **Missing Logging Infrastructure**
   - No comprehensive error tracking
   - Limited debugging capabilities
   - No performance monitoring

2. **Large Component Files**
   - DatastoresPage.tsx: 664 lines (violates 500-line rule)
   - AgentEdit.tsx: 531 lines (approaching limit)
   - Need immediate refactoring

3. **Architecture Transition**
   - Tool management patterns inconsistent
   - Migration from per-agent to shared model

### Architecture Strengths
1. **Modern React 18 + TypeScript Stack**
2. **Supabase Real-time Capabilities**
3. **Comprehensive Discord Integration**
4. **Vector Database Integration with Pinecone**
5. **OAuth Authentication System**

## Summary

This flowchart represents the current operational state of Agentopia as of May 11, 2025. The platform successfully implements:

- **Authentication & Authorization**: Full OAuth integration with role-based access
- **Real-time Collaboration**: WebSocket-based workspace features
- **AI Agent Management**: Complete CRUD operations with Discord deployment
- **Knowledge Base**: RAG system with Pinecone vector database
- **Tool Integration**: MCP framework for external tool connectivity

**Critical Next Steps:**
1. Implement comprehensive logging infrastructure
2. Refactor large component files
3. Complete tool architecture transition
4. Enhance monitoring and alerting systems

**System Status:** 70% MVP Complete, Production-Ready with Critical Issues to Address