import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Database, 
  Key, 
  Globe, 
  MessageSquare, 
  Shield, 
  Zap, 
  Cloud, 
  GitBranch,
  Settings,
  ExternalLink,
  Plus,
  Search,
  Check,
  Clock,
  AlertCircle,
  ChevronRight,
  Mail,
  Server,
  RefreshCw,
  X,
  Filter
} from 'lucide-react';
import { useIntegrationCategories, useIntegrationsByCategory, useConnections } from '@/integrations/_shared';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { IntegrationSetupModal } from '@/components/integrations/IntegrationSetupModal';
import { useGmailConnection } from '@/integrations/gmail';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { ResponsiveGrid } from '@/components/mobile/ResponsiveGrid';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { getPagePadding } from '@/lib/pwaTheme';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'available':
      return 'bg-green-500/20 text-green-600 dark:text-green-300 border-green-500/30';
    case 'beta':
      return 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30';
    case 'coming_soon':
      return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-300 border-yellow-500/30';
    case 'deprecated':
      return 'bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30';
    default:
      return 'bg-muted/20 text-muted-foreground border-border';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'available':
      return 'Available';
    case 'beta':
      return 'Beta';
    case 'coming_soon':
      return 'Coming Soon';
    case 'deprecated':
      return 'Deprecated';
    default:
      return 'Unknown';
  }
};

const getConnectionStatusIcon = (status: string) => {
  switch (status) {
    case 'connected':
      return <Check className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    default:
      return null;
  }
};

