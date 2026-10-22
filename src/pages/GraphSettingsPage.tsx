import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Plus, ExternalLink, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'react-hot-toast';

interface AccountGraphRow {
  id: string;
  user_id: string;
  provider: string;
  status: 'active' | 'disabled' | 'error';
  settings: any;
  created_at: string;
  updated_at: string;
}

export function GraphSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<AccountGraphRow | null>(null);
  const [metrics, setMetrics] = useState<{
    nodes: string | number;
    edges: string | number;
    contradictions: string | number;
    avg_confidence: string | number;
    queue_depth: string | number;
    last_sync: string | number;
  }>({ nodes: '-', edges: '-', contradictions: '-', avg_confidence: '-', queue_depth: '-', last_sync: '-' });
  
  // Datastore creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    projectName: '',
    projectKey: ''
  });
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadGraphData = async () => {
    try {
      setError(null);
      setLoading(true);
        const { data, error } = await supabase
          .from('account_graphs')
          .select('*')
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        let g = data || null;
        // Auto-initialize account graph if user has an active GetZep connection
        if (!g && user?.id) {
          const { data: conns } = await supabase
            .from('user_integration_credentials')
            .select('id, connection_metadata, connection_status, service_providers:oauth_provider_id ( name )')
            .eq('user_id', user.id);
          const getzep = (conns || []).find((c: any) => (c?.service_providers?.name || '').toLowerCase() === 'getzep' && c.connection_status === 'active');
          if (getzep) {
            const settings: any = {};
            if (getzep.connection_metadata?.project_id) settings.project_id = getzep.connection_metadata.project_id;
            if (getzep.connection_metadata?.account_id) settings.account_id = getzep.connection_metadata.account_id;
            const { data: created } = await supabase
              .from('account_graphs')
              .insert({ user_id: user.id, provider: 'getzep', connection_id: getzep.id, settings, status: 'active' })
              .select('*')
              .single();
            g = created || null;
          }
        }
        setGraph(g);
        
        // Note: Metrics are not currently available from GetZep API
        // The graph data lives entirely in GetZep's cloud service
        // Local graph_nodes/graph_edges tables are deprecated and should be removed
        // TODO: Implement metrics fetching from GetZep API when available
        setMetrics({ 
          nodes: 'N/A', 
          edges: 'N/A', 
          contradictions: 'N/A', 
          avg_confidence: 'N/A', 
          queue_depth: 'N/A', 
          last_sync: g ? new Date(g.updated_at).toLocaleString() : '-'
        });
    } catch (e: any) {
      setError(e?.message || 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGraphData();
  }, []);

  const handleDisconnect = async () => {
    if (!user || !graph) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to disconnect the knowledge graph? This will disable graph features for all agents in your account. The data will remain in GetZep and can be reconnected later.'
    );
    
    if (!confirmed) return;

    setIsDisconnecting(true);
    try {
      // Delete the account_graphs entry
      const { error: deleteError } = await supabase
        .from('account_graphs')
        .delete()
        .eq('id', graph.id);

      if (deleteError) {
        throw new Error(`Failed to disconnect: ${deleteError.message}`);
      }

      // Optionally delete the user_integration_credentials entry
      // (You may want to keep it so users can reconnect without re-entering credentials)
      // if (graph.connection_id) {
      //   await supabase
      //     .from('user_integration_credentials')
      //     .delete()
      //     .eq('id', graph.connection_id);
      // }

      toast.success('Knowledge graph disconnected successfully');
      
      // Reload to show disconnected state
      await loadGraphData();
    } catch (err: any) {
      console.error('Failed to disconnect knowledge graph:', err);
      toast.error(err.message || 'Failed to disconnect knowledge graph');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCreateDatastore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to create a knowledge graph');
      return;
    }

    setIsSaving(true);
    try {
      // Get GetZep service provider
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'getzep')
        .single();

      if (providerError) {
        throw new Error(`GetZep provider not found: ${providerError.message}`);
      }

      // Store API key securely in vault via edge function
      const secretName = `getzep_project_key_${user.id}_${Date.now()}`;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const vaultResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-secret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: secretName,
          secret: formData.projectKey,
          description: `GetZep Project Key for ${formData.projectName} - Created: ${new Date().toISOString()}`
        }),
      });

      if (!vaultResponse.ok) {
        const errorData = await vaultResponse.json();
        throw new Error(`Failed to store secret: ${errorData.error || 'Unknown error'}`);
      }

      const { id: vaultKeyId } = await vaultResponse.json();
      console.log(`✅ GetZep Project Key securely stored in vault: ${vaultKeyId}`);

      // Create connection record
      const { data: connectionData, error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id,
          external_username: formData.projectName,
          connection_name: formData.projectName || 'GetZep Knowledge Graph',
          encrypted_access_token: null, // API key is in vault
          vault_access_token_id: vaultKeyId,
          scopes_granted: ['memory_read', 'memory_write', 'session_management', 'knowledge_graph'],
          connection_status: 'active',
          credential_type: 'api_key',
          // Store GetZep-specific configuration
          connection_metadata: {
            project_name: formData.projectName
          }
        })
        .select('*')
        .single();

      if (insertError) {
        throw new Error(`Failed to create connection: ${insertError.message}`);
      }

      console.log('✅ GetZep connection created:', connectionData.id);

      // Create account graph entry
      const { data: graphData, error: graphError } = await supabase
        .from('account_graphs')
        .insert({
          user_id: user.id,
          provider: 'getzep',
          connection_id: connectionData.id,
          settings: {
            project_name: formData.projectName
          },
          status: 'active'
        })
        .select()
        .single();

      if (graphError) {
        throw new Error(`Failed to create account graph: ${graphError.message}`);
      }

      console.log('✅ Account graph created:', graphData.id);

      toast.success('Knowledge graph connected successfully! 🧠');
      
      // Reset form and close modal
      setFormData({ projectName: '', projectKey: '' });
      setShowCreateModal(false);
      
      // Reload graph data to show the new connection
      await loadGraphData();
    } catch (err: any) {
      console.error('Failed to create knowledge graph:', err);
      toast.error(err.message || 'Failed to create knowledge graph');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Knowledge Graph</h2>
        <p className="text-sm text-muted-foreground">
          Shared knowledge graph for all agents in your account. Store concepts, conclusions, entities, and relationships that can be accessed by any agent.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-foreground">Status</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Loading…</div>
        ) : error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : graph ? (
          <div className="flex items-start justify-between">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm flex-1">
              <div>
                <div className="text-muted-foreground">Provider</div>
                <div className="font-medium">{graph.provider}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div className={graph.status === 'active' ? 'text-green-600 dark:text-green-400 font-medium' : graph.status === 'error' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-foreground font-medium'}>
                  {graph.status}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Created</div>
                <div className="font-medium">{new Date(graph.created_at).toLocaleString()}</div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="ml-4 rounded-lg border-red-500 text-red-500 hover:bg-red-500/10"
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              No knowledge graph connected yet. Connect your GetZep account to enable a shared knowledge graph across all your agents.
            </div>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              Connect Knowledge Graph
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-3 text-foreground">Graph Information</h3>
        {graph ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your knowledge graph is managed by GetZep Cloud. All nodes, edges, and relationships are stored and processed in GetZep's infrastructure.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <Metric label="Last Updated" value={metrics.last_sync} />
              <Metric label="Status" value={graph.status} />
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
              <p className="text-blue-600 dark:text-blue-400">
                💡 <strong>Tip:</strong> The knowledge graph is automatically populated as your agents chat. Facts, entities, and relationships are extracted and stored in GetZep.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Connect a knowledge graph to view information</p>
        )}
      </div>

      {graph && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-foreground">GetZep Dashboard</h3>
          <p className="text-sm text-muted-foreground mb-3">
            View and explore your knowledge graph directly in the GetZep dashboard with their built-in visualization tools.
          </p>
          <a 
            href="https://app.getzep.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Open GetZep Dashboard
          </a>
        </div>
      )}

      {/* Create Knowledge Graph Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Connect Account Knowledge Graph
            </DialogTitle>
            <DialogDescription>
              Connect your GetZep account to enable a single, shared knowledge graph for all agents. This is an account-wide setting.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateDatastore} className="space-y-4 pt-2">
            <div>
              <Label htmlFor="project-name">Connection Name</Label>
              <Input
                id="project-name"
                required
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="e.g., Account Knowledge Graph"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                A friendly name for your account's knowledge graph connection
              </p>
            </div>

            <div>
              <Label htmlFor="project-key">Project Key</Label>
              <Input
                id="project-key"
                type="password"
                required
                value={formData.projectKey}
                onChange={(e) => setFormData({ ...formData, projectKey: e.target.value })}
                placeholder="Enter your GetZep project key"
                disabled={isSaving}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Found in your GetZep dashboard under Project Settings
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <ExternalLink className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-600 dark:text-blue-400 mb-1">Don't have a GetZep account?</p>
                  <p className="text-muted-foreground">
                    Sign up at{' '}
                    <a 
                      href="https://www.getzep.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      getzep.com
                    </a>
                    {' '}to get your API credentials.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ projectName: '', projectKey: '' });
                }}
                disabled={isSaving}
                className="flex-1 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 rounded-lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 p-3 bg-muted/30">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default GraphSettingsPage;


