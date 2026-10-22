import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { Database, Json } from '../../types/database.types.ts'; // Changed to relative path

// Correctly typed definitions based on the expected schema
export type AccountToolInstanceRecord = Database['public']['Tables']['account_tool_instances']['Row'];
export type AccountToolInstanceInsert = Database['public']['Tables']['account_tool_instances']['Insert'];
export type AccountToolInstanceUpdate = Database['public']['Tables']['account_tool_instances']['Update'];
export type AccountToolInstallationStatusEnum = Database['public']['Enums']['account_tool_installation_status_enum'];
export type AccountToolEnvironmentRecord = Database['public']['Tables']['account_tool_environments']['Row'];
export type ToolCatalogRecord = Database['public']['Tables']['tool_catalog']['Row'];


export interface CreateToolInstanceOptions {
    account_tool_environment_id: string;
    tool_catalog_id: string;
    instance_name_on_toolbox: string;
    base_config_override_json?: Json;
    // As per WBS 1.2.3, the status column in account_tool_instances is 'status_on_toolbox'
    // The initial_status for CreateToolInstanceOptions should map to this.
    status_on_toolbox: AccountToolInstallationStatusEnum;
}

// UpdateToolInstanceOptions should allow updating relevant fields of AccountToolInstanceRecord
// We can use AccountToolInstanceUpdate and pick relevant fields or make it more specific.
// For now, let's make it flexible but exclude IDs and immutable fields.
export type UpdateToolInstanceOptions = Omit<Partial<AccountToolInstanceUpdate>, 'id' | 'created_at' | 'account_tool_environment_id' | 'tool_catalog_id'>;

export interface DeployToolOptions {
    userId: string; // For authorization
    accountToolEnvironmentId: string;
    toolCatalogId: string;
    instanceNameOnToolbox: string;
    baseConfigOverrideJson?: Json;
}

export interface ManageToolInstanceOptions {
    userId: string; // For authorization
    accountToolInstanceId: string;
    accountToolEnvironmentId: string; // Added for context and consistency checks
}

export class ToolInstanceService {
    private supabase: SupabaseClient;

    constructor(supabaseClient: SupabaseClient) {
        this.supabase = supabaseClient;
    }

