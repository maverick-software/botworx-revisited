/**
 * Agent Integration Management
 * Components for managing agent-specific integration permissions and assignments
 */

// Main Components
export { AgentIntegrationsManager } from './components/AgentIntegrationsManager';
export { AgentIntegrationAssignment } from './components/AgentIntegrationAssignment';

// Permission Components
export { AgentGmailPermissions } from './permissions/AgentGmailPermissions';
export { AgentSMTPPermissionsModal } from './permissions/AgentSMTPPermissionsModal';
export { AgentWebSearchPermissions } from './permissions/AgentWebSearchPermissions';
export { AgentWebSearchPermissions as AgentWebSearchPermissionsUnified } from './permissions/AgentWebSearchPermissionsUnified';
