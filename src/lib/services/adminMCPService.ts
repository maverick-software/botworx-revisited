// src/lib/services/adminMCPService.ts
// Admin-specific MCP server management service with enhanced privileges and monitoring

import { MCPService, EnhancedMCPServer, ConnectionTest } from './mcpService';
import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { IntelligentDropletSelector, ResourceRequirements, DropletSelectionResult } from './intelligentDropletSelector';

export interface MCPServerDeploymentConfig {
  serverName: string;
  serverType: string;
  dockerImage: string;
  transport: 'http' | 'stdio' | 'websocket';
  endpointPath?: string;
  environmentVariables?: Record<string, string>;
  portMappings?: Array<{ containerPort: number; hostPort: number }>;
  capabilities?: string[];
  resourceLimits?: {
    memory?: string;
    cpu?: string;
  };
  environmentId?: string;
}

export interface MCPServerDeployment {
  id: string;
  status: 'deploying' | 'running' | 'failed' | 'stopped';
  serverName: string;
  deployedAt: Date;
  estimatedReadyTime?: Date;
  error?: string;
}

export interface AdminOperationLog {
  id: string;
  adminUserId: string;
  operation: 'deploy' | 'start' | 'stop' | 'restart' | 'delete' | 'configure';
  serverId: string;
  serverName: string;
  timestamp: Date;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ServerMetrics {
  serverId: string;
  cpuUsage: number;
  memoryUsage: number;
  networkIO: { in: number; out: number };
  requestCount: number;
  errorRate: number;
  uptime: number;
  lastUpdated: Date;
}

export interface AdminDashboardStats {
  totalServers: number;
  runningServers: number;
  stoppedServers: number;
  errorServers: number;
  totalConnections: number;
  activeConnections: number;
  totalRequests: number;
  averageResponseTime: number;
  lastUpdated: Date;
}

export interface LogFilters {
  operation?: string;
  serverId?: string;
  adminUserId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface ToolboxEnvironment {
  id: string;
  name: string;
  publicIP: string;
  status: string;
  region?: string;
  size?: string;
  userId?: string;
}

export class AdminMCPService extends MCPService {
  private intelligentDropletSelector: IntelligentDropletSelector;

  constructor(supabaseClient?: SupabaseClient) {
    super(supabaseClient);
    this.intelligentDropletSelector = new IntelligentDropletSelector();
  }

  /**
   * Validate that the current user has admin privileges
   */
  async validateAdminAccess(): Promise<void> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const isAdmin = await this.isUserAdmin(user.id);
    if (!isAdmin) {
      throw new Error('Admin access required');
    }
  }

  /**
   * Check if a user has admin privileges
   */
  async isUserAdmin(userId?: string): Promise<boolean> {
    const targetUserId = userId || (await this.supabase.auth.getUser()).data.user?.id;
    
    if (!targetUserId) {
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from('user_roles')
        .select(`
          roles!inner (
            name
          )
        `)
        .eq('user_id', targetUserId)
        .eq('roles.name', 'admin')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error in isUserAdmin:', error);
      return false;
    }
  }

