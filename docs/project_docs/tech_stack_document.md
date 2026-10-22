# Agentopia Tech Stack Document
**Version:** 2.0  
**Last Updated:** May 11, 2025  
**Current State Analysis Date:** May 11, 2025  

This document outlines the actual technology stack used in Agentopia as of May 2025, based on comprehensive codebase analysis. It provides clear explanations of each technology choice and how they work together to create our AI agent collaboration platform.

## Frontend Technologies

Our frontend provides a modern, responsive web interface for managing AI agents and workspaces:

### Core Framework
- **React 18 with TypeScript**
  - Modern component-based architecture for maintainable UI development
  - Full type safety throughout the application
  - Located in `src/` directory with well-organized component structure

- **Vite Build System**
  - Fast development builds with Hot Module Replacement (HMR)
  - Optimized production bundles for better performance
  - Superior developer experience compared to traditional webpack setups

### UI Framework & Styling
- **Tailwind CSS**
  - Utility-first CSS framework for rapid, consistent styling
  - Responsive design system ensuring mobile-first approach
  - Minimal bundle size through purging unused styles

- **Shadcn UI Component Library**
  - Built on Radix UI primitives for accessibility compliance
  - Consistent design system with dark theme support
  - Located in `/components/ui` with custom components in `/components/`

### State Management & Routing
- **React Context + Hooks**
  - Modern state management using React's built-in capabilities
  - Custom hooks in `/hooks/` directory for reusable logic
  - Context providers in `/contexts/` for global state

- **React Router**
  - Client-side routing with `src/routing/AppRouter.tsx`
  - Protected routes for authenticated areas
  - Clean URL structure for better user experience

## Backend Technologies

Our backend leverages modern serverless and cloud-native technologies:

### Primary Backend Infrastructure
- **Supabase (Backend-as-a-Service)**
  - **PostgreSQL Database**: Primary data storage with advanced features
  - **Authentication**: Built-in user management with Row Level Security (RLS)
  - **Edge Functions**: Serverless functions for business logic (`supabase/functions/`)
  - **Realtime**: WebSocket connections for live chat and updates
  - **Vault**: Secure storage for API keys and sensitive data

### Database Architecture
- **PostgreSQL with Extensions**
  - **pgvector**: Vector storage for embeddings and similarity search
  - **Row Level Security (RLS)**: Database-level security policies
  - **Foreign Key Relationships**: Well-structured relational data model
  - **Active Migrations**: Version-controlled schema changes

### Key Database Tables (Current Schema)
```sql
-- Core entities
users, user_profiles, agents, teams, workspaces, workspace_members

-- Communication
chat_channels, chat_messages

-- AI & Knowledge
datastores, agent_datastores (Pinecone integration)

-- Tool Infrastructure (New May 2025)
account_tool_environments, tool_catalog, account_tool_instances
agent_toolbox_access, agent_toolbelt_items, agent_tool_credentials

-- MCP Integration
mcp_servers, mcp_configurations
```

### Microservices Architecture
- **Discord Worker Service** (`services/discord-worker/`)
  - Connects agents to Discord Gateway
  - Handles real-time Discord message processing
  - PM2 process management for reliability

- **Worker Manager Service** (`services/worker-manager/`)
  - PM2-based process orchestration
  - Service health monitoring and auto-restart
  - Deployment and scaling management

- **DTMA (Droplet Tool Management Agent)** (`dtma/`)
  - Container management using Dockerode
  - Shared droplet model for tool hosting
  - DigitalOcean infrastructure management

## External Service Integrations

Agentopia integrates with industry-leading services for enhanced functionality:

### AI & Language Models
- **OpenAI API**
  - GPT-4 for agent conversations
  - Text embedding generation for vector search
  - Token-based usage tracking and optimization

- **Pinecone Vector Database**
  - High-performance vector storage and similarity search
  - RAG (Retrieval Augmented Generation) system
  - Knowledge base integration for agent memory

### Communication Platforms
- **Discord.js Integration**
  - Bot framework for Discord server deployment
  - Real-time message handling and responses
  - Channel-specific agent assignment
  - Slash command support

### Development Tools
- **GetZep (Reasoning MCP Server)**
  - Advanced reasoning capabilities
  - Memory management for complex conversations
  - Chain-of-thought processing

## Infrastructure and Deployment

Our infrastructure is designed for scalability and reliability:

### Cloud Hosting
- **DigitalOcean**
  - Primary hosting for backend services
  - Shared droplet model for tool environments
  - PM2 process management for high availability

