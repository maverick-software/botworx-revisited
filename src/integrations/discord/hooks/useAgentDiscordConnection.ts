import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AgentDiscordConnection } from '@/types';
import type { BotGuild } from '../types/DiscordTypes';
import { PostgrestError } from '@supabase/supabase-js';

// Define the return type for the hook
export interface UseAgentDiscordConnectionReturn {
  connection: Partial<AgentDiscordConnection> | null;
  // botKey: string | null; // Removed - Don't store/fetch actual key in frontend
  hasCredentials: boolean; // New state to indicate if setup seems complete
  workerStatus: AgentDiscordConnection['worker_status'] | null;
  allGuilds: BotGuild[];
  isActivating: boolean;
  isDeactivating: boolean;
  isGeneratingInvite: boolean;
  isSavingToken: boolean; // New state for token saving
  loading: boolean;
  error: string | null; // Using string for simplicity here
  fetchConnectionDetails: () => Promise<void>;
  updateConnectionField: (field: keyof AgentDiscordConnection, value: any) => void;
  saveDiscordBotToken: (token: string) => Promise<void>; // New function
  // updateBotKey: (key: string) => void; // Removed - Needs secure backend implementation for saving
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  generateInviteLink: () => Promise<string | null>; // Returns the link or null
}

export function useAgentDiscordConnection(agentId: string | undefined): UseAgentDiscordConnectionReturn {
  const [connection, setConnection] = useState<Partial<AgentDiscordConnection> | null>(null);
  // const [botKey, setBotKey] = useState<string | null>(null); // Removed
  const [hasCredentials, setHasCredentials] = useState(false); // New state
  const [workerStatus, setWorkerStatus] = useState<AgentDiscordConnection['worker_status'] | null>(null);
  const [allGuilds, setAllGuilds] = useState<BotGuild[]>([]);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false); // Initialize new state
  const [loading, setLoading] = useState(true); // Start with loading true for initial fetch
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  const fetchConnectionDetails = useCallback(async () => {
    if (!agentId) {
        setConnection(null);
        setWorkerStatus(null);
        setAllGuilds([]);
        setHasCredentials(false);
        setError(null);
        setLoading(false);
        return;
    }
    console.log(`[useAgentDiscordConnection] Fetching connection for agent ${agentId}`);
    setLoading(true);
    setError(null);
    setAllGuilds([]); 

    try {
        const { data: connectionData, error: connectionFetchError } = await supabase
            .from('agent_discord_connections')
            .select('*')
            .eq('agent_id', agentId)
            .maybeSingle();

        if (connectionFetchError) {
            console.error("[useAgentDiscordConnection] Error fetching agent_discord_connections:", connectionFetchError);
            throw connectionFetchError;
        }

        setConnection(connectionData);
        setWorkerStatus(connectionData?.worker_status || 'inactive');

        const basicCredentialsPresent = !!connectionData?.discord_app_id && 
                                      !!connectionData?.discord_public_key;
        
        let fetchedGuildsSuccessfully = false;

        if (basicCredentialsPresent) {
            console.log(`[useAgentDiscordConnection] Basic credentials (AppID/PubKey) found for agent ${agentId}. Attempting to fetch guilds.`);
            try {
                console.log(`[useAgentDiscordConnection] Attempting to fetch guilds now for agent ${agentId}.`);
                const { data: guildsData, error: guildsFetchError } = await supabase.functions.invoke('discord-get-bot-guilds', {
                    body: { agentId: agentId }
                });

                if (guildsFetchError) {
                    console.error(`[useAgentDiscordConnection] Failed to fetch guilds (discord-get-bot-guilds error): ${guildsFetchError.message}`);
                    setError(prev => prev ? `${prev}\nFailed to fetch guilds: ${guildsFetchError.message}` : `Failed to fetch guilds: ${guildsFetchError.message}`);
                } else if (guildsData && Array.isArray(guildsData)) {
                    console.log(`[useAgentDiscordConnection] Successfully fetched ${guildsData.length} guilds for agent ${agentId}.`);
                    setAllGuilds(guildsData as BotGuild[]);
                    fetchedGuildsSuccessfully = true;
                } else {
                    console.warn("[useAgentDiscordConnection] Guilds data from discord-get-bot-guilds was in an unexpected format:", guildsData);
                    setError(prev => prev ? `${prev}\nGuild data format unexpected.` : `Guild data format unexpected.`);
                }
            } catch (invokeError: any) {
                console.error("[useAgentDiscordConnection] Error invoking/processing discord-get-bot-guilds function:", invokeError);
                setError(prev => prev ? `${prev}\n${invokeError.message}` : invokeError.message);
            }
        } else {
            console.log(`[useAgentDiscordConnection] No basic credentials (AppID/PubKey) found for agent ${agentId}. Skipping guild fetch.`);
            setAllGuilds([]); 
        }
        
        setHasCredentials(basicCredentialsPresent);
        console.log(`[useAgentDiscordConnection] Final Credentials Check: basicCredentialsPresent=${basicCredentialsPresent}, Guilds Fetched=${fetchedGuildsSuccessfully} => hasCredentials (UI flag)=${basicCredentialsPresent}`);

    } catch (err: any) { 
        console.error("[useAgentDiscordConnection] Overall error in fetchConnectionDetails:", err);
        setError(err.message || "Failed to load Discord connection details.");
        setConnection(null);
        setWorkerStatus(null);
        setAllGuilds([]);
        setHasCredentials(false);
    } finally {
        setLoading(false);
    }
  }, [agentId]); 

  // Initial fetch
  useEffect(() => {
    if (agentId) { // Only fetch if agentId is present
        fetchConnectionDetails();
    }
  }, [agentId, fetchConnectionDetails]);

  // --- Handlers ---

  const updateConnectionField = useCallback(async (field: keyof AgentDiscordConnection, value: any) => {
    if (!agentId) {
        setError("Cannot update connection: Agent ID missing.");
        return;
    }
    
    // Optimistically update local state
    const newConnectionState = { ...(connection || { agent_id: agentId }), [field]: value } as Partial<AgentDiscordConnection>; 
    setConnection(newConnectionState);
    setError(null);

    try {
        const { error: upsertError } = await supabase
            .from('agent_discord_connections')
            .upsert({ agent_id: agentId, ...newConnectionState }, { onConflict: 'agent_id' })
            .select(); 
        if (upsertError) throw upsertError;
        
        console.log(`[useAgentDiscordConnection] Upserted field ${field} for agent ${agentId}.`);

        const currentBasicCredentials = !!newConnectionState.discord_app_id && !!newConnectionState.discord_public_key;
        setHasCredentials(currentBasicCredentials);

        if (field === 'discord_app_id' || field === 'discord_public_key' || field === 'guild_id') {
            if (currentBasicCredentials) {
                 console.log("[useAgentDiscordConnection] Critical connection field updated. Re-fetching all details.");
                await fetchConnectionDetails(); // Re-fetch everything if critical fields change and basic creds are good
            } else {
                setAllGuilds([]); // Clear guilds if basic creds are no longer met
            }
        }
    } catch (err: any) {
        console.error(`Error upserting connection field ${field}:`, err);
        setError(err.message || `Failed to update ${field}.`);
        // Attempt to revert optimistic update by re-fetching current state
        await fetchConnectionDetails(); 
    }
  }, [agentId, connection, fetchConnectionDetails]);

  const saveDiscordBotToken = useCallback(async (token: string) => {
    if (!agentId) {
      setError("Agent ID is missing, cannot save bot token.");
      return;
    }
    console.log(`[useAgentDiscordConnection] Saving Discord bot token for agent ${agentId}...`);
    setIsSavingToken(true);
    setError(null);
    try {
      const { error: functionError } = await supabase.functions.invoke('update-agent-discord-token', {
        body: { agentId, token: token || null } 
      });
      if (functionError) {
        console.error("[useAgentDiscordConnection] Error from 'update-agent-discord-token' function:", functionError);
        throw new Error(functionError.message || "Failed to save bot token via function.");
      }
      console.log(`[useAgentDiscordConnection] Bot token saved successfully for agent ${agentId}. Re-fetching details.`);
      await fetchConnectionDetails(); 
    } catch (err: any) {
      console.error("Error saving Discord bot token:", err);
      setError(err.message || "Failed to save Discord bot token.");
    } finally {
      setIsSavingToken(false);
    }
  }, [agentId, fetchConnectionDetails]);

  /*
  // Placeholder for secure bot key saving - requires backend function
  const secureUpdateBotKey = useCallback(async (key: string) => {
      if (!agentId) return;
      console.log("[useAgentDiscordConnection] secureUpdateBotKey called (secure persistence TODO)", key ? 'key received' : 'key cleared');
      // TODO: Implement call to Supabase edge function (e.g., 'update-agent-discord-token')
      // This function should handle secure storage (encryption/Vault).
      // Example:
      // try {
      //   setSavingKey(true); // Add loading state if needed
      //   const { error } = await supabase.functions.invoke('update-agent-discord-token', {
      //     body: { agentId, botToken: key } // Send the raw key securely
      //   });
      //   if (error) throw error;
      //   // On success, refetch connection details to update 'hasCredentials' status
      //   await fetchConnectionDetails();
      // } catch (err) {
      //   console.error("Error saving bot key:", err);
      //   setError("Failed to save bot key securely.");
      // } finally {
      //   setSavingKey(false);
      // }
  }, [agentId, fetchConnectionDetails]);
  */

  const activate = useCallback(async () => {
    // Activation requires App ID, Public Key (checked via hasCredentials implicitly) AND a selected Guild
    if (!agentId || !connection?.guild_id || !hasCredentials) {
        setError("Missing Agent ID, Server ID, or incomplete credentials to activate.");
        console.warn(`Activation blocked: agentId=${!!agentId}, guildId=${!!connection?.guild_id}, hasCredentials=${hasCredentials}`);
        return;
    }
    console.log(`[useAgentDiscordConnection] Activating agent ${agentId} on server ${connection.guild_id}`);
    setIsActivating(true);
    setWorkerStatus('activating'); // Optimistic UI update
    setError(null);
    try {
       const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
         body: { action: 'start', agentId, guildId: connection.guild_id }
       });
       if (invokeError) throw invokeError;
       console.log(`[useAgentDiscordConnection] Activation request successful for agent ${agentId}`);
       await fetchConnectionDetails();
    } catch (err: any) {
      console.error("Error activating agent:", err);
      setError(err.message || "Failed to activate agent.");
      await fetchConnectionDetails();
    } finally {
      setIsActivating(false);
    }
  }, [agentId, connection, fetchConnectionDetails, hasCredentials]);

  const deactivate = useCallback(async () => {
    if (!agentId) {
        setError("Missing Agent ID to deactivate.");
        return;
    }
     console.log(`[useAgentDiscordConnection] Deactivating agent ${agentId}`);
    setIsDeactivating(true);
    setWorkerStatus('stopping'); // Optimistic UI update
    setError(null);
    try {
        const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
           body: { action: 'stop', agentId }
         });
       if (invokeError) throw invokeError;
       console.log(`[useAgentDiscordConnection] Deactivation request successful for agent ${agentId}`);
       await fetchConnectionDetails();
    } catch (err: any) {
      console.error("Error deactivating agent:", err);
      setError(err.message || "Failed to deactivate agent.");
      await fetchConnectionDetails();
    } finally {
      setIsDeactivating(false);
    }
  }, [agentId, fetchConnectionDetails]);

  const generateInviteLink = useCallback(async (): Promise<string | null> => {
    // Keeping client-side generation for now as per investigation
    if (!connection?.discord_app_id) {
        setError("Missing Discord App ID to generate invite link.");
        return null;
    }
     console.log(`[useAgentDiscordConnection] Generating client-side invite link for app ${connection.discord_app_id}`);
    setIsGeneratingInvite(true);
    setError(null);
    try {
        // TODO: Ideally call backend function/Discord API to generate link for better permission control.
        // Using client-side generation based on current implementation findings.
        const permissions = 8; // Administrator permissions for example - consider reducing scope
        const invite = `https://discord.com/api/oauth2/authorize?client_id=${connection.discord_app_id}&permissions=${permissions}&scope=bot%20applications.commands`;

        // Simulate slight delay and copy to clipboard
        await new Promise(res => setTimeout(res, 500));
        await navigator.clipboard.writeText(invite);
        console.log(`[useAgentDiscordConnection] Invite link generated and copied (client-side)`);

        // Return the link (though the primary action is copying)
        return invite;
    } catch (err: any) {
        console.error("Error generating/copying invite link:", err);
        setError(err.message || "Failed to generate or copy invite link.");
        return null;
    } finally {
        setIsGeneratingInvite(false); // Reset state after copy/error
        // Set a brief timeout to show "Copied!" state in UI if needed elsewhere
        setTimeout(() => setIsGeneratingInvite(false), 1500);
    }
  }, [connection?.discord_app_id]);

  return {
    connection,
    // botKey, // Removed
    hasCredentials, // Added
    workerStatus,
    allGuilds,
    isActivating,
    isDeactivating,
    isGeneratingInvite,
    isSavingToken, // Export new state
    loading,
    error,
    fetchConnectionDetails,
    updateConnectionField,
    saveDiscordBotToken, // Export new function
    // updateBotKey, // Removed - See secureUpdateBotKey placeholder
    activate,
    deactivate,
    generateInviteLink,
  };
} 