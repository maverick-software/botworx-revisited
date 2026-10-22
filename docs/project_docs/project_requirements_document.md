---
description: 
globs: 
alwaysApply: false
---
# Agentopia Project Requirements Document
**Version:** 2.0  
**Date:** May 11, 2025  
**Status:** Active Development  
**Project Start Date:** April 18, 2025  
**Last Updated:** May 11, 2025 (Current System Analysis)

## 1. Executive Summary

Agentopia is an AI agent creation and collaboration platform that enables users to create, configure, and manage AI agents through a modern web interface. The platform facilitates workspace-based collaboration, Discord integration, external tool connectivity via MCP (Model Context Protocol), and knowledge base access through RAG (Retrieval Augmented Generation).

**Project Timeline:** 18 months from April 18, 2025 to October 18, 2026
**MVP Status:** In Active Development (70% Complete)
**Current Beta Release:** June 2025 (Target)
**Full Release:** October 18, 2026

### Current System Status (May 11, 2025)
- ✅ **Core Platform**: React 18 + TypeScript + Supabase architecture implemented
- ✅ **Authentication**: Supabase Auth with OAuth integration functional
- ✅ **Agent Management**: Full CRUD operations and Discord integration
- ✅ **Workspace Collaboration**: Real-time chat and team features operational
- ✅ **Discord Integration**: Bot deployment and management working
- ⚠️ **Critical Issues Identified**: Logging infrastructure, large file violations, architecture transition

## 2. Project Objectives

### 2.1 Primary Goals
- Create a user-friendly platform for AI agent creation and management
- Enable seamless collaboration between multiple AI agents within shared workspaces
- Provide robust Discord integration for bot deployment and management
- Implement advanced tool integration capabilities via MCP
- Support knowledge base integration through vector databases and RAG
- Ensure enterprise-grade security, scalability, and reliability

### 2.2 Success Metrics
- Support for 1000+ concurrent users within 6 months
- 99.9% uptime SLA
- Average response time < 200ms for API calls
- User satisfaction score > 4.5/5
- Support for 50+ integrated external tools via MCP

### 2.3 Current System Critical Issues (May 11, 2025)

#### 🔴 High Priority Issues
1. **Missing Logging Infrastructure**
   - **Impact**: No comprehensive system monitoring or debugging capability
   - **Status**: Critical gap across all services
   - **Location**: `logs/` directory nearly empty, no centralized logging

2. **Large File Violations** 
   - **Impact**: Reduced maintainability, harder debugging, violates 500-line rule
   - **Files**: 
     - `DatastoresPage.tsx`: 664 lines (CRITICAL)
     - `supabase/functions/chat/index.ts`: 612 lines (CRITICAL)
     - `AgentEdit.tsx`: 531 lines (HIGH)
   - **Action Required**: Immediate refactoring

3. **Architecture Transition In Progress**
   - **Impact**: Inconsistent tool management patterns
   - **Status**: Migration from per-agent to shared droplet model underway
   - **Risk**: Potential integration issues during transition

#### 🟡 Medium Priority Issues
4. **Token Estimation Accuracy**
   - **Current**: Simple character count method
   - **Required**: Proper tokenizer implementation for accurate LLM usage
   - **Impact**: Inaccurate cost estimation and quota management

5. **Testing Coverage Gaps**
   - **Current**: Limited automated testing infrastructure
   - **Target**: 85% code coverage per NFR-029
   - **Status**: Below target coverage levels

## 3. Functional Requirements

### 3.1 User Management
- **FR-001**: User registration and authentication via email/password
- **FR-002**: OAuth integration (Google, Discord, GitHub)
- **FR-003**: Role-based access control (Admin, Team Lead, Member, Viewer)
- **FR-004**: User profile management and preferences
- **FR-005**: Multi-tenant organization support

### 3.2 Agent Management
- **FR-006**: Create, edit, and delete AI agents
- **FR-007**: Configure agent personalities and behavior patterns
- **FR-008**: Set agent response modes (automatic, mention-only, scheduled)
- **FR-009**: Agent status management (active, inactive, maintenance)
- **FR-010**: Agent performance monitoring and analytics
- **FR-011**: Agent conversation history and logging
- **FR-012**: Agent cloning and templating

### 3.3 Workspace Collaboration
- **FR-013**: Create and manage workspaces
- **FR-014**: Invite users and agents to workspaces
- **FR-015**: Real-time chat functionality within workspaces
- **FR-016**: Channel-based organization within workspaces
- **FR-017**: Message threading and replies
- **FR-018**: File sharing and document collaboration
- **FR-019**: Workspace-level permissions and settings
- **FR-020**: Agent mentions and direct interactions (@agent)