- **Supabase Cloud**
  - Managed PostgreSQL hosting
  - Global edge network for Edge Functions
  - Built-in monitoring and analytics

### Development & Deployment Pipeline
- **Git Version Control**
  - Comprehensive branching strategy
  - Code review processes
  - Automated testing integration

- **Docker Containerization**
  - Consistent deployment environments
  - Service isolation and scalability
  - Container orchestration via Dockerode

### Monitoring & Logging
- **Critical Gap Identified**: Comprehensive logging infrastructure missing
- **Current State**: Minimal logging in `/logs/` directory
- **Immediate Priority**: Implement structured logging across all services

## Current Architecture Challenges

Based on May 2025 analysis, several areas require immediate attention:

### 🔴 Critical Issues
1. **Missing Logging Infrastructure**
   - `/logs/` directory nearly empty
   - No structured logging across services
   - Severely hampers debugging and monitoring

2. **Code Quality Violations**
   - `supabase/functions/chat/index.ts`: 612 lines (exceeds 500-line limit)
   - `src/pages/DatastoresPage.tsx`: 664 lines (exceeds 500-line limit)

3. **Architecture Transition**
   - Tool infrastructure refactor in progress
   - Migration from per-agent to shared droplet model
   - Incomplete DTMA system transformation

### 🟡 Medium Priority
- **Token Estimation**: Simple character count instead of proper tokenizer
- **Test Coverage**: Gaps in comprehensive testing
- **API Documentation**: Limited formal API specifications

## Security & Performance

### Security Measures
- **Supabase Authentication**
  - Built-in user management with secure session handling
  - OAuth integration capabilities
  - Row Level Security policies at database level

- **API Key Management**
  - Supabase Vault for encrypted storage
  - Environment-based configuration
  - Principle of least privilege access

### Performance Optimizations
- **Frontend Performance**
  - Vite's optimized bundling and code splitting
  - React 18's concurrent features
  - Tailwind CSS purging for minimal bundle size

- **Backend Performance**
  - Supabase edge functions for low latency
  - PostgreSQL query optimization
  - Vector search optimization via Pinecone

## Development Workflow

### Code Organization
```
src/
├── components/          # Reusable UI components
├── pages/              # Route-based page components
├── hooks/              # Custom React hooks
├── contexts/           # React context providers
├── routing/            # Application routing logic
└── main.tsx           # Application entry point

supabase/
├── functions/          # Edge Functions (serverless)
├── migrations/         # Database schema changes
└── config.toml        # Supabase configuration

services/
├── discord-worker/     # Discord integration service
└── worker-manager/     # Process management service
```

### Quality Standards
- **TypeScript**: Full type safety across frontend and backend
- **ESLint**: Code quality and consistency enforcement
- **Component-based Architecture**: Modular, reusable code structure
- **Version Control**: Git with comprehensive commit history

## Future Technology Roadmap

### Short-term (Next 3 months)
1. **Implement Comprehensive Logging**
   - Structured logging across all services
   - Centralized log aggregation
   - Real-time monitoring and alerting

2. **Complete Tool Infrastructure Migration**
   - Finish DTMA refactoring
   - Implement shared droplet provisioning
   - Update all tool management workflows

### Medium-term (3-6 months)
1. **Enhanced AI Capabilities**
   - Multi-model LLM support (Claude, Gemini)
   - Improved tokenization for context management
   - Advanced RAG system enhancements

2. **Performance Optimization**
   - Frontend bundle optimization
   - Database query performance tuning
   - Caching layer implementation

## Conclusion

Agentopia's technology stack represents a modern, cloud-native architecture optimized for AI agent collaboration. The combination of React/TypeScript frontend with Supabase backend provides a solid foundation for rapid development and scaling.

Key strengths include:
- **Modern Development Experience**: React 18, TypeScript, Vite
- **Serverless Architecture**: Supabase Edge Functions for scalability
- **AI-First Design**: Integrated vector search and LLM capabilities
- **Real-time Collaboration**: WebSocket-based live features

While the architecture is fundamentally sound, addressing the identified gaps in logging, code quality, and architecture transition completion will ensure long-term maintainability and operational excellence.

**Technology Stack Summary:**
- **Frontend**: React 18 + TypeScript + Vite + Tailwind + Shadcn UI
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions + Realtime)
- **AI Services**: OpenAI API + Pinecone Vector DB
- **Infrastructure**: DigitalOcean + Docker + PM2
- **Integrations**: Discord.js + GetZep MCP Server