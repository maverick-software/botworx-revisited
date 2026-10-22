import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

export function MicrosoftTeamsCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Microsoft Teams connection...');

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

      if (!code || !state) {
        throw new Error('Missing authorization code or state parameter');
      }

      // Verify state parameter
      if (!state.startsWith('teams_')) {
        throw new Error('Invalid state parameter');
      }

      // Get stored PKCE verifier
      const codeVerifier = sessionStorage.getItem('teams_pkce_verifier');
      const storedUserId = sessionStorage.getItem('teams_user_id');

      if (!codeVerifier) {
        throw new Error('Missing PKCE code verifier');
      }

      // Clean up session storage
      sessionStorage.removeItem('teams_pkce_verifier');
      sessionStorage.removeItem('teams_user_id');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // Verify user matches stored user ID
      if (storedUserId && user.id !== storedUserId) {
        throw new Error('User mismatch during OAuth flow');
      }

      setMessage('Exchanging authorization code for access token...');

      // Get Microsoft Teams provider configuration
      const { data: provider, error: providerError } = await supabase
        .from('service_providers')
        .select('id, token_endpoint, configuration_metadata')
        .eq('name', 'microsoft-teams')
        .single();

      if (providerError) throw providerError;

      // Use the Microsoft Teams API Edge Function to exchange code for tokens
      // This keeps the client secret secure on the backend
      const { data: tokenExchangeResult, error: tokenExchangeError } = await supabase.functions.invoke('microsoft-teams-api', {
        body: {
          action: 'exchange_code',
          code: code,
          code_verifier: codeVerifier,
          redirect_uri: `${window.location.origin}/integrations/microsoft-teams/callback`,
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
      setMessage('Microsoft Teams connected successfully!');
      toast.success('Microsoft Teams integration completed');

      // Redirect to integrations page after a short delay
      setTimeout(() => {
        navigate('/integrations');
      }, 2000);

    } catch (error) {
      console.error('Microsoft Teams OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to complete Microsoft Teams connection');
      toast.error('Failed to connect Microsoft Teams');
    }
  };

  const handleRetry = () => {
    navigate('/integrations');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-6 p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Microsoft Teams Integration
          </h1>
          <p className="text-gray-600">
            Completing your connection...
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {status === 'processing' && (
            <div className="flex items-center justify-center space-x-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="text-gray-700">{message}</span>
            </div>
          )}

          {status === 'success' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {message}
              </AlertDescription>
            </Alert>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {message}
                </AlertDescription>
              </Alert>
              
              <div className="flex justify-center">
                <Button onClick={handleRetry} variant="outline">
                  Return to Integrations
                </Button>
              </div>
            </div>
          )}
        </div>

        {status === 'success' && (
          <div className="text-center text-sm text-gray-500">
            Redirecting you back to integrations...
          </div>
        )}
      </div>
    </div>
  );
}