export function IntegrationsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const modalClosedByUserRef = React.useRef(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const { categories, loading: categoriesLoading } = useIntegrationCategories();
  const { integrations, loading: integrationsLoading } = useIntegrationsByCategory(
    selectedCategory === 'all' ? undefined : selectedCategory
  );
  const { connections: unifiedConnections, loading: unifiedLoading, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { connections: gmailConnections } = useGmailConnection();

  // Handle URL parameters to auto-open specific provider modals
  const processedUrlRef = useRef<string | null>(null);
  
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const providerParam = searchParams.get('provider');
    
    if (providerParam && providerParam !== processedUrlRef.current && integrations.length > 0) {
      const integration = integrations.find(int => {
        const providerName = providerNameForIntegration(int.name);
        return providerName === providerParam || int.name.toLowerCase().replace(/\s+/g, '-') === providerParam;
      });
      
      if (integration) {
        console.log('[IntegrationsPage] Auto-opening modal for provider:', providerParam);
        processedUrlRef.current = providerParam;
        setSelectedIntegration(integration);
        setShowSetupModal(true);
        
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('provider');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
    
    if (!providerParam) {
      processedUrlRef.current = null;
    }
  }, [location.search, integrations]);

  const handleClearCache = async () => {
    if (!user?.id) {
      toast.error('Unable to clear cache: missing user information');
      return;
    }

    setClearingCache(true);
    try {
      const { data, error } = await supabase.functions.invoke('invalidate-agent-tool-cache', {
        body: {
          user_id: user.id
        }
      });

      if (error) {
        console.error('Cache clear error:', error);
        toast.error('Failed to clear tool cache');
        return;
      }

      if (data?.success) {
        toast.success(`Tool cache cleared! (${data.tools_count} tools refreshed)`);
        refetchConnections();
      } else {
        toast.error(data?.error || 'Failed to clear cache');
      }
    } catch (error: any) {
      console.error('Cache clear error:', error);
      toast.error('Failed to clear tool cache');
    } finally {
      setClearingCache(false);
    }
  };

  const getEffectiveStatus = (integration: any) => {
    return integration.status || 'coming_soon';
  };

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'Globe':
        return Globe;
      case 'Database':
        return Database;
      case 'Shield':
        return Shield;
      case 'MessageSquare':
        return MessageSquare;
      case 'Mail':
        return Mail;
      case 'Cloud':
        return Cloud;
      case 'Zap':
        return Zap;
      case 'Search':
        return Search;
      case 'Server':
        return Server;
      default:
        return Settings;
    }
  };

  // Integrations that should NOT appear in user integrations page
  const hiddenIntegrations = [
    'OpenAI',
    'Mistral AI',
    'Serper API',
    'Contact Management',
    'Conversation Memory',
    'Advanced Reasoning',
    'Temporary Chat Links',
    'Brave Search API',
    'SerpAPI',
    'OCR.Space',
    'OCR Space',
    'Google',
    'Microsoft'
  ];

  const filteredIntegrations = integrations.filter(integration => {
    if (hiddenIntegrations.includes(integration.name)) {
      return false;
    }
    
    const matchesSearch = integration.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      integration.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const effectiveStatus = getEffectiveStatus(integration);
    const isNotDisabled = effectiveStatus === 'available' || effectiveStatus === 'beta';
    
    return matchesSearch && isNotDisabled;
  });

  const providerNameForIntegration = (name: string): string | null => {
    switch (name) {
      case 'Gmail':
        return 'gmail';
      case 'SMTP':
        return 'smtp';
      case 'Web Search':
        return 'web_search';
      case 'Serper API':
        return 'serper_api';
      case 'SerpAPI':
        return 'serpapi';
      case 'Brave Search API':
        return 'brave_search';
      case 'Pinecone':
        return 'pinecone';
      case 'GetZep':
        return 'getzep';
      case 'DigitalOcean':
        return 'digitalocean';
      case 'Discord':
        return 'discord';
      case 'Microsoft Teams':
        return 'microsoft-teams';
      case 'Microsoft Outlook':
        return 'microsoft-outlook';
      case 'Microsoft OneDrive':
        return 'microsoft-onedrive';
      default:
        return null;
    }
  };

  const isIntegrationConnected = (integrationName: string) => {
    const provider = providerNameForIntegration(integrationName);
    if (!provider) return false;
    
    if (provider === 'web_search') {
      const webSearchProviders = ['serper_api', 'serpapi', 'brave_search'];
      return unifiedConnections.some(c => 
        webSearchProviders.includes(c.provider_name) && c.connection_status === 'active'
      );
    }
    
    return unifiedConnections.some(c => c.provider_name === provider && c.connection_status === 'active');
  };

  const getConnectionCount = (integrationName: string) => {
    const provider = providerNameForIntegration(integrationName);
    if (!provider) return 0;
    
    return unifiedConnections.filter(c => 
      c.provider_name === provider && c.connection_status === 'active'
    ).length;
  };

  const handleSelectIntegration = (integration: any) => {
    setSelectedIntegration(integration);
  };

  const handleAddCredentials = (integration: any) => {
    setSelectedIntegration(integration);
    setShowSetupModal(true);
  };

  const handleSetupComplete = () => {
    setShowSetupModal(false);
    setSelectedIntegration(null);
    refetchConnections();
  };

  if (categoriesLoading || integrationsLoading || unifiedLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
        </div>
        <div className="animate-pulse space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          title="Integrations"
          showMenu={true}
          actions={
            <button
              onClick={handleClearCache}
              disabled={clearingCache}
              className="touch-target p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              title="Clear cache"
            >
              <RefreshCw className={`w-5 h-5 text-muted-foreground ${clearingCache ? 'animate-spin' : ''}`} />
            </button>
          }
        />
      )}

      <div className="flex-1 px-24 py-6">
        <div className="flex h-[calc(100vh-4rem)] gap-6 justify-center">
          {/* Left side - List */}
          <div className="flex flex-col space-y-6 max-w-2xl w-full">
            {/* Desktop Header */}
            {!isMobile && (
              <div className="flex flex-col space-y-4">
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Integrations</h2>
                
                <p className="text-muted-foreground text-sm">
                  Connect your favorite tools and services to power your AI agents with external capabilities.
                </p>
              </div>
            )}

            {/* Search and Category Filter */}
            <div className="flex gap-3 px-12">
              <div className="relative w-80">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search integrations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All ({integrations.length})
                  </SelectItem>
                  {categories.map((category) => {
                    const CategoryIcon = getIconComponent(category.icon_name);
                    return (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center">
                          <CategoryIcon className="h-4 w-4 mr-2" />
                          {category.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Integration List */}
            <div className="space-y-1 overflow-auto flex-1 px-12">
              {filteredIntegrations.map((integration) => {
                const IconComponent = getIconComponent(integration.icon_name || 'Settings');
                const isConnected = isIntegrationConnected(integration.name);
                const connectionCount = getConnectionCount(integration.name);
                const effectiveStatus = getEffectiveStatus(integration);
                const isComingSoon = effectiveStatus === 'coming_soon';
                const isSelected = selectedIntegration?.id === integration.id;
                
                return (
                  <div
                    key={integration.id}
                    onClick={() => handleSelectIntegration(integration)}
                    className={`flex items-center px-3 py-2 rounded-md cursor-pointer transition-colors bg-muted/30 ${
                      isSelected 
                        ? 'bg-accent' 
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className={`p-1.5 rounded-md mr-3 ${
                      isComingSoon ? 'bg-muted/50' : 'bg-primary/10'
                    }`}>
                      <IconComponent className={`h-4 w-4 ${
                        isComingSoon ? 'text-muted-foreground' : 'text-primary'
                      }`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-foreground">
                        {integration.name}
                      </h3>
                    </div>
                  </div>
                );
              })}
              
              {filteredIntegrations.length === 0 && (
                <div className="text-center py-12">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No integrations found matching your search.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Details Panel */}
          {selectedIntegration && (
            <div className="w-[400px] border-l border-border pl-6 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">{selectedIntegration.name}</h3>
                <button
                  onClick={() => setSelectedIntegration(null)}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Icon and Status */}
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-muted">
                    {React.createElement(getIconComponent(selectedIntegration.icon_name || 'Settings'), {
                      className: 'h-8 w-8 text-primary'
                    })}
                  </div>
                  <div>
                    <Badge className={getStatusColor(getEffectiveStatus(selectedIntegration))}>
                      {getStatusText(getEffectiveStatus(selectedIntegration))}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">About</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {selectedIntegration.description || 'Integration description not yet available.'}
                  </p>
                </div>

                {/* Connected Accounts */}
                {isIntegrationConnected(selectedIntegration.name) && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Connected Accounts ({getConnectionCount(selectedIntegration.name)})</h4>
                    <div className="space-y-2">
                      {unifiedConnections
                        .filter(c => c.provider_name === providerNameForIntegration(selectedIntegration.name))
                        .map((connection, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              <span className="text-sm">{connection.account_identifier || 'Account'}</span>
                            </div>
                            <Link to="/credentials">
                              <Button variant="ghost" size="sm">
                                <Settings className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2">
                  {getEffectiveStatus(selectedIntegration) !== 'coming_soon' && (
                    <>
                      <Button
                        onClick={() => handleAddCredentials(selectedIntegration)}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {isIntegrationConnected(selectedIntegration.name) ? 'Add Another Account' : 'Add Credentials'}
                      </Button>
                      
                      {isIntegrationConnected(selectedIntegration.name) && (
                        <Link to="/credentials" className="block">
                          <Button variant="outline" className="w-full">
                            <Settings className="h-4 w-4 mr-2" />
                            Manage Credentials
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
                  
                  {selectedIntegration.documentation_url && (
                    <a
                      href={selectedIntegration.documentation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="ghost" className="w-full">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Documentation
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Integration Setup Modal */}
      <IntegrationSetupModal
        integration={selectedIntegration}
        isOpen={showSetupModal && !!selectedIntegration}
        onClose={() => {
          console.log('[IntegrationsPage] Modal onClose called - user action');
          modalClosedByUserRef.current = true;
          setShowSetupModal(false);
          setSelectedIntegration(null);
        }}
        onComplete={handleSetupComplete}
      />
    </div>
  );
}
