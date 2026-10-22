import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'react-hot-toast';
import { 
  Mail, 
  Settings, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  ExternalLink,
  Key,
  Activity
} from 'lucide-react';
import { useGmailConnection } from '../hooks/useGmailIntegration';

interface GmailIntegrationCardProps {
  onConfigureAgent?: () => void;
  showAgentManagement?: boolean;
}

export function GmailIntegrationCard({ 
  onConfigureAgent, 
  showAgentManagement = true 
}: GmailIntegrationCardProps) {
  const { 
    connection, 
    loading, 
    error, 
    initiateOAuth, 
    disconnectGmail 
  } = useGmailConnection();
  // Toast imported from react-hot-toast
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const getConnectionStatus = () => {
    if (!connection) return 'not_connected';
    return connection.connection_status;
  };

  const getStatusIcon = () => {
    const status = getConnectionStatus();
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'expired':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Mail className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = () => {
    const status = getConnectionStatus();
    switch (status) {
      case 'active':
        return <Badge variant="success">Connected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'expired':
        return <Badge variant="warning">Expired</Badge>;
      default:
        return <Badge variant="outline">Not Connected</Badge>;
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await initiateOAuth();
      toast.success("Gmail Connected: Your Gmail account has been successfully connected.");
    } catch (error) {
      console.error('Failed to connect Gmail:', error);
      toast.error(`Connection Failed: ${error instanceof Error ? error.message : "Failed to connect Gmail account."}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await disconnectGmail();
      toast.success("Gmail Disconnected: Your Gmail account has been disconnected.");
    } catch (error) {
      console.error('Failed to disconnect Gmail:', error);
      toast.error(`Disconnection Failed: ${error instanceof Error ? error.message : "Failed to disconnect Gmail account."}`);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const getScopeDescription = (scope: string) => {
    const scopeDescriptions: Record<string, string> = {
      'gmail.readonly': 'Read emails and metadata',
      'gmail.send': 'Send emails on your behalf',
      'gmail.modify': 'Modify emails and labels',
      'gmail.labels': 'Manage email labels',
      'gmail.metadata': 'Access email metadata'
    };
    
    const cleanScope = scope.replace('https://www.googleapis.com/auth/', '');
    return scopeDescriptions[cleanScope] || cleanScope;
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Gmail Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Gmail Integration
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}

        {connection ? (
          <div className="space-y-4">
            {/* Connection Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Connected Account</span>
                <span className="text-sm text-gray-600">{connection.external_username}</span>
              </div>
              
              {connection.connection_metadata?.user_name && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Account Name</span>
                  <span className="text-sm text-gray-600">{connection.connection_metadata.user_name}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Last Connected</span>
                <span className="text-sm text-gray-600">
                  {new Date(connection.connection_metadata?.last_connected || '').toLocaleDateString()}
                </span>
              </div>
            </div>

            <Separator />

            {/* Permissions */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Key className="w-4 h-4" />
                Granted Permissions
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {connection.scopes_granted.map((scope) => (
                  <div key={scope} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <Shield className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{getScopeDescription(scope)}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Security Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Security Settings
              </h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Require confirmation for sending emails</span>
                  <Badge variant={connection.configuration?.require_confirmation_for_send ? "success" : "outline"}>
                    {connection.configuration?.require_confirmation_for_send ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Allow delete operations</span>
                  <Badge variant={connection.configuration?.allow_delete_operations ? "warning" : "success"}>
                    {connection.configuration?.allow_delete_operations ? "Allowed" : "Restricted"}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col gap-2">
              {showAgentManagement && (
                <Button
                  onClick={onConfigureAgent}
                  className="w-full"
                  variant="outline"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Configure Agent Access
                </Button>
              )}

              {/* Allow adding additional Gmail accounts from Integrations; management stays on Credentials */}
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full"
                variant="secondary"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </>
                ) : (
                  'Connect another Gmail account'
                )}
              </Button>

              <a
                href="/credentials"
                className="w-full text-center text-sm text-blue-600 hover:underline"
              >
                Manage Gmail credentials
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-8">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Connect your Gmail account</h3>
              <p className="text-sm text-gray-600 mb-6">
                Allow your agents to send and receive emails on your behalf with secure OAuth 2.0 authentication.
              </p>
              
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-medium">What you'll be able to do:</h4>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Send emails through your agents
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Read and search your emails
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Manage email labels and organization
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Full audit trail of all actions
                  </div>
                </div>
              </div>

              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Connect Gmail Account
                  </>
                )}
              </Button>
              
              <div className="mt-4 text-xs text-gray-500">
                <p>
                  Your credentials are encrypted and stored securely. 
                  <br />
                  <a href="#" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                    Learn more about our security practices
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 