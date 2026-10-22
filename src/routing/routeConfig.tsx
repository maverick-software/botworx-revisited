import React from 'react';
import { Navigate } from 'react-router-dom'; // Import Navigate

// Define the types for route protection
export type ProtectionType = 'public' | 'protected' | 'admin';

// Define the structure for a single route configuration
export interface RouteConfig {
  path: string;
  element: React.ComponentType<any> | React.LazyExoticComponent<React.ComponentType<any>>;
  protection: ProtectionType;
  layout?: boolean; // true if requires the main Layout component
  exact?: boolean; // Optional: useful for matching '/' exactly
  children?: RouteConfig[]; // For nested routes (like admin section)
}

// Import page components (both lazy and direct)
// Note: Need to import all components referenced in the routes below
// import { AgentEditPage } from '../pages/AgentEditPage'; // Removed direct import
// import { LoginPage } from '../pages/LoginPage'; // Removed direct import
// import { RegisterPage } from '../pages/RegisterPage'; // Removed direct import
import UnauthorizedPage from '../pages/UnauthorizedPage';
import {
    AgentsPage,
    AgentChatPage,
    // Archived 2025-10-05: DatastoresPage moved to Agent Settings → Memory tab
    // DatastoresPage,
    // DatastoreEditPage,
    AdminDashboardPage,
    TeamsPage,
    TeamDetailsPage,
    EditTeamPage,
    SettingsPage,
    BillingPage,
    MonitoringPage,
    AdminUserManagement,
    AdminAgentManagement,
    AdminSettingsPage,
    // AdminMCPMarketplaceManagement, // Archived 2025-10-13: Deprecated admin MCP system
    AdminIntegrationManagement,
    AdminSystemAPIKeysPage,
    AdminStripeConfigPage,
    AdminUserBillingPage,
    StripeOAuthCallbackPage,
    HomePage,
    LoginPage, // Now imported here
    RegisterPage, // Now imported here
    WorkspacePage, // Added WorkspacePage
    WorkspacesListPage, // Added WorkspacesListPage
    CreateWorkspacePage,
    WorkspaceSettingsPage,
    IntegrationsPage, // Added IntegrationsPage
    CredentialsPage, // Added CredentialsPage

    // AgentStorePage, // Commented out
    // DatasetStorePage, // Commented out
    // NotFoundPage, // Commented out
    MCPServersPage,
    MCPMarketplacePage,
    MCPDeployPage,
    MCPServerConfigPage,
} from './lazyComponents';

// Import Media Library page
import { MediaLibraryPage } from '../pages/MediaLibraryPage';

// Manually import the new non-lazy pages
import { WorkflowsPage } from '../pages/WorkflowsPage';
import { AutomationsPage } from '../pages/AutomationsPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import SystemPromptsPage from '../pages/admin/SystemPromptsPage';
import { GmailCallbackPage } from '@/integrations/gmail';
import { SMTPIntegrationsPage } from '@/integrations/smtp';
import { MicrosoftTeamsCallbackPage } from '../pages/integrations/MicrosoftTeamsCallbackPage';
import { MicrosoftOneDriveCallbackPage } from '../pages/integrations/MicrosoftOneDriveCallbackPage';
import { MicrosoftOutlookCallbackPage } from '../pages/integrations/MicrosoftOutlookCallbackPage';
import GraphSettingsPage from '../pages/GraphSettingsPage';
import { ChatsPage } from '../pages/ChatsPage';
import ContactsPage from '../pages/ContactsPage';
import { TempChatPage } from '../pages/TempChatPage';
import { ChatPage } from '../pages/ChatPage';
import { MorePage } from '../pages/MorePage';

import AgentEditPage from '../pages/agents/[agentId]/edit'; // Use the fixed version

