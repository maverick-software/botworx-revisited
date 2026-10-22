// src/integrations/_shared/services/ToolInstanceService.ts
// Tool Instance Service for managing deployment and lifecycle of tools on DTMA infrastructure

import { SupabaseClient } from '@supabase/supabase-js';

export interface DeployToolOptions {
  userId: string;
  accountToolEnvironmentId: string;
  toolCatalogId: string;
  instanceNameOnToolbox: string;
  baseConfigOverrideJson?: Record<string, any>;
}

export interface RefreshStatusOptions {
  userId: string;
  accountToolInstanceId: string;
  accountToolEnvironmentId: string;
}

export interface DeploymentResult {
  id: string;
  status: string;
  instanceName: string;
  environmentId: string;
}

export class ToolInstanceService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Deploy a tool to a toolbox environment via DTMA
   */
  async deployToolToToolbox(options: DeployToolOptions): Promise<DeploymentResult> {
    const {
      userId,
      accountToolEnvironmentId,
      toolCatalogId,
      instanceNameOnToolbox,
      baseConfigOverrideJson = {}
    } = options;

    try {
      // Step 1: Create account_tool_instances record with 'pending_install' status
      const { data: instance, error: insertError } = await this.supabase
        .from('account_tool_instances')
        .insert({
          user_id: userId,
          account_tool_environment_id: accountToolEnvironmentId,
          tool_catalog_id: toolCatalogId,
          instance_name_on_toolbox: instanceNameOnToolbox,
          status_on_toolbox: 'pending_install',
          base_config_override_json: baseConfigOverrideJson,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (insertError || !instance) {
        throw new Error(`Failed to create tool instance record: ${insertError?.message || 'Unknown error'}`);
      }

      // Step 2: Get toolbox environment details for DTMA API call
      const { data: environment, error: envError } = await this.supabase
        .from('account_tool_environments')
        .select('public_ip_address')
        .eq('id', accountToolEnvironmentId)
        .single();

      if (envError || !environment) {
        throw new Error(`Failed to get environment details: ${envError?.message || 'Unknown error'}`);
      }

      // Step 3: Call DTMA API to deploy the tool
      try {
        const dtmaUrl = `http://${environment.public_ip_address}:30000/tools`;
        const response = await fetch(dtmaUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            toolInstanceId: instance.id,
            toolName: instanceNameOnToolbox,
            configuration: baseConfigOverrideJson,
            action: 'deploy'
          }),
        });

        if (!response.ok) {
          throw new Error(`DTMA API returned ${response.status}: ${response.statusText}`);
        }

        const dtmaResult = await response.json();
        console.log('DTMA deployment result:', dtmaResult);

        // Step 4: Update status to reflect DTMA response
        await this.supabase
          .from('account_tool_instances')
          .update({
            status_on_toolbox: dtmaResult.success ? 'installing' : 'error_installing',
            last_heartbeat_from_dtma: new Date().toISOString()
          })
          .eq('id', instance.id);

        return {
          id: instance.id,
          status: dtmaResult.success ? 'installing' : 'error_installing',
          instanceName: instanceNameOnToolbox,
          environmentId: accountToolEnvironmentId
        };

      } catch (dtmaError) {
        console.error('DTMA API call failed:', dtmaError);
        
        // Update status to show deployment failed
        await this.supabase
          .from('account_tool_instances')
          .update({
            status_on_toolbox: 'error_installing'
          })
          .eq('id', instance.id);

        throw new Error(`DTMA deployment failed: ${dtmaError instanceof Error ? dtmaError.message : 'Unknown error'}`);
      }

    } catch (error) {
      console.error('Tool deployment failed:', error);
      throw error instanceof Error ? error : new Error('Unknown deployment error');
    }
  }

  /**
   * Refresh tool instance status from DTMA
   */
  async refreshInstanceStatusFromDtma(options: RefreshStatusOptions): Promise<void> {
    const { userId, accountToolInstanceId, accountToolEnvironmentId } = options;

    try {
      // Step 1: Get current instance details
      const { data: instance, error: instanceError } = await this.supabase
        .from('account_tool_instances')
        .select('instance_name_on_toolbox, status_on_toolbox')
        .eq('id', accountToolInstanceId)
        .single();

      if (instanceError || !instance) {
        throw new Error(`Failed to get instance details: ${instanceError?.message || 'Unknown error'}`);
      }

      // Step 2: Get environment details
      const { data: environment, error: envError } = await this.supabase
        .from('account_tool_environments')
        .select('public_ip_address')
        .eq('id', accountToolEnvironmentId)
        .single();

      if (envError || !environment) {
        throw new Error(`Failed to get environment details: ${envError?.message || 'Unknown error'}`);
      }

      // Step 3: Query DTMA for current status
      try {
        const dtmaUrl = `http://${environment.public_ip_address}:30000/tools/${accountToolInstanceId}/status`;
        const response = await fetch(dtmaUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn(`DTMA status query failed with ${response.status}: ${response.statusText}`);
          return; // Don't throw - this is a refresh operation
        }

        const dtmaStatus = await response.json();
        
        // Step 4: Update database with fresh DTMA status
        await this.supabase
          .from('account_tool_instances')
          .update({
            status_on_toolbox: this.mapDtmaStatusToInstallationStatus(dtmaStatus.status),
            last_heartbeat_from_dtma: new Date().toISOString()
          })
          .eq('id', accountToolInstanceId);

        console.log(`Status refreshed for instance ${accountToolInstanceId}: ${dtmaStatus.status}`);

      } catch (dtmaError) {
        console.warn('DTMA status refresh failed:', dtmaError);
        // Don't throw - this is a background refresh operation
      }

    } catch (error) {
      console.error('Status refresh failed:', error);
      throw error instanceof Error ? error : new Error('Unknown status refresh error');
    }
  }

  /**
   * Start a tool instance on DTMA
   */
  async startToolOnToolbox(instanceId: string, environmentId: string): Promise<void> {
    await this.executeToolboxAction(instanceId, environmentId, 'start');
  }

  /**
   * Stop a tool instance on DTMA
   */
  async stopToolOnToolbox(instanceId: string, environmentId: string): Promise<void> {
    await this.executeToolboxAction(instanceId, environmentId, 'stop');
  }

  /**
   * Execute a toolbox action (start/stop/restart)
   */
  private async executeToolboxAction(instanceId: string, environmentId: string, action: string): Promise<void> {
    try {
      // Get environment details
      const { data: environment, error: envError } = await this.supabase
        .from('account_tool_environments')
        .select('public_ip_address')
        .eq('id', environmentId)
        .single();

      if (envError || !environment) {
        throw new Error(`Failed to get environment details: ${envError?.message || 'Unknown error'}`);
      }

      // Call DTMA API
      const dtmaUrl = `http://${environment.public_ip_address}:30000/tools/${instanceId}/${action}`;
      const response = await fetch(dtmaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`DTMA ${action} failed with ${response.status}: ${response.statusText}`);
      }

      // Update status optimistically
      const newStatus = action === 'start' ? 'starting_on_toolbox' : 'stopping_on_toolbox';
      await this.supabase
        .from('account_tool_instances')
        .update({
          status_on_toolbox: newStatus,
          last_heartbeat_from_dtma: new Date().toISOString()
        })
        .eq('id', instanceId);

    } catch (error) {
      console.error(`Tool ${action} failed:`, error);
      throw error instanceof Error ? error : new Error(`Unknown ${action} error`);
    }
  }

  /**
   * Map DTMA status to installation status enum
   */
  private mapDtmaStatusToInstallationStatus(dtmaStatus: string): string {
    const statusMap: Record<string, string> = {
      'running': 'running',
      'stopped': 'stopped', 
      'exited': 'stopped',
      'starting': 'starting_on_toolbox',
      'stopping': 'stopping_on_toolbox',
      'installing': 'installing',
      'error': 'error_starting',
      'failed': 'error_starting',
      'not_found': 'stopped'
    };

    return statusMap[dtmaStatus] || 'unknown';
  }
}
