import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export function MicrosoftOutlookCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Microsoft Outlook authorization...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Check for OAuth errors
      if (error) {
        console.error('OAuth error:', error, errorDescription);
        setStatus('error');
        setMessage(`Authorization failed: ${errorDescription || error}`);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setStatus('error');
        setMessage('Missing authorization code or state parameter');
        return;
      }

      // Validate state parameter
      if (!state.startsWith('outlook_')) {
        setStatus('error');
        setMessage('Invalid state parameter');
        return;
      }

      // Get stored values from session storage
      const codeVerifier = sessionStorage.getItem('outlook_code_verifier');
      const userId = sessionStorage.getItem('outlook_user_id');

      if (!codeVerifier || !userId) {
        setStatus('error');
        setMessage('Missing session data. Please try connecting again.');
        return;
      }

      setMessage('Exchanging authorization code for access token...');

      // Get connection name from session storage before cleanup
      const connectionName = sessionStorage.getItem('outlook_connection_name') || 'Microsoft Outlook';

      // Clean up session storage
      sessionStorage.removeItem('outlook_code_verifier');
      sessionStorage.removeItem('outlook_user_id');
      sessionStorage.removeItem('outlook_connection_name');

      // Call the Edge Function to exchange the code for tokens
      const { data, error: exchangeError } = await supabase.functions.invoke('microsoft-outlook-api', {
        body: {
          action: 'exchange_code',
          code,
          code_verifier: codeVerifier,
          user_id: userId,
          connection_name: connectionName,
          redirect_uri: `${window.location.origin}/integrations/microsoft-outlook/callback`
        }
      });

      if (exchangeError) {
        console.error('Token exchange error:', exchangeError);
        setStatus('error');
        setMessage(`Failed to exchange authorization code: ${exchangeError.message}`);
        return;
      }

      if (!data?.success) {
        console.error('Token exchange failed:', data);
        setStatus('error');
        setMessage(data?.error || 'Failed to exchange authorization code');
        return;
      }

      setStatus('success');
      setMessage('Microsoft Outlook connected successfully!');

      // Notify parent window if this is a popup
      if (window.opener) {
        window.opener.postMessage({
          type: 'MICROSOFT_OUTLOOK_OAUTH_SUCCESS',
          data: { success: true }
        }, window.location.origin);
        
        // Close popup after a short delay
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        // Redirect to integrations page if not in popup
        setTimeout(() => {
          navigate('/integrations', { replace: true });
        }, 2000);
      }

    } catch (error) {
      console.error('Callback handling error:', error);
      setStatus('error');
      setMessage('An unexpected error occurred during authorization');
      
      // Notify parent window of error if this is a popup
      if (window.opener) {
        window.opener.postMessage({
          type: 'MICROSOFT_OUTLOOK_OAUTH_ERROR',
          data: { error: error instanceof Error ? error.message : 'Unknown error occurred' }
        }, window.location.origin);
        
        // Close popup after a short delay
        setTimeout(() => {
          window.close();
        }, 3000);
      }
    }
  };

  const handleRetry = () => {
    navigate('/integrations', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            {status === 'processing' && (
              <>
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <h2 className="text-lg font-semibold">Connecting Microsoft Outlook</h2>
                <p className="text-sm text-muted-foreground">{message}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <CheckCircle className="w-8 h-8 mx-auto text-green-600" />
                <h2 className="text-lg font-semibold text-green-600">Connection Successful!</h2>
                <p className="text-sm text-muted-foreground">{message}</p>
                <p className="text-xs text-muted-foreground">Redirecting you back to integrations...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <AlertCircle className="w-8 h-8 mx-auto text-red-600" />
                <h2 className="text-lg font-semibold text-red-600">Connection Failed</h2>
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button onClick={handleRetry} className="mt-4">
                  Back to Integrations
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