### 3.4 Team Management
- **FR-021**: Create and manage teams
- **FR-022**: Assign team members and roles
- **FR-023**: Team-based workspace access control
- **FR-024**: Team performance dashboards and analytics

### 3.5 Discord Integration
- **FR-025**: Discord bot creation and deployment
- **FR-026**: Server-specific agent activation/deactivation
- **FR-027**: Channel-specific agent assignment
- **FR-028**: Discord slash command integration
- **FR-029**: Discord webhook management
- **FR-030**: Real-time synchronization between Discord and platform

### 3.6 Data Store Management
- **FR-031**: Create and configure data stores (Pinecone, local vector DB)
- **FR-032**: Upload and manage knowledge base documents
- **FR-033**: Document processing and vectorization
- **FR-034**: Similarity search and retrieval
- **FR-035**: Data store analytics and usage metrics
- **FR-036**: Version control for knowledge base updates

### 3.7 MCP Tool Integration
- **FR-037**: Discover and install MCP tools from marketplace
- **FR-038**: Configure tool-specific settings and credentials
- **FR-039**: Tool usage monitoring and logging
- **FR-040**: Custom tool development framework
- **FR-041**: Tool permissions and access control
- **FR-042**: Tool marketplace with ratings and reviews

### 3.8 Administrative Features
- **FR-043**: System-wide analytics dashboard
- **FR-044**: User management and role assignment
- **FR-045**: System configuration and settings
- **FR-046**: Audit logging and compliance reporting
- **FR-047**: Billing and subscription management
- **FR-048**: API key management and rotation

## 4. Non-Functional Requirements

### 4.1 Performance
- **NFR-001**: API response time < 200ms for 95% of requests
- **NFR-002**: Support 1000+ concurrent users
- **NFR-003**: Real-time message delivery < 100ms latency
- **NFR-004**: Database query response time < 50ms
- **NFR-005**: File upload processing < 5 seconds for 100MB files

### 4.2 Scalability
- **NFR-006**: Horizontal scaling capability for all services
- **NFR-007**: Auto-scaling based on load metrics
- **NFR-008**: Support for multiple geographic regions
- **NFR-009**: CDN integration for static assets
- **NFR-010**: Database sharding capability

### 4.3 Security
- **NFR-011**: Data encryption at rest and in transit (AES-256)
- **NFR-012**: JWT-based authentication with refresh tokens
- **NFR-013**: Rate limiting and DDoS protection
- **NFR-014**: API key rotation and management
- **NFR-015**: SOC 2 Type II compliance
- **NFR-016**: GDPR compliance for data handling
- **NFR-017**: Regular security audits and penetration testing

### 4.4 Reliability
- **NFR-018**: 99.9% uptime SLA
- **NFR-019**: Automated backup and disaster recovery
- **NFR-020**: Health monitoring and alerting
- **NFR-021**: Graceful degradation during partial outages
- **NFR-022**: Circuit breaker patterns for external service calls

### 4.5 Usability
- **NFR-023**: Mobile-responsive design
- **NFR-024**: WCAG 2.1 AA accessibility compliance
- **NFR-025**: Multi-language support (English, Spanish, French, German)
- **NFR-026**: Dark/light theme support
- **NFR-027**: Keyboard navigation support

### 4.6 Maintainability
- **NFR-028**: Comprehensive API documentation
- **NFR-029**: Code coverage > 85%
- **NFR-030**: Automated testing pipeline
- **NFR-031**: Centralized logging and monitoring
- **NFR-032**: Configuration management via environment variables

## 5. Technical Constraints

### 5.1 Technology Stack
- **Frontend**: React 18+, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Realtime)
- **External Services**: OpenAI API, Pinecone, Discord API
- **Infrastructure**: DigitalOcean, Docker, PM2
- **Monitoring**: Custom logging solution, performance monitoring

### 5.2 Integration Requirements
- **TC-001**: RESTful API design with OpenAPI 3.0 specification
- **TC-002**: WebSocket support for real-time features
- **TC-003**: OAuth 2.0 integration for third-party authentication
- **TC-004**: Webhook support for external service notifications
- **TC-005**: GraphQL support for complex data queries

### 5.3 Data Requirements
- **TC-006**: PostgreSQL 14+ with pgvector extension
- **TC-007**: Vector database integration (Pinecone)
- **TC-008**: Redis for caching and session management
- **TC-009**: Object storage for file uploads (S3-compatible)
- **TC-010**: Time-series database for analytics (optional)

## 6. Compliance and Regulatory Requirements

### 6.1 Data Protection
- **CR-001**: GDPR compliance for EU users
- **CR-002**: CCPA compliance for California users
- **CR-003**: Data residency requirements by region
- **CR-004**: Right to be forgotten implementation
- **CR-005**: Data portability features

