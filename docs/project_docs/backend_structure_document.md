# Agentopia Backend Structure Document

This document outlines the backend architecture, databases, API endpoints, hosting, infrastructure components, and security measures for Agentopia. The document is written in everyday language and is designed to be easily understood even without a technical background.

## 1. Backend Architecture
# Agentopia Backend Structure Document
**Version:** 2.0  
**Last Updated:** May 11, 2025  
**Architecture Analysis Date:** May 11, 2025  

This document provides a comprehensive overview of Agentopia's backend architecture as implemented in May 2025. The backend leverages modern serverless technologies with Supabase as the primary backend-as-a-service platform, complemented by specialized microservices for Discord integration and tool management.

## 1. Backend Architecture Overview

### Modern Serverless Architecture
Agentopia uses a hybrid architecture combining:
- **Supabase Backend-as-a-Service**: Primary backend infrastructure
- **Edge Functions**: Serverless TypeScript functions for business logic
- **Microservices**: Specialized Node.js services for specific integrations
- **Container Management**: Dockerized tool environments on DigitalOcean

### Core Technology Stack
- **Runtime**: Node.js with TypeScript
- **Database**: PostgreSQL with pgvector extension (via Supabase)
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **Real-time**: Supabase Realtime for WebSocket connections
- **Serverless Functions**: Supabase Edge Functions (Deno runtime)
- **Container Orchestration**: Docker with Dockerode
- **Process Management**: PM2 for service reliability

## 2. Supabase Core Infrastructure

### Database Management
**PostgreSQL with Advanced Extensions:**
- **pgvector Extension**: Vector storage for AI embeddings and similarity search
- **Row Level Security (RLS)**: Database-level security policies for multi-tenancy
- **Real-time Subscriptions**: Live data updates via WebSocket connections
- **Automated Backups**: Point-in-time recovery and data protection

### Authentication System
**Supabase Auth Features:**
- **Multi-provider Authentication**: Email/password, OAuth (Google, Discord, GitHub planned)
- **JWT Token Management**: Secure session handling with automatic refresh
- **Role-based Access Control**: User roles and permissions managed at database level
- **Password Security**: Advanced hashing and security policies
- **MFA Support**: Multi-factor authentication capabilities (planned)

### Edge Functions (`supabase/functions/`)
**Serverless TypeScript Functions:**

#### Core Business Logic Functions
1. **`chat/` Function** (612 lines ⚠️ VIOLATES 500-line rule)
   - Primary AI agent response logic
   - OpenAI API integration for conversation handling
   - Context building and conversation management
   - RAG system integration with Pinecone
   - **Critical**: Needs refactoring due to size

2. **`discord-interaction-handler/`**
   - Discord webhook event processing
   - Message routing between Discord and agents
   - Command handling and response formatting
   - Rate limiting and error handling

3. **`manage-discord-worker/`**
   - Discord worker service management
   - Process lifecycle control via PM2
   - Health monitoring and auto-restart capabilities
   - Service proxy and routing

#### Tool Management Functions (New May 2025)
4. **`toolboxes-user/`**
   - User toolbox environment management
   - Shared droplet provisioning and configuration
   - Tool instance deployment and monitoring

5. **`agent-toolbelt/`**
   - Agent-specific tool configuration
   - Tool access management and permissions
   - Toolbelt composition and updates

6. **`get-agent-tool-credentials/`**
   - Secure credential management for tools
   - API key encryption and retrieval
   - Permission validation and access control

#### Monitoring and Health Functions
7. **`heartbeat/`**
   - DTMA (Droplet Tool Management Agent) health monitoring
   - Service availability checking
   - System status reporting and alerting

## 3. Database Schema Architecture

### Current Database Schema (May 2025)
Based on recent migrations, the schema includes:

#### Core Entity Tables
```sql
-- User management
users                    # Supabase auth users
user_profiles           # Extended user information

-- Agent system
agents                  # AI agent configurations
teams                   # Team organization
workspaces             # Collaboration spaces
workspace_members       # Team-workspace associations

-- Communication
chat_channels          # Workspace chat channels
chat_messages          # Message history and threading

-- Knowledge management
datastores             # Pinecone datastore connections
agent_datastores       # Agent-datastore associations
```

