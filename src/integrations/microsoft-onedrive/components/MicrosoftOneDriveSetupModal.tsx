import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, HardDrive, Upload, Download, Share, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { revokeConnection } from '@/integrations/_shared/services/connections';

interface MicrosoftOneDriveSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ONEDRIVE_SCOPES = [
  'https://graph.microsoft.com/Files.Read',
  'https://graph.microsoft.com/Files.ReadWrite',
  'https://graph.microsoft.com/Files.Read.All',
  'https://graph.microsoft.com/Files.ReadWrite.All',
  'https://graph.microsoft.com/Sites.Read.All',
  'https://graph.microsoft.com/Sites.ReadWrite.All',
  'https://graph.microsoft.com/User.Read'
];

const SCOPE_DESCRIPTIONS = {
  'https://graph.microsoft.com/Files.Read': 'Read your files',
  'https://graph.microsoft.com/Files.ReadWrite': 'Read and write your files',
  'https://graph.microsoft.com/Files.Read.All': 'Read all files you have access to',
  'https://graph.microsoft.com/Files.ReadWrite.All': 'Read and write all files you have access to',
  'https://graph.microsoft.com/Sites.Read.All': 'Read SharePoint sites',
  'https://graph.microsoft.com/Sites.ReadWrite.All': 'Read and write SharePoint sites',
  'https://graph.microsoft.com/User.Read': 'Read your profile information'
};

export function MicrosoftOneDriveSetupModal({ isOpen, onClose }: MicrosoftOneDriveSetupModalProps) {
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    connectionId?: string;
    scopes?: string[];
    connectedAt?: string;
    error?: string;
  }>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkConnectionStatus();
    }
  }, [isOpen]);

  const checkConnectionStatus = async () => {
    try {
      setIsCheckingStatus(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Get OneDrive service provider
      const { data: provider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'microsoft-onedrive')
        .single();

      if (providerError) throw providerError;

      // Check for existing connection
      const { data: connection, error: connectionError } = await supabase
        .from('user_integration_credentials')
        .select('id, connection_status, scopes_granted, created_at')
        .eq('user_id', user.id)
        .eq('oauth_provider_id', provider.id)
        .eq('connection_status', 'active')
        .maybeSingle();

      if (connection) {
        setConnectionStatus({
          isConnected: true,
          connectionId: connection.id,
          scopes: connection.scopes_granted || [],
          connectedAt: connection.created_at
        });
      } else {
        setConnectionStatus({ isConnected: false });
      }
    } catch (error) {
      console.error('Error checking OneDrive connection status:', error);
      setConnectionStatus({ 
        isConnected: false, 
        error: error instanceof Error ? error.message : 'Failed to check connection status' 
      });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const generatePKCEChallenge = () => {
    const codeVerifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
      .then(hash => {
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        
        return { codeVerifier, codeChallenge };
      });
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } = await generatePKCEChallenge();
      
      // Store PKCE verifier in session storage
      sessionStorage.setItem('onedrive_pkce_verifier', codeVerifier);
      sessionStorage.setItem('onedrive_user_id', user.id);

      // Get Microsoft OneDrive OAuth configuration
      const { data: provider, error: providerError } = await supabase
        .from('service_providers')
        .select('authorization_endpoint, configuration_metadata')
        .eq('name', 'microsoft-onedrive')
        .single();

      if (providerError) throw providerError;

      // Get client ID from configuration metadata
      const clientId = provider.configuration_metadata?.client_id;
      if (!clientId) {
        throw new Error('Microsoft Client ID not configured in service provider');
      }

      // Build OAuth URL
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: `${window.location.origin}/integrations/microsoft-onedrive/callback`,
        scope: ONEDRIVE_SCOPES.join(' '),
        state: `onedrive_${user.id}_${Date.now()}`,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'consent'
      });

      const authUrl = `${provider.authorization_endpoint}?${params.toString()}`;
      
      // Redirect to Microsoft OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error initiating OneDrive OAuth:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to initiate OneDrive connection');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      
      if (!connectionStatus.connectionId) {
        throw new Error('No connection to disconnect');
      }

      // Use the proper revoke connection function
      await revokeConnection(supabase, connectionStatus.connectionId);

      setConnectionStatus({ isConnected: false });
      toast.success('OneDrive disconnected successfully');
    } catch (error) {
      console.error('Error disconnecting OneDrive:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to disconnect OneDrive');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-blue-500" />
            Setup Microsoft OneDrive
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Connect your Microsoft OneDrive account to enable file storage and sharing capabilities for your agent.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 space-y-6">
          {/* Connection Status */}
          {isCheckingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-muted-foreground">Checking connection status...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {connectionStatus.isConnected ? (
                <Alert className="border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <div className="font-medium">Microsoft OneDrive is connected!</div>
                    <div className="text-sm mt-1">
                      Connected on {connectionStatus.connectedAt && formatDate(connectionStatus.connectedAt)}
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <div className="font-medium">Microsoft OneDrive is not connected</div>
                    <div className="text-sm mt-1">
                      Connect your Microsoft OneDrive account to enable file storage and sharing features.
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {connectionStatus.error && (
                <Alert className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
                  <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    {connectionStatus.error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">What you can do with Microsoft OneDrive</CardTitle>
              <CardDescription>
                Enable these capabilities for your agent by connecting Microsoft OneDrive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <Upload className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <span className="text-sm font-medium">Upload and store files</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <Download className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm font-medium">Download and access files</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <Share className="h-5 w-5 text-purple-500 flex-shrink-0" />
                  <span className="text-sm font-medium">Share files and folders</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                  <HardDrive className="h-5 w-5 text-orange-500 flex-shrink-0" />
                  <span className="text-sm font-medium">Manage file organization</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Required Permissions</CardTitle>
              <CardDescription>
                These permissions will be requested during the OAuth flow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ONEDRIVE_SCOPES.map((scope) => (
                  <div key={scope} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                    <span className="text-sm font-medium flex-1 mr-3">
                      {SCOPE_DESCRIPTIONS[scope as keyof typeof SCOPE_DESCRIPTIONS]}
                    </span>
                    {connectionStatus.isConnected && connectionStatus.scopes?.includes(scope) ? (
                      <Badge variant="default" className="bg-green-600 text-white flex-shrink-0">
                        Granted
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="flex-shrink-0">
                        Required
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20">
          <div className="flex justify-end gap-3 w-full">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {connectionStatus.isConnected ? (
              <Button 
                variant="destructive" 
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Disconnect
              </Button>
            ) : (
              <Button 
                onClick={handleConnect}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Connect Microsoft OneDrive
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
