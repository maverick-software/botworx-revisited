import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { toast } from 'react-hot-toast';
import { Loader2, Save, Check, X, Sparkles, Brain, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MODEL_CARDS, getModelsByProvider, getAllProviders, getModelCard } from '@/lib/llm/modelRegistry';

const MBTI_TYPES = [
  { type: 'INTJ', name: 'The Architect', description: 'Imaginative and strategic thinkers with a plan for everything' },
  { type: 'INTP', name: 'The Thinker', description: 'Innovative inventors with an unquenchable thirst for knowledge' },
  { type: 'ENTJ', name: 'The Commander', description: 'Bold, imaginative and strong-willed leaders, always finding a way' },
  { type: 'ENTP', name: 'The Debater', description: 'Smart and curious thinkers who cannot resist an intellectual challenge' },
  { type: 'INFJ', name: 'The Advocate', description: 'Creative and insightful, inspired and independent perfectionists' },
  { type: 'INFP', name: 'The Mediator', description: 'Poetic, kind and altruistic people, always eager to help a good cause' },
  { type: 'ENFJ', name: 'The Protagonist', description: 'Charismatic and inspiring leaders, able to mesmerize their listeners' },
  { type: 'ENFP', name: 'The Campaigner', description: 'Enthusiastic, creative and sociable free spirits' },
  { type: 'ISTJ', name: 'The Logistician', description: 'Practical and fact-minded, reliable and responsible' },
  { type: 'ISFJ', name: 'The Protector', description: 'Warm-hearted and dedicated, always ready to protect their loved ones' },
  { type: 'ESTJ', name: 'The Executive', description: 'Excellent administrators, unsurpassed at managing things or people' },
  { type: 'ESFJ', name: 'The Consul', description: 'Extraordinarily caring, social and popular people, always eager to help' },
  { type: 'ISTP', name: 'The Virtuoso', description: 'Bold and practical experimenters, masters of all kinds of tools' },
  { type: 'ISFP', name: 'The Adventurer', description: 'Flexible and charming artists, always ready to explore new possibilities' },
  { type: 'ESTP', name: 'The Entrepreneur', description: 'Smart, energetic and perceptive people, truly enjoy living on the edge' },
  { type: 'ESFP', name: 'The Entertainer', description: 'Spontaneous, energetic and enthusiastic people - life is never boring' }
];

const getMBTIName = (type: string): string => {
  return MBTI_TYPES.find(mbti => mbti.type === type)?.name || 'Unknown Type';
};

const getMBTIDescription = (type: string): string => {
  return MBTI_TYPES.find(mbti => mbti.type === type)?.description || 'No description available';
};

interface GeneralTabProps {
  agentId: string;
  agentData?: {
    name?: string;
    description?: string;
    role?: string;
    model?: string;
    personality?: string;
    metadata?: {
      mbtiType?: string;
      purpose?: string;
      theme?: string;
      [key: string]: any;
    };
  };
  onAgentUpdated?: (updatedData: any) => void;
}

import { TabRef } from './types';

