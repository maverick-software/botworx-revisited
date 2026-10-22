# Agentopia App Flow Document

## Onboarding and Sign-In/Sign-Up
When a new user arrives at Agentopia, they first encounter a friendly landing page that introduces the platform and explains its role in creating and managing AI agents for Discord. Users are welcomed by a clean, dark-themed interface that uses the Poppins font for a modern look. The app provides a straightforward sign-up process managed by Supabase where users can create an account using their email address or social login credentials. There is also an option for password recovery through a simple, step-by-step process that sends password reset instructions to the user’s email. After signing up, users sign in with secure credentials, and they always have the option to sign out when their session ends.

# Agentopia Application Flow Document
**Version:** 2.0  
**Last Updated:** May 11, 2025  
**Based on:** Current codebase analysis and actual user flows  

This document describes the actual user journeys and application flows in Agentopia as implemented in May 2025, based on comprehensive codebase analysis of the React/TypeScript frontend and Supabase backend.

## Application Entry Points and Authentication

### Initial Access and Sign-In Flow
Users access Agentopia through the main web application (`src/main.tsx` → `src/App.tsx` → `src/routing/AppRouter.tsx`). The authentication system is powered by Supabase Auth with the following flows:

1. **Landing/Login Page**: Users are presented with a clean authentication interface
2. **Registration Flow**: New users can create accounts with email/password
3. **OAuth Integration**: Support for Google, Discord, and GitHub sign-in (planned)
4. **Password Recovery**: Email-based password reset functionality
5. **MFA Support**: Multi-factor authentication via authenticator apps (planned)

After successful authentication, users are redirected to the main dashboard based on their role and permissions managed through Supabase RLS (Row Level Security).

## Main Dashboard and Navigation Structure

### Dashboard Overview (`DashboardPage.tsx` - 224 lines)
The main dashboard serves as the central hub for all Agentopia operations. Built with React 18 and Shadcn UI components, it features:

- **Sidebar Navigation**: Clean, modern navigation with sections for:
  - Agents Management
  - Workspaces
  - Teams
  - Datastores
  - Toolboxes (New tool management system)
  - Admin functions (for privileged users)

- **Real-time Updates**: WebSocket connections via Supabase Realtime for live notifications
- **Activity Overview**: Recent agent interactions, workspace activity, and system health
- **Quick Actions**: Fast access to create new agents, workspaces, or invite team members

### Navigation Architecture
The routing system (`src/routing/AppRouter.tsx`) implements protected routes with role-based access control, ensuring users only see sections they have permissions for.

## Agent Management Workflows

### Agent Creation and Configuration (`AgentsPage.tsx` - 298 lines, `AgentEdit.tsx` - 531 lines)
The agent management system provides comprehensive control over AI agents:

#### Creating a New Agent
1. **Basic Information**: Name, description, and initial configuration
2. **Personality Setup**: 
   - Selection from pre-built personality templates
   - Custom personality configuration through advanced forms
   - Personality marketplace integration (in development)
3. **Image Assignment**: Agent avatar upload and management (planned feature)
4. **Knowledge Base Assignment**: Connection to datastores for RAG capabilities
5. **Tool Configuration**: Assignment of MCP tools and external capabilities

#### Agent Configuration Options
- **Response Modes**: Configure how agents respond (automatic vs. tagged mentions)
- **Workspace Assignment**: Deploy agents to specific workspaces
- **Discord Integration**: Optional deployment to Discord servers
- **Reasoning Capabilities**: Chain of thought and advanced reasoning toggles (planned)
- **Memory Configuration**: Long-term, semantic, and working memory settings (planned)

### Agent Deployment and Management
Once configured, agents can be deployed across multiple platforms:
- **Workspace Chat**: Real-time integration with workspace channels
- **Discord Servers**: Bot deployment with channel-specific configuration
- **API Endpoints**: External platform integration capabilities (planned)

## Workspace and Team Collaboration