  /**
   * Deploy a new MCP server via DTMA infrastructure
   */
  async deployMCPServer(config: MCPServerDeploymentConfig): Promise<MCPServerDeployment> {
    await this.validateAdminAccess();
    
    const deploymentId = crypto.randomUUID();
    const validatedConfig = await this.validateServerConfig(config);
    
    try {
      // Get selected droplet environment or fallback to admin default
      const adminEnvironment = config.environmentId 
        ? await this.getToolboxEnvironmentById(config.environmentId)
        : await this.getAdminToolboxEnvironment();

      // Convert to the expected format if using the new method
      const environmentForDeployment = config.environmentId 
        ? { 
            id: adminEnvironment.id, 
            public_ip_address: (adminEnvironment as ToolboxEnvironment).publicIP || adminEnvironment.public_ip_address, 
            status: adminEnvironment.status 
          }
        : adminEnvironment;
      
      // Deploy via Supabase Edge Function (which then calls DTMA)
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Use the existing generic MCP Server tool catalog entry
      const toolCatalogId = '00000000-0000-0000-0000-000000000001'; // Generic MCP Server UUID

      // Call the toolbox-tools edge function with the correct path structure
      const toolboxToolsUrl = `toolbox-tools/${environmentForDeployment.id}/tools`;
      const { data: deployment, error: deploymentError } = await this.supabase.functions.invoke(toolboxToolsUrl, {
        method: 'POST',
        body: {
          toolCatalogId: toolCatalogId,
        instanceNameOnToolbox: validatedConfig.serverName,
        baseConfigOverrideJson: {
          dockerImage: validatedConfig.dockerImage,
          environmentVariables: validatedConfig.environmentVariables || {},
          portMappings: validatedConfig.portMappings || [{ containerPort: 8080, hostPort: 30000 }]
          }
        }
      });

      if (deploymentError || !deployment) {
        throw new Error(`Deployment via Edge Function failed: ${deploymentError?.message || 'Unknown error'}`);
      }

      // Update with MCP-specific fields
      const { error: updateError } = await this.supabase
        .from('account_tool_instances')
        .update({
          mcp_server_type: validatedConfig.serverType,
          mcp_transport_type: validatedConfig.transport,
          mcp_endpoint_path: validatedConfig.endpointPath || '/mcp',
          mcp_server_capabilities: validatedConfig.capabilities || [],
          mcp_discovery_metadata: {
            deployedAt: new Date().toISOString(),
            deploymentConfig: validatedConfig,
            deploymentId,
            adminDeployed: true
          }
        })
        .eq('id', deployment.id);

      if (updateError) {
        throw new Error(`Failed to update MCP server fields: ${updateError.message}`);
      }

      // Log admin operation
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user.id,
        operation: 'deploy',
        serverId: deployment.id,
        serverName: validatedConfig.serverName,
        timestamp: new Date(),
        success: true,
        metadata: { deploymentConfig: validatedConfig }
      });

