import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react';
import { useGmailConnection, useAgentGmailPermissions } from '@/integrations/gmail';
import { toast } from 'react-hot-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

export const AgentGmailPermissions: React.FC<{ agentId: string; }> = ({ agentId }) => {
  const { user } = useAuth(); // Assuming useAuth is available in this scope
  const { connection } = useGmailConnection();
  const { permissions, loading, error, grantPermissions, revokePermissions, refetch: refetchPermissions } = useAgentGmailPermissions(agentId);

  const [isProcessing, setIsProcessing] = useState(false);

  const hasActivePermissions = permissions && permissions.length > 0 && permissions[0].is_active;

  const handleGrant = async () => {
    console.log('[Permissions] handleGrant called');
    if (!connection) {
      toast.error('Gmail connection not found.');
      console.error('[Permissions] No connection found.');
      return;
    }
    
    const allScopes = ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.labels'];
    
    setIsProcessing(true);
    const toastId = toast.loading('Granting full access...');
    
    try {
      await grantPermissions(connection.id, allScopes);
      toast.success('All permissions granted!', { id: toastId });
      await refetchPermissions();
    } catch (e: any) {
      console.error('[Permissions] Error in handleGrant:', e);
      toast.error(`Failed to grant permissions: ${e.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevoke = async () => {
    console.log('[Permissions] handleRevoke called');
    if (!hasActivePermissions) {
      console.log('[Permissions] No active permissions to revoke.');
      return;
    };
    
    const permissionId = permissions[0].id;
    
    setIsProcessing(true);
    const toastId = toast.loading('Revoking permissions...');
    
    try {
      await revokePermissions(permissionId);
      toast.success('Permissions revoked!', { id: toastId });
      await refetchPermissions();
    } catch (e: any) {
      console.error('[Permissions] Error in handleRevoke:', e);
      toast.error(`Failed to revoke permissions: ${e.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return <div>Loading Permissions...</div>;
  if (error) return <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gmail Permissions</CardTitle>
        <CardDescription>Grant or revoke all Gmail tool permissions for this agent.</CardDescription>
      </CardHeader>
      <CardContent>
        {hasActivePermissions ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <p className="font-medium">Full Access Granted</p>
            </div>
            <Button onClick={() => { console.log('Revoke button clicked'); handleRevoke(); }} variant="destructive" disabled={isProcessing}>
              <Trash2 className="mr-2 h-4 w-4" /> Revoke Access
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <XCircle className="h-5 w-5" />
              <p>No permissions granted.</p>
            </div>
            <Button onClick={() => { console.log('Grant button clicked'); handleGrant(); }} disabled={isProcessing || !connection}>
              <Shield className="mr-2 h-4 w-4" /> Grant Full Access
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 