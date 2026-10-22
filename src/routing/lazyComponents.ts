import { lazy } from 'react';

// This file centralizes the lazy loading definitions for page components. 

export const LoginPage = lazy(() => import('../pages/LoginPage'));
export const RegisterPage = lazy(() => import('../pages/RegisterPage').then(module => ({ default: module.RegisterPage })));

// DashboardPage is imported directly in AppRouter.tsx and routeConfig.tsx.
// Lazy loading caused a 'TypeError: Cannot convert object to primitive value'
// during component initialization, likely due to timing interactions with
// hooks/data fetching within DashboardPage when loaded lazily.
// export const DashboardPage = lazy(() => import('../pages/DashboardPage')); 

export const AgentsPage = lazy(() => import('../pages/AgentsPage').then(module => ({ default: module.AgentsPage })));
// Note: AgentEditPage is currently directly imported in AppRouter.tsx
// export const AgentEditPage = lazy(() => import('../pages/AgentEditPage').then(module => ({ default: module.AgentEditPage })));
export const AgentEditPage = lazy(() => import('../pages/agents/[agentId]/edit'));
export const AgentChatPage = lazy(() => import('../pages/AgentChatPage.tsx').then(module => ({ default: module.AgentChatPage })));
// Archived 2025-10-05: DatastoresPage moved to Agent Settings → Memory tab
// export const DatastoresPage = lazy(() => import('../pages/DatastoresPage.tsx').then(module => ({ default: module.DatastoresPage })));
// export const DatastoreEditPage = lazy(() => import('../pages/DatastoreEditPage.tsx'));
export const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage'));
export const TeamsPage = lazy(() => import('../pages/TeamsPage.tsx').then(module => ({ default: module.TeamsPage })));
export const TeamDetailsPage = lazy(() => import('../pages/TeamDetailsPage.tsx').then(module => ({ default: module.TeamDetailsPage })));
export const EditTeamPage = lazy(() => import('../pages/EditTeamPage.tsx').then(module => ({ default: module.EditTeamPage })));
export const SettingsPage = lazy(() => import('../pages/SettingsPage.tsx').then(module => ({ default: module.Settings })));
export const BillingPage = lazy(() => import('../pages/BillingPage').then(module => ({ default: module.default })));

export const MonitoringPage = lazy(() => import('../pages/MonitoringPage.tsx').then(module => ({ default: module.Monitoring })));
export const AdminUserManagement = lazy(() => import('../pages/AdminUserManagement.tsx').then(module => ({ default: module.AdminUserManagement })));
export const AdminAgentManagement = lazy(() => import('../pages/AdminAgentManagement.tsx').then(module => ({ default: module.AdminAgentManagement })));
export const AdminSettingsPage = lazy(() => import('../pages/AdminSettingsPage').then(module => ({ default: module.AdminSettingsPage })));
export const HomePage = lazy(() => import('../pages/HomePage.tsx').then(module => ({ default: module.HomePage }))); 

// Add WorkspacePage
export const WorkspacePage = lazy(() => import('../pages/WorkspacePage').then(module => ({ default: module.WorkspacePage })));
export const WorkspacesListPage = lazy(() => import('../pages/WorkspacesListPage').then(module => ({ default: module.WorkspacesListPage }))); 
export const CreateWorkspacePage = lazy(() => import('../pages/CreateWorkspacePage').then(module => ({ default: module.CreateWorkspacePage }))); 
// Add WorkspaceSettingsPage
export const WorkspaceSettingsPage = lazy(() => import('../pages/WorkspaceSettingsPage').then(module => ({ default: module.WorkspaceSettingsPage }))); 

// Commenting out missing pages to resolve Vite errors
// export const AgentStorePage = lazy(() => import('../pages/AgentStorePage.tsx'));
// export const DatasetStorePage = lazy(() => import('../pages/DatasetStorePage.tsx'));
// export const NotFoundPage = lazy(() => import('../pages/NotFoundPage.tsx')); 



// MCP Server Management Pages
export const MCPServersPage = lazy(() => import('../pages/mcp/MCPServersPage').then(module => ({ default: module.MCPServersPage })));
export const MCPMarketplacePage = lazy(() => import('../pages/mcp/MCPMarketplacePage').then(module => ({ default: module.MCPMarketplacePage })));
export const MCPDeployPage = lazy(() => import('../pages/mcp/MCPDeployPage').then(module => ({ default: module.MCPDeployPage })));
export const MCPServerConfigPage = lazy(() => import('../pages/mcp/MCPServerConfigPage').then(module => ({ default: module.MCPServerConfigPage }))); 

// Archived 2025-10-13: Deprecated admin MCP system
// export const AdminMCPMarketplaceManagement = lazy(() => import('../pages/AdminMCPMarketplaceManagement')); 
export const AdminIntegrationManagement = lazy(() => import('../pages/AdminIntegrationManagement').then(module => ({ default: module.AdminIntegrationManagement })));
export const AdminSystemAPIKeysPage = lazy(() => import('../pages/admin/AdminSystemAPIKeysPage').then(module => ({ default: module.AdminSystemAPIKeysPage })));

// Admin Billing Pages
export const AdminStripeConfigPage = lazy(() => import('../pages/admin/AdminStripeConfigPage').then(module => ({ default: module.default })));
export const AdminUserBillingPage = lazy(() => import('../pages/admin/AdminUserBillingPage').then(module => ({ default: module.default })));
export const StripeOAuthCallbackPage = lazy(() => import('../pages/admin/StripeOAuthCallbackPage').then(module => ({ default: module.default })));

// Add IntegrationsPage
export const IntegrationsPage = lazy(() => import('../pages/IntegrationsPage').then(module => ({ default: module.IntegrationsPage }))); 

// Add CredentialsPage
export const CredentialsPage = lazy(() => import('../pages/CredentialsPage').then(module => ({ default: module.CredentialsPage }))); 