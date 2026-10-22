import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Check, 
  MessageSquare
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useConnections } from '@/integrations/_shared/hooks/useConnections';
import { toast } from 'react-hot-toast';
import type { Datastore } from '@/types';
import { AgentDatastoreSelector } from '@/components/agent-edit/AgentDatastoreSelector';


interface MemoryTabProps {
  agentId: string;
  agentData?: {
    name?: string;
    agent_datastores?: { datastore_id: string }[];
  };
  onAgentUpdated?: (updatedData: any) => void;
}


export function MemoryTab({ agentId, agentData, onAgentUpdated }: MemoryTabProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { connections } = useConnections({ includeRevoked: false });
  
  // Data state
  const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]);
  const [selectedDatastoreId, setSelectedDatastoreId] = useState<string | null>(null);
  const [vectorMemoryEnabled, setVectorMemoryEnabled] = useState<boolean>(false);
  const [contextHistorySize, setContextHistorySize] = useState<number>(
    parseInt(localStorage.getItem(`agent_${agentId}_context_size`) || '25')
  );
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingDatastores, setLoadingDatastores] = useState(true);
  const [agentSettings, setAgentSettings] = useState<Record<string, any>>({});
  const [agentMetadata, setAgentMetadata] = useState<Record<string, any>>({});
  const [graphEnabled, setGraphEnabled] = useState<boolean>(false);
  
  // Check if user has GetZep credentials available
  const hasGetZepCredentials = connections.some(c => 
    c.provider_name === 'getzep' && 
    c.connection_status === 'active'
  );
  


  // Load available datastores and current connections
  useEffect(() => {
    if (user) {
      loadDatastores();
    }
  }, [user]);

  // Load agent settings from agentData prop (updated by parent)
  useEffect(() => {
    if (agentData?.metadata) {
      const meta = agentData.metadata as Record<string, any>;
      setAgentMetadata(meta);
      const settings = (meta.settings || {}) as Record<string, any>;
      setAgentSettings(settings);
      setGraphEnabled(settings.use_account_graph === true);
      
      console.log('[MemoryTab] Loaded settings from agentData:', { settings, meta });
    } else {
      // Fallback for initial load if agentData doesn't have metadata
      setAgentMetadata({});
      setAgentSettings({});
      setGraphEnabled(false);
    }
  }, [agentData?.metadata]);

  // Initialize selected datastore from agent data or fetch if needed
  useEffect(() => {
    const loadDatastoreConnections = async () => {
      if (!agentId || !user) return;
      
      try {
        // Fetch current datastore connections for this agent
        const { data: connections, error } = await supabase
          .from('agent_datastores')
          .select('*')
          .eq('agent_id', agentId);
        
        if (error) {
          console.warn('Error loading agent datastore connections:', error);
          setSelectedDatastoreId(null);
          setVectorMemoryEnabled(false);
          return;
        }
        
        if (connections && connections.length > 0) {
          // Get the first (and should be only) connected datastore
          const firstConnection = connections[0];
          setSelectedDatastoreId(firstConnection.datastore_id);
          setVectorMemoryEnabled(true);
        } else {
          setSelectedDatastoreId(null);
          setVectorMemoryEnabled(false);
        }
      } catch (err) {
        console.warn('Error in loadDatastoreConnections:', err);
        setSelectedDatastoreId(null);
        setVectorMemoryEnabled(false);
      }
    };
    
    // Load datastore connections when component mounts or agentId changes
    loadDatastoreConnections();
  }, [agentId, user, supabase]);

  const loadDatastores = async () => {
    if (!user) return;
    
    setLoadingDatastores(true);
    try {
      const { data, error } = await supabase
        .from('datastores')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'pinecone') // Only load vector datastores (Pinecone)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailableDatastores(data || []);
    } catch (error) {
      console.error('Error loading datastores:', error);
      toast.error('Failed to load datastores');
    } finally {
      setLoadingDatastores(false);
    }
  };



  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    
    try {
      // Save datastore connection (single datastore only)
      const { error: deleteError } = await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', agentId);

      if (deleteError) throw deleteError;

      if (vectorMemoryEnabled && selectedDatastoreId) {
        const { error: insertError } = await supabase
          .from('agent_datastores')
          .insert({
            agent_id: agentId,
            datastore_id: selectedDatastoreId
          });

        if (insertError) throw insertError;
      }

      // Save agent metadata
      const updatedMetadata = {
        ...agentMetadata,
        settings: {
          ...agentSettings,
          use_account_graph: graphEnabled && hasGetZepCredentials, // Only save if credentials are available
          context_history_size: contextHistorySize
        }
      };

      const { error: updateError } = await supabase
        .from('agents')
        .update({ metadata: updatedMetadata })
        .eq('id', agentId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Save context size to localStorage
      localStorage.setItem(`agent_${agentId}_context_size`, contextHistorySize.toString());

      toast.success('Memory settings updated successfully! 🧠');
      
      // Show saved state for 2 seconds
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
      }, 2000);
      
      // Don't call onAgentUpdated to avoid triggering unnecessary database updates
      // The Memory tab manages its own state and we've already saved everything needed
      // If we need to refresh parent data, it should be done through a separate refresh mechanism
      
    } catch (error: any) {
      console.error('Error updating memory settings:', error);
      toast.error('Failed to update memory settings');
    } finally {
      setLoading(false);
    }
  }, [agentId, user, vectorMemoryEnabled, selectedDatastoreId, agentMetadata, agentSettings, graphEnabled, contextHistorySize, hasGetZepCredentials, supabase, onAgentUpdated]);


  const handleVectorMemoryToggle = (enabled: boolean) => {
    setVectorMemoryEnabled(enabled);
    if (!enabled) {
      setSelectedDatastoreId(null);
    } else if (availableDatastores.length > 0 && !selectedDatastoreId) {
      // Auto-select first datastore if none selected
      setSelectedDatastoreId(availableDatastores[0].id);
    }
  };

  const handleDatastoreSelection = (datastoreId: string) => {
    setSelectedDatastoreId(datastoreId);
  };


  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Memory & Knowledge</h3>
        <p className="text-sm text-muted-foreground">
          Configure context, knowledge sources, and documents for your agent.
        </p>
      </div>

      {/* Context Settings */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Context & History</span>
          </CardTitle>
          <CardDescription>
            Control how much conversation history your agent remembers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base">Context History Size: {contextHistorySize} messages</Label>
            </div>
            <Slider
              value={[contextHistorySize]}
              onValueChange={(value) => setContextHistorySize(value[0])}
              max={100}
              min={5}
              step={5}
              className="w-full max-w-md"
            />
            <p className="text-xs text-muted-foreground">
              Higher values allow longer conversations but may increase response time and cost.
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Long Term Memory - Using AgentDatastoreSelector */}
      <AgentDatastoreSelector
        agentId={agentId}
        availableDatastores={availableDatastores}
        selectedVectorStore={selectedDatastoreId}
        onSelectDatastore={(type, value) => {
          setSelectedDatastoreId(value);
          setVectorMemoryEnabled(!!value);
        }}
        onConnectDatastores={handleSave}
        loadingAvailable={loadingDatastores}
        connecting={loading}
        onDatastoresUpdated={loadDatastores}
      />

      {/* Account-Wide Knowledge Graph Toggle */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Account-Wide Knowledge Graph</span>
          </CardTitle>
          <CardDescription>
            Enable GetZep knowledge graph to share structured knowledge across all agents in your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center justify-between p-4 rounded-xl bg-accent/30 ${!hasGetZepCredentials ? 'opacity-50' : ''}`}>
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enable Knowledge Graph</Label>
              <div className="text-xs text-muted-foreground">
                {hasGetZepCredentials 
                  ? "Shared across all agents - configure in Knowledge page"
                  : "GetZep credentials required. Configure in Knowledge page."
                }
              </div>
            </div>
            <Switch
              checked={graphEnabled && hasGetZepCredentials}
              onCheckedChange={hasGetZepCredentials ? setGraphEnabled : undefined}
              disabled={!hasGetZepCredentials}
            />
          </div>
        </CardContent>
      </Card>



    </div>
  );
}
