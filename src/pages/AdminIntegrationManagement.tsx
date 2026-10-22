import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Globe, 
  Database, 
  Shield, 
  MessageSquare, 
  Cloud, 
  Zap, 
  Settings,
  ExternalLink,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { adminServiceProviders } from '@/lib/adminServiceProviders';
import { toast } from 'react-hot-toast';

interface OAuthProvider {
  id: string;
  name: string;
  display_name: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revoke_endpoint: string | null;
  discovery_endpoint: string | null;
  scopes_supported: string[];
  pkce_required: boolean;
  client_credentials_location: string;
  is_enabled: boolean;
  configuration_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface IntegrationCategory {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
}

const statusOptions = [
  { value: 'true', label: 'Enabled', color: 'bg-green-500' },
  { value: 'false', label: 'Disabled', color: 'bg-red-500' }
];

const iconOptions = [
  { value: 'Globe', label: 'Globe', icon: Globe },
  { value: 'Database', label: 'Database', icon: Database },
  { value: 'Shield', label: 'Shield', icon: Shield },
  { value: 'MessageSquare', label: 'Message Square', icon: MessageSquare },
  { value: 'Cloud', label: 'Cloud', icon: Cloud },
  { value: 'Zap', label: 'Zap', icon: Zap },
  { value: 'Settings', label: 'Settings', icon: Settings },
  { value: 'ExternalLink', label: 'External Link', icon: ExternalLink }
];

export function AdminIntegrationManagement() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<OAuthProvider | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    authorization_endpoint: '',
    token_endpoint: '',
    revoke_endpoint: '',
    discovery_endpoint: '',
    scopes_supported: '[]',
    pkce_required: true,
    client_credentials_location: 'header',
    is_enabled: true,
    configuration_metadata: '{}',
    status: 'true' // String representation for Select component
  });
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      console.log('[AdminIntegrationManagement] Using admin edge function for service_providers');
      
      const data = await adminServiceProviders.list();
      setProviders(data || []);
    } catch (error) {
      console.error('Error fetching oauth providers:', error);
      toast.error('Failed to load OAuth providers');
    } finally {
      setLoading(false);
    }
  };

  // Categories removed - OAuth providers don't use categories

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.display_name.trim()) {
      toast.error('Name and display name are required');
      return;
    }

    try {
      setSaving(true);
      
      let scopesSupported = [];
      if (formData.scopes_supported.trim()) {
        try {
          scopesSupported = JSON.parse(formData.scopes_supported);
        } catch (error) {
          toast.error('Invalid JSON in scopes supported');
          return;
        }
      }

      let configMetadata = {};
      if (formData.configuration_metadata.trim()) {
        try {
          configMetadata = JSON.parse(formData.configuration_metadata);
        } catch (error) {
          toast.error('Invalid JSON in configuration metadata');
          return;
        }
      }

      // Remove form-only fields that aren't database columns
      const { status, ...formDataWithoutStatus } = formData;
      
      const providerData = {
        name: formData.name,
        display_name: formData.display_name,
        authorization_endpoint: formData.authorization_endpoint,
        token_endpoint: formData.token_endpoint,
        revoke_endpoint: formData.revoke_endpoint || null,
        discovery_endpoint: formData.discovery_endpoint || null,
        scopes_supported: scopesSupported,
        pkce_required: formData.pkce_required,
        client_credentials_location: formData.client_credentials_location,
        is_enabled: formData.status === 'true', // Convert string back to boolean
        configuration_metadata: configMetadata
      };

      console.log('Updating provider with data:', providerData);
      console.log('Selected provider ID:', selectedProvider?.id);

      if (selectedProvider) {
        // Update existing provider
        await adminServiceProviders.update(selectedProvider.id, providerData);
      } else {
        // Create new provider
        await adminServiceProviders.create(providerData);
      }

      toast.success(selectedProvider ? 'OAuth provider updated successfully' : 'OAuth provider created successfully');
      setIsAddDialogOpen(false);
      setIsEditDialogOpen(false);
      resetForm();
      fetchProviders();
    } catch (error) {
      console.error('Error saving OAuth provider:', error);
      toast.error('Failed to save OAuth provider');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (provider: OAuthProvider) => {
    setSelectedProvider(provider);
    setFormData({
      name: provider.name,
      display_name: provider.display_name,
      authorization_endpoint: provider.authorization_endpoint,
      token_endpoint: provider.token_endpoint,
      revoke_endpoint: provider.revoke_endpoint || '',
      discovery_endpoint: provider.discovery_endpoint || '',
      scopes_supported: JSON.stringify(provider.scopes_supported, null, 2),
      pkce_required: provider.pkce_required,
      client_credentials_location: provider.client_credentials_location,
      is_enabled: provider.is_enabled,
      configuration_metadata: JSON.stringify(provider.configuration_metadata, null, 2),
      status: provider.is_enabled ? 'true' : 'false'
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;

    try {
      await adminServiceProviders.delete(selectedProvider.id);

      toast.success('OAuth provider deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedProvider(null);
      fetchProviders();
    } catch (error) {
      console.error('Error deleting OAuth provider:', error);
      toast.error('Failed to delete OAuth provider');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      display_name: '',
      authorization_endpoint: '',
      token_endpoint: '',
      revoke_endpoint: '',
      discovery_endpoint: '',
      scopes_supported: '[]',
      pkce_required: true,
      client_credentials_location: 'header',
      is_enabled: true,
      configuration_metadata: '{}',
      status: 'true'
    });
    setSelectedProvider(null);
  };

  const getStatusBadge = (isEnabled: boolean) => {
    return isEnabled ? (
      <Badge className="bg-success/10 text-success border border-success/20">
        <CheckCircle className="h-3 w-3 mr-1" />
        Enabled
      </Badge>
    ) : (
      <Badge className="bg-destructive/10 text-destructive border border-destructive/20">
        <AlertCircle className="h-3 w-3 mr-1" />
        Disabled
      </Badge>
    );
  };

  const getIcon = (iconName: string) => {
    const IconComponent = iconOptions.find(opt => opt.value === iconName)?.icon || Settings;
    return <IconComponent className="h-4 w-4" />;
  };

  // Hide internal tools and system-level integrations from admin OAuth management
  const hiddenProviders = [
    'brave_search',
    'brave_search_api',
    'contact_management',
    'conversation_memory',
    'internal_system', // Advanced Reasoning
    'temporary_chat_internal', // Temporary Chat Links
    'google',
    'microsoft',
    'ocr_space',
    'ocrspace',
    'openai',
    'serpapi',
    'serp_api',
    'mistral_ai', // System-level API key
    'serper_api' // System-level API key
  ];

  const filteredProviders = providers.filter(provider => {
    // Hide internal tools and deprecated integrations
    if (hiddenProviders.includes(provider.name.toLowerCase())) {
      return false;
    }
    
    const matchesSearch = provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         provider.display_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'enabled' && provider.is_enabled) ||
                         (statusFilter === 'disabled' && !provider.is_enabled);
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <span className="text-muted-foreground">Loading OAuth providers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-input border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-input border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="enabled">Enabled</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add OAuth Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New OAuth Provider</DialogTitle>
              <DialogDescription>
                Create a new OAuth provider configuration for user authentication.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Provider Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., gmail, serper_api"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    placeholder="e.g., Gmail, Serper API"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="authorization_endpoint">Authorization Endpoint</Label>
                  <Input
                    id="authorization_endpoint"
                    value={formData.authorization_endpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, authorization_endpoint: e.target.value }))}
                    placeholder="https://accounts.google.com/o/oauth2/auth"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="token_endpoint">Token Endpoint</Label>
                  <Input
                    id="token_endpoint"
                    value={formData.token_endpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, token_endpoint: e.target.value }))}
                    placeholder="https://oauth2.googleapis.com/token"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="revoke_endpoint">Revoke Endpoint (Optional)</Label>
                  <Input
                    id="revoke_endpoint"
                    value={formData.revoke_endpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, revoke_endpoint: e.target.value }))}
                    placeholder="https://oauth2.googleapis.com/revoke"
                  />
                </div>
                <div>
                  <Label htmlFor="discovery_endpoint">Discovery Endpoint (Optional)</Label>
                  <Input
                    id="discovery_endpoint"
                    value={formData.discovery_endpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, discovery_endpoint: e.target.value }))}
                    placeholder="https://accounts.google.com/.well-known/openid_configuration"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="client_credentials_location">Client Credentials Location</Label>
                  <Select value={formData.client_credentials_location} onValueChange={(value) => setFormData(prev => ({ ...prev, client_credentials_location: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="header">Header</SelectItem>
                      <SelectItem value="body">Body</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="pkce_required"
                    checked={formData.pkce_required}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, pkce_required: checked }))}
                  />
                  <Label htmlFor="pkce_required">PKCE Required</Label>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_enabled"
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                  />
                  <Label htmlFor="is_enabled">Enabled</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="scopes_supported">Scopes Supported (JSON Array)</Label>
                <Textarea
                  id="scopes_supported"
                  value={formData.scopes_supported}
                  onChange={(e) => setFormData(prev => ({ ...prev, scopes_supported: e.target.value }))}
                  rows={3}
                  placeholder='["openid", "email", "profile"]'
                />
              </div>

              <div>
                <Label htmlFor="configuration_metadata">Configuration Metadata (JSON)</Label>
                <Textarea
                  id="configuration_metadata"
                  value={formData.configuration_metadata}
                  onChange={(e) => setFormData(prev => ({ ...prev, configuration_metadata: e.target.value }))}
                  rows={4}
                  placeholder='{"provider_type": "oauth", "requires_api_key": false}'
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create OAuth Provider'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* OAuth Providers Grid */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-foreground">OAuth Providers ({filteredProviders.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            {filteredProviders.map(provider => (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-muted/50 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{provider.display_name}</h3>
                      {getStatusBadge(provider.is_enabled)}
                      <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border">
                        {provider.pkce_required ? 'PKCE' : 'No PKCE'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Provider: {provider.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Scopes: {provider.scopes_supported.length} • Credentials: {provider.client_credentials_location}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(provider)}
                    className="hover:bg-muted text-primary hover:text-primary/80"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProvider(provider);
                      setIsDeleteDialogOpen(true);
                    }}
                    className="hover:bg-destructive/10 text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {filteredProviders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No OAuth providers found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit OAuth Provider</DialogTitle>
            <DialogDescription>
              Update the OAuth provider configuration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Same form fields as Add dialog */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_name">Provider Name</Label>
                <Input
                  id="edit_name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., gmail, serper_api"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_display_name">Display Name</Label>
                <Input
                  id="edit_display_name"
                  value={formData.display_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder="e.g., Gmail, Serper API"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_authorization_endpoint">Authorization Endpoint</Label>
                <Input
                  id="edit_authorization_endpoint"
                  value={formData.authorization_endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, authorization_endpoint: e.target.value }))}
                  placeholder="https://accounts.google.com/o/oauth2/auth"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_token_endpoint">Token Endpoint</Label>
                <Input
                  id="edit_token_endpoint"
                  value={formData.token_endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, token_endpoint: e.target.value }))}
                  placeholder="https://oauth2.googleapis.com/token"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="edit_status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_documentation_url">Documentation URL</Label>
                <Input
                  id="edit_documentation_url"
                  type="url"
                  value={formData.documentation_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, documentation_url: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit_display_order">Display Order</Label>
                <Input
                  id="edit_display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_popular"
                  checked={formData.is_popular}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_popular: checked }))}
                />
                <Label htmlFor="edit_is_popular">Popular</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_configuration_schema">Configuration Schema (JSON)</Label>
              <Textarea
                id="edit_configuration_schema"
                value={formData.configuration_schema}
                onChange={(e) => setFormData(prev => ({ ...prev, configuration_schema: e.target.value }))}
                rows={4}
                placeholder='{"api_key": {"type": "string", "required": true}}'
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Updating...' : 'Update OAuth Provider'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OAuth Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProvider?.display_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 