### Workspace Management (`WorkspacePage.tsx` - 287 lines, `WorkspaceSettingsPage.tsx` - 179 lines)
Workspaces serve as collaboration hubs where teams interact with agents:

#### Workspace Features
- **Real-time Chat**: WebSocket-powered messaging with agent integration
- **File Sharing**: Document upload and sharing with agents
- **Message Threading**: Organized conversation flows with reply support
- **Agent Interaction**: Direct agent communication and task assignment
- **Member Management**: Add/remove team members with role-based permissions

#### Workspace Settings and Configuration
- **Access Control**: Team-based permissions and invitation management
- **Agent Assignment**: Deploy specific agents to workspace channels
- **Integration Settings**: Configure external tool access and capabilities
- **Notification Preferences**: Email, SMS, and in-app notification settings (planned)

### Team Management (`TeamsPage.tsx` - 84 lines, `TeamDetailsPage.tsx` - 109 lines)
Team functionality enables organizational structure and collaboration:

- **Team Creation**: Organize users into functional groups
- **Role Assignment**: Define permissions and access levels
- **Delegated Access**: Allow team members to manage specific agents or workspaces
- **Team Analytics**: Usage patterns and collaboration metrics

## Knowledge Management and Datastores

### Datastore Operations (`DatastoresPage.tsx` - 664 lines ⚠️ VIOLATES 500-line rule)
The datastore system manages AI knowledge bases through Pinecone integration:

#### Datastore Management
1. **Document Upload**: Support for PDF, DOC, TXT, and other document formats (enhanced feature planned)
2. **Vector Processing**: Automatic embedding generation via OpenAI API
3. **Knowledge Organization**: Categorization and tagging of information
4. **Search Capabilities**: Semantic search through uploaded documents
5. **Agent Association**: Connect datastores to specific agents for RAG capabilities

#### RAG System Integration
- **Context Retrieval**: Automatic relevant document retrieval during conversations
- **Source Attribution**: Track and display source documents for agent responses
- **Version Control**: Manage document updates and knowledge base evolution
- **Analytics**: Usage tracking and search performance metrics

## Tool Ecosystem and MCP Integration

### Toolbox Management (`ToolboxesPage.tsx` - 312 lines, `ToolboxDetailPage.tsx` - 210 lines)
The new tool infrastructure (May 2025 refactor) introduces shared toolbox environments:

#### Tool Environment Architecture
- **Account-level Toolboxes**: Shared DigitalOcean droplets per user account
- **Tool Catalog**: Registry of available MCP tools and integrations
- **Instance Management**: Deploy and manage tool instances on shared infrastructure
- **Credential Management**: Secure API key and authentication storage

#### MCP Tool Integration
- **Tool Discovery**: Browse and install available MCP tools
- **Configuration**: Set up tool parameters and access permissions
- **Agent Assignment**: Connect tools to specific agents via toolbelts
- **Workflow Automation**: Scheduled tasks and workflow orchestration (planned)
- **External Agent Integration**: Support for Make.com, n8n, and Zapier workflows (planned)

### Tool Development and Marketplace
- **Developer Portal**: SDK and documentation for creating MCP tools
- **Tool Publishing**: Submit and review process for new tools
- **Rating System**: Community feedback and tool quality assessment
- **Monetization**: Framework for paid tools and developer revenue sharing

## Discord Integration Workflows

### Discord Bot Deployment
The Discord integration system (`services/discord-worker/`) enables seamless bot deployment:

#### Setup Process
1. **Bot Registration**: Automatic Discord application and bot creation
2. **Server Integration**: Add Agentopia bot to Discord servers
3. **Channel Assignment**: Deploy specific agents to Discord channels
4. **Permission Configuration**: Set up bot permissions and access levels

#### Agent Interaction on Discord
- **Message Processing**: Real-time message handling and agent responses
- **Command Support**: Slash commands for agent interaction and configuration
- **Channel Management**: Multi-channel deployment with channel-specific agents
- **Webhook Integration**: Efficient message delivery and response handling

