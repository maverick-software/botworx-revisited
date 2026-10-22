import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface CreateDatastoreModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'pinecone' | 'getzep' | null;
  onSuccess?: () => void;
}

export const CreateDatastoreModal: React.FC<CreateDatastoreModalProps> = ({
  isOpen,
  onOpenChange,
  type,
  onSuccess
}) => {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    apiKey: '',
    indexName: '',
    collectionName: '',
    dimensions: 1536
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !type) return;

    setIsSaving(true);
    try {
      const configData = type === 'pinecone' ? {
        apiKey: formData.apiKey,
        environment: 'gcp-starter',
        indexName: formData.indexName
      } : {
        apiKey: formData.apiKey,
        url: 'https://getzep.example.com',
        collectionName: formData.collectionName || 'default',
        dimensions: formData.dimensions
      };

      const { error } = await supabase
        .from('datastores')
        .insert({
          name: formData.name,
          type: type,
          description: formData.description,
          config: configData,
          user_id: user.id
        });

      if (error) throw error;

      toast.success(`${type === 'pinecone' ? 'Vector store' : 'Knowledge graph'} created successfully!`);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        apiKey: '',
        indexName: '',
        collectionName: '',
        dimensions: 1536
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating datastore:', error);
      toast.error('Failed to create datastore');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
      // Reset form when closing
      setFormData({
        name: '',
        description: '',
        apiKey: '',
        indexName: '',
        collectionName: '',
        dimensions: 1536
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              Create New {type === 'pinecone' ? 'Vector Store' : 'Knowledge Graph'}
            </DialogTitle>
            <DialogDescription>
              {type === 'pinecone' 
                ? 'Create a new vector datastore for similarity search.'
                : 'Create a new knowledge graph datastore.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`My ${type === 'pinecone' ? 'Vector Store' : 'Knowledge Graph'}`}
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this datastore"
                rows={3}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={`Enter ${type === 'pinecone' ? 'Pinecone' : 'GetZep'} API key`}
                required
                disabled={isSaving}
              />
            </div>

            {type === 'pinecone' ? (
              <div className="space-y-2">
                <Label htmlFor="indexName">Index Name</Label>
                <Input
                  id="indexName"
                  value={formData.indexName}
                  onChange={(e) => setFormData({ ...formData, indexName: e.target.value })}
                  placeholder="my-index"
                  required
                  disabled={isSaving}
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="collectionName">Collection Name</Label>
                  <Input
                    id="collectionName"
                    value={formData.collectionName}
                    onChange={(e) => setFormData({ ...formData, collectionName: e.target.value })}
                    placeholder="default"
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dimensions">Dimensions</Label>
                  <Input
                    id="dimensions"
                    type="number"
                    value={formData.dimensions}
                    onChange={(e) => setFormData({ ...formData, dimensions: parseInt(e.target.value) || 1536 })}
                    placeholder="1536"
                    disabled={isSaving}
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}; 