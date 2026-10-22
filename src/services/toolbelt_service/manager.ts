import { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types.ts';

// Define necessary types from the database schema
export type AgentToolbeltItemRecord = Database['public']['Tables']['agent_toolbelt_items']['Row'];
export type AgentToolbeltItemInsert = Database['public']['Tables']['agent_toolbelt_items']['Insert'];
export type AgentToolbeltItemUpdate = Database['public']['Tables']['agent_toolbelt_items']['Update'];

export type AgentToolCredentialRecord = Database['public']['Tables']['agent_tool_credentials']['Row'];
export type AgentToolCredentialInsert = Database['public']['Tables']['agent_tool_credentials']['Insert'];
// Update for credentials might be more specific, e.g., re-authenticating or changing status
// export type AgentToolCredentialUpdate = Database['public']['Tables']['agent_tool_credentials']['Update'];

export type AgentToolCapabilityPermissionRecord = Database['public']['Tables']['agent_tool_capability_permissions']['Row'];
export type AgentToolCapabilityPermissionInsert = Database['public']['Tables']['agent_tool_capability_permissions']['Insert'];
export type AgentToolCapabilityPermissionUpdate = Database['public']['Tables']['agent_tool_capability_permissions']['Update'];

// WBS 2A.2.1: Options for creating a toolbelt item - CORRECTED
export interface AddToolToAgentToolbeltOptions {
    agent_id: string;
    account_tool_instance_id: string;
    is_active_for_agent?: boolean; // Corrected name, optional
}

// WBS 2A.2.2: Options for managing agent tool credentials
export interface ConnectAgentToolCredentialOptions {
    agent_toolbelt_item_id: string;
    credential_type: string; // e.g., 'api_key', 'oauth2_token_set'
    credential_value: Json; // The actual sensitive credential data. Will be stringified for Vault.
    account_identifier?: string; // e.g., masked email, for display
    status?: Database['public']['Enums']['agent_tool_credential_status_enum']; 
}

// WBS 2A.2.3: Options for managing capability permissions
export interface SetAgentToolCapabilityPermissionOptions {
    agent_toolbelt_item_id: string;
    capability_name: string; // As defined in tool_catalog.capabilities_schema_json
    is_permitted: boolean;
    // Optional: agent_id for authorization if not derivable from toolbelt_item_id context
    agent_id?: string; 
}


export class ToolbeltService {
    private supabase: SupabaseClient<Database>;

    constructor(supabaseClient: SupabaseClient<Database>) {
        this.supabase = supabaseClient;
    }

    // --- Agent Toolbelt Item Management (WBS 2A.2.1) ---

    async addToolToAgentToolbelt(options: AddToolToAgentToolbeltOptions): Promise<AgentToolbeltItemRecord> {
        if (!options.agent_id || !options.account_tool_instance_id) {
            throw new Error('Agent ID and Account Tool Instance ID are required to add a tool to the toolbelt.');
        }

        // TODO: Add authorization logic: Ensure the calling user/agent has permission to modify this agent_id's toolbelt
        // TODO: Add validation: Ensure options.account_tool_instance_id refers to an existing and active tool instance.

        const insertData: AgentToolbeltItemInsert = {
            agent_id: options.agent_id,
            account_tool_instance_id: options.account_tool_instance_id,
            // Use the corrected field name 'is_active_for_agent'
            // Default to true if not specified, as per table schema DEFAULT TRUE
            is_active_for_agent: options.is_active_for_agent === undefined ? true : options.is_active_for_agent,
        };

        const { data, error } = await this.supabase
            .from('agent_toolbelt_items')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Error adding tool to agent toolbelt:', error);
            throw new Error(`Failed to add tool to toolbelt: ${error.message}`);
        }

        if (!data) {
            throw new Error('Failed to add tool to toolbelt: No data returned after insert.');
        }

        return data;
    }

    async getAgentToolbeltItemById(toolbeltItemId: string): Promise<AgentToolbeltItemRecord | null> {
        if (!toolbeltItemId) {
            throw new Error('Toolbelt Item ID is required.');
        }

        // TODO: Authorization: Ensure the caller has rights to access this specific toolbelt item.
        // This might involve checking against the agent_id linked to this item, and then the user owning that agent.

        const { data, error } = await this.supabase
            .from('agent_toolbelt_items')
            .select('*')
            .eq('id', toolbeltItemId)
            .maybeSingle(); // Use maybeSingle() as the item might not exist

        if (error) {
            console.error(`Error fetching agent toolbelt item by ID (${toolbeltItemId}):`, error);
            throw new Error(`Failed to fetch toolbelt item: ${error.message}`);
        }

        return data; // Returns the record or null if not found
    }

    async getAgentToolbeltItems(agentId: string): Promise<AgentToolbeltItemRecord[]> {
        if (!agentId) {
            throw new Error('Agent ID is required to fetch toolbelt items.');
        }

        // TODO: Authorization: Ensure the caller has rights to access toolbelt items for this agent_id.

        const { data, error } = await this.supabase
            .from('agent_toolbelt_items')
            .select('*')
            .eq('agent_id', agentId);

        if (error) {
            console.error(`Error fetching toolbelt items for agent (${agentId}):`, error);
            throw new Error(`Failed to fetch toolbelt items for agent: ${error.message}`);
        }

        return data || []; // Returns the array of records or an empty array if none found
    }

    async updateAgentToolbeltItem(toolbeltItemId: string, updates: Partial<AgentToolbeltItemUpdate>): Promise<AgentToolbeltItemRecord> {
        if (!toolbeltItemId) {
            throw new Error('Toolbelt Item ID is required for an update.');
        }
        if (Object.keys(updates).length === 0) {
            // Optionally, could return the existing item or throw a different error if no updates are provided.
            throw new Error('No updates provided for the toolbelt item.');
        }

        // TODO: Authorization: Ensure the caller has rights to update this toolbelt item.
        // TODO: Validation: Validate the fields in 'updates' against schema or business rules.
        //       For example, ensure agent_id or account_tool_instance_id are not changed if they are meant to be immutable post-creation.
        //       The AgentToolbeltItemUpdate type should already restrict changing id, agent_id, account_tool_instance_id, created_at by default if Omit<> is used.

        // Ensure `updated_at` is handled by the database trigger `trigger_set_timestamp`.
        // If not, it should be added here: updates.updated_at = new Date().toISOString();

        const { data, error } = await this.supabase
            .from('agent_toolbelt_items')
            .update(updates)
            .eq('id', toolbeltItemId)
            .select()
            .single();

        if (error) {
            console.error(`Error updating agent toolbelt item (${toolbeltItemId}):`, error);
            throw new Error(`Failed to update toolbelt item: ${error.message}`);
        }
        
        if (!data) {
            // This could happen if the item to update was not found with the given toolbeltItemId
            throw new Error('Failed to update toolbelt item: Item not found or no data returned.');
        }

        return data;
    }

    async removeToolFromAgentToolbelt(toolbeltItemId: string): Promise<void> {
        if (!toolbeltItemId) {
            throw new Error('Toolbelt Item ID is required for removal.');
        }

        // TODO: Authorization: Ensure the caller has rights to remove this toolbelt item.

        // Business Logic Consideration:
        // When a toolbelt item is removed, what happens to associated:
        // - agent_tool_credentials ? (Should they be deleted? Requires Vault secret deletion too)
        // - agent_tool_capability_permissions ? (Should they be deleted?)
        // For now, this method will only delete the agent_toolbelt_items record.
        // Cascade deletes in the DB (ON DELETE CASCADE) for FKs might handle related records.
        // Need to check FK definitions for agent_tool_credentials and agent_tool_capability_permissions.
        // From migration: Both have ON DELETE CASCADE for agent_toolbelt_item_id. So they will be auto-deleted.

        const { error } = await this.supabase
            .from('agent_toolbelt_items')
            .delete()
            .eq('id', toolbeltItemId);

        if (error) {
            console.error(`Error removing tool from agent toolbelt (${toolbeltItemId}):`, error);
            throw new Error(`Failed to remove tool from toolbelt: ${error.message}`);
        }
        
        // No data is typically returned from a .delete().single() or similar.
        // Success is indicated by no error.
        // If we wanted to ensure a row was actually deleted, we might need a count or check if it existed first.
        // For simplicity, if no error, assume success.
        console.log(`Toolbelt item ${toolbeltItemId} removed successfully (or did not exist).`);
    }

    // --- Agent Tool Credential Management (WBS 2A.2.2) ---

    async connectAgentToolCredential(options: ConnectAgentToolCredentialOptions): Promise<AgentToolCredentialRecord> {
        if (!options.agent_toolbelt_item_id || !options.credential_type || options.credential_value === undefined) {
            throw new Error('Agent Toolbelt Item ID, Credential Type, and Credential Value are required.');
        }

        // TODO: Authorization: Ensure the caller has rights to add credentials for this toolbelt item.
        // TODO: Validation: Validate agent_toolbelt_item_id exists.
        //                   Validate credential_type against a known set if necessary.

        let vault_secret_id: string;
        try {
            // Step 1: Store the sensitive credential_value in Supabase Vault via an RPC call.
            // The RPC function 'create_vault_secret' is assumed to take the secret and return its ID.
            // The actual name and parameters of this RPC need to be confirmed.
            // We stringify credential_value as RPCs often take simple types or pre-formatted JSON strings.
            const { data: rpcData, error: rpcError } = await this.supabase.rpc('create_vault_secret', {
                secret_value: JSON.stringify(options.credential_value) 
            });

            if (rpcError) {
                console.error('Error calling create_vault_secret RPC:', rpcError);
                throw new Error(`Failed to store credential in Vault: ${rpcError.message}`);
            }
            if (!rpcData) { // Assuming the RPC returns the ID directly or in a known property
                throw new Error('Failed to store credential in Vault: No ID returned from RPC.');
            }
            // Adjust if rpcData is an object like { id: '...' }
            vault_secret_id = rpcData as string; 
        } catch (error: any) {
            console.error('Exception during Vault secret creation:', error);
            // Ensure error is an instance of Error for consistent message access
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Exception storing credential in Vault: ${message}`);
        }
        
        // Step 2: Store the reference (Vault ID) in the agent_tool_credentials table.
        const insertData: AgentToolCredentialInsert = {
            agent_toolbelt_item_id: options.agent_toolbelt_item_id,
            credential_type: options.credential_type,
            encrypted_credentials: vault_secret_id, // This now stores the Vault Secret ID
            account_identifier: options.account_identifier,
            // last_validated_at can be null initially
            status: options.status || 'active', // Default to 'active' if not provided
        };

        const { data: credData, error: credError } = await this.supabase
            .from('agent_tool_credentials')
            .insert(insertData)
            .select()
            .single();

        if (credError) {
            console.error('Error inserting agent tool credential:', credError);
            // TODO: Consideration: If this fails, should we attempt to delete the Vault secret created in step 1?
            // This would require another RPC like `delete_vault_secret(vault_secret_id)`.
            // For now, we'll log and throw.
            throw new Error(`Failed to save tool credential reference: ${credError.message}`);
        }

        if (!credData) {
            throw new Error('Failed to save tool credential reference: No data returned after insert.');
        }

        return credData;
    }

    async getAgentToolCredentialsForToolbeltItem(agentToolbeltItemId: string): Promise<AgentToolCredentialRecord[]> {
        if (!agentToolbeltItemId) {
            throw new Error('Agent Toolbelt Item ID is required.');
        }
        // TODO: Authorization: Ensure caller can access credentials for this toolbelt item.

        const { data, error } = await this.supabase
            .from('agent_tool_credentials')
            .select('*') // Selects all fields, including the vault_secret_id in encrypted_credentials
            .eq('agent_toolbelt_item_id', agentToolbeltItemId);

        if (error) {
            console.error(`Error fetching credentials for toolbelt item (${agentToolbeltItemId}):`, error);
            throw new Error(`Failed to fetch credentials for toolbelt item: ${error.message}`);
        }
        return data || [];
    }
    
    async getAgentToolCredentialById(credentialId: string): Promise<AgentToolCredentialRecord | null> {
        if (!credentialId) {
            throw new Error('Credential ID is required.');
        }
        // TODO: Authorization: Ensure caller can access this specific credential.

        const { data, error } = await this.supabase
            .from('agent_tool_credentials')
            .select('*')
            .eq('id', credentialId)
            .maybeSingle();

        if (error) {
            console.error(`Error fetching credential by ID (${credentialId}):`, error);
            throw new Error(`Failed to fetch credential by ID: ${error.message}`);
        }
        return data;
    }

    async updateAgentToolCredentialStatus(
        credentialId: string, 
        status: Database['public']['Enums']['agent_tool_credential_status_enum'], 
        newCredentialValue?: Json,
        newAccountIdentifier?: string
    ): Promise<AgentToolCredentialRecord> {
        if (!credentialId) {
            throw new Error('Credential ID is required.');
        }

        // TODO: Authorization: Ensure caller can update this credential.

        const updates: Partial<AgentToolCredentialInsert> = { status };
        let oldVaultSecretIdToClean: string | null = null;

        if (newAccountIdentifier !== undefined) {
            updates.account_identifier = newAccountIdentifier;
        }

        if (newCredentialValue !== undefined) {
            // If a new credential value is provided, we need to create a new Vault secret
            // and then update 'encrypted_credentials' with the new Vault ID.
            // We'll also mark the old one for deletion after the DB update.

            // First, fetch the current credential to get the old vault secret ID if it exists.
            const currentCredential = await this.getAgentToolCredentialById(credentialId);
            if (!currentCredential) {
                throw new Error(`Credential with ID ${credentialId} not found for update.`);
            }
            if (currentCredential.encrypted_credentials) {
                oldVaultSecretIdToClean = currentCredential.encrypted_credentials;
            }

            console.log(`Updating credential value for ${credentialId}. Old Vault ID: ${oldVaultSecretIdToClean}`);

            const { data: newSecretRpcData, error: newSecretRpcError } = await this.supabase.rpc('create_vault_secret', { 
                secret_value: JSON.stringify(newCredentialValue) 
                // Consider adding name/description if useful for Vault management
            });

            if (newSecretRpcError) {
                console.error(`Error calling create_vault_secret RPC when updating credential ${credentialId}:`, newSecretRpcError);
                throw new Error(`Failed to create new Vault secret for credential ${credentialId}: ${newSecretRpcError.message}`);
            }
            if (!newSecretRpcData) { // Assuming RPC returns UUID directly
                throw new Error(`Failed to create new Vault secret for credential ${credentialId}: No ID returned from RPC.`);
            }
            updates.encrypted_credentials = newSecretRpcData as string;
            console.log(`New Vault secret ${updates.encrypted_credentials} created for credential ${credentialId}.`);
        }

        const { data, error } = await this.supabase
            .from('agent_tool_credentials')
            .update(updates)
            .eq('id', credentialId)
            .select()
            .single();

        if (error) {
            console.error(`Error updating credential status/value (${credentialId}):`, error);
            // If we created a new vault secret but failed to update the DB, that new secret is orphaned.
            if (updates.encrypted_credentials && updates.encrypted_credentials !== oldVaultSecretIdToClean) {
                console.warn(`DB update for credential ${credentialId} failed after creating new Vault secret ${updates.encrypted_credentials}. This new secret is now orphaned and may need manual deletion.`);
            }
            throw new Error(`Failed to update credential: ${error.message}`);
        }
        if (!data) {
            throw new Error('Failed to update credential: No data returned or credential not found.');
        }

        // After successfully updating the DB record, if an old Vault secret existed
        // and is different from any new one that might have been set, delete the old one.
        if (oldVaultSecretIdToClean && oldVaultSecretIdToClean !== data.encrypted_credentials) {
            console.log(`Attempting to delete old Vault secret ${oldVaultSecretIdToClean} for credential ${credentialId}.`);
            const { data: deleteSuccess, error: deleteRpcError } = await this.supabase.rpc('delete_vault_secret', { secret_id: oldVaultSecretIdToClean });

            if (deleteRpcError) {
                console.error(`Error calling delete_vault_secret RPC for old Vault secret ${oldVaultSecretIdToClean} (credential ${credentialId}):`, deleteRpcError);
                console.warn(`Credential ${credentialId} updated, but old Vault secret ${oldVaultSecretIdToClean} failed to delete. Manual cleanup of old Vault secret may be required. RPC Error: ${deleteRpcError.message}`);
            } else if (deleteSuccess === false) {
                console.warn(`Old Vault secret ${oldVaultSecretIdToClean} (for credential ${credentialId}) was not found in Vault for deletion, or already deleted.`);
            } else {
                console.log(`Old Vault secret ${oldVaultSecretIdToClean} for credential ${credentialId} deleted successfully during update.`);
            }
        }
        return data;
    }

    async removeAgentToolCredential(credentialId: string): Promise<void> {
        if (!credentialId) {
            throw new Error('Credential ID is required for removal.');
        }
        // TODO: Authorization: Ensure caller can remove this credential.

        // Step 1: Retrieve the Vault secret ID BEFORE deleting the DB record.
        const credentialRecord = await this.getAgentToolCredentialById(credentialId);
        if (!credentialRecord) {
            console.warn(`Credential record ${credentialId} not found for removal. Assuming already deleted.`);
            return; // Or throw error if strict existence is required
        }
        const vaultSecretId = credentialRecord.encrypted_credentials;

        // Step 2: Delete the database record.
        const { error: dbDeleteError } = await this.supabase
            .from('agent_tool_credentials')
            .delete()
            .eq('id', credentialId);

        if (dbDeleteError) {
            console.error(`Error deleting agent tool credential record (${credentialId}):`, dbDeleteError);
            throw new Error(`Failed to delete tool credential record: ${dbDeleteError.message}`);
            // If DB delete fails, we DO NOT proceed to delete the Vault secret.
        }

        // Step 3: Securely delete the secret from Supabase Vault using its ID.
        if (vaultSecretId) {
            console.log(`Attempting to delete Vault secret ${vaultSecretId} for credential ${credentialId}.`);
            const { data: deleteSuccess, error: rpcError } = await this.supabase.rpc('delete_vault_secret', { secret_id: vaultSecretId });

            if (rpcError) {
                console.error(`Error calling delete_vault_secret RPC for Vault secret ${vaultSecretId} (credential ${credentialId}):`, rpcError);
                // Critical issue: DB record deleted but Vault secret may remain (orphan).
                // Log for manual cleanup and re-throw to inform the caller of the partial failure.
                throw new Error(`DB record for credential ${credentialId} deleted, but failed to delete associated Vault secret ${vaultSecretId}. Manual cleanup of Vault secret may be required. RPC Error: ${rpcError.message}`);
            }

            if (deleteSuccess === false) { // RPC returns false if secret not found
                 console.warn(`Vault secret ${vaultSecretId} (for credential ${credentialId}) was not found in Vault for deletion, or already deleted.`);
            } else {
                console.log(`Vault secret ${vaultSecretId} for credential ${credentialId} deleted successfully.`);
            }
        } else {
            console.warn(`No Vault secret ID found for credential ${credentialId} during removal. Nothing to delete from Vault.`);
        }
        
        console.log(`Agent tool credential ${credentialId} database record removed successfully.`);
    }

    // --- Agent Tool Capability Permission Management (WBS 2A.2.3) ---

    async setAgentToolCapabilityPermission(options: SetAgentToolCapabilityPermissionOptions): Promise<AgentToolCapabilityPermissionRecord> {
        if (!options.agent_toolbelt_item_id || !options.capability_name) {
            throw new Error('Agent Toolbelt Item ID and Capability Name are required.');
        }

        // TODO: Authorization: Ensure caller can set permissions for this toolbelt item (e.g., based on options.agent_id or derived from toolbelt item).
        // TODO: Validation: 
        //          - Validate agent_toolbelt_item_id exists.
        //          - Validate capability_name is a valid capability for the tool associated with the toolbelt item (requires joining to tool_catalog and checking required_capabilities_schema).
        //            This is complex and might be better handled by a pre-check or a more sophisticated validation layer.
        //            For now, we assume capability_name is valid as provided.

        const upsertData: AgentToolCapabilityPermissionInsert = {
            agent_toolbelt_item_id: options.agent_toolbelt_item_id,
            capability_name: options.capability_name,
            is_allowed: options.is_permitted,
            // id, created_at, updated_at are auto-managed by DB or defaults/triggers
        };

        const { data, error } = await this.supabase
            .from('agent_tool_capability_permissions')
            .upsert(upsertData, {
                onConflict: 'agent_toolbelt_item_id, capability_name', // Specify conflict target for upsert
                // ignoreDuplicates: false, // Default is false, ensures update on conflict
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error setting agent tool capability permission:', error);
            throw new Error(`Failed to set capability permission: ${error.message}`);
        }

        if (!data) {
            throw new Error('Failed to set capability permission: No data returned after upsert.');
        }

        return data;
    }

    async getAgentToolCapabilityPermissions(agentToolbeltItemId: string): Promise<AgentToolCapabilityPermissionRecord[]> {
        if (!agentToolbeltItemId) {
            throw new Error('Agent Toolbelt Item ID is required.');
        }
        // TODO: Authorization: Ensure caller can view permissions for this toolbelt item.

        const { data, error } = await this.supabase
            .from('agent_tool_capability_permissions')
            .select('*')
            .eq('agent_toolbelt_item_id', agentToolbeltItemId);

        if (error) {
            console.error(`Error fetching capability permissions for toolbelt item (${agentToolbeltItemId}):`, error);
            throw new Error(`Failed to fetch capability permissions: ${error.message}`);
        }
        return data || [];
    }
    
    async checkAgentToolCapabilityPermission(agentToolbeltItemId: string, capabilityName: string): Promise<boolean> {
        if (!agentToolbeltItemId || !capabilityName) {
            throw new Error('Agent Toolbelt Item ID and Capability Name are required.');
        }
        // TODO: Authorization: Ensure caller can check this permission.

        const { data, error } = await this.supabase
            .from('agent_tool_capability_permissions')
            .select('is_allowed')
            .eq('agent_toolbelt_item_id', agentToolbeltItemId)
            .eq('capability_name', capabilityName)
            .maybeSingle(); // Expect one or none

        if (error) {
            console.error(`Error checking capability permission (${agentToolbeltItemId}, ${capabilityName}):`, error);
            // If error, assume not permitted for safety, or rethrow
            throw new Error(`Failed to check capability permission: ${error.message}`);
        }

        return data?.is_allowed || false; // If record exists, return its is_allowed, else false (default to not allowed if no specific record)
    }
}

// Example of how this service might be instantiated and used:
// import { createClient } from '@supabase/supabase-js';
// const supabaseUrl = process.env.SUPABASE_URL;
// const supabaseKey = process.env.SUPABASE_KEY;
// if (!supabaseUrl || !supabaseKey) {
//     throw new Error("Supabase URL or Key is not defined in environment variables.");
// }
// const supabase = createClient<Database>(supabaseUrl, supabaseKey);
// const toolbeltService = new ToolbeltService(supabase); 