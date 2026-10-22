import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Mail
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { IntegrationSetupProps } from '../../_shared/types/IntegrationSetup';
import { useGmailConnection } from '../hooks/useGmailIntegration';
import { useFormModalState } from '../../../hooks/useModalState';

/**
 * Gmail Integration Setup Modal
 * Handles Gmail OAuth setup and credential storage
 */
export function GmailSetupModal({
  integration,
  isOpen,
  onClose,
  onSuccess,
  onError,
  user
}: IntegrationSetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Use protected form state that persists across tab switches
  const {
    formData,
    errors,
    updateFormField,
    setFieldError
  } = useFormModalState(
    {
      connectionName: ''
    },
    {
      preserveOnHidden: true,
      preserveOnBlur: true,
      onCleanup: () => {
        console.log('[GmailSetupModal] Form state cleaned up');
      }
    }
  );
  
  const { connection: gmailConnection, initiateOAuth: gmailInitiateOAuth } = useGmailConnection();

  // Component lifecycle debugging (commented out for production)
  // useEffect(() => {
  //   console.log('[GmailSetupModal] Component mounted');
  //   return () => console.log('[GmailSetupModal] Component unmounting');
  // }, []);
  
  // useEffect(() => {
  //   console.log('[GmailSetupModal] isOpen changed:', { isOpen });
  // }, [isOpen]);

  const handleOAuthSetup = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      console.log('Initiating Gmail OAuth flow');
      await gmailInitiateOAuth();
      
      // Success! The Gmail connection should now be established
      onSuccess({
        connection_id: gmailConnection?.id || 'gmail-connection',
        connection_name: formData.connectionName || 'Gmail Connection',
        provider_name: 'gmail',
        external_username: gmailConnection?.external_username,
        scopes_granted: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify'
        ]
      });

      toast.success('Gmail connected successfully! 🎉');
      onClose();

    } catch (err: any) {
      console.error('Gmail OAuth error:', err);
      const errorMessage = err.message || 'Failed to connect Gmail';
      setError(errorMessage);
      setFieldError('connectionName', errorMessage);
      onError(errorMessage);
      if (!err.message?.includes('cancelled')) {
        toast.error('Failed to connect Gmail');
      }
    } finally {
      setLoading(false);
    }
  };

  // Note: Don't return null here - let the parent Dialog handle visibility
  // if (!isOpen) return null; // ❌ This destroys component state!

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
          <Mail className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Setup Gmail</h2>
          <p className="text-muted-foreground">Connect your Gmail account for email management</p>
        </div>
      </div>

      {/* OAuth Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-500" />
            <span>OAuth 2.0 Authentication</span>
          </CardTitle>
          <CardDescription>
            Secure authentication flow to connect your Gmail account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* General error display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {errors.connectionName && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.connectionName}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label htmlFor="connection_name">
              Connection Name (Optional)
            </Label>
            <Input
              id="connection_name"
              value={formData.connectionName}
              onChange={(e) => updateFormField('connectionName', e.target.value)}
              placeholder="My Gmail Connection"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Give this connection a name to identify it later
            </p>
          </div>

          <Button
            onClick={handleOAuthSetup}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Connect with Gmail
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Capabilities Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span>Agent Capabilities</span>
          </CardTitle>
          <CardDescription>
            What your agents will be able to do with Gmail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Send and receive emails</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Read and search email messages</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Manage email labels and folders</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Secure OAuth authentication</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
