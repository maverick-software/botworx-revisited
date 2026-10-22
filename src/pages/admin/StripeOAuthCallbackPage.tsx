/**
 * Stripe OAuth Callback Page
 * Handles the OAuth callback from Stripe Connect
 * Processes the authorization code and completes the connection
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

export default function StripeOAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<any>(null);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      setLoading(true);
      
      // Get parameters from URL
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      // Handle OAuth errors
      if (error) {
        throw new Error(errorDescription || `OAuth error: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received from Stripe');
      }

      if (!state) {
        throw new Error('No state parameter received');
      }

      // Verify state parameter
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        throw new Error('Invalid state parameter');
      }

      if (stateData.user_id !== user?.id) {
        throw new Error('Invalid user state');
      }

      // Exchange authorization code for access token
      const { data, error: functionError } = await supabase.functions.invoke('admin-stripe-config', {
        body: {
          action: 'complete_oauth',
          code,
          state,
        },
      });

      if (functionError) throw functionError;

      if (data.success) {
        setSuccess(true);
        setAccountInfo(data.account);
        toast.success('Successfully connected to Stripe!');
        
        // Redirect to admin billing config after a delay
        setTimeout(() => {
          navigate('/admin/billing/stripe-config');
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to complete OAuth connection');
      }
    } catch (err: any) {
      console.error('OAuth callback error:', err);
      setError(err.message || 'Failed to complete Stripe connection');
      toast.error(err.message || 'Failed to complete Stripe connection');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    navigate('/admin/billing/stripe-config');
  };

  return (
    <div className="container mx-auto py-12 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Stripe Connection</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {loading && (
            <div className="flex flex-col items-center gap-4">
              <RefreshCw className="w-12 h-12 animate-spin text-blue-600" />
              <div>
                <h3 className="text-lg font-medium">Connecting to Stripe...</h3>
                <p className="text-muted-foreground">
                  Please wait while we complete your Stripe connection.
                </p>
              </div>
            </div>
          )}

          {success && !loading && (
            <div className="flex flex-col items-center gap-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
              <div>
                <h3 className="text-lg font-medium text-green-800">Successfully Connected!</h3>
                <p className="text-muted-foreground">
                  Your Stripe account has been connected successfully.
                </p>
                {accountInfo && (
                  <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm">
                      <strong>Account:</strong> {accountInfo.display_name || accountInfo.id}
                    </p>
                    <p className="text-sm">
                      <strong>Country:</strong> {accountInfo.country}
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  Redirecting to admin panel in a few seconds...
                </p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
              <div>
                <h3 className="text-lg font-medium text-red-800">Connection Failed</h3>
                <p className="text-muted-foreground mb-4">
                  {error}
                </p>
                <Button onClick={handleRetry} className="mt-4">
                  Return to Configuration
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
