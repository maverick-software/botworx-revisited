import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { Loader2, CheckCircle, AlertCircle, HardDrive } from 'lucide-react';

export function MicrosoftOneDriveCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing OneDrive connection...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        throw new Error(errorDescription || `OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      if (!state || !state.startsWith('onedrive_')) {
        throw new Error('Invalid state parameter');
      }

      setMessage('Verifying authorization...');

      // Get stored PKCE verifier and user ID
      const codeVerifier = sessionStorage.getItem('onedrive_pkce_verifier');
      const storedUserId = sessionStorage.getItem('onedrive_user_id');

      if (!codeVerifier) {
        throw new Error('PKCE code verifier not found. Please try connecting again.');
      }

      // Clean up session storage
      sessionStorage.removeItem('onedrive_pkce_verifier');
      sessionStorage.removeItem('onedrive_user_id');

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Authentication required. Please log in and try again.');
      }

      // Verify user matches stored user ID
      if (storedUserId && user.id !== storedUserId) {
        throw new Error('User mismatch during OAuth flow');
      }

      setMessage('Exchanging authorization code for access token...');

      // Use the Microsoft OneDrive API Edge Function to exchange code for tokens
      // This keeps the client secret secure on the backend
      const { data: tokenExchangeResult, error: tokenExchangeError } = await supabase.functions.invoke('microsoft-onedrive-api', {
        body: {
          action: 'exchange_code',
          code: code,
          code_verifier: codeVerifier,
          redirect_uri: `${window.location.origin}/integrations/microsoft-onedrive/callback`,
          user_id: user.id
        }
      });

      if (tokenExchangeError) {
        throw new Error(`Token exchange failed: ${tokenExchangeError.message}`);
      }

      if (!tokenExchangeResult?.success) {
        throw new Error(tokenExchangeResult?.error || 'Token exchange failed');
      }

      const connectionData = tokenExchangeResult.data;

      setMessage('Connection established successfully!');

      setStatus('success');
      setMessage('Microsoft OneDrive connected successfully!');
      toast.success('Microsoft OneDrive integration completed');

      // Redirect to integrations page after a short delay
      setTimeout(() => {
        navigate('/integrations', { replace: true });
      }, 2000);

    } catch (error) {
      console.error('OneDrive OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to complete OneDrive connection');
      toast.error('OneDrive connection failed');

      // Redirect to integrations page after a delay
      setTimeout(() => {
        navigate('/integrations', { replace: true });
      }, 3000);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto p-6">
        <div className="text-center space-y-4">
          {/* Header */}
          <div className="flex items-center justify-center space-x-2 mb-6">
            <HardDrive className="h-6 w-6 text-blue-500" />
            <h1 className="text-2xl font-bold">Microsoft OneDrive</h1>
          </div>

          {/* Status Icon */}
          <div className="flex justify-center">
            {getStatusIcon()}
          </div>

          {/* Status Message */}
          <div className="space-y-2">
            <h2 className={`text-lg font-semibold ${getStatusColor()}`}>
              {status === 'loading' && 'Connecting OneDrive...'}
              {status === 'success' && 'Connection Successful!'}
              {status === 'error' && 'Connection Failed'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {message}
            </p>
          </div>

          {/* Additional Info */}
          {status === 'success' && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm text-green-800 dark:text-green-200">
                You can now use OneDrive features in your agents. Redirecting to integrations page...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-800 dark:text-red-200">
                Please try connecting again from the integrations page. Redirecting...
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Please wait while we securely connect your OneDrive account...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