    /**
     * Creates a new tool instance record in the database.
     * WBS 2A.1.1
     */
    async createToolInstance(options: CreateToolInstanceOptions): Promise<AccountToolInstanceRecord> {
        const insertData: AccountToolInstanceInsert = {
            account_tool_environment_id: options.account_tool_environment_id,
            tool_catalog_id: options.tool_catalog_id,
            instance_name_on_toolbox: options.instance_name_on_toolbox,
            base_config_override_json: options.base_config_override_json,
            status_on_toolbox: options.status_on_toolbox,
        };

        const { data, error } = await this.supabase
            .from('account_tool_instances')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Error creating tool instance:', error);
            throw error;
        }
        return data as AccountToolInstanceRecord; // Cast because select() can return array
    }

    /**
     * Retrieves a tool instance by its ID.
     * WBS 2A.1.1
     */
    async getToolInstanceById(toolInstanceId: string): Promise<AccountToolInstanceRecord | null> {
        const { data, error } = await this.supabase
            .from('account_tool_instances')
            .select('*')
            .eq('id', toolInstanceId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching tool instance by ID:', error);
            throw error;
        }
        return data;
    }

    /**
     * Retrieves all tool instances for a given toolbox (account_tool_environment_id).
     * WBS 2A.1.1
     */
    async getToolInstancesForToolbox(accountToolEnvironmentId: string): Promise<AccountToolInstanceRecord[]> {
        const { data, error } = await this.supabase
            .from('account_tool_instances')
            .select('*')
            .eq('account_tool_environment_id', accountToolEnvironmentId);

        if (error) {
            console.error('Error fetching tool instances for toolbox:', error);
            throw error;
        }
        return data || [];
    }

    /**
     * Updates a tool instance record.
     * WBS 2A.1.1
     */
    async updateToolInstance(toolInstanceId: string, updates: UpdateToolInstanceOptions): Promise<AccountToolInstanceRecord> {
        // Ensure 'updated_at' is managed by the trigger or manually set if needed.
        // Supabase typically handles this with a trigger: trigger_set_timestamp(updated_at)
        const updateData: AccountToolInstanceUpdate = updates;

        const { data, error } = await this.supabase
            .from('account_tool_instances')
            .update(updateData)
            .eq('id', toolInstanceId)
            .select()
            .single();

        if (error) {
            console.error('Error updating tool instance:', error);
            throw error;
        }
        return data as AccountToolInstanceRecord; // Cast because select() can return array
    }

    /**
     * Marks a tool instance for deletion by updating its status to 'pending_delete'.
     * Actual deletion from DTMA and potentially DB record removal would be separate steps.
     * WBS 2A.1.1
     */
    async markToolInstanceForDeletion(toolInstanceId: string): Promise<AccountToolInstanceRecord> {
        const updateData: AccountToolInstanceUpdate = {
            status_on_toolbox: 'pending_delete' as AccountToolInstallationStatusEnum,
            // updated_at will be handled by the trigger
        };

        const { data, error } = await this.supabase
            .from('account_tool_instances')
            .update(updateData)
            .eq('id', toolInstanceId)
            .select()
            .single();

        if (error) {
            console.error('Error marking tool instance for deletion:', error);
            throw error;
        }
        return data as AccountToolInstanceRecord; // Cast because select() can return array
    }

    /**
     * Deploys a tool from the tool_catalog onto a specified Toolbox by commanding the DTMA.
     * WBS 2A.1.2
     */
    async deployToolToToolbox(options: DeployToolOptions): Promise<AccountToolInstanceRecord> {
        // 1. Authorize User (Placeholder - implement actual authorization logic)
        console.log(`Authorizing userId: ${options.userId} for toolbox: ${options.accountToolEnvironmentId}`);
        // const toolbox = await this.getToolboxEnvironmentDetails(options.accountToolEnvironmentId);
        // if (!toolbox || toolbox.user_id !== options.userId) {
        //     throw new Error('Unauthorized or Toolbox not found');
        // }
        // if (toolbox.status !== 'active') { // Or relevant status to allow deployment
        //     throw new Error('Toolbox is not in a state ready for deployment.');
        // }

        // 2. Fetch Tool Catalog Entry
        const { data: toolCatalogEntry, error: catalogError } = await this.supabase
            .from('tool_catalog')
            .select('*')
            .eq('id', options.toolCatalogId)
            .single();

        if (catalogError || !toolCatalogEntry) {
            console.error('Error fetching tool catalog entry:', catalogError);
            throw new Error(catalogError?.message || 'Tool catalog entry not found.');
        }

        // 3. Fetch Toolbox Details (simplified for now, assuming AccountEnvironmentService might provide this)
        // For this example, directly fetch what's needed if AccountEnvironmentService is not integrated yet.
        const { data: toolbox, error: toolboxError } = await this.supabase
            .from('account_tool_environments')
            .select('public_ip_address, status, user_id') // Add user_id for auth check
            .eq('id', options.accountToolEnvironmentId)
            .single();

        if (toolboxError || !toolbox) {
            console.error('Error fetching toolbox details:', toolboxError);
            throw new Error(toolboxError?.message || 'Toolbox not found.');
        }

        // Actual Authorization check (allow admins to deploy to any toolbox)
        // Check if user is admin
        const { data: userRoles } = await this.supabase
            .from('user_roles')
            .select('roles!inner(name)')
            .eq('user_id', options.userId)
            .eq('roles.name', 'admin');

        const isAdmin = userRoles && userRoles.length > 0;

        // Allow access if user owns the toolbox OR user is admin
        if (toolbox.user_id !== options.userId && !isAdmin) {
            throw new Error('User is not authorized to deploy to this toolbox.');
        }
        // Add check for toolbox status, e.g., must be 'active'
        if (toolbox.status !== 'active') { // Replace 'active' with actual enum from Database types if different
             throw new Error(`Toolbox is not active. Current status: ${toolbox.status}`);
        }

        const newToolInstanceRecord = await this.createToolInstance({
            account_tool_environment_id: options.accountToolEnvironmentId,
            tool_catalog_id: options.toolCatalogId,
            instance_name_on_toolbox: options.instanceNameOnToolbox,
            base_config_override_json: options.baseConfigOverrideJson,
            status_on_toolbox: 'pending_deploy' as AccountToolInstallationStatusEnum, // Initial status
        });

        try {
            // Prepare DTMA API Call
            const dtmaPayload = {
                dockerImageUrl: toolCatalogEntry.package_identifier, // Assuming package_identifier holds the image URL
                instanceNameOnToolbox: newToolInstanceRecord.instance_name_on_toolbox,
                accountToolInstanceId: newToolInstanceRecord.id,
                baseConfigOverrideJson: newToolInstanceRecord.base_config_override_json,
                // requiredEnvVars: toolCatalogEntry.required_env_vars, // If this field exists in tool_catalog
            };

            const dtmaPort = Deno.env.get('DTMA_PORT') || '30000'; // Fixed to match actual DTMA port
            const backendToDtmaApiKey = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
            if (!backendToDtmaApiKey) {
                throw new Error('BACKEND_TO_DTMA_API_KEY is not configured.');
            }

            const dtmaApiUrl = `http://${toolbox.public_ip_address}:${dtmaPort}/tools`;
            
            console.log('Calling DTMA API:', dtmaApiUrl, 'with payload:', dtmaPayload);

            // Make API Call to DTMA (using fetch API)
            const response = await fetch(dtmaApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${backendToDtmaApiKey}`,
                },
                body: JSON.stringify(dtmaPayload),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`DTMA API request failed with status ${response.status}: ${errorBody}`);
            }
            
            // DTMA call succeeded, update status to 'deploying'
            return await this.updateToolInstance(newToolInstanceRecord.id, {
                status_on_toolbox: 'deploying' as AccountToolInstallationStatusEnum,
            });

        } catch (error: any) {
            console.error('Error during DTMA call or subsequent update:', error);
            // Rollback or set status to 'error_deploying'
            await this.updateToolInstance(newToolInstanceRecord.id, {
                status_on_toolbox: 'error_deploying' as AccountToolInstallationStatusEnum,
                // runtime_details: { error: error.message } // Storing error message
            });
            throw error; // Re-throw the error to the caller
        }
    }

    private async _getToolboxAndInstanceForManagement(accountToolInstanceId: string, userId: string): Promise<{instance: AccountToolInstanceRecord, toolbox: AccountToolEnvironmentRecord & { public_ip_address: string } }> {
        const { data: instance, error: instanceError } = await this.supabase
            .from('account_tool_instances')
            .select('*, account_tool_environments(*)')
            .eq('id', accountToolInstanceId)
            .single();

        if (instanceError || !instance) {
            console.error('Error fetching tool instance for management:', instanceError);
            throw new Error(instanceError?.message || 'Tool instance not found.');
        }

        if (!instance.account_tool_environments) {
            throw new Error('Tool instance is not associated with a toolbox environment.');
        }
        
        const toolbox = instance.account_tool_environments as AccountToolEnvironmentRecord;

        // Check if user is admin (same logic as deployToolToToolbox)
        const { data: userRoles } = await this.supabase
            .from('user_roles')
            .select('roles!inner(name)')
            .eq('user_id', userId)
            .eq('roles.name', 'admin');

        const isAdmin = userRoles && userRoles.length > 0;

        // Allow access if user owns the toolbox OR user is admin
        if (toolbox.user_id !== userId && !isAdmin) {
            throw new Error('User is not authorized to manage this tool instance.');
        }
        if (toolbox.status !== 'active') {
             throw new Error(`Toolbox is not active. Current status: ${toolbox.status}`);
        }

        if (typeof toolbox.public_ip_address !== 'string' || !toolbox.public_ip_address) {
            console.error('Toolbox public_ip_address is missing or not a string:', toolbox.public_ip_address);
            throw new Error('Toolbox public IP address is invalid or not available.');
        }

        return { instance, toolbox: toolbox as AccountToolEnvironmentRecord & { public_ip_address: string } };
    }

    private async _callDtmaApi(
        toolboxIp: string, 
        method: 'POST' | 'DELETE',
        path: string,
        payload?: object
    ): Promise<any> {
        const dtmaPort = Deno.env.get('DTMA_PORT') || '30000';
        const backendToDtmaApiKey = Deno.env.get('BACKEND_TO_DTMA_API_KEY');
        if (!backendToDtmaApiKey) {
            throw new Error('BACKEND_TO_DTMA_API_KEY is not configured for DTMA API calls.');
        }

        const dtmaApiUrl = `http://${toolboxIp}:${dtmaPort}${path}`;
        console.log(`Calling DTMA API: ${method} ${dtmaApiUrl}`, payload || '');

        const response = await fetch(dtmaApiUrl, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${backendToDtmaApiKey}`,
            },
            body: payload ? JSON.stringify(payload) : undefined,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`DTMA API request failed to ${dtmaApiUrl} with status ${response.status}: ${errorBody}`);
            throw new Error(`DTMA API request failed: ${response.status} ${errorBody}`);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            try {
                return await response.json();
            } catch (e) {
                console.error('Failed to parse JSON response from DTMA:', e);
                return { success: true, message: 'DTMA request successful, but response was not valid JSON.', error: (e as Error).message };
            }
        }
        return { success: true, message: await response.text() || 'DTMA request successful' };
    }

    /**
     * Removes a tool instance from a Toolbox by commanding the DTMA.
     * WBS 2A.1.3
     */
    async removeToolFromToolbox(options: ManageToolInstanceOptions): Promise<AccountToolInstanceRecord> {
        const { instance, toolbox } = await this._getToolboxAndInstanceForManagement(options.accountToolInstanceId, options.userId);

        let updatedInstance = await this.updateToolInstance(instance.id, {
            status_on_toolbox: 'pending_delete' as AccountToolInstallationStatusEnum,
        });

        try {
            await this._callDtmaApi(
                toolbox.public_ip_address, 
                'DELETE',
                `/tools/${instance.instance_name_on_toolbox}`
            );
            updatedInstance = await this.updateToolInstance(instance.id, {
                status_on_toolbox: 'deleting' as AccountToolInstallationStatusEnum,
            });
        } catch (error: any) {
            console.error('Error removing tool from DTMA or updating status:', error);
            updatedInstance = await this.updateToolInstance(instance.id, {
                status_on_toolbox: 'error_deleting' as AccountToolInstallationStatusEnum,
                // instance_error_message: error.message, // Temporarily removed
            });
            throw error; 
        }
        return updatedInstance;
    }

    /**
     * Starts a stopped tool instance on a Toolbox by commanding the DTMA.
     * WBS 2A.1.3
     */
    async startToolOnToolbox(options: ManageToolInstanceOptions): Promise<AccountToolInstanceRecord> {
        const { instance, toolbox } = await this._getToolboxAndInstanceForManagement(options.accountToolInstanceId, options.userId);

        if (instance.status_on_toolbox !== 'stopped') {
            throw new Error(`Tool instance must be in 'stopped' state to be started. Current state: ${instance.status_on_toolbox}`);
        }

        let updatedInstance = await this.updateToolInstance(instance.id, {
            status_on_toolbox: 'starting_on_toolbox' as AccountToolInstallationStatusEnum, 
        });

        try {
            await this._callDtmaApi(
                toolbox.public_ip_address, 
                'POST',
                `/tools/${instance.instance_name_on_toolbox}/start`
            );
            updatedInstance = await this.updateToolInstance(instance.id, {
                status_on_toolbox: 'running' as AccountToolInstallationStatusEnum,
            });
        } catch (error: any) {
            console.error('Error starting tool on DTMA or updating status:', error);
            updatedInstance = await this.updateToolInstance(instance.id, {
                status_on_toolbox: 'error_starting' as AccountToolInstallationStatusEnum, 
                // instance_error_message: error.message, // Temporarily removed
            });
            throw error;
        }
        return updatedInstance;
    }

    /**
     * Stops a running tool instance on a Toolbox by commanding the DTMA.
     * WBS 2A.1.3
     */
    async stopToolOnToolbox(options: ManageToolInstanceOptions): Promise<AccountToolInstanceRecord> {
        const { instance, toolbox } = await this._getToolboxAndInstanceForManagement(options.accountToolInstanceId, options.userId);

        if (instance.status_on_toolbox !== 'running') {
            throw new Error(`Tool instance must be in 'running' state to be stopped. Current state: ${instance.status_on_toolbox}`);
        }

        let updatedInstance = await this.updateToolInstance(instance.id, {
            status_on_toolbox: 'stopping_on_toolbox' as AccountToolInstallationStatusEnum,
        });

        try {
            await this._callDtmaApi(
                toolbox.public_ip_address, 
                'POST',
                `/tools/${instance.instance_name_on_toolbox}/stop`
            );
            updatedInstance = await this.updateToolInstance(instance.id, {
                status_on_toolbox: 'stopped' as AccountToolInstallationStatusEnum,
            });
        } catch (error: any) {
            console.error('Error stopping tool on DTMA or updating status:', error);
            updatedInstance = await this.updateToolInstance(instance.id, {
                status_on_toolbox: 'error_stopping' as AccountToolInstallationStatusEnum, 
                // instance_error_message: error.message, // Temporarily removed
            });
            throw error;
        }
        return updatedInstance;
    }

    /**
     * WBS 2A.1.4: Placeholder for status reconciliation logic.
     * Fetches the current status of a specific tool instance directly from the DTMA
     * and updates the database record if necessary.
     * This can be used for on-demand status checks or to reconcile discrepancies.
     */
    async refreshInstanceStatusFromDtma(options: ManageToolInstanceOptions): Promise<AccountToolInstanceRecord> {
        // This would involve:
        // 1. Getting toolbox IP from options.accountToolEnvironmentId (or instance.account_tool_environment_id)
        // 2. Calling DTMA's GET /status or a specific GET /tools/{instanceNameOnToolbox}/status endpoint
        // 3. Parsing the response for the specific instance
        // 4. Updating the DB record.
        // This is slightly different from being called *after* AccountEnvironmentService already called /status
        console.warn("ToolInstanceService.refreshInstanceStatusFromDtma is a placeholder and not fully implemented for direct DTMA query.");
        
        const instance = await this.getToolInstanceById(options.accountToolInstanceId);
        if (!instance) {
            throw new Error('Tool instance not found');
        }
        // For now, just return the instance without actual refresh via DTMA.
        // TODO: Implement direct DTMA query if needed for single instance refresh.
        return instance; 
    }

    /**
     * Updates a tool instance's status and runtime details based on a report
     * received from the DTMA (typically from the DTMA's /status endpoint payload).
     * This method is called by AccountEnvironmentService.
     * WBS 2A.1.4
     */
    async updateToolInstanceDetailsFromDtmaReport(
        accountToolInstanceId: string,
        statusFromDtma: string, // e.g., "running", "exited"
        runtimeDetailsFromDtma?: Json, // Raw state/details from DTMA for this instance
        lastHeartbeatTime?: string // Optional: timestamp of the DTMA report
    ): Promise<AccountToolInstanceRecord | null> {
        const existingInstance = await this.getToolInstanceById(accountToolInstanceId);
        if (!existingInstance) {
            console.warn(`Tool instance ${accountToolInstanceId} not found. Cannot update from DTMA report.`);
            return null;
        }

        const newStatus = mapDtmaStatusToInstallationStatus(statusFromDtma);

        const updates: Partial<AccountToolInstanceUpdate> = {
            status_on_toolbox: newStatus,
            last_heartbeat_from_dtma: lastHeartbeatTime || new Date().toISOString(), // Corrected field name
            // runtime_details: runtimeDetailsFromDtma, // Removed as column was dropped
        };

        if (runtimeDetailsFromDtma) {
            const details = runtimeDetailsFromDtma as any;
            if (typeof details.instance_name_on_toolbox === 'string') {
                updates.instance_name_on_toolbox = details.instance_name_on_toolbox;
            }
            // version from DTMA could also be updated here if applicable
            // e.g., if (typeof details.version === 'string') { updates.version = details.version; }

            if (details.container_id) {
                console.log(`[ToolInstanceService] DTMA reported container_id: ${details.container_id} for instance ${accountToolInstanceId}. Not stored in a dedicated column.`);
            }
            if (details.metrics) {
                console.log(`[ToolInstanceService] DTMA reported metrics for instance ${accountToolInstanceId}. Not stored in a dedicated column. Metrics:`, details.metrics);
            }
        }

        if (Object.keys(updates).length === 0) {
            console.log(`[ToolInstanceService] No effective changes to update for instance ${accountToolInstanceId} from DTMA report.`);
            return existingInstance; // Return the existing record if no actual updates are made
        }

        try {
            const { data, error } = await this.supabase
                .from('account_tool_instances')
                .update(updates)
                .eq('id', accountToolInstanceId)
                .select()
                .single();

            if (error) {
                console.error(`Error updating tool instance ${accountToolInstanceId} from DTMA report:`, error);
                throw error;
            }
            console.log(`Tool instance ${accountToolInstanceId} updated successfully from DTMA report.`);
            return data as AccountToolInstanceRecord;
        } catch (error) {
            // Catch block added to prevent unhandled promise rejection if DB update fails
            console.error(`Failed to apply updates to tool instance ${accountToolInstanceId} from DTMA report in DB:`, error);
            return null; // Or rethrow, depending on desired error handling
        }
    }
}

function mapDtmaStatusToInstallationStatus(dtmaStatus: string): AccountToolInstallationStatusEnum {
    // Based on DTMA status strings (e.g., from dtma/src/index.ts ManagedToolInstanceStatus)
    // and target ENUM account_tool_installation_status_enum
    // (pending_deploy, deploying, running, stopped, error, pending_delete, deleting)
    // DTMA states: PENDING, STARTING, RUNNING, STOPPING, STOPPED, ERROR, UNKNOWN
    switch (dtmaStatus?.toUpperCase()) {
        case 'PENDING':
        case 'STARTING': // Or map to 'deploying' if that's more fitting for initial start
            return 'deploying'; 
        case 'RUNNING':
            return 'running';
        case 'STOPPING':
            return 'deploying'; // Using 'deploying' as a generic transition state, consider 'pending_delete' if it implies removal
        case 'STOPPED':
            return 'stopped';
        case 'ERROR':
            return 'error';
        case 'UNKNOWN':
        default:
            console.warn(`Unknown DTMA status: ${dtmaStatus}. Mapping to 'error'.`);
            return 'error'; // Default to error or a specific 'unknown' state if added to ENUM
    }
}

// Example of how this service might be instantiated and used:
// import { createClient } from '@supabase/supabase-js';
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_KEY;
// if (!supabaseUrl || !supabaseKey) {
//     throw new Error("Supabase URL or Key is not defined in environment variables.");
// }
// const supabase = createClient<Database>(supabaseUrl, supabaseKey); // Generic for Database
// const toolInstanceService = new ToolInstanceService(supabase); 