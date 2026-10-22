import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Datastore } from '@/types';
import { Label } from '@/components/ui/label';
import { Loader2, Database, Edit2, Plus, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { DatastoreConfigurationModal } from './DatastoreConfigurationModal';

// Datastore Form Component - Type-specific forms
interface DatastoreFormProps {
  datastore?: Datastore | null;
  onSubmit: (data: Partial<Datastore>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  datastoreType: 'pinecone' | 'getzep'; // Pre-determined type
}

function DatastoreForm({ datastore, onSubmit, onCancel, isSaving, datastoreType }: DatastoreFormProps) {
  const [formData, setFormData] = useState<Partial<Datastore>>({
    name: datastore?.name || '',
    description: datastore?.description || '',
    type: datastore?.type || datastoreType, // Use the pre-determined type
    config: datastore?.config || {},
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setFormError(null);
      await onSubmit(formData);
    } catch (err) {
      console.error('Form submission error:', err);
      setFormError(err.message || 'Failed to save datastore. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-md text-sm">
          {formError}
        </div>
      )}

      <div>
        <Label htmlFor="ds-name">Name</Label>
        <Input
          id="ds-name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={`Enter ${datastoreType === 'pinecone' ? 'vector store' : 'knowledge graph'} name`}
          disabled={isSaving}
        />
      </div>

      <div>
        <Label htmlFor="ds-description">Description</Label>
        <Textarea
          id="ds-description"
          required
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder={`Describe this ${datastoreType === 'pinecone' ? 'vector store' : 'knowledge graph'}`}
          rows={3}
          disabled={isSaving}
        />
      </div>

      {formData.type === 'pinecone' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="pinecone-api-key">API Key</Label>
            <Input
              id="pinecone-api-key"
              type="password"
              required
              value={formData.config?.apiKey || ''}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, apiKey: e.target.value }
              })}
              placeholder="Enter Pinecone API key"
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
              value={formData.config?.dimensions || 1536}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, dimensions: parseInt(e.target.value) }
              })}
              placeholder="e.g., 1536"
              disabled={isSaving}
            />
          </div>
        </div>
      )}

      {formData.type === 'getzep' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="getzep-api-key">API Key</Label>
            <Input
              id="getzep-api-key"
              type="password"
              required
              value={formData.config?.apiKey || ''}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, apiKey: e.target.value }
              })}
              placeholder="Enter GetZep API key"
              disabled={isSaving}
            />
          </div>
          <div>
            <Label htmlFor="getzep-collection">Collection Name</Label>
            <Input
              id="getzep-collection"
              required
              value={formData.config?.collectionName || ''}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, collectionName: e.target.value }
              })}
              placeholder="Enter collection name"
              disabled={isSaving}
            />
          </div>
          <div>
            <Label htmlFor="getzep-project">Project ID</Label>
            <Input
              id="getzep-project"
              required
              value={formData.config?.projectId || ''}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, projectId: e.target.value }
              })}
              placeholder="Enter project ID"
              disabled={isSaving}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            datastore ? 'Update' : 'Create'
          )}
        </Button>
      </div>
    </form>
  );
}

// Main component props
interface AgentDatastoreSelectorProps {
  agentId: string | undefined;
  availableDatastores: Datastore[];
  selectedVectorStore: string | undefined;
  onSelectDatastore: (type: 'vector', value: string) => void;
  onConnectDatastores: () => Promise<void>;
  loadingAvailable: boolean;
  connecting: boolean;
  onDatastoresUpdated?: () => void; // Callback when datastores are created/updated
}

export const AgentDatastoreSelector: React.FC<AgentDatastoreSelectorProps> = ({
  agentId,
  availableDatastores,
  selectedVectorStore,
  onSelectDatastore,
  onConnectDatastores,
  loadingAvailable,
  connecting,
  onDatastoresUpdated
}) => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalType, setCreateModalType] = useState<'pinecone' | 'getzep'>('pinecone');
  const [editingDatastore, setEditingDatastore] = useState<Datastore | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter datastores by type (only vector stores for agent-specific configuration)
  const vectorStores = availableDatastores.filter(ds => ds.type === 'pinecone');

  const handleConnectClick = async () => {
    await onConnectDatastores();
    setIsModalOpen(false);
  };

  const handleCreateOrUpdateDatastore = async (data: Partial<Datastore>) => {
    if (!user) return;

    try {
      setIsSaving(true);

      const datastoreData = {
        ...data,
        user_id: user.id,
      };

      let result;
      if (editingDatastore) {
        result = await supabase
          .from('datastores')
          .update(datastoreData)
          .eq('id', editingDatastore.id)
          .eq('user_id', user.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('datastores')
          .insert([datastoreData])
          .select()
          .single();
      }

      if (result.error) {
        throw result.error;
      }

      toast.success(editingDatastore ? 'Datastore updated' : 'Datastore created');
      setShowCreateModal(false);
      setEditingDatastore(null);
      
      // Refresh datastores
      if (onDatastoresUpdated) {
        onDatastoresUpdated();
      }
    } catch (err) {
      console.error('Error saving datastore:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for datastore selection
  const handleDatastoreSelect = (type: 'pinecone', datastoreId: string) => {
    onSelectDatastore('vector', datastoreId);
  };

  // Get currently selected datastore
  const selectedVector = vectorStores.find(ds => ds.id === selectedVectorStore);

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-5 w-5" />
          Vector Store Connection
        </CardTitle>
        <CardDescription>
          Connect a Pinecone vector database for semantic similarity search and episodic memory
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Connection Display */}
        <div>
          {/* Vector Store */}
          {selectedVector ? (
            <div className="flex items-center justify-between p-4 rounded-xl bg-accent/30">
              <div className="space-y-1">
                <p className="text-sm font-medium">Vector Store</p>
                <p className="text-sm text-muted-foreground">
                  {selectedVector.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingDatastore(selectedVector);
                  setShowCreateModal(true);
                }}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Vector Store</p>
                <p className="text-sm text-muted-foreground/70">
                  Add vector datastore
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Datastore Configuration Modal */}
        <DatastoreConfigurationModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          agentId={agentId!}
          availableDatastores={availableDatastores}
          selectedVectorStore={selectedVectorStore}
          onSelectDatastore={handleDatastoreSelect}
          connecting={connecting}
          loadingAvailable={loadingAvailable}
          onDatastoresUpdated={onDatastoresUpdated}
        />

        {/* Create/Edit Datastore Modal - Type-specific */}
        <Dialog open={showCreateModal || !!editingDatastore} onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingDatastore(null);
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingDatastore 
                  ? `Edit ${editingDatastore.type === 'pinecone' ? 'Vector Store' : 'Knowledge Graph'}`
                  : `Create New ${createModalType === 'pinecone' ? 'Vector Store' : 'Knowledge Graph'}`
                }
              </DialogTitle>
              <DialogDescription>
                {editingDatastore 
                  ? `Update your ${editingDatastore.type === 'pinecone' ? 'Pinecone vector database' : 'GetZep knowledge graph'} configuration`
                  : `Set up a new ${createModalType === 'pinecone' ? 'Pinecone vector database for semantic search' : 'GetZep knowledge graph for entity relationships'}`
                }
              </DialogDescription>
            </DialogHeader>
            <DatastoreForm
              datastore={editingDatastore}
              onSubmit={handleCreateOrUpdateDatastore}
              onCancel={() => {
                setShowCreateModal(false);
                setEditingDatastore(null);
              }}
              isSaving={isSaving}
              datastoreType={editingDatastore?.type || createModalType}
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}; 