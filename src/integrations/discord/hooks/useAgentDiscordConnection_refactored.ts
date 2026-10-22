import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { AgentDiscordConnection } from '@/types';
import type { BotGuild } from '../types/DiscordTypes'; 

// Identical interface, just for the refactored hook structure
interface UseAgentDiscordConnectionRefactoredReturn {
  connection: Partial<AgentDiscordConnection> | null;
  hasCredentials: boolean; 
  workerStatus: AgentDiscordConnection['worker_status'] | null;
  allGuilds: BotGuild[];
  isActivating: boolean;
  isDeactivating: boolean;
  isGeneratingInvite: boolean;
  isSavingToken: boolean; 
  loading: boolean;
  error: string | null; 
  fetchConnectionDetails: () => Promise<void>;
  updateConnectionField: (field: keyof AgentDiscordConnection, value: any) => void;
  saveDiscordBotToken: (token: string) => Promise<void>; 
  activate: () => Promise<void>;
  deactivate: () => Promise<void>;
  generateInviteLink: () => Promise<string | null>; 
}

// Renamed function
export function useAgentDiscordConnection_refactored(agentId: string | undefined): UseAgentDiscordConnectionRefactoredReturn {
  // ... ALL THE EXISTING LOGIC FROM useAgentDiscordConnection ...
  // Including state variables, fetchConnectionDetails, updateConnectionField, 
  // saveDiscordBotToken, activate, deactivate, generateInviteLink, 
  // useEffects, and the final return statement.
  // --- State Variables --- 
  const [connection, setConnection] = useState<Partial<AgentDiscordConnection> | null>(null);
  const [hasCredentials, setHasCredentials] = useState(false); 
  const [workerStatus, setWorkerStatus] = useState<AgentDiscordConnection['worker_status'] | null>(null);
  const [allGuilds, setAllGuilds] = useState<BotGuild[]>([]);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [isSavingToken, setIsSavingToken] = useState(false); 
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);

  // --- fetchConnectionDetails --- 
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
    console.log(`[useAgentDiscordConnection_refactored] Fetching connection for agent ${agentId}`);
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
            console.error("[useAgentDiscordConnection_refactored] Error fetching agent_discord_connections:", connectionFetchError);
            throw connectionFetchError;
        }

        setConnection(connectionData); 
        setWorkerStatus(connectionData?.worker_status || 'inactive');

        const basicCredentialsPresent = !!connectionData?.discord_app_id && 
                                      !!connectionData?.discord_public_key;
        
        let fetchedGuildsSuccessfully = false;

        if (basicCredentialsPresent) {
            console.log(`[useAgentDiscordConnection_refactored] Basic credentials (AppID/PubKey) found for agent ${agentId}. Attempting to fetch guilds.`);
            try {
                console.log(`[useAgentDiscordConnection_refactored] Attempting to fetch guilds now for agent ${agentId}.`);
                const { data: guildsData, error: guildsFetchError } = await supabase.functions.invoke('discord-get-bot-guilds', {
                    body: { agentId: agentId }
                });

                if (guildsFetchError) {
                    console.error(`[useAgentDiscordConnection_refactored] Failed to fetch guilds (discord-get-bot-guilds error): ${guildsFetchError.message}`);
                    setError(prev => prev ? `${prev}\nFailed to fetch guilds: ${guildsFetchError.message}` : `Failed to fetch guilds: ${guildsFetchError.message}`);
                } else if (guildsData && Array.isArray(guildsData)) {
                    console.log(`[useAgentDiscordConnection_refactored] Successfully fetched ${guildsData.length} guilds for agent ${agentId}.`);
                    setAllGuilds(guildsData as BotGuild[]);
                    fetchedGuildsSuccessfully = true;
                } else {
                    console.warn("[useAgentDiscordConnection_refactored] Guilds data from discord-get-bot-guilds was in an unexpected format:", guildsData);
                    setError(prev => prev ? `${prev}\nGuild data format unexpected.` : `Guild data format unexpected.`);
                }
            } catch (invokeError: any) {
                console.error("[useAgentDiscordConnection_refactored] Error invoking/processing discord-get-bot-guilds function:", invokeError);
                setError(prev => prev ? `${prev}\n${invokeError.message}` : invokeError.message);
            }
        } else {
            console.log(`[useAgentDiscordConnection_refactored] No basic credentials (AppID/PubKey) found for agent ${agentId}. Skipping guild fetch.`);
            setAllGuilds([]); 
        }
        
        setHasCredentials(basicCredentialsPresent);
        console.log(`[useAgentDiscordConnection_refactored] Final Credentials Check: basicCredentialsPresent=${basicCredentialsPresent}, Guilds Fetched=${fetchedGuildsSuccessfully} => hasCredentials (UI flag)=${basicCredentialsPresent}`);

    } catch (err: any) { 
        console.error("[useAgentDiscordConnection_refactored] Overall error in fetchConnectionDetails:", err);
        setError(err.message || "Failed to load Discord connection details.");
        setConnection(null);
        setWorkerStatus(null);
        setAllGuilds([]);
        setHasCredentials(false);
    } finally {
        setLoading(false);
    }
  }, [agentId]); 

  // --- useEffect for Initial Fetch ---
  useEffect(() => {
    if (agentId) { 
        fetchConnectionDetails();
    }
  }, [agentId, fetchConnectionDetails]);

  // --- updateConnectionField --- 
  const updateConnectionField = useCallback(async (field: keyof AgentDiscordConnection, value: any) => {
    if (!agentId) {
        setError("Cannot update connection: Agent ID missing.");
        return;
    }
    
    const newConnectionState = { ...(connection || { agent_id: agentId }), [field]: value } as Partial<AgentDiscordConnection>; 
    setConnection(newConnectionState);
    setError(null);

    try {
        const { error: upsertError } = await supabase
            .from('agent_discord_connections')
            .upsert({ agent_id: agentId, [field]: value }, { onConflict: 'agent_id' }) 
            .select(); 
        if (upsertError) throw upsertError;
        
        console.log(`[useAgentDiscordConnection_refactored] Upserted field ${field} for agent ${agentId}.`);

        const currentBasicCredentials = !!newConnectionState.discord_app_id && !!newConnectionState.discord_public_key;
        setHasCredentials(currentBasicCredentials);
    } catch (err: any) {
        console.error(`Error upserting connection field ${field}:`, err);
        setError(err.message || `Failed to update ${field}.`);
        await fetchConnectionDetails(); 
    }
  }, [agentId, connection, fetchConnectionDetails]);

  // --- saveDiscordBotToken --- 
  const saveDiscordBotToken = useCallback(async (token: string) => {
    if (!agentId) {
      setError("Agent ID is missing, cannot save bot token.");
      return;
    }
    console.log(`[useAgentDiscordConnection_refactored] Saving Discord bot token for agent ${agentId}...`);
    setIsSavingToken(true);
    setError(null);
    try {
      const { error: functionError } = await supabase.functions.invoke('update-agent-discord-token', {
        body: { agentId, token: token || null } 
      });
      if (functionError) {
        console.error("[useAgentDiscordConnection_refactored] Error from 'update-agent-discord-token' function:", functionError);
        throw new Error(functionError.message || "Failed to save bot token via function.");
      }
      console.log(`[useAgentDiscordConnection_refactored] Bot token saved successfully for agent ${agentId}. Re-fetching details.`);
      await fetchConnectionDetails(); 
    } catch (err: any) {
      console.error("Error saving Discord bot token:", err);
      setError(err.message || "Failed to save Discord bot token.");
    } finally {
      setIsSavingToken(false);
    }
  }, [agentId, fetchConnectionDetails]);

  // --- activate --- 
  const activate = useCallback(async () => {
    if (!agentId || !connection?.guild_id || !hasCredentials) {
        setError("Missing Agent ID, Server ID, or incomplete credentials to activate.");
        console.warn(`Activation blocked: agentId=${!!agentId}, guildId=${!!connection?.guild_id}, hasCredentials=${hasCredentials}`);
        return;
    }
    console.log(`[useAgentDiscordConnection_refactored] Activating agent ${agentId} on server ${connection.guild_id}`);
    setIsActivating(true);
    setWorkerStatus('activating'); 
    setError(null);
    try {
       const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
         body: { action: 'start', agentId, guildId: connection.guild_id }
       });
       if (invokeError) throw invokeError;
       console.log(`[useAgentDiscordConnection_refactored] Activation request successful for agent ${agentId}`);
       await fetchConnectionDetails();
    } catch (err: any) {
      console.error("Error activating agent:", err);
      setError(err.message || "Failed to activate agent.");
      await fetchConnectionDetails();
    } finally {
      setIsActivating(false);
    }
  }, [agentId, connection, fetchConnectionDetails, hasCredentials]);

  // --- deactivate --- 
  const deactivate = useCallback(async () => {
    if (!agentId) {
        setError("Missing Agent ID to deactivate.");
        return;
    }
     console.log(`[useAgentDiscordConnection_refactored] Deactivating agent ${agentId}`);
    setIsDeactivating(true);
    setWorkerStatus('stopping'); 
    setError(null);
    try {
        const { error: invokeError } = await supabase.functions.invoke('manage-discord-worker', {
           body: { action: 'stop', agentId }
         });
       if (invokeError) throw invokeError;
       console.log(`[useAgentDiscordConnection_refactored] Deactivation request successful for agent ${agentId}`);
       await fetchConnectionDetails();
    } catch (err: any) {
      console.error("Error deactivating agent:", err);
      setError(err.message || "Failed to deactivate agent.");
      await fetchConnectionDetails();
    } finally {
      setIsDeactivating(false);
    }
  }, [agentId, fetchConnectionDetails]);

  // --- generateInviteLink --- 
  const generateInviteLink = useCallback(async (): Promise<string | null> => {
    if (!connection?.discord_app_id) {
        setError("Missing Discord App ID to generate invite link.");
        return null;
    }
     console.log(`[useAgentDiscordConnection_refactored] Generating client-side invite link for app ${connection.discord_app_id}`);
    setIsGeneratingInvite(true);
    setError(null);
    try {
      const permissions = 8;
      const invite = `https://discord.com/api/oauth2/authorize?client_id=${connection.discord_app_id}&permissions=${permissions}&scope=bot%20applications.commands`;
      await new Promise(res => setTimeout(res, 300)); 
      await navigator.clipboard.writeText(invite);
      console.log(`[useAgentDiscordConnection_refactored] Invite link generated and copied (client-side)`);
      return invite;
    } catch (err: any) {
      console.error("Error generating/copying invite link:", err);
      setError(err.message || "Failed to generate or copy invite link.");
      return null;
    } finally {
      setTimeout(() => setIsGeneratingInvite(false), 1200);
    }
  }, [connection?.discord_app_id]);

  // --- Return Statement --- 
  return {
    connection,
    hasCredentials,
    workerStatus,
    allGuilds,
    isActivating,
    isDeactivating,
    isGeneratingInvite,
    isSavingToken, 
    loading,
    error,
    fetchConnectionDetails,
    updateConnectionField,
    saveDiscordBotToken, 
    activate,
    deactivate,
    generateInviteLink,
  };
} 