import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Loader2, 
  Check, 
  Database,
  Brain,
  Plus,
  Lightbulb,
  MessageSquare,
  Library,
  FileText
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import type { Datastore } from '@/types';
import { MediaLibrarySelector } from './MediaLibrarySelector';

interface WhatIKnowModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
    agent_datastores?: { datastore_id: string }[];
  };
  onAgentUpdated?: (updatedData: any) => void;
}



const MEMORY_PREFERENCES = [
  {
    id: 'remember_preferences',
    label: 'Remember your preferences',
    description: 'Your communication style, work patterns, and personal preferences'
  },
  {
    id: 'track_projects',
    label: 'Keep track of ongoing projects',
    description: 'Project status, deadlines, and collaborative work details'
  },
  {
    id: 'learn_conversations',
    label: 'Learn from our conversations',
    description: 'Patterns, insights, and context from our chat history'
  },
  {
    id: 'forget_sessions',
    label: 'Forget after each session',
    description: 'Start fresh each time without remembering previous conversations'
  }
];



export function WhatIKnowModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: WhatIKnowModalProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data state
  const [availableDatastores, setAvailableDatastores] = useState<Datastore[]>([]);
  const [connectedDatastores, setConnectedDatastores] = useState<string[]>([]);
  const [memoryPreferences, setMemoryPreferences] = useState<string[]>(['remember_preferences', 'track_projects', 'learn_conversations']);
  const [contextHistorySize, setContextHistorySize] = useState<number>(
    parseInt(localStorage.getItem(`agent_${agentId}_context_size`) || '25')
  );
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingDatastores, setLoadingDatastores] = useState(true);
  const [saved, setSaved] = useState(false);
  const [agentSettings, setAgentSettings] = useState<Record<string, any>>({});
  const [agentMetadata, setAgentMetadata] = useState<Record<string, any>>({});
  const [graphEnabled, setGraphEnabled] = useState<boolean>(false); // default OFF until loaded
  

  
  // Datastore selection modals
  const [showVectorSelection, setShowVectorSelection] = useState(false);
  const [showKnowledgeSelection, setShowKnowledgeSelection] = useState(false);
  
  // Media Library integration
  const [showMediaLibrarySelector, setShowMediaLibrarySelector] = useState(false);
  const [assignedMediaCount, setAssignedMediaCount] = useState(0);

  // Load available datastores and current connections
  useEffect(() => {
    if (isOpen && user) {
      loadDatastores();
      loadAssignedMediaCount();
    }
  }, [isOpen, user]);

  // Load agent settings (to drive centralized graph toggle)
  useEffect(() => {
    const loadAgentSettings = async () => {
      if (!isOpen || !agentId) return;
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('metadata')
          .eq('id', agentId)
          .maybeSingle();
        
        if (error) {
          console.warn('Error loading agent metadata:', error);
          // Initialize with defaults if metadata column doesn't exist yet
          setAgentMetadata({});
          setAgentSettings({});
          setGraphEnabled(false); // Default to false if no metadata
          return;
        }
        
        const meta = (data?.metadata || {}) as Record<string, any>;
        setAgentMetadata(meta);
        const settings = (meta.settings || {}) as Record<string, any>;
        setAgentSettings(settings);
        // Default to false if not explicitly set
        setGraphEnabled(settings.use_account_graph === true);
      } catch (err) {
        console.warn('Error in loadAgentSettings:', err);
        setAgentMetadata({});
        setAgentSettings({});
        setGraphEnabled(false);
      }
    };
    loadAgentSettings();
  }, [isOpen, agentId, supabase]);

  // Initialize connected datastores from agent data
  useEffect(() => {
    if (isOpen && agentData?.agent_datastores) {
      const connected = agentData.agent_datastores.map(ad => ad.datastore_id);
      setConnectedDatastores(connected);
      setSaved(false);
    }
  }, [isOpen, agentData]);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const loadDatastores = useCallback(async () => {
    if (!user) return;
    
    setLoadingDatastores(true);
    try {
      const { data: datastores, error } = await supabase
        .from('datastores')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      setAvailableDatastores(datastores || []);
    } catch (error: any) {
      console.error('Error loading datastores:', error);
      toast.error('Failed to load knowledge sources');
    } finally {
      setLoadingDatastores(false);
    }
  }, [user, supabase]);

  const loadAssignedMediaCount = useCallback(async () => {
    if (!user || !agentId) return;
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media-library-api`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'list_documents',
          agent_id: agentId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAssignedMediaCount(data.data.total_count || 0);
        }
      }
    } catch (error) {
      console.error('Error loading assigned media count:', error);
    }
  }, [user, agentId, supabase]);



  const handleSelectVectorDatastore = () => {
    const vectorDatastores = getDatastoresByType('pinecone');
    const connectedVector = vectorDatastores.find(ds => connectedDatastores.includes(ds.id));
    
    if (connectedVector) {
      // If already connected, disconnect it
      setConnectedDatastores(prev => prev.filter(id => id !== connectedVector.id));
      toast.success('Vector datastore disconnected');
    } else {
      // Always open the vector selection modal (it will handle empty state)
      setShowVectorSelection(true);
    }
  };

  const handleSelectKnowledgeDatastore = () => {
    // Toggle centralized knowledge graph (account-wide) ON/OFF
    toggleGraphEnabled();
  };

  const ensureAccountGraph = async () => {
    try {
      const { data: ag } = await supabase
        .from('account_graphs')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (ag?.id) return true;

      // find GetZep connection
      const { data: provider } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'getzep')
        .single();
      if (!provider) {
        toast.error('GetZep provider not found');
        return false;
      }
      const { data: conn } = await supabase
        .from('user_integration_credentials')
        .select('id')
        .eq('oauth_provider_id', provider.id)
        .eq('user_id', user?.id)
        .maybeSingle();
      if (!conn?.id) {
        toast.error('Connect GetZep in Integrations to enable the knowledge graph');
        return false;
      }
      const { error: insErr } = await supabase
        .from('account_graphs')
        .insert({ user_id: user?.id, connection_id: conn.id, settings: { retrieval: { hop_depth: 2, max_results: 50 } } });
      if (insErr) {
        toast.error('Failed to create account graph');
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  };

  const toggleGraphEnabled = async () => {
    const prev = graphEnabled;
    const next = !prev;
    // Optimistic UI update
    setGraphEnabled(next);
    
    // If enabling, ensure an account_graph exists first; rollback on failure
    if (next) {
      const ok = await ensureAccountGraph();
      if (!ok) {
        setGraphEnabled(prev);
        return; // do not proceed with setting update
      }
    }
    
    try {
      const newSettings = { ...(agentSettings || {}), use_account_graph: next };
      const mergedMetadata = { ...(agentMetadata || {}), settings: newSettings };
      
      const { data, error } = await supabase
        .from('agents')
        .update({ metadata: mergedMetadata })
        .eq('id', agentId)
        .select('metadata')
        .single();
        
      if (error) {
        console.error('Error updating agent metadata:', error);
        throw error;
      }
      
      // Update local state with the returned data to ensure consistency
      if (data?.metadata) {
        setAgentMetadata(data.metadata);
        setAgentSettings(data.metadata.settings || {});
      }
      
      toast.success(next ? 'Knowledge graph enabled' : 'Knowledge graph disabled');
    } catch (e: any) {
      console.error('Failed to toggle knowledge graph:', e);
      setGraphEnabled(prev); // rollback on failure
      toast.error(`Failed to update knowledge graph setting: ${e.message || 'Unknown error'}`);
    }
  };

  const handleToggleMemoryPreference = (preferenceId: string) => {
    if (preferenceId === 'forget_sessions') {
      // Exclusive: if forget_sessions is selected, clear all others
      setMemoryPreferences(prev => 
        prev.includes(preferenceId) ? [] : [preferenceId]
      );
    } else {
      // Remove forget_sessions if selecting any other option
      setMemoryPreferences(prev => {
        const filtered = prev.filter(id => id !== 'forget_sessions');
        return filtered.includes(preferenceId)
          ? filtered.filter(id => id !== preferenceId)
          : [...filtered, preferenceId];
      });
    }
  };

  const handleContextSizeChange = (value: number[]) => {
    const newSize = value[0];
    setContextHistorySize(newSize);
    localStorage.setItem(`agent_${agentId}_context_size`, newSize.toString());
  };

  // Handle datastore selection from modals
  const handleVectorDatastoreSelect = (datastoreId: string) => {
    const datastore = availableDatastores.find(ds => ds.id === datastoreId);
    
    // Remove any existing vector datastores and add the new one
    const vectorDatastoreIds = getDatastoresByType('pinecone').map(ds => ds.id);
    setConnectedDatastores(prev => {
      const withoutOtherVectors = prev.filter(id => !vectorDatastoreIds.includes(id));
      return [...withoutOtherVectors, datastoreId];
    });
    
    setShowVectorSelection(false);
    toast.success(`Connected to vector datastore: ${datastore?.name || 'Unknown'}`);
  };

  const handleKnowledgeDatastoreSelect = (datastoreId: string) => {
    const datastore = availableDatastores.find(ds => ds.id === datastoreId);
    
    // Remove any existing knowledge graph datastores and add the new one
    const knowledgeDatastoreIds = getDatastoresByType('getzep').map(ds => ds.id);
    setConnectedDatastores(prev => {
      const withoutOtherKnowledge = prev.filter(id => !knowledgeDatastoreIds.includes(id));
      return [...withoutOtherKnowledge, datastoreId];
    });
    
    setShowKnowledgeSelection(false);
    toast.success(`Connected to knowledge graph: ${datastore?.name || 'Unknown'}`);
  };



  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    try {
      // Remove all existing connections
      await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', agentId);

      // Add new connections
      if (connectedDatastores.length > 0) {
        const connections = connectedDatastores.map(datastoreId => ({
          agent_id: agentId,
          datastore_id: datastoreId
        }));

        const { error } = await supabase
          .from('agent_datastores')
          .insert(connections);

        if (error) throw error;
      }

      // Here you could also save memory preferences to agent settings/metadata
      // For now, we'll just show success
      
      toast.success('Knowledge connections updated! 🧠');
      setSaved(true);
      
      // Notify parent component
      if (onAgentUpdated) {
        // Fetch updated agent data
        const { data: updatedAgent } = await supabase
          .from('agents')
          .select(`*`)
          .eq('id', agentId)
          .single();
          
        if (updatedAgent) {
          onAgentUpdated(updatedAgent);
        }
      }
      
    } catch (error: any) {
      console.error('Error updating knowledge connections:', error);
      toast.error('Failed to update knowledge connections');
    } finally {
      setLoading(false);
    }
  }, [agentId, connectedDatastores, supabase, onAgentUpdated]);

  const getDatastoresByType = (type: 'pinecone' | 'getzep') => {
    return availableDatastores.filter(ds => ds.type === type);
  };

  const hasChanges = () => {
    if (!agentData?.agent_datastores) return connectedDatastores.length > 0;
    const currentConnections = agentData.agent_datastores.map(ad => ad.datastore_id);
    return JSON.stringify(currentConnections.sort()) !== JSON.stringify(connectedDatastores.sort());
  };



  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
                      <DialogTitle className="text-xl font-semibold flex items-center">
            📚 Knowledge
          </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Connect knowledge sources and set memory preferences so I can be most helpful to you.
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 space-y-6">
            {/* Connected Knowledge Sources */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">
                  What topics am I expert in?
                </Label>
              </div>

              {loadingDatastores ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading knowledge sources...</span>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Vector Datastore Box */}
                  {(() => {
                    const vectorDatastores = getDatastoresByType('pinecone');
                    const connectedVector = vectorDatastores.find(ds => connectedDatastores.includes(ds.id));
                    
                    return (
                      <div
                        className={`border-2 border-dashed rounded-lg p-4 text-center transition-all duration-200 cursor-pointer ${
                          connectedVector
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                            : 'border-muted-foreground/25 hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
                        }`}
                        onClick={handleSelectVectorDatastore}
                      >
                        <Database className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                        {connectedVector ? (
                          <>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Vector Datastore</p>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                              Connected: {connectedVector.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Click to change or disconnect
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium mb-1">Vector Datastore</p>
                            <p className="text-xs text-muted-foreground">
                              {vectorDatastores.length > 0 
                                ? 'Click to select a Pinecone datastore'
                                : 'Click to create a new Pinecone datastore'
                              }
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Knowledge Graph Box */}
                  {(() => {
                    const knowledgeDatastores = getDatastoresByType('getzep');
                    const connectedKnowledge = knowledgeDatastores.find(ds => connectedDatastores.includes(ds.id));
                    
                    return (
                      <div
                        className={`border-2 rounded-lg p-4 text-center transition-all duration-200 cursor-pointer ${
                          graphEnabled
                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                            : 'border-muted-foreground/25 hover:border-green-500/50 hover:bg-green-50/50 dark:hover:bg-green-950/10'
                        }`}
                        onClick={handleSelectKnowledgeDatastore}
                      >
                        <Brain className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        {graphEnabled ? (
                          <>
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">Knowledge Graph Datastore</p>
                            <p className="text-xs text-green-700 dark:text-green-300 mt-1">Enabled (account-wide)</p>
                            <p className="text-xs text-muted-foreground mt-1">Click to disable</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium mb-1">Knowledge Graph Datastore</p>
                            <p className="text-xs text-muted-foreground">Disabled. Click to enable account-wide knowledge graph</p>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Memory Preferences */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                What should I remember from our chats?
              </Label>
              <div className="space-y-2">
                {MEMORY_PREFERENCES.map(preference => {
                  const isSelected = memoryPreferences.includes(preference.id);
                  const isForgetSessions = preference.id === 'forget_sessions';
                  
                  return (
                    <div
                      key={preference.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? isForgetSessions 
                            ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20'
                            : 'border-primary bg-primary/5'
                          : 'border-border hover:border-border hover:bg-accent/50'
                      }`}
                      onClick={() => handleToggleMemoryPreference(preference.id)}
                    >
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => handleToggleMemoryPreference(preference.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{preference.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {preference.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Conversation Context History */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Conversation Memory
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  How many recent messages should I remember from our conversation?
                </p>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Messages to remember:</span>
                  <span className="text-sm font-medium bg-primary/10 px-2 py-1 rounded">
                    {contextHistorySize} {contextHistorySize === 1 ? 'message' : 'messages'}
                  </span>
                </div>
                
                <Slider
                  value={[contextHistorySize]}
                  onValueChange={handleContextSizeChange}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                
                <div className="relative h-6">
                  {/* Main endpoints */}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>100</span>
                  </div>
                  
                  {/* Intermediate markers positioned accurately */}
                  <div className="absolute inset-0 flex items-center">
                    <span className="absolute text-xs text-muted-foreground" style={{ left: '25%', transform: 'translateX(-50%)' }}>
                      25
                    </span>
                    <span className="absolute text-xs text-muted-foreground" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                      50
                    </span>
                    <span className="absolute text-xs text-muted-foreground" style={{ left: '75%', transform: 'translateX(-50%)' }}>
                      75
                    </span>
                  </div>
                  
                  {/* Labels below */}
                  <div className="absolute -bottom-4 inset-x-0 flex justify-between text-xs text-muted-foreground/70">
                    <span className="text-[10px]">No memory</span>
                    <span className="absolute text-[10px]" style={{ left: '25%', transform: 'translateX(-50%)' }}>
                      (default)
                    </span>
                    <span className="text-[10px]">Max context</span>
                  </div>
                </div>
                
                <div className="mt-4"></div>
                
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  {contextHistorySize === 0 
                    ? "I won't remember any previous messages in our conversation."
                    : contextHistorySize <= 10
                    ? "I'll remember only the most recent exchanges."
                    : contextHistorySize <= 25
                    ? "I'll maintain good context of our recent conversation."
                    : contextHistorySize <= 50
                    ? "I'll remember a substantial portion of our conversation history."
                    : "I'll remember extensive conversation history for maximum context."
                  }
                </p>
              </div>
            </div>

            {/* Media Library Section */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Media Library Documents
              </Label>
              
              <Card className="border-2 border-dashed border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/20">
                <CardContent className="p-4 text-center">
                  <Library className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                  <p className="text-sm font-medium mb-1">
                    {assignedMediaCount > 0 
                      ? `${assignedMediaCount} document${assignedMediaCount !== 1 ? 's' : ''} assigned`
                      : 'No documents assigned from Media Library'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Assign documents from your centralized media library for training data
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowMediaLibrarySelector(true)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Assign from Library
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate('/media')}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Manage Library
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>



            {/* Summary */}
            {(connectedDatastores.length > 0 || memoryPreferences.length > 0) && (
              <div className="p-4 bg-muted/50 rounded-lg border border-muted">
                <div className="text-sm font-medium mb-2 flex items-center">
                  <Lightbulb className="h-4 w-4 mr-2" />
                  Summary of my knowledge setup:
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Connected to {connectedDatastores.length} knowledge source{connectedDatastores.length !== 1 ? 's' : ''}</li>
                  <li>• {memoryPreferences.includes('forget_sessions') ? 'Will forget after each session' : `Will remember ${memoryPreferences.length} type${memoryPreferences.length !== 1 ? 's' : ''} of information`}</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={loading || !hasChanges()}
              className="min-w-[140px]"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="mr-2 h-4 w-4" />
              ) : null}
              {loading ? 'Saving...' : saved ? 'Saved!' : 'Update My Knowledge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media Library Selector Modal */}
      <MediaLibrarySelector
        isOpen={showMediaLibrarySelector}
        onClose={() => setShowMediaLibrarySelector(false)}
        agentId={agentId}
        agentName={agentData?.name}
        onMediaAssigned={(assignedMedia) => {
          setAssignedMediaCount(prev => prev + assignedMedia.length);
          toast.success(`Assigned ${assignedMedia.length} document${assignedMedia.length !== 1 ? 's' : ''} from Media Library`);
        }}
        multiSelect={true}
        assignmentType="training_data"
      />

      {/* Vector Datastore Selection Modal */}
      <Dialog open={showVectorSelection} onOpenChange={setShowVectorSelection}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-500" />
              Select Vector Datastore
            </DialogTitle>
            <DialogDescription>
              Choose a Pinecone vector database to connect for semantic search and document embeddings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {getDatastoresByType('pinecone').map((datastore) => (
              <Card 
                key={datastore.id}
                className="cursor-pointer transition-all duration-200 hover:bg-accent hover:border-blue-500"
                onClick={() => handleVectorDatastoreSelect(datastore.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{datastore.name}</h4>
                      {datastore.description && (
                        <p className="text-sm text-muted-foreground">{datastore.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Database className="h-3 w-3" />
                        <span>Pinecone Vector Database</span>
                      </div>
                    </div>
                    <div className="h-2 w-2 bg-green-500 rounded-full" title="Available" />
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {getDatastoresByType('pinecone').length === 0 && (
              <div className="text-center p-6 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No vector datastores available</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    setShowVectorSelection(false);
                    onClose(); // Close the knowledge modal
                    navigate('/memory'); // Navigate to memory/datastores page
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Vector Datastore
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVectorSelection(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge Graph Selection Modal */}
      <Dialog open={showKnowledgeSelection} onOpenChange={setShowKnowledgeSelection}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-green-500" />
              Select Knowledge Graph
            </DialogTitle>
            <DialogDescription>
              Choose a GetZep knowledge graph to connect for entity relationships and contextual understanding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {getDatastoresByType('getzep').map((datastore) => (
              <Card 
                key={datastore.id}
                className="cursor-pointer transition-all duration-200 hover:bg-accent hover:border-green-500"
                onClick={() => handleKnowledgeDatastoreSelect(datastore.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{datastore.name}</h4>
                      {datastore.description && (
                        <p className="text-sm text-muted-foreground">{datastore.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Brain className="h-3 w-3" />
                        <span>GetZep Knowledge Graph</span>
                      </div>
                    </div>
                    <div className="h-2 w-2 bg-green-500 rounded-full" title="Available" />
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {getDatastoresByType('getzep').length === 0 && (
              <div className="text-center p-6 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No knowledge graphs available</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => {
                    setShowKnowledgeSelection(false);
                    onClose(); // Close the knowledge modal
                    navigate('/memory'); // Navigate to memory/datastores page
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Create Knowledge Graph
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKnowledgeSelection(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}