#### Tool Infrastructure (New May 2025 Refactor)
```sql
-- Tool environment management
account_tool_environments    # Shared DigitalOcean droplets per account
tool_catalog                # Registry of available MCP tools
account_tool_instances      # Tool instances on droplets

-- Agent tool integration
agent_toolbox_access       # Agent access to tool environments
agent_toolbelt_items       # Individual tools assigned to agents
agent_tool_credentials     # Secure credential storage per agent-tool pair

-- MCP integration
mcp_servers                # MCP server configurations
mcp_configurations         # MCP connection settings
```

#### Advanced Features
- **Vector Storage**: pgvector extension for embedding storage and similarity search
- **Row Level Security**: Comprehensive RLS policies for data isolation
- **Foreign Key Relationships**: Well-structured relational constraints
- **Audit Trails**: Change tracking and versioning capabilities
- **Migration Management**: Version-controlled schema evolution

## 4. Microservices Architecture

### Discord Integration Service (`services/discord-worker/`)
**Purpose**: Dedicated Discord bot connection and message processing
**Technology**: Node.js + Discord.js + PM2
**Key Features**:
- Real-time Discord Gateway connection
- Message event processing and routing
- Agent response generation and delivery
- Channel-specific agent deployment
- Slash command handling
- Auto-reconnection and error recovery

### Worker Manager Service (`services/worker-manager/`)
**Purpose**: Process orchestration and service management
**Technology**: Node.js + PM2 ecosystem management
**Key Features**:
- PM2 process lifecycle management
- Service health monitoring and alerting
- Auto-restart and failure recovery
- Resource usage monitoring
- Deployment coordination
- Service scaling management

### DTMA (Droplet Tool Management Agent) (`dtma/`)
**Purpose**: Container and tool environment management
**Technology**: Node.js + Express + Dockerode
**Current State**: Major refactoring in progress (May 2025)
**Key Features**:
- Docker container orchestration
- DigitalOcean droplet management
- Shared tool environment provisioning
- Container health monitoring
- Resource allocation and scaling
- Tool installation and configuration

**⚠️ Architecture Transition**: Migrating from per-agent droplets to shared account-level toolboxes

## 5. Current Architecture Challenges

### 🔴 Critical Issues (Immediate Attention Required)

#### Missing Logging Infrastructure
**Problem**: Severely underdeveloped logging system
- `/logs/` directory nearly empty
- No structured logging across services
- Debugging and monitoring severely hampered
- **Impact**: Operations and troubleshooting significantly hindered
- **Priority**: CRITICAL - Must be addressed immediately

#### Code Quality Violations
**Large Files Exceeding 500-line Limit**:
- `supabase/functions/chat/index.ts`: 612 lines
- Impact: Reduced maintainability, harder debugging, complex testing
- **Action Required**: Immediate refactoring with modular breakdown

#### Architecture Transition in Progress
**Tool Infrastructure Refactor**:
- Migration from per-agent to shared droplet model incomplete
- DTMA system transformation ongoing
- Risk of partial migration causing system instability
- **Priority**: HIGH - Complete the refactor before major feature additions

### 🟡 Medium Priority Issues
- **Token Management**: Simple character counting instead of proper tokenizer
- **Test Coverage**: Gaps in comprehensive testing
- **API Documentation**: Limited formal API specifications

## 6. Security Architecture

### Multi-layered Security Approach
**Database Security**:
- Row Level Security (RLS) policies for data isolation
- Encrypted connections and data at rest
- Regular security updates and patches
- Database-level access controls

**API Security**:
- JWT-based authentication for all endpoints
- Rate limiting and DDoS protection
- Input validation and sanitization
- CORS and security headers implementation

**Credential Management**:
- Supabase Vault for encrypted API key storage
- Environment-based configuration management
- Principle of least privilege access
- Regular credential rotation policies

## 7. Performance and Monitoring

### Performance Optimization Strategies
**Database Performance**:
- Query optimization and indexing
- Connection pooling and management
- Vector search optimization
- Caching strategies for frequent queries