      return {
        id: deployment.id,
        status: 'deploying',
        serverName: validatedConfig.serverName,
        deployedAt: new Date(),
        estimatedReadyTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
      };

    } catch (error) {
      // Log failed deployment
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'deploy',
        serverId: 'unknown',
        serverName: validatedConfig.serverName,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * One-click intelligent MCP deployment with automatic droplet selection
   */
  async oneClickDeploy(templateId: string): Promise<MCPServerDeployment> {
    await this.validateAdminAccess();
    
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // 1. Load template with smart defaults
      const template = await this.getTemplateWithDefaults(templateId);
      
      // 2. Convert template to resource requirements
      const requirements = this.templateToResourceRequirements(template);
      
      // 3. Intelligent droplet selection
      const dropletResult = await this.intelligentDropletSelector
        .selectOptimalDroplet(user.id, requirements);
      
      // 4. Auto-provision if needed or use selected droplet
      const dropletId = dropletResult.autoProvisionRecommendation 
        ? await this.autoProvisionDroplet(dropletResult.autoProvisionRecommendation, user.id)
        : dropletResult.selectedDropletId;

      if (!dropletId) {
        throw new Error('No suitable droplet found and auto-provisioning failed');
      }
      
      // 5. Deploy with existing infrastructure using optimal droplet
      const deploymentConfig: MCPServerDeploymentConfig = {
        serverName: `${template.tool_name}-${Date.now()}`,
        serverType: 'mcp_server',
        dockerImage: template.docker_image,
        transport: 'http',
        endpointPath: '/mcp',
        environmentVariables: template.mcp_server_metadata?.environmentVariables || {},
        capabilities: ['tools', 'resources'],
        resourceLimits: this.getResourceLimitsFromHint(template.mcp_server_metadata?.resourceHint),
        environmentId: dropletId
      };

      return await this.deployMCPServer(deploymentConfig);

    } catch (error) {
      console.error('One-click deployment failed:', error);
      throw new Error(`One-click deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get template with smart defaults
   */
  private async getTemplateWithDefaults(templateId: string) {
    const { data: template, error } = await this.supabase
      .from('tool_catalog')
      .select('*')
      .eq('id', templateId)
      .eq('is_mcp_server', true)
      .single();

    if (error || !template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return template;
  }

  /**
   * Convert template to resource requirements
   */
  private templateToResourceRequirements(template: any): ResourceRequirements {
    const resourceHint = template.mcp_server_metadata?.resourceHint || 'medium';
    
    return {
      cpu: resourceHint as 'light' | 'medium' | 'heavy',
      memory: resourceHint as 'light' | 'medium' | 'heavy',
      network: 'medium',
      storage: 'standard',
      expectedLoad: 'production'
    };
  }

  /**
   * Auto-provision a new droplet based on recommendation
   */
  private async autoProvisionDroplet(recommendation: any, userId: string): Promise<string> {
    // This would integrate with your existing droplet provisioning logic
    // For now, we'll throw an error to indicate this needs implementation
    throw new Error('Auto-provisioning not yet implemented - please select an existing droplet');
  }

  /**
   * Get resource limits from resource hint
   */
  private getResourceLimitsFromHint(resourceHint?: string) {
    switch (resourceHint) {
      case 'light':
        return { memory: '512m', cpu: '0.5' };
      case 'heavy':
        return { memory: '2g', cpu: '2' };
      default:
        return { memory: '1g', cpu: '1' };
    }
  }

  /**
   * Start an MCP server
   */
  async startMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();
    
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Use Edge Function instead of direct service call
      const startUrl = `toolbox-tools/${server.environment.id}/tools/${serverId}/start`;
      const { error: startError } = await this.supabase.functions.invoke(startUrl, {
        method: 'POST'
      });

      if (startError) {
        throw new Error(`Failed to start server via Edge Function: ${startError.message}`);
      }

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user.id,
        operation: 'start',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true
      });

    } catch (error) {
      const { data: { user } } = await this.supabase.auth.getUser();
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user?.id || 'unknown',
        operation: 'start',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new Error(`Failed to start server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop an MCP server
   */
  async stopMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();
    
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Use Edge Function instead of direct service call
      const stopUrl = `toolbox-tools/${server.environment.id}/tools/${serverId}/stop`;
      const { error: stopError } = await this.supabase.functions.invoke(stopUrl, {
        method: 'POST'
      });

      if (stopError) {
        throw new Error(`Failed to stop server via Edge Function: ${stopError.message}`);
      }

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user.id,
        operation: 'stop',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true
      });

    } catch (error) {
      const { data: { user } } = await this.supabase.auth.getUser();
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: user?.id || 'unknown',
        operation: 'stop',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new Error(`Failed to stop server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Restart an MCP server
   */
  async restartMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();
    
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      // Stop then start
      await this.stopMCPServer(serverId);
      
      // Wait a moment for clean shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await this.startMCPServer(serverId);

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'restart',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true
      });

    } catch (error) {
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'restart',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new Error(`Failed to restart server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete an MCP server
   */
  async deleteMCPServer(serverId: string): Promise<void> {
    await this.validateAdminAccess();
    
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      // Stop server first if running
      if (server.status.state === 'running') {
        await this.stopMCPServer(serverId);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Delete via Edge Function instead of direct service call
      const deleteUrl = `toolbox-tools/${server.environment.id}/tools/${serverId}`;
      const { error: deleteError } = await this.supabase.functions.invoke(deleteUrl, {
        method: 'DELETE'
      });

      if (deleteError) {
        throw new Error(`Failed to delete server via Edge Function: ${deleteError.message}`);
      }

      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'delete',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: true
      });

    } catch (error) {
      await this.logAdminOperation({
        id: crypto.randomUUID(),
        adminUserId: (await this.supabase.auth.getUser()).data.user!.id,
        operation: 'delete',
        serverId,
        serverName: server.name,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new Error(`Failed to delete server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all MCP servers (admin view - includes all users' servers)
   */
  async getAllMCPServers(): Promise<EnhancedMCPServer[]> {
    await this.validateAdminAccess();

    try {
      // Admin can see all MCP servers across all users
      const { data, error } = await this.supabase
        .from('account_tool_instances')
        .select(`
          id,
          instance_name_on_toolbox,
          status_on_toolbox,
          last_heartbeat_from_dtma,
          created_at,
          updated_at,
          mcp_server_type,
          mcp_transport_type,
          mcp_endpoint_path,
          mcp_server_capabilities,
          mcp_discovery_metadata,
          account_tool_environment:account_tool_environments(
            id,
            name,
            public_ip_address,
            region_slug,
            size_slug,
            user_id
          )
        `)
        .not('mcp_server_type', 'is', null)
        .order('instance_name_on_toolbox');

      if (error) {
        throw new Error(`Failed to fetch MCP servers: ${error.message}`);
      }

      return (data || []).map(this.transformToEnhancedMCPServer.bind(this));
    } catch (error) {
      console.error('Error in getAllMCPServers:', error);
      throw error instanceof Error ? error : new Error('Unknown error in getAllMCPServers');
    }
  }

  /**
   * Get server logs via DTMA
   */
  async getMCPServerLogs(serverId: string, lines: number = 100): Promise<string[]> {
    await this.validateAdminAccess();
    
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      // Get logs via DTMA API directly since getToolInstanceLogs doesn't exist
      const response = await fetch(`http://${server.environment.publicIP}:3000/api/logs/${serverId}?lines=${lines}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const logs = await response.text();
      return logs.split('\n').filter((line: string) => line.trim());
    } catch (error) {
      throw new Error(`Failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get admin dashboard statistics
   */
  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    await this.validateAdminAccess();

    try {
      // Try to get deployed servers, but handle cases where they don't have IP addresses yet
      let totalServers = 0;
      let runningServers = 0;
      let stoppedServers = 0;
      let errorServers = 0;

      try {
        const servers = await this.getAllMCPServers();
        totalServers = servers.length;
        runningServers = servers.filter(s => s.status.state === 'running').length;
        stoppedServers = servers.filter(s => s.status.state === 'stopped').length;
        errorServers = servers.filter(s => s.status.state === 'error').length;
      } catch (serverError) {
        console.warn('Could not fetch deployed servers for stats (likely due to missing IP addresses):', serverError);
        
        // Fallback: Count MCP server instances directly from database
        const { data: instances, error: instanceError } = await this.supabase
          .from('account_tool_instances')
          .select('id, status_on_toolbox')
          .not('mcp_server_type', 'is', null);

        if (!instanceError && instances) {
          totalServers = instances.length;
          runningServers = instances.filter(i => i.status_on_toolbox === 'running').length;
          stoppedServers = instances.filter(i => ['stopped', 'exited'].includes(i.status_on_toolbox)).length;
          errorServers = instances.filter(i => ['error_starting', 'error_stopping'].includes(i.status_on_toolbox)).length;
        }
      }

      // Get connection stats from agent_mcp_connections if available
      const { data: connections } = await this.supabase
        .from('agent_mcp_connections')
        .select('id, is_active')
        .eq('is_active', true);

      const activeConnections = connections?.length || 0;

      return {
        totalServers,
        runningServers,
        stoppedServers,
        errorServers,
        totalConnections: activeConnections,
        activeConnections,
        totalRequests: 0, // Would need metrics collection
        averageResponseTime: 0, // Would need metrics collection
        lastUpdated: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Log admin operations for audit trail
   */
  async logAdminOperation(operation: AdminOperationLog): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('admin_operation_logs')
        .insert({
          id: operation.id,
          admin_user_id: operation.adminUserId,
          operation: operation.operation,
          server_id: operation.serverId,
          server_name: operation.serverName,
          timestamp: operation.timestamp.toISOString(),
          success: operation.success,
          error: operation.error,
          metadata: operation.metadata
        });

      if (error) {
        console.error('Failed to log admin operation:', error);
        // Don't throw - logging failure shouldn't break the operation
      }
    } catch (error) {
      console.error('Error in logAdminOperation:', error);
    }
  }

  /**
   * Get admin operation logs with filtering
   */
  async getAdminOperationLogs(filters?: LogFilters): Promise<AdminOperationLog[]> {
    await this.validateAdminAccess();

    try {
      let query = this.supabase
        .from('admin_operation_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (filters) {
        if (filters.operation) query = query.eq('operation', filters.operation);
        if (filters.serverId) query = query.eq('server_id', filters.serverId);
        if (filters.adminUserId) query = query.eq('admin_user_id', filters.adminUserId);
        if (filters.success !== undefined) query = query.eq('success', filters.success);
        if (filters.startDate) query = query.gte('timestamp', filters.startDate.toISOString());
        if (filters.endDate) query = query.lte('timestamp', filters.endDate.toISOString());
        if (filters.limit) query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch operation logs: ${error.message}`);
      }

      return (data || []).map(log => ({
        id: log.id,
        adminUserId: log.admin_user_id,
        operation: log.operation,
        serverId: log.server_id,
        serverName: log.server_name,
        timestamp: new Date(log.timestamp),
        success: log.success,
        error: log.error,
        metadata: log.metadata
      }));
    } catch (error) {
      throw new Error(`Failed to get operation logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get admin toolbox environment (updated for compatibility)
   */
  protected async getAdminToolboxEnvironment(): Promise<{ id: any; public_ip_address: any; status: any; }> {
    const { data, error } = await this.supabase
      .from('account_tool_environments')
      .select('id, name, public_ip_address, status')
      .eq('status', 'active')
      .limit(1)
      .single();

    if (error || !data) {
      throw new Error('No active admin toolbox environment found for MCP server deployment');
    }

    return {
      id: data.id,
      public_ip_address: data.public_ip_address,
      status: data.status
    };
  }

  /**
   * Validate server configuration
   */
  private async validateServerConfig(config: MCPServerDeploymentConfig): Promise<MCPServerDeploymentConfig> {
    // Basic validation
    if (!config.serverName || config.serverName.trim().length === 0) {
      throw new Error('Server name is required');
    }

    if (!config.serverType || config.serverType.trim().length === 0) {
      throw new Error('Server type is required');
    }

    if (!config.dockerImage || config.dockerImage.trim().length === 0) {
      throw new Error('Docker image is required');
    }

    // Validate transport
    if (!['http', 'stdio', 'websocket'].includes(config.transport)) {
      throw new Error('Invalid transport type. Must be http, stdio, or websocket');
    }

    // Validate server name uniqueness
    const existingServers = await this.getAllMCPServers();
    const nameExists = existingServers.some(server => 
      server.name.toLowerCase() === config.serverName.toLowerCase()
    );

    if (nameExists) {
      throw new Error(`Server name '${config.serverName}' already exists`);
    }

    return {
      ...config,
      serverName: config.serverName.trim(),
      serverType: config.serverType.trim(),
      dockerImage: config.dockerImage.trim(),
      endpointPath: config.endpointPath || '/mcp',
      capabilities: config.capabilities || ['tools'],
      portMappings: config.portMappings || [{ containerPort: 8080, hostPort: 30000 }]
    };
  }

  /**
   * Get all available droplets for MCP deployment
   */
  async getAvailableDroplets(): Promise<ToolboxEnvironment[]> {
    await this.validateAdminAccess();

    const { data, error } = await this.supabase
      .from('account_tool_environments')
      .select('id, name, public_ip_address, status, region_slug, size_slug, user_id')
      .eq('status', 'active')
      .order('name');

    if (error) {
      throw new Error(`Failed to fetch available droplets: ${error.message}`);
    }

    return (data || []).map(env => ({
      id: env.id,
      name: env.name,
      publicIP: env.public_ip_address,
      status: env.status,
      region: env.region_slug,
      size: env.size_slug,
      userId: env.user_id
    }));
  }

  /**
   * Get admin toolbox environment by ID (for specific droplet selection)
   */
  private async getToolboxEnvironmentById(environmentId: string): Promise<ToolboxEnvironment> {
    const { data, error } = await this.supabase
      .from('account_tool_environments')
      .select('id, name, public_ip_address, status, region_slug, size_slug')
      .eq('id', environmentId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      throw new Error(`Droplet with ID ${environmentId} not found or not active`);
    }

    return {
      id: data.id,
      name: data.name,
      publicIP: data.public_ip_address,
      status: data.status,
      region: data.region_slug,
      size: data.size_slug
    };
  }

  /**
   * Ensure tool catalog entry exists for MCP template
   */
  private async ensureToolCatalogEntry(templateId: string, dockerImage: string): Promise<string> {
    // Check if entry already exists
    const { data: existing } = await this.supabase
      .from('tool_catalog')
      .select('id')
      .eq('id', templateId)
      .single();

    if (existing) {
      return templateId; // Entry already exists
    }

    // Create new tool catalog entry for this MCP template
    const { data: newEntry, error } = await this.supabase
      .from('tool_catalog')
      .insert({
        id: templateId,
        tool_name: `MCP Server: ${templateId}`,
        name: `MCP Server: ${templateId}`,
        description: 'MCP Server deployed from template',
        package_identifier: dockerImage,
        docker_image_url: dockerImage,
        category: 'mcp-server',
        version: '1.0.0',
        is_public: true,
        status: 'available',
        packaging_type: 'docker_image',
        created_by: (await this.supabase.auth.getUser()).data.user!.id
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Could not create tool catalog entry, using generic one:', error);
      return '00000000-0000-0000-0000-000000000001'; // Fallback to generic
    }

    return newEntry.id;
  }
} 