export const GeneralTab = forwardRef<TabRef, GeneralTabProps>(({ agentId, agentData, onAgentUpdated }, ref) => {
  const [description, setDescription] = useState(agentData?.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [provider, setProvider] = useState<string>('openai');
  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const supabase = useSupabaseClient();
  
  // Track initial values for change detection
  const [initialValues, setInitialValues] = useState({
    description: agentData?.description || '',
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096
  });

  // Load agent LLM preferences
  useEffect(() => {
    const loadLLMPreferences = async () => {
      if (!agentId) return;
      
      setLoadingPreferences(true);
      try {
        const { data, error } = await supabase
          .from('agent_llm_preferences')
          .select('provider, model, params, embedding_model')
          .eq('agent_id', agentId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error loading LLM preferences:', error);
        } else if (data) {
          const loadedProvider = data.provider || 'openai';
          const loadedModel = data.model || 'gpt-4o-mini';
          const params = data.params || {};
          const loadedTemperature = params.temperature ?? 0.7;
          const loadedMaxTokens = params.maxTokens ?? 4096;
          
          setProvider(loadedProvider);
          setModel(loadedModel);
          setTemperature(loadedTemperature);
          setMaxTokens(loadedMaxTokens);
          
          // Update initial values for change detection
          setInitialValues({
            description: agentData?.description || '',
            provider: loadedProvider,
            model: loadedModel,
            temperature: loadedTemperature,
            maxTokens: loadedMaxTokens
          });
        }
      } catch (error) {
        console.error('Error loading LLM preferences:', error);
      } finally {
        setLoadingPreferences(false);
      }
    };

    loadLLMPreferences();
  }, [agentId, supabase]);

  useEffect(() => {
    setDescription(agentData?.description || '');
  }, [agentData]);

  const handleSave = async () => {
    if (!description.trim()) {
      toast.error('Agent description is required');
      return;
    }

    setIsLoading(true);
    setSaveState('saving');
    
    try {
      // Check if user is admin - admins can edit any agent
      const { data: { user } } = await supabase.auth.getUser();
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role_id, roles(name)')
        .eq('user_id', user?.id);
      
      const isAdmin = roles?.some((r: any) => r.roles?.name === 'admin');
      
      // Update basic agent info (only description, name moved to Identity tab)
      // Admin users can update any agent, regular users only their own
      let agentQuery = supabase
        .from('agents')
        .update({
          description: description.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId);
      
      // Only filter by user_id if not admin
      if (!isAdmin) {
        agentQuery = agentQuery.eq('user_id', user?.id);
      }
      
      const { data: agentData, error: agentError } = await agentQuery
        .select()
        .single();

      if (agentError) throw agentError;

      // Update or create LLM preferences
      const { error: prefsError } = await supabase
        .from('agent_llm_preferences')
        .upsert({
          agent_id: agentId,
          provider: provider,
          model: model,
          params: {
            temperature: temperature,
            maxTokens: maxTokens
          },
          embedding_model: 'text-embedding-3-small', // Default embedding model
          updated_at: new Date().toISOString()
        });

      if (prefsError) throw prefsError;

      // Success state
      setSaveState('success');
      toast.success('Agent details updated successfully');
      onAgentUpdated?.(agentData);
      
      // Update initial values to current values after successful save
      setInitialValues({
        description: description,
        provider: provider,
        model: model,
        temperature: temperature,
        maxTokens: maxTokens
      });

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveState('idle');
      }, 2000);

    } catch (error) {
      console.error('Error updating agent:', error);
      console.error('Error details:', error);
      
      // Error state
      setSaveState('error');
      toast.error('Failed to update agent details');

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveState('idle');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = 
    description !== initialValues.description ||
    provider !== initialValues.provider ||
    model !== initialValues.model ||
    temperature !== initialValues.temperature ||
    maxTokens !== initialValues.maxTokens;

  // Expose save method and state to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    hasChanges,
    saving: saveState === 'saving',
    saveSuccess: saveState === 'success'
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">General Information</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your agent's basic information, identity, and language model.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Description - Moved agent name to Identity tab */}
        <Card>
          <CardHeader>
            <CardTitle>Agent Description</CardTitle>
            <CardDescription>
              A brief description of the agent's capabilities and intended use.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="agent-description" className="text-sm font-medium">
                  Description <span className="text-destructive">*</span>
                </Label>
                {!isEditingDescription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingDescription(true)}
                    className="h-8"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Assist
                  </Button>
                )}
              </div>
              {isEditingDescription ? (
                <Textarea
                  id="agent-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this agent does and its purpose"
                  className="min-h-[100px] resize-none w-full"
                  autoFocus
                />
              ) : (
                <div 
                  className="text-sm cursor-pointer hover:text-muted-foreground/80 transition-colors"
                  onClick={() => setIsEditingDescription(true)}
                >
                  {description || (
                    <span className="text-muted-foreground italic">Click to add a description...</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* LLM Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Language Model</CardTitle>
            <CardDescription>
              Choose the language model provider and specific model that powers your agent's responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingPreferences ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading model preferences...</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="provider-select">Provider</Label>
                  <Select value={provider} onValueChange={(value) => {
                    setProvider(value);
                    // Reset to first available model for the new provider
                    const providerModels = getModelsByProvider(value as any);
                    if (providerModels.length > 0) {
                      setModel(providerModels[0].id);
                    }
                  }}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Select a provider..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllProviders().map((prov) => (
                        <SelectItem key={prov} value={prov}>
                          {prov === 'openai' && 'OpenAI'}
                          {prov === 'anthropic' && 'Anthropic'}
                          {prov === 'google' && 'Google (Gemini)'}
                          {prov === 'mistral' && 'Mistral AI'}
                          {prov === 'groq' && 'Groq'}
                          {prov === 'openrouter' && 'OpenRouter'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model-select">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="max-w-md">
                      <SelectValue placeholder="Select a model..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getModelsByProvider(provider as any).map((modelCard) => (
                        <SelectItem key={modelCard.id} value={modelCard.id}>
                          <div className="flex items-center justify-between w-full">
                            <span>{modelCard.displayName}</span>
                            {modelCard.category === 'reasoning' && (
                              <Brain className="h-3.5 w-3.5 text-purple-500 ml-2" />
                            )}
                            {modelCard.category === 'fast' && (
                              <Zap className="h-3.5 w-3.5 text-yellow-500 ml-2" />
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {getModelCard(model) && (
                    <p className="text-xs text-muted-foreground">
                      Context: {getModelCard(model)?.context.toLocaleString()} tokens • 
                      Tools: {getModelCard(model)?.supportsTools ? 'Supported' : 'Not supported'} • 
                      Streaming: {getModelCard(model)?.supportsStreaming ? 'Supported' : 'Not supported'}
                    </p>
                  )}
                </div>

                {/* Advanced Settings - Collapsible */}
                <div className="pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="w-full justify-between"
                  >
                    <span className="text-sm font-medium">Advanced Model Settings</span>
                    <span className="text-xs text-muted-foreground">
                      {showAdvancedSettings ? '▲' : '▼'}
                    </span>
                  </Button>
                  
                  {showAdvancedSettings && (
                    <div className="mt-4 space-y-4 px-4 py-4 bg-muted/30 rounded-lg border border-border/50">
                      {/* Temperature */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="temperature">Temperature</Label>
                          <span className="text-xs text-muted-foreground">{temperature}</span>
                        </div>
                        <input
                          type="range"
                          id="temperature"
                          min="0"
                          max="2"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Precise (0.0)</span>
                          <span>Balanced (1.0)</span>
                          <span>Creative (2.0)</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Controls randomness. Lower values are more focused and deterministic. Higher values are more creative and random.
                        </p>
                      </div>

                      {/* Max Tokens */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="maxTokens">Max Output Tokens</Label>
                          <span className="text-xs text-muted-foreground">{maxTokens}</span>
                        </div>
                        <input
                          type="range"
                          id="maxTokens"
                          min="256"
                          max="16384"
                          step="256"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                          className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>256</span>
                          <span>4096</span>
                          <span>16384</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Maximum number of tokens the model can generate in a single response.
                        </p>
                      </div>

                      <div className="pt-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                        <strong>Note:</strong> These settings are saved automatically when you save model preferences. 
                        Recommended defaults: Temperature 0.7, Max Tokens 4096.
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* MBTI Personality Display */}
        {agentData?.metadata?.mbtiType && (
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="secondary">{agentData.metadata.mbtiType}</Badge>
                Personality Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="font-medium">
                  {getMBTIName(agentData.metadata.mbtiType)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {getMBTIDescription(agentData.metadata.mbtiType)}
                </p>
                {agentData.metadata.purpose && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-sm font-medium mb-1">Original Purpose</div>
                    <p className="text-sm text-muted-foreground">{agentData.metadata.purpose}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
});