**Function Performance**:
- Edge function optimization for low latency
- Efficient memory usage and garbage collection
- Async/await patterns for concurrent operations
- Response caching and CDN integration

### Monitoring and Alerting (Needs Enhancement)
**Current Monitoring**:
- Basic Supabase metrics and analytics
- PM2 process monitoring
- Limited custom alerting

**Required Improvements**:
- Comprehensive structured logging system
- Real-time performance monitoring
- Custom alerting for business metrics
- Error tracking and analysis tools

## 8. External Service Integrations

### AI and Machine Learning Services
**OpenAI API Integration**:
- GPT-4 for conversation generation
- Text embedding models for vector search
- Token usage tracking and optimization
- Rate limiting and cost management
- Error handling and fallback strategies

**Pinecone Vector Database**:
- High-performance vector storage and retrieval
- RAG (Retrieval Augmented Generation) system
- Semantic search capabilities
- Index management and optimization
- Usage analytics and performance monitoring

### Specialized AI Services
**GetZep Integration** (`services/reasoning-mcp-server/`):
- Advanced reasoning capabilities
- Memory management for complex conversations
- Chain-of-thought processing
- Context preservation across sessions
- Graph-based knowledge representation

## 9. Development and Deployment Workflow

### Code Organization Structure
```
supabase/
├── functions/          # Edge Functions (TypeScript/Deno)
│   ├── chat/          # Main AI logic (⚠️ needs refactoring)
│   ├── discord-interaction-handler/
│   ├── manage-discord-worker/
│   ├── toolboxes-user/
│   ├── agent-toolbelt/
│   └── get-agent-tool-credentials/
├── migrations/         # Database schema changes
└── config.toml        # Supabase configuration

services/
├── discord-worker/     # Discord bot service
├── worker-manager/     # PM2 management service
└── reasoning-mcp-server/  # GetZep integration

dtma/                  # Tool management agent
├── src/               # Express.js application
└── Dockerfile         # Container configuration
```

### Quality Standards and Practices
- **TypeScript**: Full type safety across all services
- **ESLint**: Code quality and consistency enforcement
- **Testing**: Unit and integration testing (needs enhancement)
- **Documentation**: Inline code documentation and API specs
- **Version Control**: Git with feature branching strategies

## 10. Future Architecture Roadmap

### Short-term Improvements (Next 3 months)
1. **Implement Comprehensive Logging**
   - Structured logging across all services
   - Centralized log aggregation and analysis
   - Real-time monitoring and alerting system

2. **Complete Tool Infrastructure Migration**
   - Finish DTMA refactoring for shared droplet model
   - Update all tool management workflows
   - Validate new architecture performance

3. **Code Quality Improvements**
   - Refactor large functions into modular components
   - Increase test coverage across all services
   - Enhance API documentation

### Medium-term Enhancements (3-6 months)
1. **Performance Optimization**
   - Database query optimization and caching
   - Function response time improvements
   - Resource usage optimization

2. **Advanced Features**
   - Multi-model LLM support (Claude, Gemini)
   - Enhanced security and compliance features
   - Advanced analytics and reporting

## 11. Conclusion

Agentopia's backend architecture represents a modern, cloud-native approach optimized for AI agent collaboration and management. The combination of Supabase's managed services with specialized microservices provides a solid foundation for rapid development and scaling.

### Key Architectural Strengths
- **Serverless-first Design**: Reduced operational overhead and automatic scaling
- **Modern Database Features**: Advanced PostgreSQL with vector search capabilities
- **Real-time Capabilities**: WebSocket-based live collaboration features
- **Container-based Tools**: Flexible and scalable tool deployment system
- **Security-focused**: Multi-layered security with database-level policies

### Immediate Priorities
1. **Critical**: Implement comprehensive logging infrastructure
2. **High**: Complete tool architecture refactor
3. **High**: Refactor large files for better maintainability
4. **Medium**: Enhance monitoring and alerting capabilities

**Architecture Status**: Fundamentally sound with identified improvement areas
**Operational Readiness**: Requires logging infrastructure completion
**Scalability**: Well-positioned for horizontal scaling and feature expansion
