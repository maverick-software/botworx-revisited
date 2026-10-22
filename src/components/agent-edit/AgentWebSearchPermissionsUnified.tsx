import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, AlertCircle, Trash2, Search } from 'lucide-react';
import { useWebSearchConnection, useAgentWebSearchPermissions } from '@/hooks/useWebSearchIntegration';
import { toast } from 'react-hot-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

export const AgentWebSearchPermissions: React.FC<{ agentId: string; }> = ({ agentId }) => {
  const { user } = useAuth();
  const { connections } = useWebSearchConnection();
  const { permissions, loading, error, grantPermissions, revokePermissions, refetch: refetchPermissions } = useAgentWebSearchPermissions(agentId);

  const [isProcessing, setIsProcessing] = useState(false);

  const hasActivePermissions = permissions && permissions.length > 0 && permissions[0].is_active;
  const hasConnections = connections && connections.length > 0;

  const handleGrant = async () => {
    console.log('[WebSearch Permissions] handleGrant called');
    if (!connections || connections.length === 0) {
      toast.error('No web search connections found. Please add API keys in Integrations first.');
      console.error('[WebSearch Permissions] No connections found.');
      return;
    }
    
    // Use the first available connection (could be enhanced to let user choose)
    const connection = connections[0];
    const defaultPermissions = ['web_search', 'news_search', 'scrape_and_summarize'];
    
    setIsProcessing(true);
    const toastId = toast.loading('Granting web search access...');
    
    try {
      await grantPermissions(connection.id, defaultPermissions);
      toast.success('Web search permissions granted!', { id: toastId });
      await refetchPermissions();
    } catch (e: any) {
      console.error('[WebSearch Permissions] Error in handleGrant:', e);
      toast.error(`Failed to grant permissions: ${e.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevoke = async () => {
    console.log('[WebSearch Permissions] handleRevoke called');
    if (!hasActivePermissions) {
      console.log('[WebSearch Permissions] No active permissions to revoke.');
      return;
    }
    
    const permissionId = permissions[0].id;
    
    setIsProcessing(true);
    const toastId = toast.loading('Revoking web search permissions...');
    
    try {
      await revokePermissions(permissionId);
      toast.success('Web search permissions revoked!', { id: toastId });
      await refetchPermissions();
    } catch (e: any) {
      console.error('[WebSearch Permissions] Error in handleRevoke:', e);
      toast.error(`Failed to revoke permissions: ${e.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div>Loading Web Search Permissions...</div>;
  if (error) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-blue-400" />
          Web Search Permissions
        </CardTitle>
        <CardDescription>Grant or revoke web search tool permissions for this agent.</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasConnections ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">No web search API keys configured</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/integrations'}
              className="border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white"
            >
              Add API Keys
            </Button>
          </div>
        ) : hasActivePermissions ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Web Search Access Granted</p>
                <p className="text-sm text-gray-400">
                  Using: {connections.find(c => c.id === permissions[0].user_oauth_connection_id)?.provider_display_name}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => { console.log('Revoke button clicked'); handleRevoke(); }} 
              variant="destructive" 
              disabled={isProcessing}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Revoke Access
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" />
              <div>
                <p>No web search permissions granted.</p>
                <p className="text-sm text-gray-400">
                  {connections.length} API key{connections.length !== 1 ? 's' : ''} available
                </p>
              </div>
            </div>
            <Button 
              onClick={() => { console.log('Grant button clicked'); handleGrant(); }} 
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Shield className="mr-2 h-4 w-4" /> Grant Web Search Access
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 