// Define the application routes using the RouteConfig structure
export const appRoutes: RouteConfig[] = [
  // Public routes (no layout, no protection needed beyond AppRouter logic)
  { path: '/login', element: LoginPage, protection: 'public', layout: false },
  { path: '/register', element: RegisterPage, protection: 'public', layout: false },
  { path: '/unauthorized', element: UnauthorizedPage, protection: 'public', layout: false },
  { path: '/temp-chat/:token', element: TempChatPage, protection: 'public', layout: false },

  // Protected routes (require layout)

  { path: '/chat', element: ChatPage, protection: 'protected', layout: true },
  { path: '/agents', element: AgentsPage, protection: 'protected', layout: true },
  { path: '/agents/new', element: AgentEditPage, protection: 'protected', layout: true },
  { path: '/agents/:agentId', element: AgentEditPage, protection: 'protected', layout: true },
  { path: '/agents/:agentId/edit', element: AgentEditPage, protection: 'protected', layout: true },
  { path: '/agents/:agentId/chat', element: AgentChatPage, protection: 'protected', layout: true },
  { path: '/chats/:agentId', element: ChatsPage, protection: 'protected', layout: true },
  // Archived 2025-10-05: Memory/Datastores routes moved to Agent Settings → Memory tab
  // { path: '/memory', element: DatastoresPage, protection: 'protected', layout: true },
  // { path: '/memory/new', element: DatastoreEditPage, protection: 'protected', layout: true },
  // { path: '/memory/:datastoreId/edit', element: DatastoreEditPage, protection: 'protected', layout: true },
  { path: '/media', element: MediaLibraryPage, protection: 'protected', layout: true },
  { path: '/contacts', element: ContactsPage, protection: 'protected', layout: true },
  { path: '/teams', element: TeamsPage, protection: 'protected', layout: true },
  { path: '/teams/:teamId', element: TeamDetailsPage, protection: 'protected', layout: true },
  { path: '/teams/:teamId/edit', element: EditTeamPage, protection: 'protected', layout: true },
  { path: '/workspaces', element: WorkspacesListPage, protection: 'protected', layout: true },
  { path: '/workspaces/new', element: CreateWorkspacePage, protection: 'protected', layout: true },
  { path: '/workspaces/:roomId', element: WorkspacePage, protection: 'protected', layout: false },
  { path: '/workspaces/:roomId/settings', element: WorkspaceSettingsPage, protection: 'protected', layout: false },
  { path: '/workspaces/:roomId/channels/:channelId', element: WorkspacePage, protection: 'protected', layout: false },
  { path: '/integrations', element: IntegrationsPage, protection: 'protected', layout: true },
  { path: '/integrations/smtp', element: SMTPIntegrationsPage, protection: 'protected', layout: true },
  { path: '/credentials', element: CredentialsPage, protection: 'protected', layout: true },
  { path: '/settings', element: SettingsPage, protection: 'protected', layout: true },
  { path: '/billing', element: BillingPage, protection: 'protected', layout: true },
  { path: '/monitoring', element: MonitoringPage, protection: 'protected', layout: true },
  { path: '/graph-settings', element: GraphSettingsPage, protection: 'protected', layout: true },
  { path: '/workflows', element: WorkflowsPage, protection: 'protected', layout: true },
  { path: '/workflows/automations', element: AutomationsPage, protection: 'protected', layout: true },
  { path: '/projects', element: ProjectsPage, protection: 'protected', layout: true },
  { path: '/more', element: MorePage, protection: 'protected', layout: true },
  { path: '/integrations/gmail/callback', element: GmailCallbackPage, protection: 'public', layout: false },
  { path: '/integrations/microsoft-teams/callback', element: MicrosoftTeamsCallbackPage, protection: 'public', layout: false },
  { path: '/integrations/microsoft-onedrive/callback', element: MicrosoftOneDriveCallbackPage, protection: 'public', layout: false },
  { path: '/integrations/microsoft-outlook/callback', element: MicrosoftOutlookCallbackPage, protection: 'public', layout: false },
  // { path: 'agent-store', element: AgentStorePage, protection: 'protected', layout: true }, // Commented out
  // { path: 'dataset-store', element: DatasetStorePage, protection: 'protected', layout: true }, // Commented out
  
  // MCP Server Management routes - REMOVED: Users should not deploy their own MCP servers
  // MCP servers are now managed by admins only via /admin/marketplace
  // Users connect to admin-deployed servers via agent configuration
  
  // Admin routes (nested under a protected layout)
  {
    path: '/admin', 
    protection: 'admin', 
    layout: false, // AdminRoute now provides AdminLayout, no need for regular Layout
    element: AdminDashboardPage, // Base element for /admin
    children: [
      { path: '/admin/users', element: AdminUserManagement, protection: 'admin', layout: false },
      { path: '/admin/agents', element: AdminAgentManagement, protection: 'admin', layout: false },
      { path: '/admin/prompts', element: SystemPromptsPage, protection: 'admin', layout: false },
      { path: '/admin/settings', element: AdminSettingsPage, protection: 'admin', layout: false },
      // Legacy routes for backward compatibility
      { path: '/admin/system-api-keys', element: AdminSettingsPage, protection: 'admin', layout: false },
      { path: '/admin/oauth-providers', element: AdminSettingsPage, protection: 'admin', layout: false },
      { path: '/admin/billing/stripe-config', element: AdminSettingsPage, protection: 'admin', layout: false },
      { path: '/admin/billing/users', element: AdminUserBillingPage, protection: 'admin', layout: false },
      { path: '/admin/billing/stripe-callback', element: StripeOAuthCallbackPage, protection: 'admin', layout: false },
    ]
  },

  // Root route
  { path: '/', element: HomePage, protection: 'public', layout: false, exact: true },
]; 