### Discord Server Owner Experience
Server owners have dedicated tools for managing Agentopia integration:
- **Agent Selection**: Choose which agents to deploy to their servers
- **Channel Configuration**: Assign agents to specific channels
- **Response Mode Selection**: Automatic responses vs. tagged mentions
- **Monitoring Tools**: Track agent performance and user engagement

## Admin and System Management

### Administrative Dashboard (`AdminDashboardPage.tsx`, `AdminUserManagement.tsx`, `AdminAgentManagement.tsx`)
System administrators have access to comprehensive management tools:

#### User Management
- **User Accounts**: Create, modify, and manage user accounts
- **Permission Management**: Assign roles and access levels
- **Usage Analytics**: Track user activity and platform engagement
- **Support Tools**: Handle user issues and account problems

#### System Monitoring
- **Service Health**: Monitor backend services and infrastructure
- **Performance Metrics**: Track API response times and system performance
- **Error Tracking**: Centralized error logging and alerting (needs improvement)
- **Usage Statistics**: Platform-wide analytics and reporting

## Project Management Features (Planned Phase 4)

### Project Creation and Management
Upcoming features for enterprise and project-focused workflows:
- **Project Structure**: Create hierarchical project organization
- **Agent Access Control**: CRUD and partial CRUD permissions for project-based agents
- **Project Assistant**: AI-powered project setup with automatic document generation
- **Workflow Integration**: Connect projects with tool workflows and automation

## Advanced Features and Future Flows

### Voice and Multimedia Integration (Planned Phase 4-5)
- **Voice Capabilities**: Audio interaction with agents
- **3D Visualization**: Immersive agent interaction interfaces
- **Desktop Client**: Native desktop application for local agent authentication

### Advanced Memory and AI Features (Planned Phase 5)
- **Memory Gem Slots**: UI interface for configuring different memory types
- **Multi-model Support**: Choose between GPT-4, Claude, Gemini for different tasks
- **Custom Prompts**: Save and reuse prompt templates as tools
- **Agent Communication**: Inter-agent collaboration and task delegation

## Error Handling and System Resilience

### Error Management
The application implements comprehensive error handling throughout:
- **Graceful Degradation**: Service failures don't crash the entire application
- **User-Friendly Messages**: Clear error communication with actionable guidance
- **Automatic Recovery**: System attempts to recover from transient failures
- **Fallback Systems**: Backup providers and redundant service paths

### Current Logging Challenges ⚠️ CRITICAL ISSUE
**Major Gap Identified**: The logging infrastructure is severely underdeveloped:
- `/logs/` directory nearly empty
- No structured logging across services
- Debugging and monitoring severely hampered
- **Immediate Priority**: Implement comprehensive logging system

## Conclusion and Application Journey Summary

Agentopia provides a comprehensive platform for AI agent creation, deployment, and management. The user journey flows from simple authentication through sophisticated agent configuration, workspace collaboration, and multi-platform deployment.

Key user paths include:
1. **Administrator Path**: Complete agent lifecycle management
2. **Team Member Path**: Workspace collaboration and agent interaction
3. **Discord User Path**: Seamless bot interaction and communication
4. **Developer Path**: Tool creation and marketplace participation

The platform successfully integrates modern web technologies (React 18, TypeScript, Supabase) with AI capabilities (OpenAI, Pinecone) and collaboration tools (Discord, real-time chat) to create a cohesive agent management ecosystem.

**Current State Summary:**
- **Strengths**: Modern architecture, comprehensive feature set, real-time capabilities
- **Immediate Needs**: Logging infrastructure, large file refactoring, tool architecture completion
- **Future Roadmap**: Voice capabilities, advanced AI features, enterprise project management

The application flow demonstrates a mature platform with strong foundations ready for scaling and advanced feature development.