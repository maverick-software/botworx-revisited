import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Calendar, Users, CheckCircle, AlertCircle, ExternalLink, Loader2, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { revokeConnection } from '@/integrations/_shared/services/connections';

interface MicrosoftOutlookSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface OutlookConnection {
  id: string;
  connection_name: string;
  external_username: string;
  scopes_granted: string[];
  token_expires_at?: string;
  connection_status: 'active' | 'expired' | 'error';
}

export function MicrosoftOutlookSetupModal({ isOpen, onClose, onComplete }: MicrosoftOutlookSetupModalProps) {
  const { user } = useAuth();
  const [connections, setConnections] = useState<OutlookConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [provider, setProvider] = useState<any>(null);
  const [connectionName, setConnectionName] = useState('');

  const requiredScopes = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.Send',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/Calendars.Read',
    'https://graph.microsoft.com/Calendars.ReadWrite',
    'https://graph.microsoft.com/Contacts.Read',
    'https://graph.microsoft.com/User.Read'
  ];

  useEffect(() => {
    if (isOpen) {
      fetchProvider();
    }
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (provider) {
      fetchConnections();
    }
  }, [provider, user?.id]);

  const fetchProvider = async () => {
    try {
      const { data, error } = await supabase
        .from('service_providers')
        .select('*')
        .eq('name', 'microsoft-outlook')
        .single();

      if (error) {
        console.error('Error fetching Outlook provider:', error);
        return;
      }

      setProvider(data);
    } catch (error) {
      console.error('Error fetching Outlook provider:', error);
    }
  };

  const fetchConnections = async () => {
    if (!user?.id || !provider?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_integration_credentials')
        .select('id, connection_name, external_username, scopes_granted, token_expires_at, connection_status')
        .eq('user_id', user.id)
        .eq('oauth_provider_id', provider.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching connections:', error);
        return;
      }

      const outlookConnections: OutlookConnection[] = (data || []).map(conn => ({
        id: conn.id,
        connection_name: conn.connection_name || `Outlook (${conn.external_username})`,
        external_username: conn.external_username,
        scopes_granted: conn.scopes_granted || [],
        token_expires_at: conn.token_expires_at,
        connection_status: conn.connection_status
      }));

      setConnections(outlookConnections);
    } catch (error) {
      console.error('Error fetching connections:', error);
      setConnections([]);
    }
  };

  const handleConnect = async () => {
    if (!connectionName.trim()) {
      alert('Please enter a connection name');
      return;
    }
    
    setLoading(true);
    
    try {
      // Store connection name for the callback
      sessionStorage.setItem('outlook_connection_name', connectionName.trim());
      
      // Call Edge Function to initiate OAuth flow
      const { data, error } = await supabase.functions.invoke('microsoft-outlook-api', {
        body: {
          action: 'initiate_oauth',
          user_id: user!.id,
          redirect_uri: `${window.location.origin}/integrations/microsoft-outlook/callback`
        }
      });

      if (error) {
        console.error('Error initiating OAuth:', error);
        setLoading(false);
        return;
      }

      if (!data?.auth_url) {
        console.error('No auth URL received from Edge Function');
        setLoading(false);
        return;
      }

      // Store PKCE verifier and user ID for callback
      if (data.code_verifier) {
        sessionStorage.setItem('outlook_code_verifier', data.code_verifier);
      }
      sessionStorage.setItem('outlook_user_id', user!.id);
      
      // Open OAuth in popup window
      const popup = window.open(
        data.auth_url,
        'microsoft-outlook-oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes'
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        console.error('Popup was blocked by browser');
        setLoading(false);
        // Fallback to redirect if popup is blocked
        window.location.href = data.auth_url;
        return;
      }

      // Listen for messages from popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'MICROSOFT_OUTLOOK_OAUTH_SUCCESS') {
          console.log('Microsoft Outlook OAuth success');
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          setLoading(false);
          setConnectionName(''); // Clear the connection name
          fetchConnections();
          if (onComplete) onComplete();
        } else if (event.data.type === 'MICROSOFT_OUTLOOK_OAUTH_ERROR') {
          console.error('Microsoft Outlook OAuth error:', event.data.data.error);
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          setLoading(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Listen for popup completion (fallback)
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          clearTimeout(timeout);
          window.removeEventListener('message', handleMessage);
          setLoading(false);
          // Check if connection was successful
          fetchConnections();
        }
      }, 1000);

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        clearInterval(checkClosed);
        window.removeEventListener('message', handleMessage);
        if (!popup.closed) {
          popup.close();
        }
        setLoading(false);
      }, 300000);
    } catch (error) {
      console.error('Error initiating Outlook OAuth:', error);
      setLoading(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    setDisconnecting(true);
    try {
      await revokeConnection(supabase, connectionId);
      // Refresh connections list
      await fetchConnections();
      onComplete?.();
    } catch (error) {
      console.error('Error disconnecting Outlook:', error);
    } finally {
      setDisconnecting(false);
    }
  };

  const formatExpiryDate = (expiresAt?: string) => {
    if (!expiresAt) return 'No expiry';
    const date = new Date(expiresAt);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">Setup Microsoft Outlook</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Send emails, manage calendar events, and access contacts in Microsoft Outlook
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Existing Connections */}
          {connections.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Connected Accounts</h3>
              {connections.map((connection) => (
                <Card key={connection.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-medium">{connection.connection_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Connected as: {connection.external_username}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(connection.id)}
                        disabled={disconnecting}
                      >
                        {disconnecting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Disconnect
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Token Expires</p>
                          <p className="font-medium">{formatExpiryDate(connection.token_expires_at)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Permissions</p>
                          <p className="font-medium">{connection.scopes_granted.length} scopes granted</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add New Connection */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Plus className="w-5 h-5" />
                  <h3 className="text-lg font-medium">Add New Connection</h3>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="connectionName">Connection Name</Label>
                  <Input
                    id="connectionName"
                    placeholder="e.g., Work Outlook, Personal Outlook"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <Button
                  onClick={handleConnect}
                  disabled={loading || !connectionName.trim()}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connect Microsoft Outlook
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div>
            <h3 className="font-semibold mb-3">What you can do with Outlook integration:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-medium">Email Management</h4>
                  <p className="text-sm text-muted-foreground">Send, read, and manage emails</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-medium">Calendar Events</h4>
                  <p className="text-sm text-muted-foreground">Create and manage calendar events</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Users className="w-5 h-5 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-medium">Contacts</h4>
                  <p className="text-sm text-muted-foreground">Access and manage contacts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Required Permissions */}
          <div>
            <h3 className="font-semibold mb-3">Required Permissions:</h3>
            <div className="grid grid-cols-1 gap-2">
              {[
                { scope: 'Mail.Read', label: 'Read email messages' },
                { scope: 'Mail.Send', label: 'Send email messages' },
                { scope: 'Mail.ReadWrite', label: 'Read and write email messages' },
                { scope: 'Calendars.Read', label: 'Read calendar events' },
                { scope: 'Calendars.ReadWrite', label: 'Read and write calendar events' },
                { scope: 'Contacts.Read', label: 'Read contacts' },
                { scope: 'User.Read', label: 'Read user profile' }
              ].map((permission) => (
                <div key={permission.scope} className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {permission.scope}
                  </Badge>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{permission.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}