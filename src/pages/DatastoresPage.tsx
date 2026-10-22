import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Edit2, Database, RefreshCw, X, Brain, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Datastore as DatastoreType } from '../types';
import { CredentialSelector } from '@/integrations/_shared';

type ExtendedDatastore = DatastoreType & {
  agent_datastores?: Array<{ agent_id: string }>;
};

export function DatastoresPage() {
  const { user } = useAuth();
  const [datastores, setDatastores] = useState<ExtendedDatastore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDatastore, setEditingDatastore] = useState<ExtendedDatastore | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const totalFetchAttempts = useRef(0);
  const MAX_TOTAL_FETCH_ATTEMPTS = 5;

  const fetchDatastores = useCallback(async (isInitialCall = true) => {
    if (!user) return;

    let currentAttempt = totalFetchAttempts.current + 1;
    if (isInitialCall) {
      currentAttempt = 1;
      totalFetchAttempts.current = 0;
    }
    totalFetchAttempts.current = currentAttempt;

    if (currentAttempt > MAX_TOTAL_FETCH_ATTEMPTS) {
      console.warn(`Max fetch attempts (${MAX_TOTAL_FETCH_ATTEMPTS}) reached for datastores. Aborting.`);
      setError(`Failed to load datastores after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts.`);
      setLoading(false);
      return;
    }
    console.log(`Fetching datastores... Attempt ${currentAttempt}`);

    try {
      setError(null);
      setLoading(true);

      const { data, error: fetchError } = await supabase
        .from('datastores')
        .select('*, agent_datastores(agent_id)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) { throw fetchError; }

      await new Promise(resolve => setTimeout(resolve, 300));
      setDatastores(data || []);
      setLoading(false);
      if (isInitialCall) totalFetchAttempts.current = 0;

    } catch (err: any) {
      console.error('Error fetching datastores:', err);
      if (currentAttempt < MAX_TOTAL_FETCH_ATTEMPTS) {
        const delay = 2000;
        console.log(`Datastore fetch failed, retrying in ${delay}ms (Attempt ${currentAttempt + 1})`);
        setTimeout(() => fetchDatastores(false), delay);
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load datastores. Retrying... (${currentAttempt}/${MAX_TOTAL_FETCH_ATTEMPTS}): ${message}`);
      } else {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(`Failed to load datastores after ${MAX_TOTAL_FETCH_ATTEMPTS} attempts: ${message}`);
        console.error('Max fetch attempts reached after error.');
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      totalFetchAttempts.current = 0;
      fetchDatastores(true);
    } else {
      setDatastores([]);
      setLoading(false);
      setError(null);
    }
  }, [user, fetchDatastores]);

  const handleDelete = async (id: string) => {
    if (!id || isDeleting) return;

    try {
      setIsDeleting(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('datastores')
        .delete()
        .eq('id', id)
        .eq('user_id', user?.id);

      if (deleteError) {
        console.error('Delete error:', {
          message: deleteError.message,
          code: deleteError.code,
          details: deleteError.details
        });
        throw deleteError;
      }

      setDatastores(prev => prev.filter(ds => ds.id !== id));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting datastore:', err);
      setError('Failed to delete datastore. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateOrUpdate = async (formData: Partial<ExtendedDatastore>) => {
    if (!user?.id) {
      setError('You must be logged in to perform this action.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      if (!formData.name?.trim()) throw new Error('Name is required');
      if (!formData.description?.trim()) throw new Error('Description is required');
      if (!formData.type) throw new Error('Type is required');
      
      if (formData.type === 'pinecone') {
        if (!formData.config?.connectionId) throw new Error('API Key Connection is required');
        if (!formData.config?.region) throw new Error('Region is required');
        if (!formData.config?.host) throw new Error('Host is required');
        if (!formData.config?.indexName) throw new Error('Index Name is required');
        if (!formData.config?.dimensions) throw new Error('Dimensions is required');
        if (typeof formData.similarity_threshold !== 'number' || (formData.similarity_threshold as number) < 0 || (formData.similarity_threshold as number) > 1) {
          throw new Error('Similarity threshold must be between 0 and 1');
        }
        if (typeof formData.max_results !== 'number' || (formData.max_results as number) < 1) {
          throw new Error('Max results must be at least 1');
        }
      } else if (formData.type === 'getzep') {
        if (!formData.config?.connectionId) throw new Error('API Key Connection is required');
        if (!formData.config?.projectId) throw new Error('Project ID is required');
        if (!formData.config?.collectionName) throw new Error('Collection Name is required');
      }

      const datastoreData = {
        ...formData,
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
        console.error('Save error:', {
          message: result.error.message,
          code: result.error.code,
          details: result.error.details
        });
        throw result.error;
      }

      if (editingDatastore) {
        setDatastores(prev => 
          prev.map(ds => ds.id === editingDatastore.id ? result.data : ds)
        );
      } else {
        setDatastores(prev => [result.data, ...prev]);
      }

      setShowCreateModal(false);
      setEditingDatastore(null);
    } catch (err) {
      console.error('Error saving datastore:', {
        error: err,
        message: err.message,
        stack: err.stack
      });
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Please sign in to manage datastores.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Datastores</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Datastore
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-400 p-4 rounded-md flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => fetchDatastores(true)}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-md transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading && error?.includes('Retrying') ? 'animate-spin' : ''}`} />
            {loading && error?.includes('Retrying') ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="bg-card border border-border rounded-lg p-6 space-y-4"
            >
              <div className="animate-pulse space-y-4">
                <div className="flex justify-between">
                  <div className="h-6 bg-muted rounded w-1/2"></div>
                  <div className="space-x-2 flex">
                    <div className="w-8 h-8 bg-muted rounded"></div>
                    <div className="w-8 h-8 bg-muted rounded"></div>
                  </div>
                </div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                  </div>
                  <div className="flex justify-between">
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                    <div className="h-4 bg-muted rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : datastores.length === 0 ? (
          <div className="col-span-full bg-card border border-border rounded-lg p-8 text-center">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No datastores found. Create your first datastore to get started!</p>
          </div>
        ) : (
          datastores.map((datastore) => (
            <div
              key={datastore.id}
              className="bg-card border border-border rounded-lg p-6 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{datastore.name}</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {datastore.description}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingDatastore(datastore)}
                    className="p-2 text-muted-foreground hover:text-primary rounded-md transition-colors"
                    title="Edit datastore"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(datastore.id)}
                    className="p-2 text-muted-foreground hover:text-destructive rounded-md transition-colors"
                    title="Delete datastore"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="text-foreground capitalize">{datastore.type}</span>
                </div>
                {datastore.type === 'pinecone' && (
                  <>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Index:</span>
                      <span className="text-foreground">
                        {datastore.config.indexName}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Region:</span>
                      <span className="text-foreground">
                        {datastore.config.region}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Dimensions:</span>
                      <span className="text-foreground">
                        {datastore.config.dimensions}
                      </span>
                    </div>
                  </>
                )}
                {datastore.type === 'getzep' && (
                  <>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Collection:</span>
                      <span className="text-foreground">
                        {datastore.config.collectionName}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Project:</span>
                      <span className="text-foreground">
                        {datastore.config.projectId}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {datastore.agent_datastores && datastore.agent_datastores.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Connected to {datastore.agent_datastores.length} agent{datastore.agent_datastores.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Delete Datastore</h2>
            <p className="text-foreground mb-6">
              Are you sure you want to delete this datastore? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(showCreateModal || editingDatastore) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 z-50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <DatastoreForm
              datastore={editingDatastore}
              onSubmit={handleCreateOrUpdate}
              onCancel={() => {
                setShowCreateModal(false);
                setEditingDatastore(null);
              }}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface DatastoreFormProps {
  datastore?: ExtendedDatastore | null;
  onSubmit: (data: Partial<ExtendedDatastore>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function DatastoreForm({ datastore, onSubmit, onCancel, isSaving }: DatastoreFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<ExtendedDatastore>>({
    name: datastore?.name || '',
    description: datastore?.description || '',
    type: datastore?.type || 'pinecone',
    config: datastore?.config || {},
    similarity_threshold: (datastore as any)?.similarity_threshold ?? 0.5,
    max_results: (datastore as any)?.max_results ?? 5,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const totalSteps = 4;
  const isEditing = !!datastore;

  const steps = [
    { id: 1, title: 'Basic Info', description: 'Name and description' },
    { id: 2, title: 'Type Selection', description: 'Choose your platform' },
    { id: 3, title: 'Configuration', description: 'API keys and settings' },
    { id: 4, title: 'Review', description: 'Confirm and create' }
  ];

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 2:
        return formData.name && formData.name.trim().length > 0;
      case 3:
        return formData.type;
      case 4:
        if (formData.type === 'pinecone') {
          return formData.config?.connectionId && formData.config?.region && formData.config?.host && formData.config?.indexName && formData.config?.dimensions;
        } else if (formData.type === 'getzep') {
          return formData.config?.connectionId && formData.config?.projectId && formData.config?.collectionName;
        }
        return false;
      default:
        return true;
    }
  };

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
    <div className="bg-background/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-2xl w-full overflow-hidden">
      {/* Step Header */}
      <div className="relative bg-gradient-to-r from-primary/5 to-primary/10 px-5 py-4 border-b border-border/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-1">
              {isEditing ? 'Edit Datastore' : 'Create New Datastore'}
            </h2>
            <p className="text-muted-foreground text-xs">
              Step {currentStep} of {totalSteps}: {steps[currentStep - 1].description}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground transition-all duration-200 p-1.5 rounded-full hover:bg-background/50"
            disabled={isSaving}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between relative">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-medium text-xs transition-all duration-300 ${
                  currentStep > step.id 
                    ? 'bg-primary border-primary text-primary-foreground shadow-sm' 
                    : currentStep === step.id 
                      ? 'border-primary text-primary bg-primary/10 shadow-sm ring-2 ring-primary/20' 
                      : 'border-border text-muted-foreground bg-background'
                }`}>
                  {currentStep > step.id ? '✓' : step.id}
                </div>
                <div className="mt-1.5 text-center">
                  <div className={`text-xs font-medium transition-colors ${
                    currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.title}
                  </div>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3 transition-colors duration-300 ${
                  currentStep > step.id ? 'bg-primary' : 'bg-border'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 min-h-[300px]">
        {formError && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg flex items-start gap-2 mb-4">
            <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 bg-destructive rounded-full"></div>
            </div>
            <div>
              <p className="font-medium text-xs">Configuration Error</p>
              <p className="text-xs opacity-90 mt-0.5">{formError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in-50 duration-300">
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-foreground mb-1">Basic Information</h3>
                <p className="text-muted-foreground text-sm">Let's start with the basics for your datastore</p>
              </div>

              <div className="max-w-sm mx-auto space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    Datastore Name
                    <span className="text-destructive text-xs">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background/50 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 hover:border-border text-sm"
                    placeholder="My Company Knowledge Base"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Choose a descriptive name that identifies this datastore</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">
                    Description <span className="text-muted-foreground text-xs">(Optional)</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2.5 bg-background/50 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary/50 transition-all duration-200 hover:border-border resize-none text-sm"
                    placeholder="Brief description of what this datastore contains and how it will be used..."
                    rows={3}
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">Help others understand the purpose of this datastore</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Type Selection */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in-50 duration-300">
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-foreground mb-1">Choose Your Platform</h3>
                <p className="text-muted-foreground text-sm">Select the type of database you want to connect to</p>
              </div>

              <div className="max-w-lg mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'pinecone', config: {} })}
                    disabled={isSaving}
                    className={`group p-4 rounded-xl border-2 transition-all duration-300 text-left hover:shadow-md ${
                      formData.type === 'pinecone' 
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 shadow-md ring-2 ring-blue-500/20' 
                        : 'border-border/50 hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <Database className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">Pinecone</h4>
                        <p className="text-xs text-blue-600 dark:text-blue-400">Vector Database</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      High-performance vector database perfect for semantic search, embeddings, and AI applications.
                    </p>
                    <div className="mt-2 flex items-center text-xs text-muted-foreground">
                      <span>• Semantic Search</span>
                      <span className="mx-1">•</span>
                      <span>• Embeddings</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'getzep', config: {} })}
                    disabled={isSaving}
                    className={`group p-4 rounded-xl border-2 transition-all duration-300 text-left hover:shadow-md ${
                      formData.type === 'getzep' 
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-md ring-2 ring-purple-500/20' 
                        : 'border-border/50 hover:border-purple-500/50 hover:bg-purple-50/30 dark:hover:bg-purple-950/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                        <Brain className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">GetZep</h4>
                        <p className="text-xs text-purple-600 dark:text-purple-400">Knowledge Graph</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Intelligent knowledge graph for understanding relationships, entities, and context.
                    </p>
                    <div className="mt-2 flex items-center text-xs text-muted-foreground">
                      <span>• Relationships</span>
                      <span className="mx-1">•</span>
                      <span>• Context</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configuration */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in-50 duration-300">
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {formData.type === 'pinecone' ? 'Pinecone Configuration' : 'GetZep Configuration'}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {formData.type === 'pinecone' 
                    ? 'Connect to your Pinecone vector database' 
                    : 'Connect to your GetZep knowledge graph'
                  }
                </p>
              </div>

              {formData.type === 'pinecone' && (
                <div className="max-w-lg mx-auto">
                  <div className="bg-gradient-to-br from-blue-50/30 to-blue-100/20 dark:from-blue-950/10 dark:to-blue-900/5 border border-blue-200/30 dark:border-blue-800/20 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          API Key Connection
                          <span className="text-destructive text-xs">*</span>
                        </label>
                        <CredentialSelector
                          providerName="pinecone"
                          value={formData.config?.connectionId || ''}
                          onChange={(id) => setFormData({ ...formData, config: { ...formData.config, connectionId: id } })}
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">Choose your saved Pinecone API key from Integrations.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Region
                          <span className="text-destructive text-xs">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.config?.region || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, region: e.target.value }
                          })}
                          className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 text-sm"
                          placeholder="us-west-2"
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">AWS region for your index</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Host URL
                          <span className="text-destructive text-xs">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.config?.host || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, host: e.target.value }
                          })}
                          className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 text-sm"
                          placeholder="https://your-index.pinecone.io"
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">Your index endpoint URL</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Index Name
                          <span className="text-destructive text-xs">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.config?.indexName || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, indexName: e.target.value }
                          })}
                          className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 text-sm"
                          placeholder="my-vector-index"
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">Name of your Pinecone index</p>
                      </div>
                    </div>

                    <div className="space-y-2 max-w-xs">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        Vector Dimensions
                        <span className="text-destructive text-xs">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.config?.dimensions || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          config: { ...formData.config, dimensions: parseInt(e.target.value, 10) }
                        })}
                        className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 text-sm"
                        placeholder="1536"
                        disabled={isSaving}
                      />
                      <p className="text-xs text-muted-foreground">1536 for OpenAI, 768 for others</p>
                    </div>

                    {/* Search Tuning */}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Similarity Threshold
                          <span className="text-muted-foreground text-[10px]">(0–1)</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={(formData.similarity_threshold as number) ?? 0.5}
                          onChange={(e) => setFormData({
                            ...formData,
                            similarity_threshold: parseFloat(e.target.value)
                          })}
                          className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 text-sm"
                          placeholder="0.50"
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">Lower to include more results.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Max Results
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={(formData.max_results as number) ?? 5}
                          onChange={(e) => setFormData({
                            ...formData,
                            max_results: parseInt(e.target.value, 10)
                          })}
                          className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 text-sm"
                          placeholder="5"
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">Controls topK in vector search.</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Preview Length (chars)
                        </label>
                        <input
                          type="number"
                          min="50"
                          value={formData.config?.previewLength ?? 400}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, previewLength: parseInt(e.target.value, 10) }
                          })}
                          className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all duration-200 text-sm"
                          placeholder="400"
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">How much of each match to show.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Include Low-Confidence Fallback
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={(formData.config?.lowConfidenceFallback ?? true) as boolean}
                            onChange={(e) => setFormData({
                              ...formData,
                              config: { ...formData.config, lowConfidenceFallback: e.target.checked }
                            })}
                            className="h-4 w-4"
                            disabled={isSaving}
                          />
                          <span className="text-xs text-muted-foreground">Show top matches even if below threshold</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {formData.type === 'getzep' && (
                <div className="max-w-lg mx-auto">
                  <div className="bg-gradient-to-br from-purple-50/30 to-purple-100/20 dark:from-purple-950/10 dark:to-purple-900/5 border border-purple-200/30 dark:border-purple-800/20 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          API Key Connection
                          <span className="text-destructive text-xs">*</span>
                        </label>
                        <CredentialSelector
                          providerName="getzep"
                          value={formData.config?.connectionId || ''}
                          onChange={(id) => setFormData({ ...formData, config: { ...formData.config, connectionId: id } })}
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">Choose your saved GetZep API key from Integrations.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-foreground flex items-center gap-1">
                          Project ID
                          <span className="text-destructive text-xs">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.config?.projectId || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            config: { ...formData.config, projectId: e.target.value }
                          })}
                          className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all duration-200 text-sm"
                          placeholder="project-123"
                          disabled={isSaving}
                        />
                        <p className="text-xs text-muted-foreground">Your GetZep project identifier</p>
                      </div>
                    </div>

                    <div className="space-y-2 max-w-xs">
                      <label className="text-xs font-medium text-foreground flex items-center gap-1">
                        Collection Name
                        <span className="text-destructive text-xs">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.config?.collectionName || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          config: { ...formData.config, collectionName: e.target.value }
                        })}
                        className="w-full px-3 py-2.5 bg-background/70 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-purple-500/20 focus:border-purple-500/50 transition-all duration-200 text-sm"
                        placeholder="my-knowledge-graph"
                        disabled={isSaving}
                      />
                      <p className="text-xs text-muted-foreground">Collection name for organizing data</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in-50 duration-300">
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-foreground mb-1">Review & Create</h3>
                <p className="text-muted-foreground text-sm">Confirm your datastore configuration</p>
              </div>

              <div className="max-w-md mx-auto">
                <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-border/20 rounded-xl p-4 space-y-3">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-border/20">
                      <span className="text-xs font-medium text-muted-foreground">Datastore Name</span>
                      <span className="text-foreground font-medium text-sm">{formData.name}</span>
                    </div>
                    
                    {formData.description && (
                      <div className="flex items-start justify-between py-2 border-b border-border/20">
                        <span className="text-xs font-medium text-muted-foreground">Description</span>
                        <span className="text-foreground text-right max-w-xs text-xs">{formData.description}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2 border-b border-border/20">
                      <span className="text-xs font-medium text-muted-foreground">Type</span>
                      <div className="flex items-center gap-1">
                        {formData.type === 'pinecone' ? (
                          <>
                            <Database className="w-3 h-3 text-blue-500" />
                            <span className="text-foreground font-medium text-xs">Pinecone Vector Database</span>
                          </>
                        ) : (
                          <>
                            <Brain className="w-3 h-3 text-purple-500" />
                            <span className="text-foreground font-medium text-xs">GetZep Knowledge Graph</span>
                          </>
                        )}
                      </div>
                    </div>

                    {formData.type === 'pinecone' && (
                      <>
                        <div className="flex items-center justify-between py-2 border-b border-border/20">
                          <span className="text-xs font-medium text-muted-foreground">Region</span>
                          <span className="text-foreground font-mono text-xs">{formData.config?.region}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/20">
                          <span className="text-xs font-medium text-muted-foreground">Index Name</span>
                          <span className="text-foreground font-mono text-xs">{formData.config?.indexName}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/20">
                          <span className="text-xs font-medium text-muted-foreground">Dimensions</span>
                          <span className="text-foreground font-mono text-xs">{formData.config?.dimensions}</span>
                        </div>
                      </>
                    )}

                    {formData.type === 'getzep' && (
                      <>
                        <div className="flex items-center justify-between py-2 border-b border-border/20">
                          <span className="text-xs font-medium text-muted-foreground">Project ID</span>
                          <span className="text-foreground font-mono text-xs">{formData.config?.projectId}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-border/20">
                          <span className="text-xs font-medium text-muted-foreground">Collection</span>
                          <span className="text-foreground font-mono text-xs">{formData.config?.collectionName}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="bg-muted/20 rounded-lg p-3 mt-4">
                    <p className="text-xs text-muted-foreground text-center">
                      🎉 Your datastore is ready to be created! Click "Create Datastore" to complete the setup.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </form>
      </div>

      {/* Multi-Step Footer */}
      <div className="relative border-t border-border/20 bg-gradient-to-r from-muted/20 to-muted/10 px-5 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side - Progress Info */}
          <div className="text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              Step {currentStep} of {totalSteps}
              {formData.type && (
                <>
                  <span className="mx-1">•</span>
                  {formData.type === 'pinecone' ? (
                    <>
                      <Database className="w-3 h-3 text-blue-500" />
                      <span className="text-xs">Pinecone</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-3 h-3 text-purple-500" />
                      <span className="text-xs">GetZep</span>
                    </>
                  )}
                </>
              )}
            </span>
          </div>
          
          {/* Right Side - Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-2 text-muted-foreground hover:text-foreground transition-all duration-200 font-medium text-xs disabled:opacity-50 hover:bg-background/50 rounded-lg"
              disabled={isSaving}
            >
              Cancel
            </button>

            {/* Previous Button */}
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                disabled={isSaving}
                className="px-4 py-2 border border-border hover:border-border/80 text-foreground hover:bg-background/50 rounded-lg transition-all duration-200 font-medium text-xs disabled:opacity-50"
              >
                Previous
              </button>
            )}

            {/* Next Button */}
            {currentStep < totalSteps && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={isSaving || !canProceedToStep(currentStep + 1)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 min-w-[80px] justify-center"
              >
                <span>Next</span>
                <div className="w-3 h-3 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <span className="text-xs">→</span>
                </div>
              </button>
            )}

            {/* Create/Update Button - Only on last step */}
            {currentStep === totalSteps && (
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isSaving || !canProceedToStep(currentStep)}
                className="px-5 py-2 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-lg hover:shadow-md hover:shadow-primary/25 transition-all duration-200 font-medium text-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center gap-1 min-w-[120px] justify-center"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <span>{isEditing ? 'Update Datastore' : 'Create Datastore'}</span>
                    <div className="w-3 h-3 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                      <span className="text-xs">✓</span>
                    </div>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}