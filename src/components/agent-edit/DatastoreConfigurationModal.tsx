import React, { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Database, Brain, Plus, ExternalLink, Check, Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { CredentialSelector } from '@/integrations/_shared';

interface Datastore {
  id: string;
  name: string;
  type: 'pinecone' | 'getzep';
  description?: string;
  config?: any;
}



interface DatastoreConfigurationModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  availableDatastores: Datastore[];
  selectedVectorStore?: string;
  onSelectDatastore: (type: 'pinecone', datastoreId: string) => void;
  connecting: boolean;
  loadingAvailable: boolean;
  onDatastoresUpdated?: () => void; // Callback when datastores are created
}



export const DatastoreConfigurationModal: React.FC<DatastoreConfigurationModalProps> = ({
  isOpen,
  onOpenChange,
  agentId,
  availableDatastores,
  selectedVectorStore,
  onSelectDatastore,
  connecting,
  loadingAvailable,
  onDatastoresUpdated
}) => {
  const { user } = useAuth();

  const [agentName, setAgentName] = useState<string>('unknown_agent');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    config: {} as any
  });

  // Fetch agent name when modal opens
  useEffect(() => {
    if (isOpen && agentId) {
      const fetchAgentName = async () => {
        try {
          const { data: agent, error } = await supabase
            .from('agents')
            .select('name')
            .eq('id', agentId)
            .single();
          
          if (error) throw error;
          setAgentName(agent.name || 'unknown_agent');
        } catch (error) {
          console.warn('Failed to fetch agent name:', error);
          setAgentName(`agent_${agentId.slice(0, 8)}`);
        }
      };
      
      fetchAgentName();
    }
  }, [isOpen, agentId]);

  // Filter datastores by type (only vector stores for agent-specific configuration)
  const vectorStores = availableDatastores.filter(ds => ds.type === 'pinecone');

  // Get selected datastore
  const connectedVectorStore = vectorStores.find(ds => ds.id === selectedVectorStore);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShowCreateForm(false);
      setFormData({ name: '', description: '', config: {} });
    }
  }, [isOpen]);

  const handleCreateDatastore = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to create a datastore');
      return;
    }

    setIsSaving(true);
    try {
      const { data: newDatastore, error } = await supabase
        .from('datastores')
        .insert({
          name: formData.name,
          description: formData.description,
          type: 'pinecone',
          config: formData.config,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Vector store created successfully!');
      
      // Reset form and hide it
      setFormData({ name: '', description: '', config: {} });
      setShowCreateForm(false);
      
      // Notify parent to refresh datastores
      if (onDatastoresUpdated) {
        onDatastoresUpdated();
      }
      
      // Auto-select the newly created datastore
      if (newDatastore) {
        onSelectDatastore('pinecone', newDatastore.id);
      }
    } catch (err: any) {
      console.error('Failed to create datastore:', err);
      toast.error(err.message || 'Failed to create datastore');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configure Vector Store</DialogTitle>
          <DialogDescription>
            Select or create a Pinecone vector database for semantic similarity search
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Vector Datastore Section */}
          {(
            <Card 
            className={`transition-all duration-200 rounded-xl ${
              connectedVectorStore 
                ? 'border-primary/50 bg-primary/5' 
                : 'border-border/50 hover:border-primary/30 hover:bg-accent/30'
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Database className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Vector Datastore</CardTitle>
                    <CardDescription>
                      Pinecone vector database for semantic similarity search
                    </CardDescription>
                  </div>
                </div>
                {connectedVectorStore && (
                  <div className="flex items-center text-sm text-primary">
                    <Check className="h-4 w-4 mr-1" />
                    Connected
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {connectedVectorStore ? (
                <div className="flex items-center justify-between p-3 bg-accent/20 border border-border/50 rounded-xl">
                  <div>
                    <p className="font-medium text-foreground">{connectedVectorStore.name}</p>
                    <p className="text-sm text-muted-foreground">{connectedVectorStore.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectDatastore('pinecone', '')}
                    disabled={connecting}
                    className="rounded-lg"
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {loadingAvailable ? (
                    <p className="text-center text-muted-foreground py-4">Loading vector stores...</p>
                  ) : !showCreateForm ? (
                    <>
                      <Label className="text-sm font-medium">Available Vector Stores</Label>
                      <Select 
                        value={selectedVectorStore || 'none'}
                        onValueChange={(value) => onSelectDatastore('pinecone', value === 'none' ? '' : value)}
                        disabled={connecting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vector store..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {vectorStores.map(ds => (
                            <SelectItem key={ds.id} value={ds.id}>{ds.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button 
                        variant="outline"
                        onClick={() => setShowCreateForm(true)}
                        className="w-full rounded-lg"
                        disabled={connecting}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Vector Store
                      </Button>
                    </>
                  ) : (
                    <form onSubmit={handleCreateDatastore} className="space-y-4 pt-2">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold">New Vector Store</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowCreateForm(false);
                            setFormData({ name: '', description: '', config: {} });
                          }}
                          disabled={isSaving}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div>
                        <Label htmlFor="vector-name">Name</Label>
                        <Input
                          id="vector-name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="e.g., Main Vector Database"
                          disabled={isSaving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="vector-description">Description</Label>
                        <Textarea
                          id="vector-description"
                          required
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Describe this vector store"
                          rows={2}
                          disabled={isSaving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="pinecone-api-key">Pinecone API Key</Label>
                        <Input
                          id="pinecone-api-key"
                          type="password"
                          required
                          value={formData.config?.apiKey || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, apiKey: e.target.value }
                          })}
                          placeholder="Enter API key"
                          disabled={isSaving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="pinecone-index">Index Name</Label>
                        <Input
                          id="pinecone-index"
                          required
                          value={formData.config?.indexName || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, indexName: e.target.value }
                          })}
                          placeholder="Enter index name"
                          disabled={isSaving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="pinecone-region">Region</Label>
                        <Input
                          id="pinecone-region"
                          required
                          value={formData.config?.region || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, region: e.target.value }
                          })}
                          placeholder="e.g., us-east-1"
                          disabled={isSaving}
                        />
                      </div>

                      <div>
                        <Label htmlFor="pinecone-dimensions">Dimensions</Label>
                        <Input
                          id="pinecone-dimensions"
                          type="number"
                          required
                          value={formData.config?.dimensions || '1536'}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, dimensions: parseInt(e.target.value) }
                          })}
                          placeholder="1536"
                          disabled={isSaving}
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowCreateForm(false);
                            setFormData({ name: '', description: '', config: {} });
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
                              Creating...
                            </>
                          ) : (
                            'Create'
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};