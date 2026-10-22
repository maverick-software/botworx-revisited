import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useConnections, useIntegrationsByClassification } from '@/integrations/_shared';
import { ZapierMCPModal } from '../ZapierMCPModal';

// Imported extracted components
import { ConnectedToolsList } from './ConnectedToolsList';
import { AvailableToolsList } from './AvailableToolsList';
import { CredentialSelector } from './CredentialSelector';
import { ToolSetupForms } from './ToolSetupForms';
import { ZapierMCPSection } from './ZapierMCPSection';
import { useToolsModalState } from './useToolsModalState';
import { useToolPermissions } from './useToolPermissions';
import { useToolSetupHandlers } from './useToolSetupHandlers';
import { SEARCH_PROVIDERS } from './toolConstants';

interface EnhancedToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
}

export function EnhancedToolsModalRefactored({
  isOpen,
  onClose,
  agentId,
  agentData
}: EnhancedToolsModalProps) {
  const { user } = useAuth();
  const supabase = useSupabaseClient();
  
  // Hooks for data fetching
  const { connections, refetch: refetchConnections } = useConnections({ includeRevoked: false });
  const { integrations } = useIntegrationsByClassification('tool');
  
  // Zapier MCP state
  const [zapierConnection, setZapierConnection] = useState<any>(null);
  const [capabilitiesByIntegrationId, setCapabilitiesByIntegrationId] = useState<any>({});
  
  // Custom hooks for state and permissions
  const modalState = useToolsModalState();
  const { 
    agentPermissions, 
    refetchIntegrationPermissions,
    defaultScopesForProvider 
  } = useToolPermissions(agentId);

  // Setup handlers
  const { handleApiKeySetup, handleDigitalOceanSetup } = useToolSetupHandlers({
    agentId,
    modalState,
    refetchIntegrationPermissions,
    refetchConnections
  });

  // Load capabilities for current tool integrations
  useEffect(() => {
    if (!integrations || integrations.length === 0) return;
    
    const loadCapabilities = async () => {
      try {
        const { data: capabilities } = await supabase
          .from('integration_capabilities')
          .select('integration_id, capability_key, display_label, display_order')
          .in('integration_id', integrations.map(i => i.id))
          .order('display_order', { ascending: true });
        
        if (capabilities) {
          const grouped = capabilities.reduce((acc, cap) => {
            if (!acc[cap.integration_id]) acc[cap.integration_id] = [];
            acc[cap.integration_id].push(cap);
            return acc;
          }, {} as Record<string, any[]>);
          
          setCapabilitiesByIntegrationId(grouped);
        }
      } catch (error) {
        console.error('Failed to load capabilities:', error);
      }
    };

    loadCapabilities();
  }, [integrations, supabase]);

  // Check for existing Zapier MCP connection
  useEffect(() => {
    if (!isOpen || !agentId || !user?.id) return;

    const checkZapierConnection = async () => {
      try {
        const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
        const manager = new ZapierMCPManager(supabase, user.id);
        
        const connections = await manager.getAgentConnections(agentId);
        const connection = connections.length > 0 ? connections[0] : null;
        setZapierConnection(connection);
        
        if (connection) {
          const tools = await manager.getConnectionTools(connection.id);
          modalState.setZapierToolsCount(tools.length);
        } else {
          modalState.setZapierToolsCount(0);
        }
      } catch (error) {
        console.error('Failed to check Zapier connection:', error);
      }
    };

    checkZapierConnection();
  }, [isOpen, agentId, user?.id, supabase]);

  // Filter integrations for tools
  const TOOL_INTEGRATIONS = (integrations || [])
    .filter((i: any) => i.status === 'available')
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0) || a.name.localeCompare(b.name));

  // Helper function to render capability badges
  const renderCapabilitiesBadges = (integrationId?: string) => {
    const caps = integrationId ? (capabilitiesByIntegrationId as any)?.[integrationId] : null;
    if (!caps || caps.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {caps.map((c: any) => (
          <Badge key={c.capability_key} variant="secondary" className="text-xs">{c.display_label}</Badge>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            ⚡ Tools
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect tools and services to expand your agent's capabilities.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6">
          <Tabs value={modalState.activeTab} onValueChange={modalState.setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="connected">Connected Tools</TabsTrigger>
              <TabsTrigger value="zapier">MCP</TabsTrigger>
              <TabsTrigger value="available">Add New Tool</TabsTrigger>
            </TabsList>
            
            <TabsContent value="connected" className="mt-6">
              <div className="min-h-[300px]">
                <ConnectedToolsList
                  agentPermissions={agentPermissions}
                  onSwitchToAvailable={() => modalState.setActiveTab('available')}
                  onPermissionsUpdated={refetchIntegrationPermissions}
                  renderCapabilitiesBadges={renderCapabilitiesBadges}
                  TOOL_INTEGRATIONS={TOOL_INTEGRATIONS}
                  SEARCH_PROVIDERS={SEARCH_PROVIDERS}
                />
              </div>
            </TabsContent>

            <TabsContent value="zapier" className="mt-6">
              <div className="min-h-[300px] space-y-6">
                <ZapierMCPSection
                  zapierConnection={zapierConnection}
                  zapierToolsCount={modalState.zapierToolsCount}
                  zapierToolsRefreshKey={modalState.zapierToolsRefreshKey}
                  agentId={agentId}
                  onShowZapierModal={() => modalState.setShowZapierModal(true)}
                  onZapierConnectionChange={setZapierConnection}
                  onZapierToolsCountChange={modalState.setZapierToolsCount}
                  onZapierRefreshKeyChange={modalState.setZapierToolsRefreshKey}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="available" className="mt-6">
              <div className="min-h-[300px]">
                <AvailableToolsList
                  integrations={TOOL_INTEGRATIONS}
                  agentPermissions={agentPermissions}
                  connections={connections}
                  setupService={modalState.setupService}
                  selectingCredentialFor={modalState.selectingCredentialFor}
                  onSetupClick={modalState.setSetupService}
                  onSelectCredentialClick={modalState.setSelectingCredentialFor}
                  onCancelSetup={() => {
                    modalState.setSetupService(null);
                    modalState.setSelectingCredentialFor(null);
                  }}
                  renderCapabilitiesBadges={renderCapabilitiesBadges}
                  renderSetupFlow={(integration) => (
                    <ToolSetupForms
                      tool={{ id: integration.name.toLowerCase() === 'web search' ? 'web_search' : integration.name.toLowerCase(), name: integration.name }}
                      selectedProvider={modalState.selectedProvider}
                      apiKey={modalState.apiKey}
                      connectionName={modalState.connectionName}
                      error={modalState.error}
                      connectingService={modalState.connectingService}
                      searchProviders={SEARCH_PROVIDERS}
                      onProviderChange={modalState.setSelectedProvider}
                      onApiKeyChange={modalState.setApiKey}
                      onConnectionNameChange={modalState.setConnectionName}
                      onWebSearchSetup={() => handleApiKeySetup('web_search')}
                      onDigitalOceanSetup={handleDigitalOceanSetup}
                    />
                  )}
                  renderCredentialSelector={(provider, integrationId) => (
                    <CredentialSelector
                      provider={provider}
                      integrationId={integrationId}
                      agentId={agentId}
                      connections={connections}
                      connectingService={modalState.connectingService}
                      onPermissionsUpdated={refetchIntegrationPermissions}
                      onSwitchToSetup={() => {
                        modalState.setSelectingCredentialFor(null);
                        modalState.setSetupService(provider);
                      }}
                      renderCapabilitiesBadges={renderCapabilitiesBadges}
                      defaultScopesForProvider={defaultScopesForProvider}
                    />
                  )}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Zapier MCP Modal */}
      <ZapierMCPModal
        isOpen={modalState.showZapierModal}
        onClose={() => {
          modalState.setShowZapierModal(false);
          // Refresh connection status when modal closes
          if (agentId && user?.id) {
            setTimeout(async () => {
              try {
                const { ZapierMCPManager } = await import('@/lib/mcp/zapier-mcp-manager');
                const manager = new ZapierMCPManager(supabase, user.id);
                
                const connections = await manager.getAgentConnections(agentId);
                const connection = connections.length > 0 ? connections[0] : null;
                setZapierConnection(connection);
                
                if (connection) {
                  const tools = await manager.getConnectionTools(connection.id);
                  modalState.setZapierToolsCount(tools.length);
                } else {
                  modalState.setZapierToolsCount(0);
                }
              } catch (error) {
                console.error('Failed to refresh Zapier connection:', error);
              }
            }, 100);
          }
        }}
        agentId={agentId}
        agentData={agentData}
      />
    </Dialog>
  );
}
