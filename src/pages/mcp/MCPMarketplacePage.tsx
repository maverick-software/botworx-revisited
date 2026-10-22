import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MCPMarketplace from '../../components/mcp/MCPMarketplace';
import { MCPServerTemplate, MCPServerCategory, MCPDeploymentConfig } from '../../lib/mcp/ui-types';
import { mcpService } from '../../lib/services/mcpService';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { ArrowLeft, Layers } from 'lucide-react';

// Mock data for marketplace templates - In production, this would come from an API
const mockTemplates: MCPServerTemplate[] = [
  {
    id: 'weather-api',
    name: 'Weather API Server',
    description: 'Provides weather information using OpenWeatherMap API',
    version: '1.2.0',
    author: 'MCP Community',
    category: 'productivity',
    tags: ['weather', 'api', 'productivity'],
    dockerImage: 'mcpservers/weather-api:1.2.0',
    documentation: 'https://docs.mcpservers.com/weather-api',
    sourceCode: 'https://github.com/mcpservers/weather-api',
    rating: { average: 4.5, count: 42 },
    downloads: 1250,
    verified: true,
    configSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', title: 'OpenWeatherMap API Key', description: 'Your API key from OpenWeatherMap' },
        defaultLocation: { type: 'string', title: 'Default Location', description: 'Default city for weather queries' }
      },
      required: ['apiKey']
    },
    requiredCapabilities: ['tools'],
    supportedTransports: ['stdio', 'sse'],
    resourceRequirements: { memory: '128Mi', cpu: '0.1' },
    environment: { NODE_ENV: 'production' },
    lastUpdated: new Date('2024-12-15'),
    isActive: true
  },
  {
    id: 'github-api',
    name: 'GitHub Integration',
    description: 'GitHub API integration for repository management and code analysis',
    version: '2.1.3',
    author: 'DevTools Inc',
    category: 'development',
    tags: ['github', 'git', 'development', 'api'],
    dockerImage: 'mcpservers/github-api:2.1.3',
    documentation: 'https://docs.mcpservers.com/github-api',
    sourceCode: 'https://github.com/mcpservers/github-api',
    rating: { average: 4.8, count: 128 },
    downloads: 3200,
    verified: true,
    configSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', title: 'GitHub Token', description: 'Personal access token for GitHub API' },
        defaultOrg: { type: 'string', title: 'Default Organization', description: 'Default GitHub organization' }
      },
      required: ['token']
    },
    requiredCapabilities: ['tools', 'resources'],
    supportedTransports: ['stdio', 'sse', 'websocket'],
    resourceRequirements: { memory: '256Mi', cpu: '0.2' },
    lastUpdated: new Date('2024-12-20'),
    isActive: true
  },
  {
    id: 'database-query',
    name: 'Database Query Server',
    description: 'Execute SQL queries across multiple database engines',
    version: '1.0.8',
    author: 'DataTools Corp',
    category: 'data-analysis',
    tags: ['database', 'sql', 'analytics'],
    dockerImage: 'mcpservers/database-query:1.0.8',
    documentation: 'https://docs.mcpservers.com/database-query',
    rating: { average: 4.2, count: 67 },
    downloads: 890,
    verified: false,
    configSchema: {
      type: 'object',
      properties: {
        connectionString: { type: 'string', title: 'Database Connection', description: 'Database connection string' },
        maxConnections: { type: 'number', title: 'Max Connections', description: 'Maximum concurrent connections', default: 10 }
      },
      required: ['connectionString']
    },
    requiredCapabilities: ['tools'],
    supportedTransports: ['stdio'],
    resourceRequirements: { memory: '512Mi', cpu: '0.5', storage: '1Gi' },
    lastUpdated: new Date('2024-11-30'),
    isActive: true
  }
];

const categories: MCPServerCategory[] = [
  'productivity', 'development', 'data-analysis', 'ai-tools', 
  'integrations', 'utilities', 'entertainment', 'business', 'other'
];

export const MCPMarketplacePage: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<MCPServerTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MCPServerCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load marketplace templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        const marketplaceTemplates = await mcpService.getMarketplaceTemplates();
        setTemplates(marketplaceTemplates);
      } catch (err) {
        console.error('Error loading marketplace templates:', err);
        setError('Failed to load marketplace templates. Please try again.');
        // Fallback to mock data
        setTemplates(mockTemplates);
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const handleTemplateSelect = (template: MCPServerTemplate) => {
    // Navigate to deployment page with template pre-selected
    navigate('/mcp/deploy', { state: { template } });
  };

  const handleDeploy = (template: MCPServerTemplate, config: MCPDeploymentConfig) => {
    // Navigate to deployment page with both template and config
    navigate('/mcp/deploy', { state: { template, config } });
  };

  const handleCategoryChange = (category: MCPServerCategory | null) => {
    setSelectedCategory(category);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="space-y-8">
        {/* Simple Navigation */}
        <nav className="text-sm text-muted-foreground">
                          <a href="/agents" className="hover:text-foreground transition-colors">Agents</a>
          <span className="mx-2">/</span>
          <a href="/mcp/servers" className="hover:text-foreground transition-colors">MCP Servers</a>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Marketplace</span>
        </nav>

        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/mcp/servers')}
                className="mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Servers
              </Button>
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
                  <Layers className="h-10 w-10 text-primary" />
                  MCP Marketplace
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  Discover and deploy Model Context Protocol servers from the community
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => navigate('/mcp/servers')}
              >
                My Servers
              </Button>
            </div>
          </div>
        </div>

        {/* Global Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Marketplace Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl border border-blue-200 shadow-sm">
            <div className="text-3xl font-bold text-blue-900">{templates.length}</div>
            <div className="text-sm font-medium text-blue-700 mt-1">Available Servers</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl border border-green-200 shadow-sm">
            <div className="text-3xl font-bold text-green-900">
              {templates.filter(t => t.verified).length}
            </div>
            <div className="text-sm font-medium text-green-700 mt-1">Verified Servers</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-100 p-6 rounded-xl border border-purple-200 shadow-sm">
            <div className="text-3xl font-bold text-purple-900">{categories.length}</div>
            <div className="text-sm font-medium text-purple-700 mt-1">Categories</div>
          </div>
        </div>

        {/* Main Marketplace Component */}
        <div className="bg-card rounded-lg border p-1">
          <MCPMarketplace
            templates={templates}
            onTemplateSelect={handleTemplateSelect}
            onDeploy={handleDeploy}
            loading={loading}
            error={error || undefined}
            categories={categories}
            selectedCategory={selectedCategory || undefined}
            onCategoryChange={handleCategoryChange}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
          />
        </div>
      </div>
    </div>
  );
}; 