/**
 * Web Search Integration Card Component
 * Manages web search API key connections for agents
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Search, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Settings,
  Trash2
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface WebSearchProvider {
  name: string;
  display_name: string;
  base_url: string;
  rate_limit: string;
  supports_location: boolean;
  privacy_focused?: boolean;
}

interface WebSearchConnection {
  id: string;
  provider_name: string;
  provider_display_name: string;
  is_active: boolean;
  created_at: string;
}

interface WebSearchIntegrationCardProps {
  className?: string;
}

export function WebSearchIntegrationCard({ className }: WebSearchIntegrationCardProps) {
  const supabase = useSupabaseClient();
  const { user } = useAuth();
  
  const [connections, setConnections] = useState<WebSearchConnection[]>([]);
  const [providers, setProviders] = useState<WebSearchProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadConnections();
      loadProviders();
    }
  }, [user]);

  const loadProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('service_providers')
        .select('name, display_name, configuration')
        .in('name', ['serper', 'serpapi', 'brave_search'])
        .eq('is_enabled', true);

      if (error) throw error;

      const webSearchProviders = data?.map(provider => ({
        name: provider.name,
        display_name: provider.display_name,
        base_url: provider.configuration?.base_url || '',
        rate_limit: provider.configuration?.rate_limit || '',
        supports_location: provider.configuration?.supports_location || false,
        privacy_focused: provider.configuration?.privacy_focused || false,
      })) || [];

      setProviders(webSearchProviders);
    } catch (error) {
      console.error('Error loading web search providers:', error);
    }
  };

  const loadConnections = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_integration_credentials')
        .select(`
          id,
          is_active,
          created_at,
          service_providers!inner(name, display_name)
        `)
        .eq('user_id', user.id)
        .in('service_providers.name', ['serper', 'serpapi', 'brave_search']);

      if (error) throw error;

      const webSearchConnections = data?.map((conn: any) => ({
        id: conn.id,
        provider_name: conn.service_providers.name,
        provider_display_name: conn.service_providers.display_name,
        is_active: conn.is_active,
        created_at: conn.created_at,
      })) || [];

      setConnections(webSearchConnections);
    } catch (error) {
      console.error('Error loading web search connections:', error);
      toast.error('Failed to load web search connections');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async () => {
    if (!selectedProvider || !apiKey || !user) {
      setError('Please select a provider and enter an API key');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Get provider configuration
      const { data: providerData, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', selectedProvider)
        .single();

      if (providerError) throw providerError;

      // Encrypt API key using Supabase Vault
      const { data: encryptedKey, error: encryptError } = await supabase
        .rpc('vault_encrypt', { 
          data: apiKey,
          key_name: `${selectedProvider}_api_key_${user.id}`
        });

      if (encryptError) throw encryptError;

      // Store connection
      const { error: insertError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: providerData.id,
          external_user_id: user.id, // Required field
          external_username: `${selectedProvider} Connection`,
          connection_name: `${selectedProvider} Connection`,
          encrypted_access_token: encryptedKey,
          scopes_granted: ['web_search', 'news_search', 'image_search'],
          connection_status: 'active',
          credential_type: 'api_key' // Specify this is an API key connection
        });

      if (insertError) throw insertError;

      toast.success(`${providers.find(p => p.name === selectedProvider)?.display_name} API key added successfully!`);
      
      // Reset form
      setSelectedProvider('');
      setApiKey('');
      setShowAddModal(false);
      
      // Reload connections
      await loadConnections();

    } catch (error: any) {
      console.error('Error adding web search provider:', error);
      setError(error.message || 'Failed to add provider');
      toast.error('Failed to add web search provider');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveConnection = async (connectionId: string, providerName: string) => {
    if (!confirm(`Are you sure you want to remove your ${providerName} connection?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('user_integration_credentials')
        .delete()
        .eq('id', connectionId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success(`${providerName} connection removed`);
      await loadConnections();
    } catch (error) {
      console.error('Error removing connection:', error);
      toast.error('Failed to remove connection');
    }
  };

  const getProviderIcon = (providerName: string) => {
    switch (providerName) {
      case 'serper':
        return <Search className="h-4 w-4" />;
      case 'serpapi':
        return <Search className="h-4 w-4" />;
      case 'brave_search':
        return <Search className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getProviderDescription = (provider: WebSearchProvider) => {
    const features = [];
    if (provider.supports_location) features.push('Location-based');
    if (provider.privacy_focused) features.push('Privacy-focused');
    if (provider.rate_limit) features.push(`${provider.rate_limit} limit`);
    
    return features.length > 0 ? features.join(' • ') : 'Web search API';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Loading web search providers...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Web Search</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(true)}
              disabled={connections.length >= 3} // Limit to 3 providers
            >
              <Key className="h-4 w-4 mr-2" />
              Add API Key
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-2">
          {connections.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Web Search APIs Connected</h3>
              <p className="text-gray-600 mb-4">
                Connect web search APIs to enable your agents to search the web, 
                scrape content, and provide up-to-date information.
              </p>
              <Button onClick={() => setShowAddModal(true)}>
                <Key className="h-4 w-4 mr-2" />
                Add Your First API Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getProviderIcon(connection.provider_name)}
                    <div>
                      <div className="font-medium">{connection.provider_display_name}</div>
                      <div className="text-sm text-gray-500">
                        {getProviderDescription(providers.find(p => p.name === connection.provider_name) || {} as WebSearchProvider)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={connection.is_active ? "default" : "secondary"}>
                      {connection.is_active ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveConnection(connection.id, connection.provider_display_name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {connections.length > 0 && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your agents can now search the web, scrape content, and access up-to-date information. 
                Configure agent permissions in the agent edit page.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Add Provider Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Web Search API Key</DialogTitle>
            <DialogDescription>
              Connect a web search API to enable your agents to search the web and access current information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="provider">Search Provider</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a web search provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers
                    .filter(provider => !connections.some(conn => conn.provider_name === provider.name))
                    .map((provider) => (
                      <SelectItem key={provider.name} value={provider.name}>
                        <div className="flex items-center space-x-2">
                          {getProviderIcon(provider.name)}
                          <span>{provider.display_name}</span>
                          {provider.privacy_focused && (
                            <Badge variant="secondary" className="text-xs">Privacy</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProvider && (
              <>
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                  />
                </div>

                {providers.find(p => p.name === selectedProvider) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p><strong>Rate Limit:</strong> {providers.find(p => p.name === selectedProvider)?.rate_limit}</p>
                        <p>
                          <Button variant="link" className="p-0 h-auto" asChild>
                            <a 
                              href={providers.find(p => p.name === selectedProvider)?.base_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              Get API Key <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddModal(false);
                setSelectedProvider('');
                setApiKey('');
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddProvider}
              disabled={saving || !selectedProvider || !apiKey}
            >
              {saving ? 'Adding...' : 'Add API Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 