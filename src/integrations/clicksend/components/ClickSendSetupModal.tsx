import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Zap,
  Plus,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

interface ClickSendSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (connection: any) => void;
  onError: (error: string) => void;
  user: any;
}

interface TestResult {
  success: boolean;
  details?: string;
  balance?: number;
  account_name?: string;
}

export function ClickSendSetupModal({
  isOpen,
  onClose,
  onSuccess,
  onError,
  user
}: ClickSendSetupModalProps) {
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connectionName, setConnectionName] = useState('');
  const [senderId, setSenderId] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleClose = () => {
    setUsername('');
    setApiKey('');
    setConnectionName('');
    setSenderId('');
    setShowApiKey(false);
    setTestResult(null);
    onClose();
  };

  const handleTestConnection = async () => {
    if (!username.trim() || !apiKey.trim()) {
      toast.error('Please enter both username and API key');
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    try {
      // Test the connection by calling ClickSend API directly
      const credentials = btoa(`${username.trim()}:${apiKey.trim()}`);
      const response = await fetch('https://rest.clicksend.com/v3/account', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const accountData = await response.json();
        setTestResult({
          success: true,
          details: `Connected successfully! Account: ${accountData.data?.username || 'Unknown'}`,
          balance: parseFloat(accountData.data?.balance) || 0,
          account_name: accountData.data?.username
        });
        toast.success('Connection test successful!');
      } else {
        const errorData = await response.text();
        setTestResult({
          success: false,
          details: 'Authentication failed. Please check your credentials.'
        });
        toast.error('Connection test failed');
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      setTestResult({
        success: false,
        details: 'Unable to connect to ClickSend. Please check your internet connection.'
      });
      toast.error('Connection test failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !apiKey.trim()) {
      toast.error('Please enter both username and API key');
      return;
    }

    // Recommend testing connection first
    if (!testResult?.success) {
      toast.error('Please test your connection first to ensure credentials are valid');
      return;
    }

    setIsConnecting(true);

    try {
      // Get ClickSend service provider ID
      const { data: provider, error: providerError } = await supabase
        .from('service_providers')
        .select('id')
        .eq('name', 'clicksend_sms')
        .single();

      if (providerError || !provider) {
        throw new Error('ClickSend service provider not found. Please contact support.');
      }

      // Encrypt credentials using Supabase Vault
      const { data: encryptedUsername, error: usernameError } = await supabase.rpc(
        'vault.create_secret',
        {
          secret: username.trim(),
          name: `clicksend_username_${user.id}`,
          description: 'ClickSend username for SMS/MMS integration'
        }
      );

      const { data: encryptedApiKey, error: apiKeyError } = await supabase.rpc(
        'vault.create_secret',
        {
          secret: apiKey.trim(),
          name: `clicksend_apikey_${user.id}`,
          description: 'ClickSend API key for SMS/MMS integration'
        }
      );

      if (usernameError || apiKeyError || !encryptedUsername || !encryptedApiKey) {
        throw new Error('Failed to encrypt credentials. Please try again.');
      }

      // Create user integration credentials record
      const { data: connection, error: connectionError } = await supabase
        .from('user_integration_credentials')
        .insert({
          user_id: user.id,
          oauth_provider_id: provider.id,
          vault_access_token_id: encryptedUsername.id,
          vault_refresh_token_id: encryptedApiKey.id,
          scopes_granted: ['sms', 'mms', 'balance', 'history', 'delivery_receipts'],
          connection_status: 'active',
          external_username: testResult.account_name || username.trim(),
          external_user_id: testResult.account_name || username.trim(),
          connection_name: connectionName.trim() || 'ClickSend SMS/MMS',
          credential_type: 'api_key',
          connection_metadata: {
            account_balance: testResult.balance,
            setup_date: new Date().toISOString(),
            features_enabled: ['sms', 'mms', 'balance', 'history'],
            default_sender_id: senderId.trim() || null
          }
        })
        .select()
        .single();

      if (connectionError) {
        throw new Error(`Failed to create connection: ${connectionError.message}`);
      }

      toast.success('ClickSend connected successfully!');
      onSuccess(connection);
      handleClose();

    } catch (error: any) {
      console.error('Connection setup error:', error);
      const errorMessage = error.message || 'Failed to connect ClickSend account';
      toast.error(errorMessage);
      onError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-blue-600" />
            </div>
            <span>Connect ClickSend SMS/MMS</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Setup Instructions */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Setup Instructions</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Sign up for ClickSend account at <span className="font-mono">clicksend.com</span></li>
              <li>2. Navigate to API Credentials in your dashboard</li>
              <li>3. Copy your Username and API Key</li>
              <li>4. Enter credentials below</li>
            </ol>
          </div>

          {/* Credential Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                ClickSend Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your ClickSend username"
                className="mt-1"
                required
                disabled={isConnecting}
              />
            </div>
            
            <div>
              <Label htmlFor="apiKey" className="text-sm font-medium text-gray-700">
                API Key
              </Label>
              <div className="relative mt-1">
                <Input
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your ClickSend API key"
                  className="pr-10"
                  required
                  disabled={isConnecting}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                  disabled={isConnecting}
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="connectionName" className="text-sm font-medium text-gray-700">
                Connection Name (Optional)
              </Label>
              <Input
                id="connectionName"
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="e.g., Main SMS Account"
                className="mt-1"
                disabled={isConnecting}
              />
            </div>

            <div>
              <Label htmlFor="senderId" className="text-sm font-medium text-gray-700">
                Default Sender ID (Optional)
              </Label>
              <Input
                id="senderId"
                type="text"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="e.g., +1234567890 or YourBrand"
                className="mt-1"
                disabled={isConnecting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Phone number (with country code) or alphanumeric sender ID (up to 11 characters)
              </p>
            </div>

            {/* Test Connection Button */}
            <Button
              type="button"
              onClick={handleTestConnection}
              disabled={!username.trim() || !apiKey.trim() || isTestingConnection || isConnecting}
              variant="outline"
              className="w-full"
            >
              {isTestingConnection ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>

            {/* Connection Test Results */}
            {testResult && (
              <div className={`p-3 rounded-md border ${
                testResult.success 
                  ? 'bg-green-50 border-green-200 text-green-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  <span className="font-medium">
                    {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                  </span>
                </div>
                {testResult.details && (
                  <p className="mt-1 text-sm">{testResult.details}</p>
                )}
                {testResult.success && testResult.balance !== undefined && (
                  <p className="mt-1 text-sm">
                    Account Balance: ${typeof testResult.balance === 'number' ? testResult.balance.toFixed(2) : '0.00'}
                  </p>
                )}
              </div>
            )}

            {/* Warning for untested connection */}
            {!testResult && username.trim() && apiKey.trim() && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
                  <span className="text-sm font-medium text-yellow-800">
                    Test your connection to verify credentials
                  </span>
                </div>
              </div>
            )}
          </form>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!username.trim() || !apiKey.trim() || !testResult?.success || isConnecting}
            className="min-w-[120px]"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Connect ClickSend
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