### 6.2 Industry Standards
- **CR-006**: ISO 27001 security management
- **CR-007**: SOC 2 Type II compliance
- **CR-008**: OWASP security guidelines adherence
- **CR-009**: API security best practices (OWASP API Top 10)

## 7. User Stories and Acceptance Criteria

### 7.1 Epic: Agent Creation and Management
**As an** administrator  
**I want to** create and configure AI agents  
**So that** I can deploy customized AI assistants for my organization  

**Acceptance Criteria:**
- Agent creation form with name, description, and personality settings
- Template library for quick agent setup
- Preview functionality before deployment
- Bulk agent operations (create, update, delete)

### 7.2 Epic: Workspace Collaboration
**As a** team member  
**I want to** collaborate with AI agents in shared workspaces  
**So that** I can leverage AI assistance for team projects  

**Acceptance Criteria:**
- Real-time chat interface with typing indicators
- Agent mention functionality (@agent)
- File sharing with AI analysis capabilities
- Message search and history

### 7.3 Epic: Discord Integration
**As a** Discord server owner  
**I want to** deploy AI agents to my Discord server  
**So that** my community can interact with intelligent bots  

**Acceptance Criteria:**
- One-click Discord bot deployment
- Channel-specific agent configuration
- Slash command integration
- Real-time synchronization with platform

## 8. Risk Assessment

### 8.1 Technical Risks
- **Risk**: Third-party API rate limiting (OpenAI, Discord)
- **Mitigation**: Implement caching, retry logic, and fallback providers

- **Risk**: Database performance bottlenecks with large datasets
- **Mitigation**: Database optimization, indexing, and sharding strategies

- **Risk**: Security vulnerabilities in AI model outputs
- **Mitigation**: Content filtering, output validation, and safety guardrails

### 8.2 Business Risks
- **Risk**: Competitive pressure from established platforms
- **Mitigation**: Unique value proposition focus and rapid feature development

- **Risk**: Regulatory changes affecting AI deployment
- **Mitigation**: Compliance monitoring and adaptable architecture

## 9. Dependencies and Assumptions

### 9.1 External Dependencies
- OpenAI API availability and pricing stability
- Discord API compatibility and rate limits
- Supabase service reliability and feature support
- DigitalOcean infrastructure capacity

### 9.2 Assumptions
- Users have basic technical knowledge for agent configuration
- Internet connectivity is reliable for real-time features
- Third-party services maintain backward compatibility
- Regulatory environment remains stable during development

## 10. Acceptance Criteria

### 10.1 Minimum Viable Product (MVP) - Status: 70% Complete
- ✅ User authentication and basic profile management (Supabase Auth implemented)
- ✅ Agent creation with personality configuration (React interface operational)
- ✅ Workspace with real-time chat functionality (WebSocket integration working)
- ✅ Discord bot deployment and interactions (Full integration complete)
- ✅ Data store integration (Pinecone integration operational)
- ⚠️ **Critical Issues**: Logging infrastructure, large file refactoring needed

### 10.2 Version 1.0 Release - Status: In Development
- ✅ Core functional requirements implemented (Agents, Workspaces, Discord)
- ⏳ Performance targets verification (API response times need validation)
- ⏳ Security audits completion (Scheduled for Q3 2025)
- ✅ Basic MCP tool integration (Framework implemented)
- ⚠️ Production deployment optimization (Critical issues must be resolved)

### 10.3 Current Implementation Status (May 11, 2025)

#### ✅ Fully Implemented Features
- **Authentication System**: Supabase Auth with OAuth (Google, Discord, GitHub)
- **Agent Management**: Complete CRUD operations, personality configuration
- **Workspace Collaboration**: Real-time chat, file sharing, member management
- **Discord Integration**: Bot deployment, channel management, slash commands
- **Data Stores**: Pinecone integration, document processing, vector search
- **Tool Integration**: MCP framework, tool marketplace foundation
- **User Interface**: Modern React 18 + TypeScript + Shadcn UI

#### ⏳ In Development
- **Enhanced Analytics**: System-wide dashboard improvements
- **Advanced Tool Features**: Custom tool development framework
- **Performance Optimization**: Database query optimization, caching
- **Mobile Responsiveness**: Touch interface enhancements

#### 🔴 Critical Remediation Required
- **Logging Infrastructure**: Implement comprehensive logging across all services
- **Code Quality**: Refactor large files exceeding 500-line limit
- **Architecture Completion**: Finalize tool management architecture transition
- **Testing Coverage**: Achieve 85% test coverage target

## 11. Approval and Sign-off

**Project Sponsor**: [Name]  
**Technical Lead**: [Name]  
**Product Owner**: [Name]  
**Security Officer**: [Name]  

**Approval Date**: ___________  
**Next Review Date**: ___________  

---
*This document is a living specification and will be updated as requirements evolve during the development process.*
