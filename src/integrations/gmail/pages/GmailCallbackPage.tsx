import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useGmailConnection } from '../hooks/useGmailIntegration';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function GmailCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useGmailConnection();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const handleCallback = async () => {
      // Prevent multiple executions
      if (isProcessingRef.current) {
        return;
      }
      isProcessingRef.current = true;

      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        // Handle the OAuth callback
        await handleOAuthCallback(code, state);
        
        setStatus('success');
        
        // Send success message to parent window if this is a popup
        if (window.opener) {
          console.log('Sending success message to parent window');
          const message = {
            type: 'GMAIL_OAUTH_SUCCESS',
            data: { 
              success: true,
              message: 'Gmail connected successfully!' 
            }
          };
          console.log('Message to send:', message, 'to origin:', window.location.origin);
          window.opener.postMessage(message, '*');
          
          // Close popup after a brief delay to show success message
          setTimeout(() => {
            console.log('Closing popup window');
            window.close();
          }, 1500);
        } else {
          // If not in popup, redirect to integrations page after 3 seconds
          setTimeout(() => {
            navigate('/integrations');
          }, 3000);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to complete OAuth flow';
        setError(errorMessage);
        setStatus('error');
        
        // Send error message to parent window if this is a popup
        if (window.opener) {
          console.log('Sending error message to parent window:', errorMessage);
          const message = {
            type: 'GMAIL_OAUTH_ERROR',
            data: { 
              success: false,
              error: errorMessage 
            }
          };
          console.log('Error message to send:', message, 'to origin:', window.location.origin);
          window.opener.postMessage(message, '*');
          
          // Keep popup open on error so user can see the error message
          // They can manually close it or retry
        }
      }
    };

    handleCallback();
  }, [searchParams, handleOAuthCallback, navigate]);

  const handleRetry = () => {
    if (window.opener) {
      window.close();
    } else {
      navigate('/integrations');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Gmail Integration</h1>
          <p className="text-gray-400">
            {status === 'processing' && 'Processing your Gmail connection...'}
            {status === 'success' && 'Successfully connected to Gmail!'}
            {status === 'error' && 'Failed to connect to Gmail'}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          {status === 'processing' && (
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-gray-300">Setting up your Gmail integration...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Connection Successful!
              </h3>
              <p className="text-gray-400 mb-4">
                Your Gmail integration is now active and ready to use with your agents.
              </p>
              {window.opener ? (
                <p className="text-sm text-gray-500">
                  This window will close automatically...
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Redirecting to integrations page...
                </p>
              )}
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Connection Failed
              </h3>
              <Alert className="bg-red-900/20 border-red-500/20 mb-4">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-400">
                  {error}
                </AlertDescription>
              </Alert>
              <Button 
                onClick={handleRetry}
                variant="outline" 
                className="mt-4"
              >
                {window.opener ? 'Close Window' : 'Return to Integrations'}
              </Button>
            </div>
          )}
        </div>

        {/* Instructions for popup flow */}
        {window.opener && status !== 'processing' && status !== 'success' && (
          <div className="text-center">
            <p className="text-sm text-gray-500">
              You can close this window and return to the main application.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 