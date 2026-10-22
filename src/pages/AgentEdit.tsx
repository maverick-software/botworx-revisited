import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Database, Check } from 'lucide-react';
import MonacoEditor from 'react-monaco-editor';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Agent, Datastore } from '../types';
import { DiscordConnect } from '@/integrations/discord';

interface Agent {
  id: string;
  name: string;
  description: string;
  personality: string;
  active: boolean;
  discord_channel?: string;
  discord_bot_key?: string;
  system_instructions?: string;
  assistant_instructions?: string;
  created_at?: string;
  updated_at?: string;
}

const personalityTemplates = [
  { id: 'disc-d', name: 'DISC - Dominant', description: 'Direct, results-oriented, strong-willed' },
  { id: 'disc-i', name: 'DISC - Influential', description: 'Outgoing, enthusiastic, optimistic' },
  { id: 'disc-s', name: 'DISC - Steady', description: 'Patient, stable, consistent' },
  { id: 'disc-c', name: 'DISC - Conscientious', description: 'Accurate, analytical, systematic' },
  { id: 'mbti-intj', name: 'MBTI - INTJ', description: 'Architect - Imaginative and strategic thinkers' },
  { id: 'mbti-enfp', name: 'MBTI - ENFP', description: 'Campaigner - Enthusiastic, creative, sociable' },
  { id: 'custom', name: 'Custom Template', description: 'Create your own personality template' },
];

