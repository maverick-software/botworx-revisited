import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useConnections } from '@/integrations/_shared/hooks/useConnections';
import { toast } from 'react-hot-toast';
import { TabRef } from './types';
import { 
  Volume2, 
  Search, 
  FileText, 
  Loader2, 
  Save,
  ExternalLink,
  AlertCircle,
  Settings,
  Plus,
  Key,
  ScanText,
  MessageCircle,
  RefreshCw,
  Database
} from 'lucide-react';

interface ToolsTabProps {
  agentId: string;
  agentData?: any;
  onAgentUpdated?: (updatedData: any) => void;
}

interface ToolSettings {
  voice_enabled: boolean;
  web_search_enabled: boolean;
  document_creation_enabled: boolean;
  ocr_processing_enabled: boolean;
  temporary_chat_links_enabled: boolean;
}

interface CredentialModalState {
  isOpen: boolean;
  toolType: 'voice' | 'web_search' | 'document_creation' | 'ocr_processing' | 'temporary_chat_links' | null;
  selectedProvider: string;
  availableProviders: any[];
  availableCredentials: any[];
}

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresOAuth: boolean;
}

export const ToolsTab = forwardRef<TabRef, ToolsTabProps>(({ agentId, agentData, onAgentUpdated }, ref) => {
  console.log('[ToolsTab] Mounted with agentId:', agentId, 'agentData:', agentData);
  
  const [settings, setSettings] = useState<ToolSettings>({
    voice_enabled: false,
    web_search_enabled: false,
    document_creation_enabled: false,
    ocr_processing_enabled: false,
    temporary_chat_links_enabled: false
  });
  const [selectedCredentials, setSelectedCredentials] = useState<{
    web_search?: string;
    voice?: string;
    document_creation?: string;
    ocr_processing?: string;
    temporary_chat_links?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [credentialModal, setCredentialModal] = useState<CredentialModalState>({
    isOpen: false,
    toolType: null,
    selectedProvider: '',
    availableProviders: [],
    availableCredentials: []
  });
  const [newApiKey, setNewApiKey] = useState('');
  const [agentSettings, setAgentSettings] = useState<Record<string, any>>({});
  const [agentMetadata, setAgentMetadata] = useState<Record<string, any>>({});
  const [hasAssignedDocuments, setHasAssignedDocuments] = useState(false);
  const [assignedDocumentsCount, setAssignedDocumentsCount] = useState(0);
  const [refreshingCache, setRefreshingCache] = useState(false);
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  const { connections } = useConnections({ includeRevoked: false });

  // Expose save method and state to parent via ref
  useImperativeHandle(ref, () => ({
    save: async () => {
      await handleSave();
    },
    hasChanges,
    saving: isLoading,
    saveSuccess
  }));

  // Check for assigned documents
  useEffect(() => {
    const checkAssignedDocuments = async () => {
      if (!agentId || !user) return;
      
      try {
        const { data, error } = await supabase
          .from('agent_media_assignments')
          .select('id')
          .eq('agent_id', agentId)
          .eq('user_id', user.id)
          .eq('is_active', true);
        
        if (error) throw error;
        
        const count = data?.length || 0;
        const hasDocuments = count > 0;
        setHasAssignedDocuments(hasDocuments);
        setAssignedDocumentsCount(count);
        
        // If documents are assigned but ocr_processing is not enabled, enable it automatically
        if (hasDocuments && agentData) {
          const metadata = agentData.metadata || {};
          const toolSettings = metadata.settings || {};
          
          if (!toolSettings.ocr_processing_enabled) {
            console.log('[ToolsTab] Auto-enabling Read Documents for agent with assigned documents');
            
            // Enable in database
            const updatedSettings = { ...toolSettings, ocr_processing_enabled: true };
            const updatedMetadata = {
              ...metadata,
              settings: updatedSettings
            };

            const { error: updateError } = await supabase
              .from('agents')
              .update({ metadata: updatedMetadata })
              .eq('id', agentId)
              .eq('user_id', user.id);

            if (updateError) {
              console.error('Error auto-enabling Read Documents:', updateError);
            } else {
              // Update local state
              setAgentSettings(updatedSettings);
              setAgentMetadata(updatedMetadata);
              setSettings(prev => ({ ...prev, ocr_processing_enabled: true }));
              
              // Notify parent
              if (onAgentUpdated) {
                onAgentUpdated({ ...agentData, id: agentId, metadata: updatedMetadata });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking assigned documents:', error);
      }
    };
    
    checkAssignedDocuments();
  }, [agentId, user, supabase, agentData, onAgentUpdated]);

  useEffect(() => {
    // Load current tool settings from agent metadata
    if (agentData) {
      const metadata = agentData.metadata || {};
      const toolSettings = metadata.settings || {};
      
      setAgentMetadata(metadata);
      setAgentSettings(toolSettings);
      
      // Sync database setting with UI state for ocr_processing
      const shouldEnableOCR = hasAssignedDocuments ? true : (toolSettings.ocr_processing_enabled || false);
      
      setSettings({
        voice_enabled: toolSettings.voice_enabled || false,
        web_search_enabled: toolSettings.web_search_enabled || false,
        document_creation_enabled: toolSettings.document_creation_enabled || false,
        ocr_processing_enabled: shouldEnableOCR,
        temporary_chat_links_enabled: toolSettings.temporary_chat_links_enabled || false
      });
      
      setSelectedCredentials({
        web_search: toolSettings.web_search_credential || '',
        voice: toolSettings.voice_credential || '',
        document_creation: toolSettings.document_creation_credential || '',
        ocr_processing: toolSettings.ocr_processing_credential || '',
        temporary_chat_links: toolSettings.temporary_chat_links_credential || ''
      });
      
      // If UI state doesn't match database, sync it immediately
      if (hasAssignedDocuments && !toolSettings.ocr_processing_enabled) {
        console.log('[ToolsTab] UI shows enabled but DB shows disabled, syncing database...');
        const updatedSettings = { ...toolSettings, ocr_processing_enabled: true };
        const updatedMetadata = { ...metadata, settings: updatedSettings };
        
        supabase
          .from('agents')
          .update({ metadata: updatedMetadata })
          .eq('id', agentId)
          .eq('user_id', user?.id)
          .then(({ error }) => {
            if (error) {
              console.error('[ToolsTab] Error syncing OCR setting to database:', error);
            } else {
              console.log('[ToolsTab] Successfully synced OCR setting to database');
              setAgentSettings(updatedSettings);
              setAgentMetadata(updatedMetadata);
              if (onAgentUpdated) {
                onAgentUpdated({ ...agentData, id: agentId, metadata: updatedMetadata });
              }
            }
          });
      }
    }
  }, [agentData, hasAssignedDocuments, agentId, user, supabase, onAgentUpdated]);

  // Provider configurations
  const providerConfigs: Record<string, ProviderConfig[]> = {
    ocr_processing: [
      {
        id: 'azure-document-intelligence',
        name: 'Azure Document Intelligence',
        description: 'Microsoft\'s enterprise-grade document analysis and text extraction service',
        requiresApiKey: true,
        requiresOAuth: false
      },
      {
        id: 'mistral-ocr',
        name: 'Mistral OCR',
        description: 'Advanced AI-powered OCR and document processing with structured output',
        requiresApiKey: true,
        requiresOAuth: false
      }
    ],
    voice: [
      { id: 'elevenlabs', name: 'ElevenLabs', description: 'High-quality AI voice synthesis', requiresApiKey: true, requiresOAuth: false },
      { id: 'openai_tts', name: 'OpenAI TTS', description: 'OpenAI text-to-speech', requiresApiKey: true, requiresOAuth: false },
      { id: 'azure_speech', name: 'Azure Speech', description: 'Microsoft Azure Speech Services', requiresApiKey: true, requiresOAuth: false }
    ],
    web_search: [
      { id: 'serper_api', name: 'Serper API', description: 'Google Search API via Serper', requiresApiKey: true, requiresOAuth: false },
      { id: 'serpapi', name: 'SerpAPI', description: 'Google Search results API', requiresApiKey: true, requiresOAuth: false },
      { id: 'brave_search', name: 'Brave Search', description: 'Privacy-focused search API', requiresApiKey: true, requiresOAuth: false }
    ],
    document_creation: [
      { id: 'google_docs', name: 'Google Docs', description: 'Create and edit Google Documents', requiresApiKey: false, requiresOAuth: true },
      { id: 'microsoft_office', name: 'Microsoft Office', description: 'Create and edit Office documents', requiresApiKey: false, requiresOAuth: true },
      { id: 'notion', name: 'Notion', description: 'Create and manage Notion pages', requiresApiKey: true, requiresOAuth: false }
    ],
    temporary_chat_links: [
      { id: 'temporary_chat_internal', name: 'Temporary Chat Links', description: 'Create public chat links for anonymous users', requiresApiKey: false, requiresOAuth: false }
    ]
  };

  const handleToggle = async (tool: keyof ToolSettings, enabled: boolean) => {
    console.log('[ToolsTab] handleToggle called - tool:', tool, 'enabled:', enabled, 'agentId:', agentId);
    
    if (!agentId) {
      console.error('[ToolsTab] agentId is undefined, cannot toggle tool');
      toast.error('Agent ID is missing. Please close and reopen the settings.');
      return;
    }
    
    // Prevent disabling Read Documents if agent has assigned documents
    if (tool === 'ocr_processing_enabled' && !enabled && hasAssignedDocuments) {
      toast.error(`Cannot disable Read Documents while ${assignedDocumentsCount} document${assignedDocumentsCount !== 1 ? 's are' : ' is'} assigned. Remove documents from the Media tab first.`, {
        duration: 4000
      });
      return;
    }
    
    if (enabled) {
      // Check if credentials exist for this tool
      const toolType = tool.replace('_enabled', '') as 'voice' | 'web_search' | 'document_creation' | 'ocr_processing' | 'temporary_chat_links';
      
      // Skip credential check for built-in tools that don't require external APIs
      const builtInTools = ['temporary_chat_links', 'document_creation'];
      if (!builtInTools.includes(toolType)) {
        const availableCredentials = getAvailableCredentials(toolType);
        
        if (availableCredentials.length === 0) {
          // Open credential selection modal
          openCredentialModal(toolType);
          return;
        }
      }
    }
    
    // Update local state immediately
    setSettings(prev => ({ ...prev, [tool]: enabled }));
    
    if (!enabled) {
      // Clear selected credential when disabling
      const toolType = tool.replace('_enabled', '') as 'voice' | 'web_search' | 'document_creation' | 'ocr_processing';
      setSelectedCredentials(prev => ({ ...prev, [toolType]: '' }));
    }

    // Save to database immediately
    try {
      const updatedSettings = { ...agentSettings, [tool]: enabled };
      const updatedMetadata = {
        ...agentMetadata,
        settings: updatedSettings
      };

      const { error } = await supabase
        .from('agents')
        .update({ metadata: updatedMetadata })
        .eq('id', agentId)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update local state
      setAgentSettings(updatedSettings);
      setAgentMetadata(updatedMetadata);
      
      // Show brief success feedback
      const toolName = tool.replace('_enabled', '').replace('_', ' ');
      toast.success(`${toolName} ${enabled ? 'enabled' : 'disabled'}`, {
        duration: 2000
      });

      // Notify parent component
      if (onAgentUpdated) {
        onAgentUpdated({ ...agentData, id: agentId, metadata: updatedMetadata });
      }
    } catch (error: any) {
      console.error('Error updating tool setting:', error);
      // Revert local state on error
      setSettings(prev => ({ ...prev, [tool]: !enabled }));
      if (!enabled) {
        const toolType = tool.replace('_enabled', '') as 'voice' | 'web_search' | 'document_creation' | 'ocr_processing';
        setSelectedCredentials(prev => ({ ...prev, [toolType]: selectedCredentials[toolType] }));
      }
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} ${tool.replace('_enabled', '').replace('_', ' ')}`);
    }
  };

  const checkExistingCredentials = async (toolType: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_integration_credentials')
        .select('id')
        .eq('user_id', user?.id)
        .eq('connection_status', 'active')
        .ilike('connection_name', `%${toolType}%`)
        .limit(1);

      if (error) {
        console.error('Error checking credentials:', error);
        return false;
      }
      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  };

  const openCredentialModal = async (toolType: 'voice' | 'web_search' | 'document_creation' | 'ocr_processing' | 'temporary_chat_links') => {
    // Get provider names for this tool type
    const configProviders = providerConfigs[toolType] || [];
    const providerNames = configProviders.map(p => p.id);
    
    // Fetch actual service providers from database
    let providers: ProviderConfig[] = [];
    try {
      const { data: serviceProviders, error: providersError } = await supabase
        .from('service_providers')
        .select('id, name, display_name')
        .in('name', providerNames)
        .eq('is_enabled', true);
      
      if (providersError) throw providersError;
      
      // Map database providers to UI config format
      providers = (serviceProviders || []).map(sp => {
        const config = configProviders.find(cp => cp.id === sp.name);
        return {
          id: sp.id, // Use actual UUID from database
          name: sp.display_name || sp.name,
          description: config?.description || '',
          requiresApiKey: config?.requiresApiKey || false,
          requiresOAuth: config?.requiresOAuth || false
        };
      });
    } catch (error) {
      console.error('Error loading service providers:', error);
      // Fallback to hardcoded configs if database query fails
      providers = configProviders;
    }
    
    // Load existing credentials
    try {
      const { data: credentials, error } = await supabase
        .from('user_integration_credentials')
        .select('*')
        .eq('user_id', user?.id)
        .ilike('connection_name', `%${toolType}%`);

      if (error) {
        console.error('Error loading credentials:', error);
        // Continue anyway to allow new credential creation
      }

      setCredentialModal({
        isOpen: true,
        toolType,
        selectedProvider: '',
        availableProviders: providers,
        availableCredentials: credentials || []
      });
    } catch (error) {
      console.error('Error loading credentials:', error);
      // Continue anyway to allow new credential creation
      setCredentialModal({
        isOpen: true,
        toolType,
        selectedProvider: '',
        availableProviders: providers,
        availableCredentials: []
      });
    }
  };

  const handleProviderSelect = (providerId: string) => {
    setCredentialModal(prev => ({ ...prev, selectedProvider: providerId }));
  };

  const handleCreateCredential = async () => {
    if (!credentialModal.selectedProvider || !user) return;

    const provider = credentialModal.availableProviders.find(p => p.id === credentialModal.selectedProvider);
    if (!provider) return;

    try {
      if (provider.requiresApiKey && !newApiKey.trim()) {
        toast.error('API key is required');
        return;
      }

      const configuration = provider.requiresApiKey 
        ? { api_key: newApiKey, provider: provider.id, auth_type: 'api_key' }
        : { provider: provider.id, auth_type: 'oauth', oauth_pending: true };

      const credentialData = {
        user_id: user.id,
        oauth_provider_id: provider.id, // Use the actual service provider UUID
        external_user_id: `api_key_${Date.now()}`, // Required field - generate unique ID for API keys
        external_username: provider.name || null,
        connection_name: `${credentialModal.toolType}_${provider.id}`,
        connection_status: 'active' as const,
        credential_type: 'api_key' as const,
        scopes_granted: provider.requiresApiKey ? ['api_access'] : [],
        vault_access_token_id: provider.requiresApiKey ? newApiKey : null, // Store API key in vault field temporarily
        vault_refresh_token_id: null,
        token_expires_at: null,
        connection_metadata: configuration // Correct column name
        // created_at and updated_at have defaults, don't set explicitly
      };

      const { error } = await supabase
        .from('user_integration_credentials')
        .insert(credentialData);

      if (error) throw error;

      toast.success(`${provider.name} credentials saved successfully`);
      setNewApiKey('');
      setCredentialModal(prev => ({ ...prev, isOpen: false }));
      
      // Enable the tool now that credentials are configured
      const toolKey = `${credentialModal.toolType}_enabled` as keyof ToolSettings;
      setSettings(prev => ({ ...prev, [toolKey]: true }));
      setHasChanges(true);
      
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Failed to save credentials');
    }
  };

  const handleRefreshCache = async () => {
    console.log('[ToolsTab] Refresh cache button clicked');
    
    // Use user_id from agentData first, fallback to authenticated user
    const userId = agentData?.user_id || user?.id;
    
    if (!userId) {
      console.error('[ToolsTab] Missing user_id - agentData:', agentData, 'user:', user);
      toast.error('Unable to refresh cache: missing user information');
      return;
    }

    console.log('[ToolsTab] Starting cache refresh for agent:', agentId, 'user:', userId);
    setRefreshingCache(true);
    
    try {
      toast.loading('Refreshing tool cache...', { duration: 1000 });

      const { data, error } = await supabase.functions.invoke('invalidate-agent-tool-cache', {
        body: {
          agent_id: agentId,
          user_id: userId
        }
      });

      console.log('[ToolsTab] Cache refresh response:', { data, error });

      if (error) {
        console.error('[ToolsTab] Cache refresh error:', error);
        toast.error(`Failed to refresh tool cache: ${error.message}`);
        return;
      }

      if (data?.success) {
        toast.success(`Tool cache refreshed successfully! (${data.tools_count || 0} tools updated)`);
      } else {
        toast.error(data?.error || 'Failed to refresh cache');
      }
    } catch (error: any) {
      console.error('[ToolsTab] Cache refresh exception:', error);
      toast.error(`Failed to refresh tool cache: ${error.message || 'Unknown error'}`);
    } finally {
      setRefreshingCache(false);
      console.log('[ToolsTab] Cache refresh complete');
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Save tool settings to agent metadata
      const updatedMetadata = {
        ...agentMetadata,
        settings: {
          ...agentSettings,
          voice_enabled: settings.voice_enabled,
          web_search_enabled: settings.web_search_enabled,
          document_creation_enabled: settings.document_creation_enabled,
          web_search_credential: selectedCredentials.web_search,
          voice_credential: selectedCredentials.voice,
          document_creation_credential: selectedCredentials.document_creation
        }
      };

      const { error: updateError } = await supabase
        .from('agents')
        .update({ metadata: updatedMetadata })
        .eq('id', agentId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      toast.success('Tool settings updated successfully! 🛠️');
      
      // Show saved state for 2 seconds
      setSaved(true);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaved(false);
        setSaveSuccess(false);
      }, 2000);
      
      setHasChanges(false);
      
      // Call onAgentUpdated to update parent state
      if (onAgentUpdated) {
        // Make sure we include the id field
        onAgentUpdated({ 
          id: agentId,
          ...agentData, 
          metadata: updatedMetadata 
        });
      }
    } catch (error) {
      console.error('Error updating tool settings:', error);
      toast.error('Failed to update tool settings');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for available credentials
  const getAvailableCredentials = (toolType: string) => {
    const providerNames = {
      'web_search': ['serper_api', 'serpapi', 'brave_search'],
      'voice': ['elevenlabs'],
      'document_creation': ['google_docs', 'microsoft_office', 'notion'],
      'ocr_processing': ['mistral_ai', 'azure-document-intelligence'],
      'temporary_chat_links': ['temporary_chat_internal']
    };
    
    return connections.filter(c => 
      providerNames[toolType]?.includes(c.provider_name) && 
      c.connection_status === 'active'
    );
  };

  const tools = [
    {
      id: 'voice_enabled' as keyof ToolSettings,
      name: 'Voice Synthesis',
      description: 'Enable text-to-speech capabilities for agent responses',
      icon: Volume2,
      enabled: settings.voice_enabled,
      requiresApi: 'ElevenLabs API',
      availableCredentials: getAvailableCredentials('voice'),
      toolType: 'voice' as const,
      usesSystemKey: false
    },
    {
      id: 'web_search_enabled' as keyof ToolSettings,
      name: 'Web Search',
      description: 'Allow agent to search the web for current information',
      icon: Search,
      enabled: settings.web_search_enabled,
      requiresApi: 'System API Key (Serper API)',
      availableCredentials: [],
      toolType: 'web_search' as const,
      usesSystemKey: true
    },
    {
      id: 'document_creation_enabled' as keyof ToolSettings,
      name: 'Document Creation',
      description: 'Enable agent to create and edit documents, code files, and artifacts (inline preview with Canvas mode)',
      icon: FileText,
      enabled: settings.document_creation_enabled,
      requiresApi: 'Built-in Artifacts System (No API required)',
      availableCredentials: [],
      toolType: 'document_creation' as const,
      usesSystemKey: false
    },
    {
      id: 'ocr_processing_enabled' as keyof ToolSettings,
      name: 'Read Documents',
      description: 'Enable text extraction from PDFs and images',
      icon: ScanText,
      enabled: settings.ocr_processing_enabled,
      requiresApi: 'System API Key (Mistral AI)',
      availableCredentials: [],
      toolType: 'ocr_processing' as const,
      usesSystemKey: true
    },
    {
      id: 'temporary_chat_links_enabled' as keyof ToolSettings,
      name: 'Temporary Chat Links',
      description: 'Create public chat links for anonymous users (employee check-ins, customer support)',
      icon: MessageCircle,
      enabled: settings.temporary_chat_links_enabled,
      requiresApi: 'Built-in (No API required)',
      availableCredentials: [],
      toolType: 'temporary_chat_links' as const,
      usesSystemKey: false
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium">Tools & Capabilities</h3>
          <p className="text-sm text-muted-foreground">
            Configure which tools and capabilities your agent can use.
          </p>
        </div>
        <Button
          onClick={handleRefreshCache}
          disabled={refreshingCache}
          variant="outline"
          size="sm"
          className="flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshingCache ? 'animate-spin' : ''}`} />
          Refresh Tool Cache
        </Button>
      </div>

      {/* Cache Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Database className="w-4 h-4" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">Tool Schema Cache</h4>
                <Badge variant="outline" className="text-xs">System</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                The tool cache stores schemas and metadata for all available tools. Refresh this cache if you've recently connected new integrations, updated API credentials, or if tools aren't appearing correctly in your agent's capabilities.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          const hasCredentials = tool.availableCredentials.length > 0;
          
          return (
            <Card key={tool.id}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        tool.enabled
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{tool.name}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={tool.id}
                        checked={tool.enabled}
                        onCheckedChange={(checked) => handleToggle(tool.id, checked)}
                        disabled={tool.id === 'ocr_processing_enabled' && hasAssignedDocuments}
                      />
                      <Label htmlFor={tool.id} className="sr-only">
                        Toggle {tool.name}
                      </Label>
                    </div>
                  </div>

                  {/* Document Assignment Notice */}
                  {tool.id === 'ocr_processing_enabled' && hasAssignedDocuments && (
                    <div className="pl-16 mt-2">
                      <div className="flex items-start space-x-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Required for Assigned Documents</p>
                          <p className="text-xs mt-1 text-blue-700 dark:text-blue-300">
                            This agent has {assignedDocumentsCount} document{assignedDocumentsCount !== 1 ? 's' : ''} assigned. 
                            Read Documents must remain enabled. Remove all documents from the Media tab to disable this feature.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Credential Selection - Only show for non-system-key tools */}
                  {tool.enabled && hasCredentials && !tool.usesSystemKey && (
                    <div className="pl-16">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Credentials</Label>
                        <Select
                          value={selectedCredentials[tool.toolType] || ''}
                          onValueChange={async (value) => {
                            setSelectedCredentials(prev => ({ ...prev, [tool.toolType]: value }));
                            
                            // Save credential selection immediately
                            try {
                              const updatedSettings = { ...agentSettings, [`${tool.toolType}_credential`]: value };
                              const updatedMetadata = {
                                ...agentMetadata,
                                settings: updatedSettings
                              };

                              const { error } = await supabase
                                .from('agents')
                                .update({ metadata: updatedMetadata })
                                .eq('id', agentId)
                                .eq('user_id', user?.id);

                              if (error) throw error;

                              setAgentSettings(updatedSettings);
                              setAgentMetadata(updatedMetadata);
                              
                              toast.success(`Credentials updated for ${tool.name}`, { duration: 2000 });

                              if (onAgentUpdated) {
                                onAgentUpdated({ ...agentData, id: agentId, metadata: updatedMetadata });
                              }
                            } catch (error: any) {
                              console.error('Error updating credentials:', error);
                              // Revert on error
                              setSelectedCredentials(prev => ({ ...prev, [tool.toolType]: selectedCredentials[tool.toolType] || '' }));
                              toast.error(`Failed to update credentials for ${tool.name}`);
                            }
                          }}
                        >
                          <SelectTrigger className="w-full max-w-sm">
                            <SelectValue placeholder="Choose credentials..." />
                          </SelectTrigger>
                          <SelectContent>
                            {tool.availableCredentials.map((cred) => (
                              <SelectItem key={cred.connection_id} value={cred.connection_id}>
                                <div>
                                  <div className="font-medium">{cred.provider_name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {cred.connection_name}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedCredentials[tool.toolType] && (
                          <div className="text-xs text-green-600 mt-1">
                            ✓ Selected: {tool.availableCredentials.find(c => c.connection_id === selectedCredentials[tool.toolType])?.provider_name}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>



      {/* Credential Configuration Modal */}
      <Dialog open={credentialModal.isOpen} onOpenChange={(open) => 
        setCredentialModal(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Configure {credentialModal.toolType?.replace('_', ' ')} Provider</span>
            </DialogTitle>
            <DialogDescription>
              Select a provider and configure your credentials to enable this tool.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Existing Credentials */}
            {credentialModal.availableCredentials.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Existing Credentials</Label>
                <div className="space-y-2">
                  {credentialModal.availableCredentials.map((cred) => (
                    <div key={cred.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{cred.integration_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {cred.provider_id} • {cred.status}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Use existing credential and enable tool
                          const toolKey = `${credentialModal.toolType}_enabled` as keyof ToolSettings;
                          setSettings(prev => ({ ...prev, [toolKey]: true }));
                          setHasChanges(true);
                          setCredentialModal(prev => ({ ...prev, isOpen: false }));
                        }}
                      >
                        Use This
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or create new</span>
                  </div>
                </div>
              </div>
            )}

            {/* Provider Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Provider</Label>
              <Select value={credentialModal.selectedProvider} onValueChange={handleProviderSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a provider..." />
                </SelectTrigger>
                <SelectContent>
                  {credentialModal.availableProviders.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      <div>
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-xs text-muted-foreground">{provider.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Credential Input */}
            {credentialModal.selectedProvider && (
              <div className="space-y-4">
                {(() => {
                  const provider = credentialModal.availableProviders.find(p => p.id === credentialModal.selectedProvider);
                  if (!provider) return null;

                  return (
                    <div className="space-y-3">
                      {provider.requiresApiKey && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium flex items-center space-x-2">
                            <Key className="h-4 w-4" />
                            <span>API Key</span>
                          </Label>
                          <Input
                            type="password"
                            value={newApiKey}
                            onChange={(e) => setNewApiKey(e.target.value)}
                            placeholder="Enter your API key..."
                          />
                          <p className="text-xs text-muted-foreground">
                            Your API key will be encrypted and stored securely.
                          </p>
                        </div>
                      )}
                      
                      {provider.requiresOAuth && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            This provider requires OAuth authentication. Click "Connect" to authorize access.
                          </p>
                        </div>
                      )}

                      <div className="flex space-x-2 pt-2">
                        <Button
                          variant="outline"
                          onClick={() => setCredentialModal(prev => ({ ...prev, isOpen: false }))}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateCredential}
                          className="flex-1"
                          disabled={provider.requiresApiKey && !newApiKey.trim()}
                        >
                          {provider.requiresOAuth ? 'Connect' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

ToolsTab.displayName = 'ToolsTab';
