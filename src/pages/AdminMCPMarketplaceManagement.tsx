import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, Eye, Shield, Users, Server, TrendingUp, Activity, AlertCircle, CheckCircle, Clock, Square, Play, Zap } from 'lucide-react';
import { mcpService } from '@/lib/services/mcpService';
import { AdminMCPService } from '@/lib/services/adminMCPService';
import { StatusSyncService } from '@/lib/services/statusSyncService';
import { MCPServerTemplate, MCPServerCategory } from '@/lib/mcp/ui-types';
import { EnhancedMCPServer, MCPServerStatus } from '@/lib/services/mcpService';
import { AgentMCPConnection } from '@/lib/services/userMCPService';
import { OneClickMCPDeployment } from '@/components/mcp/OneClickMCPDeployment';

// Extend the MCPServerTemplate interface for admin view
interface AdminMCPTemplate extends MCPServerTemplate {
  totalDeployments: number;
  activeDeployments: number;
  isVerified: boolean; // Additional field for backwards compatibility
}

interface AddTemplateFormProps {
  onSubmit: (templateData: Partial<AdminMCPTemplate>) => void;
  onCancel: () => void;
}

const AddTemplateForm: React.FC<AddTemplateFormProps> = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    version: '1.0.0',
    author: '',
    category: 'other' as MCPServerCategory,
    dockerImage: '',
    documentation: '',
    sourceCode: '',
    tags: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    
    const templateData: Partial<AdminMCPTemplate> = {
      ...formData,
      category: formData.category as MCPServerCategory,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    };
    
    console.log('Processed template data:', templateData);
    onSubmit(templateData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCategoryChange = (value: string) => {
    setFormData(prev => ({ ...prev, category: value as MCPServerCategory }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="name">Template Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="e.g., GitHub Tools"
            required
          />
        </div>
        <div>
          <Label htmlFor="version">Version *</Label>
          <Input
            id="version"
            value={formData.version}
            onChange={(e) => handleInputChange('version', e.target.value)}
            placeholder="e.g., 1.0.0"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Brief description of what this MCP server does"
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="author">Author *</Label>
          <Input
            id="author"
            value={formData.author}
            onChange={(e) => handleInputChange('author', e.target.value)}
            placeholder="e.g., GitHub Inc., OpenAI, Community Developer"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Enter the author or organization name (not a URL)
          </p>
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="productivity">Productivity</SelectItem>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="data-analysis">Data Analysis</SelectItem>
              <SelectItem value="ai-tools">AI Tools</SelectItem>
              <SelectItem value="integrations">Integrations</SelectItem>
              <SelectItem value="utilities">Utilities</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="dockerImage">Docker Image *</Label>
        <Input
          id="dockerImage"
          value={formData.dockerImage}
          onChange={(e) => handleInputChange('dockerImage', e.target.value)}
          placeholder="e.g., mcp-servers/github-tools:latest"
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor="documentation">Documentation URL</Label>
          <Input
            id="documentation"
            value={formData.documentation}
            onChange={(e) => handleInputChange('documentation', e.target.value)}
            placeholder="https://docs.example.com"
          />
        </div>
        <div>
          <Label htmlFor="sourceCode">Source Code URL</Label>
          <Input
            id="sourceCode"
            value={formData.sourceCode}
            onChange={(e) => handleInputChange('sourceCode', e.target.value)}
            placeholder="https://github.com/example/repo"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => handleInputChange('tags', e.target.value)}
          placeholder="e.g., github, git, development"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Add Template
        </Button>
      </div>
    </form>
  );
};

const AdminMCPMarketplaceManagement: React.FC = () => {
  // Existing template management state
  const [templates, setTemplates] = useState<AdminMCPTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AdminMCPTemplate | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  
  // One-click deployment state
  const [oneClickTemplate, setOneClickTemplate] = useState<AdminMCPTemplate | null>(null);
  const [isOneClickDialogOpen, setIsOneClickDialogOpen] = useState(false);

  // New MCP server management state
  const [servers, setServers] = useState<EnhancedMCPServer[]>([]);
  const [connections, setConnections] = useState<AgentMCPConnection[]>([]);
  const [selectedServer, setSelectedServer] = useState<EnhancedMCPServer | null>(null);
  const [activeTab, setActiveTab] = useState('templates');
  
  // Loading states
  const [loading, setLoading] = useState({
    templates: true,
    servers: false,
    connections: false,
    deployment: false
  });

  // Error handling
  const [error, setError] = useState<{ message: string; type: string } | null>(null);

  // Service instances
  const [adminMCPService] = useState(() => new AdminMCPService());
  const [statusSyncService] = useState(() => new StatusSyncService());

  // Debug: Track dialog state changes
  useEffect(() => {
    console.log('Add Dialog Open state changed:', isAddDialogOpen);
  }, [isAddDialogOpen]);

  // Enhanced statistics
  const [stats, setStats] = useState({
    totalTemplates: 0,
    verifiedTemplates: 0,
    totalDeployments: 0,
    activeServers: 0,
    totalConnections: 0,
    errorRate: 0
  });

  // Debug: Track dialog state changes
  useEffect(() => {
    console.log('Add Dialog Open state changed:', isAddDialogOpen);
  }, [isAddDialogOpen]);

  // Load MCP servers
  const loadMCPServers = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, servers: true }));
      const serversData = await adminMCPService.getAllMCPServers();
      setServers(serversData);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      setError({ message: 'Failed to load MCP servers', type: 'servers' });
    } finally {
      setLoading(prev => ({ ...prev, servers: false }));
    }
  }, [adminMCPService]);

  // Load agent connections
  const loadConnections = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, connections: true }));
      // TODO: Implement proper connection loading method
      // For now, set empty array
      setConnections([]);
    } catch (error) {
      console.error('Failed to load connections:', error);
      setError({ message: 'Failed to load connections', type: 'connections' });
    } finally {
      setLoading(prev => ({ ...prev, connections: false }));
    }
  }, []);

  // Initialize data loading
  useEffect(() => {
    loadTemplates();
    loadStats();
    if (activeTab === 'servers') {
      loadMCPServers();
    } else if (activeTab === 'connections') {
      loadConnections();
    }
  }, [activeTab, loadMCPServers, loadConnections]);

  // TODO: Implement real-time updates subscription
  // useEffect(() => {
  //   const subscription = statusSyncService.subscribeToServer(...);
  //   return () => subscription.unsubscribe();
  // }, [statusSyncService]);

  const loadTemplates = async () => {
    try {
      setLoading(prev => ({ ...prev, templates: true }));
      // Use the new database-backed method
      const marketplaceTemplates = await mcpService.getMarketplaceTemplates();
      
      // Transform to AdminMCPTemplate format (add admin-specific fields)
      const adminTemplates: AdminMCPTemplate[] = marketplaceTemplates.map(template => ({
        ...template,
        isVerified: template.verified, // Map verified to isVerified for backwards compatibility
        totalDeployments: template.downloads, // Use downloads as proxy for deployments
        activeDeployments: Math.floor(template.downloads * 0.1) // Estimate active deployments
      }));
      
      setTemplates(adminTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setError({ message: 'Failed to load templates', type: 'templates' });
    } finally {
      setLoading(prev => ({ ...prev, templates: false }));
    }
  };

  const loadStats = async () => {
    try {
      // Calculate stats from templates
      const rawTemplates = await mcpService.getMarketplaceTemplates();
      const totalTemplates = rawTemplates.length;
      const verifiedTemplates = rawTemplates.filter(t => t.verified).length;
      
      // Get real server and connection stats from AdminMCPService
      const dashboardStats = await adminMCPService.getAdminDashboardStats();

      setStats({
        totalTemplates,
        verifiedTemplates,
        totalDeployments: dashboardStats.totalServers || 0,
        activeServers: dashboardStats.runningServers || 0,
        totalConnections: dashboardStats.totalConnections || 0,
        errorRate: Math.round((dashboardStats.errorServers / Math.max(dashboardStats.totalServers, 1)) * 100)
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setError({ message: 'Failed to load statistics', type: 'stats' });
    }
  };

  const toggleVerification = async (templateId: string, isVerified: boolean) => {
    try {
      // Use the new persistent updateTemplateVerification method
      await mcpService.updateTemplateVerification(templateId, !isVerified);
      
      // Reload templates to reflect changes
      await loadTemplates();
      await loadStats();
    } catch (error) {
      console.error('Failed to toggle verification:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      // Use the new persistent deleteTemplate method
      await mcpService.deleteTemplate(templateId);
      
      // Reload templates to reflect changes
      await loadTemplates();
      await loadStats();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const addTemplate = async (templateData: Partial<AdminMCPTemplate>) => {
    try {
      console.log('addTemplate called with:', templateData);
      
      // Use the new persistent createTemplate method
      const newTemplate = await mcpService.createTemplate(templateData);
      console.log('Template created successfully:', newTemplate);
      
      // Reload templates from database to get updated list
      await loadTemplates();
      await loadStats();
      setIsAddDialogOpen(false);
      console.log('Dialog closed and templates reloaded');
    } catch (error) {
      console.error('Failed to add template:', error);
      alert(`Failed to add template: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [availableDroplets, setAvailableDroplets] = useState<Array<{
    id: string;
    name: string;
    publicIP: string;
    region?: string;
    size?: string;
    status: string;
  }>>([]);
  const [selectedDropletId, setSelectedDropletId] = useState<string>('');

  // Load available droplets when deployment dialog opens
  const loadAvailableDroplets = async () => {
    try {
      const droplets = await adminMCPService.getAvailableDroplets();
      setAvailableDroplets(droplets);
      if (droplets.length > 0) {
        setSelectedDropletId(droplets[0].id); // Select first droplet by default
      }
    } catch (error) {
      console.error('Failed to load droplets:', error);
      alert('Failed to load available droplets');
    }
  };

  const openDeployDialog = async (template: AdminMCPTemplate) => {
    setSelectedTemplate(template);
    await loadAvailableDroplets();
    setIsDeployDialogOpen(true);
  };

  const deployTemplate = async () => {
    if (!selectedTemplate || !selectedDropletId) return;

    try {
      setLoading(prev => ({ ...prev, deployment: true }));
      
      // Deploy using AdminMCPService with selected droplet
      const deployment = await adminMCPService.deployMCPServer({
        serverName: `${selectedTemplate.name}-${Date.now()}`, // Unique name
        serverType: 'mcp_server', // ✅ Use valid constraint value instead of template.id
        dockerImage: selectedTemplate.dockerImage,
        transport: 'stdio', // ✅ Use valid transport type (stdio/sse/websocket)
        endpointPath: '/mcp',
        environmentVariables: selectedTemplate.environment || {},
        capabilities: selectedTemplate.requiredCapabilities || ['tools'],
        portMappings: [{ containerPort: 8080, hostPort: 30000 }],
        resourceLimits: {
          memory: selectedTemplate.resourceRequirements.memory,
          cpu: selectedTemplate.resourceRequirements.cpu
        },
        environmentId: selectedDropletId // Use selected droplet
      });

      console.log('Deployment initiated:', deployment);
      alert(`✅ Deployment started! Server "${deployment.serverName}" is being deployed to your selected droplet.`);
      
      // Refresh the deployed servers list
      await loadMCPServers();
      await loadStats();
      
      // Switch to deployed servers tab to see the result
      setActiveTab('servers');
      
      // Close dialog
      setIsDeployDialogOpen(false);
      setSelectedTemplate(null);
      
    } catch (error) {
      console.error('Failed to deploy template:', error);
      alert(`❌ Failed to deploy template: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(prev => ({ ...prev, deployment: false }));
    }
  };

  // One-click deployment handlers
  const handleOneClickDeploy = (template: AdminMCPTemplate) => {
    setOneClickTemplate(template);
    setIsOneClickDialogOpen(true);
  };

  const handleDeploymentComplete = (deployment: any) => {
    console.log('Deployment completed:', deployment);
    setIsOneClickDialogOpen(false);
    setOneClickTemplate(null);
    // Refresh servers list to show the new deployment
    loadMCPServers();
  };

  const handleDeploymentError = (error: string) => {
    console.error('Deployment failed:', error);
    // Error is already handled by the OneClickMCPDeployment component
    // We could add additional error handling here if needed
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCP Template Management</h1>
          <p className="text-muted-foreground">
            Manage MCP server templates and deploy them to droplets
          </p>
        </div>
        <div className="flex gap-2">
          {error && (
            <Badge variant="destructive" className="mr-2">
              <AlertCircle className="w-3 h-3 mr-1" />
              {error.message}
            </Badge>
          )}
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTemplates}</div>
            <p className="text-xs text-muted-foreground">
              {stats.verifiedTemplates} verified
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deployed Servers</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDeployments}</div>
            <p className="text-xs text-muted-foreground">
              Total deployed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Servers</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeServers}</div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connections</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalConnections}</div>
            <p className="text-xs text-muted-foreground">
              Agent connections
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.errorRate}%</div>
            <p className="text-xs text-muted-foreground">
              Server errors
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.servers || loading.templates ? (
                <Clock className="h-6 w-6 animate-spin" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-600" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              System status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="servers">Deployed Servers</TabsTrigger>
          <TabsTrigger value="connections">Active Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          {/* Template Filters */}
          <div className="flex gap-4">
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Templates Table */}
          <Card>
            <CardHeader>
              <CardTitle>MCP Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {loading.templates ? (
                <div className="text-center py-8">Loading templates...</div>
              ) : (
                <div className="space-y-4">
                  {filteredTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{template.name}</h3>
                          {template.isVerified && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              <Shield className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          <Badge variant="secondary">{template.category}</Badge>
                          <Badge variant="outline">v{template.version}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Deployments: {template.totalDeployments}</span>
                          <span>Active: {template.activeDeployments}</span>
                          <span>Rating: {template.rating.average.toFixed(1)}/5 ({template.rating.count})</span>
                          <span>Author: {template.author}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleVerification(template.id, template.isVerified)}
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOneClickDeploy(template)}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        >
                          <Zap className="w-4 h-4 mr-1" />
                          One-Click Deploy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDeployDialog(template)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Manual Deploy
                        </Button>
                      </div>
                    </div>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No templates found matching your criteria
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="servers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployed MCP Servers</CardTitle>
              <p className="text-sm text-muted-foreground">
                MCP servers currently deployed to DigitalOcean droplets
              </p>
            </CardHeader>
            <CardContent>
              {loading.servers ? (
                <div className="text-center py-8">Loading deployed servers...</div>
              ) : servers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">No Deployed Servers</h3>
                  <p className="text-sm mb-4">
                    No MCP servers are currently deployed to your droplets. 
                    Deploy a template to get started.
                  </p>
                  <Button onClick={() => setActiveTab('templates')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Browse Templates
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {servers.map((server) => (
                    <div
                      key={server.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{server.name}</h3>
                          <Badge 
                            variant={server.status.state === 'running' ? 'default' : 'secondary'}
                            className={server.status.state === 'running' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {server.status.state}
                          </Badge>
                          <Badge variant="outline">{server.serverType}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Endpoint: {server.endpoint}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Environment: {server.environment.name}</span>
                          <span>Region: {server.environment.region}</span>
                          <span>Health: {server.health.overall}</span>
                          {server.lastHeartbeat && (
                            <span>Last seen: {server.lastHeartbeat.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedServer(server);
                            // TODO: Open server details dialog
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {server.status.state === 'running' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adminMCPService.stopMCPServer(server.id.toString())}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => adminMCPService.startMCPServer(server.id.toString())}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => adminMCPService.deleteMCPServer(server.id.toString())}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          {/* TODO: Add connections content */}
          <div className="text-center py-8 text-muted-foreground">
            Connection monitoring coming soon...
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Details Dialog */}
      {selectedTemplate && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Template Details: {selectedTemplate.name}</DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="details" className="space-y-4">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="config">Configuration</TabsTrigger>
                <TabsTrigger value="stats">Statistics</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={selectedTemplate.name} readOnly />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={selectedTemplate.description} readOnly />
                  </div>
                  <div>
                    <Label>Version</Label>
                    <Input value={selectedTemplate.version} readOnly />
                  </div>
                  <div>
                    <Label>Author</Label>
                    <Input value={selectedTemplate.author} readOnly />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Input value={selectedTemplate.category} readOnly />
                  </div>
                  <div>
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.tags.map((tag: string, index: number) => (
                        <Badge key={index} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Required Capabilities</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.requiredCapabilities.map((cap: string, index: number) => (
                        <Badge key={index} variant="outline">{cap}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="config">
                <div className="space-y-4">
                  <div>
                    <Label>Docker Image</Label>
                    <Input value={selectedTemplate.dockerImage} readOnly />
                  </div>
                  <div>
                    <Label>Documentation</Label>
                    <Input value={selectedTemplate.documentation} readOnly />
                  </div>
                  <div>
                    <Label>Source Code</Label>
                    <Input value={selectedTemplate.sourceCode || 'N/A'} readOnly />
                  </div>
                  <div>
                    <Label>Supported Transports</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTemplate.supportedTransports.map((transport: string, index: number) => (
                        <Badge key={index} variant="outline">{transport}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="stats">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Deployment Stats</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Total Deployments:</span>
                          <span className="font-semibold">{selectedTemplate.totalDeployments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Active Deployments:</span>
                          <span className="font-semibold">{selectedTemplate.activeDeployments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Downloads:</span>
                          <span className="font-semibold">{selectedTemplate.downloads}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Template Info</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Version:</span>
                          <span className="font-semibold">{selectedTemplate.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Verified:</span>
                          <span className="font-semibold">
                            {selectedTemplate.verified ? 'Yes' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Author:</span>
                          <span className="font-semibold">{selectedTemplate.author}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Rating:</span>
                          <span className="font-semibold">
                            {selectedTemplate.rating.average.toFixed(1)}/5 ({selectedTemplate.rating.count})
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Template Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New MCP Template</DialogTitle>
          </DialogHeader>
          <AddTemplateForm onSubmit={addTemplate} onCancel={() => setIsAddDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Deployment Dialog */}
      <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Deploy MCP Template</DialogTitle>
            <DialogDescription>
              Deploy "{selectedTemplate?.name}" to a DigitalOcean droplet
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Template Information */}
            {selectedTemplate && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Template Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Name</p>
                      <p className="text-sm text-muted-foreground">{selectedTemplate.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Category</p>
                      <p className="text-sm text-muted-foreground">{selectedTemplate.category}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Docker Image</p>
                      <p className="text-sm text-muted-foreground font-mono">{selectedTemplate.dockerImage}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Resource Requirements</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedTemplate.resourceRequirements.memory} RAM, {selectedTemplate.resourceRequirements.cpu} CPU
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Description</p>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Droplet Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Target Droplet</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Choose which DigitalOcean droplet to deploy this MCP server to
                </p>
              </CardHeader>
              <CardContent>
                {availableDroplets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No active droplets available</p>
                    <p className="text-xs">Create a droplet first in the Droplet Management section</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Select value={selectedDropletId} onValueChange={setSelectedDropletId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a droplet" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDroplets.map((droplet) => (
                          <SelectItem key={droplet.id} value={droplet.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{droplet.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {droplet.region} • {droplet.size}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Selected Droplet Details */}
                    {selectedDropletId && (
                      <div className="mt-4 p-4 bg-muted rounded-lg">
                        {(() => {
                          const selectedDroplet = availableDroplets.find(d => d.id === selectedDropletId);
                          return selectedDroplet ? (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-medium">Droplet Name</p>
                                <p className="text-muted-foreground">{selectedDroplet.name}</p>
                              </div>
                              <div>
                                <p className="font-medium">Public IP</p>
                                <p className="text-muted-foreground font-mono">{selectedDroplet.publicIP}</p>
                              </div>
                              <div>
                                <p className="font-medium">Region</p>
                                <p className="text-muted-foreground">{selectedDroplet.region}</p>
                              </div>
                              <div>
                                <p className="font-medium">Size</p>
                                <p className="text-muted-foreground">{selectedDroplet.size}</p>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsDeployDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={deployTemplate}
              disabled={!selectedDropletId || loading.deployment}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading.deployment ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Deploy to Droplet
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* One-Click Deployment Dialog */}
      <Dialog open={isOneClickDialogOpen} onOpenChange={setIsOneClickDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>One-Click Deployment</DialogTitle>
            <DialogDescription>
              Automatically deploy "{oneClickTemplate?.name}" with intelligent droplet selection
            </DialogDescription>
          </DialogHeader>
          
          {oneClickTemplate && (
            <OneClickMCPDeployment
              template={{
                id: oneClickTemplate.id,
                tool_name: oneClickTemplate.name,
                display_name: oneClickTemplate.name,
                description: oneClickTemplate.description,
                docker_image: oneClickTemplate.dockerImage,
                category: oneClickTemplate.category,
                mcp_server_metadata: {
                  resourceHint: 'medium',
                  version: oneClickTemplate.version,
                  author: oneClickTemplate.author,
                  tags: oneClickTemplate.tags
                }
              }}
              onDeploymentComplete={handleDeploymentComplete}
              onDeploymentError={handleDeploymentError}
              className="border-0 shadow-none p-0"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMCPMarketplaceManagement; 