export function AgentEdit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Agent>>({
    name: '',
    description: '',
    personality: '',
    discord_channel: '',
    discord_bot_key: '',
    system_instructions: '',
    assistant_instructions: '',
    active: true
  });

  const [showDatastoreModal, setShowDatastoreModal] = useState(false);
  const [datastores, setDatastores] = useState<Datastore[]>([]);
  const [selectedDatastores, setSelectedDatastores] = useState<{
    vector?: string;
    knowledge?: string;
  }>({});
  const [loadingDatastores, setLoadingDatastores] = useState(false);
  const [connectingDatastores, setConnectingDatastores] = useState(false);

  // Reset success message after 3 seconds
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (saveSuccess) {
      timeout = setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    }
    return () => clearTimeout(timeout);
  }, [saveSuccess]);

  // Fetch datastores on component mount if editing
  useEffect(() => {
    if (isEditing) {
      fetchDatastores();
    }
  }, [isEditing]);

  const fetchAgent = async (agentId: string) => {
    try {
      setLoading(true);
      setError(null);

      // First fetch the agent data
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .eq('user_id', user?.id)
        .single();

      if (agentError) throw new Error(agentError.message);
      if (!agentData) throw new Error('Agent not found');

      setFormData(agentData);

      // Then fetch the associated datastores
      const { data: connections, error: connectionsError } = await supabase
        .from('agent_datastores')
        .select(`
          datastore_id,
          datastores:datastore_id (
            id,
            type
          )
        `)
        .eq('agent_id', agentId);

      if (connectionsError) throw new Error(connectionsError.message);

      if (connections) {
        const vectorStore = connections.find(c => c.datastores?.type === 'pinecone');
        const knowledgeStore = connections.find(c => c.datastores?.type === 'getzep');

        setSelectedDatastores({
          vector: vectorStore?.datastore_id,
          knowledge: knowledgeStore?.datastore_id
        });
      }
    } catch (err) {
      console.error('Error fetching agent:', err);
      setError('Failed to load agent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDatastores = async () => {
    try {
      setLoadingDatastores(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('datastores')
        .select('*')
        .eq('user_id', user?.id);

      if (fetchError) throw fetchError;

      setDatastores(data || []);
    } catch (err) {
      console.error('Error fetching datastores:', err);
      setError('Failed to load datastores. Please try again.');
    } finally {
      setLoadingDatastores(false);
    }
  };

  const handleConnectDatastores = async () => {
    if (!id || !user?.id) return;

    try {
      setConnectingDatastores(true);
      setError(null);

      // Remove existing connections
      const { error: deleteError } = await supabase
        .from('agent_datastores')
        .delete()
        .eq('agent_id', id);

      if (deleteError) throw deleteError;

      // Add new connections
      const connections = [];
      if (selectedDatastores.vector) {
        connections.push({
          agent_id: id,
          datastore_id: selectedDatastores.vector
        });
      }
      if (selectedDatastores.knowledge) {
        connections.push({
          agent_id: id,
          datastore_id: selectedDatastores.knowledge
        });
      }

      if (connections.length > 0) {
        const { error: insertError } = await supabase
          .from('agent_datastores')
          .insert(connections);

        if (insertError) throw insertError;
      }

      setShowDatastoreModal(false);
    } catch (err) {
      console.error('Error connecting datastores:', err);
      setError('Failed to connect datastores. Please try again.');
    } finally {
      setConnectingDatastores(false);
    }
  };

  useEffect(() => {
    if (isEditing && id) {
      fetchAgent(id);
    }
  }, [id, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      const agentData = {
        ...formData,
        user_id: user.id,
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('agents')
          .update(agentData)
          .eq('id', id)
          .eq('user_id', user.id);

        if (updateError) throw new Error(updateError.message);
      } else {
        const { data, error: insertError } = await supabase
          .from('agents')
          .insert([agentData])
          .select()
          .single();

        if (insertError) throw new Error(insertError.message);
        
        // Create default LLM preferences for the new agent
        if (data) {
          const { error: llmPrefsError } = await supabase
            .from('agent_llm_preferences')
            .insert({
              agent_id: data.id,
              provider: 'openai',
              model: 'gpt-4o-mini',
              params: {},
              embedding_model: 'text-embedding-3-small'
            });

          if (llmPrefsError) {
            console.error('Error creating LLM preferences for agent:', data.id, llmPrefsError);
            // Don't throw error - agent is already created
          } else {
            console.log('LLM preferences created successfully for agent:', data.id);
          }

          // If creating new agent, update the URL to edit mode
          navigate(`/agents/${data.id}`, { replace: true });
        }
      }

      setSaveSuccess(true);
    } catch (err) {
      console.error('Error saving agent:', err);
      setError('Failed to save agent. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Please sign in to manage agents.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading agent...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/agents')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">
            {isEditing ? 'Edit Agent' : 'Create New Agent'}
          </h1>
        </div>
        <div className="flex space-x-4">
          {isEditing && (
            <button
              onClick={() => setShowDatastoreModal(true)}
              className="flex items-center px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              <Database className="w-5 h-5 mr-2" />
              Connect Datastores
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`flex items-center px-4 py-2 rounded-md transition-colors ${
              saveSuccess
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-5 h-5 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Agent
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter agent name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Description
              </label>
              <textarea
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter agent description"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Personality Template
              </label>
              <select
                required
                value={formData.personality}
                onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a template</option>
                {personalityTemplates.map(template => (
                  <option key={template.id} value={template.name}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Discord Configuration */}
          <div className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Discord Configuration</h2>
            
            <DiscordConnect
              agentId={id || ''}
              onChannelSelect={(channelId) => setFormData({ 
                ...formData, 
                discord_channel: channelId 
              })}
              isConnected={Boolean(formData.discord_bot_key && formData.discord_channel)}
            />
          </div>
        </div>

        {/* System Instructions */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">System Instructions</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Define the core behavior and capabilities of your AI agent. These instructions set the foundation for how the agent will interact and process information.
          </p>
          <div className="h-64 border border-border rounded-lg overflow-hidden">
            <MonacoEditor
              language="markdown"
              theme="vs-dark"
              value={formData.system_instructions}
              onChange={(value) => setFormData({ ...formData, system_instructions: value })}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Assistant Instructions */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Assistant Instructions</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Specify additional context and instructions for the assistant, including any relevant information from datastores or specific behavioral guidelines.
          </p>
          <div className="h-64 border border-border rounded-lg overflow-hidden">
            <MonacoEditor
              language="markdown"
              theme="vs-dark"
              value={formData.assistant_instructions}
              onChange={(value) => setFormData({ ...formData, assistant_instructions: value })}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                wrappingIndent: 'indent',
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </form>

      {/* Datastore Connection Modal */}
      {showDatastoreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-2xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6">Connect Datastores</h2>
            
            {loadingDatastores ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading datastores...</p>
              </div>
            ) : datastores.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No datastores found. Create a datastore first.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Vector Datastore Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Vector Datastore
                  </label>
                  <select
                    value={selectedDatastores.vector || ''}
                    onChange={(e) => setSelectedDatastores({
                      ...selectedDatastores,
                      vector: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a vector datastore</option>
                    {datastores
                      .filter(ds => ds.type === 'pinecone')
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))
                    }
                  </select>
                </div>

                {/* Knowledge Graph Datastore Selection */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Knowledge Graph
                  </label>
                  <select
                    value={selectedDatastores.knowledge || ''}
                    onChange={(e) => setSelectedDatastores({
                      ...selectedDatastores,
                      knowledge: e.target.value || undefined
                    })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a knowledge graph datastore</option>
                    {datastores
                      .filter(ds => ds.type === 'getzep')
                      .map(ds => (
                        <option key={ds.id} value={ds.id}>{ds.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-6">
                  <button
                    type="button"
                    onClick={() => setShowDatastoreModal(false)}
                    className="px-4 py-2 text-foreground hover:text-foreground transition-colors"
                    disabled={connectingDatastores}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConnectDatastores}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={connectingDatastores}
                  >
                    {connectingDatastores ? 'Connecting...' : 'Connect Datastores'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}