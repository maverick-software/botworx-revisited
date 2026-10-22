/**
 * Stripe Configuration Panel - Admin Interface
 * Allows admins to configure Stripe API keys and connection settings
 * Includes product import and webhook configuration
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Key, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  Upload,
  Settings,
  Globe,
  Shield,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { VaultService } from '@/integrations/_shared';

interface StripeConfig {
  publishable_key: string;
  secret_key: string;
  webhook_secret: string;
  webhook_url: string;
  mode: 'test' | 'live';
  connected: boolean;
  last_sync: string | null;
  oauth_connected: boolean;
  stripe_user_id?: string;
  stripe_account_id?: string;
  connection_method: 'oauth' | 'manual';
}

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  active: boolean;
  default_price: {
    id: string;
    unit_amount: number;
    currency: string;
    recurring?: {
      interval: string;
    };
  };
}

export function StripeConfigurationPanel() {
  const { user } = useAuth();
  const [config, setConfig] = useState<StripeConfig>({
    publishable_key: '',
    secret_key: '',
    webhook_secret: '',
    webhook_url: '',
    mode: 'test',
    connected: false,
    last_sync: null,
    oauth_connected: false,
    stripe_user_id: '',
    stripe_account_id: '',
    connection_method: 'oauth',
  });
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingProducts, setSyncingProducts] = useState(false);

  useEffect(() => {
    loadStripeConfig();
  }, []);

  const loadStripeConfig = async () => {
    try {
      console.log('Loading Stripe configuration...');
      
      // Load existing Stripe configuration using the Edge Function
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: { action: 'get_config' }
      });

      if (error) {
        console.error('Failed to load config via Edge Function:', error);
        return;
      }

      if (data.success && data.data) {
        console.log('Loaded config:', data.data);
        
        const configData = data.data;
        
        setConfig(prev => ({
          ...prev,
          ...configData,
          // Show masked values based on metadata
          secret_key: configData.has_secret_key ? '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••' : '',
          webhook_secret: configData.has_webhook_secret ? '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••' : '',
          publishable_key: configData.has_publishable_key ? '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••' : ''
        }));
      }
    } catch (error) {
      console.error('Failed to load Stripe config:', error);
    }
  };

  const saveStripeConfig = async () => {
    try {
      setLoading(true);
      
      if (!config.secret_key || !config.webhook_secret) {
        throw new Error('Secret key and webhook secret are required');
      }

      // Use the admin-stripe-config Edge Function which now handles vault storage properly
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: {
          action: 'save_keys',
          secret_key: config.secret_key,
          webhook_secret: config.webhook_secret,
          publishable_key: config.publishable_key,
        }
      });

      if (error) throw error;

      if (data.success) {
        // Update local state with the returned configuration, preserving form inputs
        setConfig(prev => ({ 
          ...prev, 
          connected: true,
          ...data.data.config,
          // Keep the form inputs that the user entered
          publishable_key: prev.publishable_key,
          secret_key: prev.secret_key,
          webhook_secret: prev.webhook_secret
        }));
        toast.success('Stripe configuration saved successfully in vault');
      } else {
        throw new Error(data.error || 'Failed to save configuration');
      }
    } catch (error: any) {
      console.error('Failed to save Stripe config:', error);
      toast.error(`Failed to save configuration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testStripeConnection = async () => {
    try {
      setTestingConnection(true);
      
      // Test connection using stored credentials from vault (don't send masked key)
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: {
          action: 'test_connection'
          // Don't send secret_key since it's masked - let backend retrieve from vault
        }
      });

      if (error) throw error;

      if (data.success) {
        setConfig(prev => ({ ...prev, connected: true }));
        toast.success(`Stripe connection successful! Account: ${data.data.account_id}`);
      } else {
        throw new Error(data.error || 'Connection test failed');
      }
    } catch (error: any) {
      console.error('Stripe connection test failed:', error);
      toast.error('Connection test failed: ' + error.message);
      setConfig(prev => ({ ...prev, connected: false }));
    } finally {
      setTestingConnection(false);
    }
  };

  const syncStripeProducts = async () => {
    try {
      setSyncingProducts(true);
      
      // Sync products using stored credentials from vault (don't send masked key)
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: {
          action: 'sync_products'
          // Don't send secret_key since it's masked - let backend retrieve from vault
        }
      });

      if (error) throw error;

      if (data.success) {
        setProducts(data.data.products || []);
        setConfig(prev => ({ ...prev, last_sync: new Date().toISOString() }));
        toast.success(`Synced ${data.data.count || 0} products from Stripe`);
      } else {
        throw new Error(data.error || 'Product sync failed');
      }
    } catch (error: any) {
      console.error('Product sync failed:', error);
      toast.error('Product sync failed: ' + error.message);
    } finally {
      setSyncingProducts(false);
    }
  };

  const initiateStripeOAuth = () => {
    try {
      // Check for required client ID
      const clientId = import.meta.env.VITE_STRIPE_CLIENT_ID || process.env.REACT_APP_STRIPE_CLIENT_ID;
      
      console.log('Environment check:', {
        VITE_STRIPE_CLIENT_ID: import.meta.env.VITE_STRIPE_CLIENT_ID,
        REACT_APP_STRIPE_CLIENT_ID: process.env.REACT_APP_STRIPE_CLIENT_ID,
        clientId,
        allEnvVars: import.meta.env
      });
      
      if (!clientId || clientId === 'ca_YOUR_CLIENT_ID') {
        toast.error('Stripe Client ID not configured. Please set VITE_STRIPE_CLIENT_ID in your environment variables.');
        console.error('Missing VITE_STRIPE_CLIENT_ID environment variable');
        return;
      }

      if (!user?.id) {
        toast.error('User not authenticated');
        return;
      }

      // Stripe OAuth flow
      const redirectUri = `${window.location.origin}/admin/billing/stripe-callback`;
      const state = btoa(JSON.stringify({ user_id: user.id, timestamp: Date.now() }));
      
      const oauthUrl = new URL('https://connect.stripe.com/oauth/authorize');
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('client_id', clientId);
      oauthUrl.searchParams.set('scope', 'read_write');
      oauthUrl.searchParams.set('redirect_uri', redirectUri);
      oauthUrl.searchParams.set('state', state);
      
      console.log('Redirecting to Stripe OAuth:', oauthUrl.toString());
      
      // Redirect to Stripe OAuth
      window.location.href = oauthUrl.toString();
    } catch (error: any) {
      console.error('OAuth initiation error:', error);
      toast.error('Failed to initiate Stripe connection: ' + error.message);
    }
  };

  const disconnectStripeOAuth = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('admin-stripe-config', {
        body: {
          action: 'disconnect_oauth',
          stripe_user_id: config.stripe_user_id,
        },
      });

      if (error) throw error;

      if (data.success) {
        setConfig(prev => ({ 
          ...prev, 
          oauth_connected: false,
          stripe_user_id: '',
          stripe_account_id: '',
          connected: false,
          publishable_key: '',
          secret_key: ''
        }));
        toast.success('Stripe account disconnected');
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (error: any) {
      console.error('OAuth disconnect error:', error);
      toast.error(error.message || 'Failed to disconnect');
    } finally {
      setLoading(false);
    }
  };

  const importProductToBillingPlans = async (product: StripeProduct) => {
    try {
      const { error } = await supabase
        .from('billing_plans')
        .upsert({
          plan_name: product.name.toLowerCase().replace(/\s+/g, '_'),
          display_name: product.name,
          description: product.description || '',
          stripe_price_id: product.default_price.id,
          amount: product.default_price.unit_amount || 0,
          currency: product.default_price.currency,
          billing_interval: product.default_price.recurring?.interval || 'month',
          features: [],
          limits: {},
          is_active: product.active,
        });

      if (error) throw error;
      toast.success(`Imported ${product.name} to billing plans`);
    } catch (error) {
      console.error('Failed to import product:', error);
      toast.error('Failed to import product');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Stripe Configuration</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Configure Stripe integration and manage billing products
          </p>
        </div>
        <Badge className={config.connected ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}>
          {config.connected ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Connected
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3 mr-1" />
              Not Connected
            </>
          )}
        </Badge>
      </div>

      <Tabs defaultValue="configuration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-4">
          {/* OAuth Connection Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Connect with Stripe
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Securely connect your Stripe account using OAuth (recommended) or manually enter API keys.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="oauth"
                    name="connection_method"
                    checked={config.connection_method === 'oauth'}
                    onChange={() => setConfig(prev => ({ ...prev, connection_method: 'oauth' }))}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Label htmlFor="oauth">OAuth Connection (Recommended)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    id="manual"
                    name="connection_method"
                    checked={config.connection_method === 'manual'}
                    onChange={() => setConfig(prev => ({ ...prev, connection_method: 'manual' }))}
                    className="w-4 h-4 text-blue-600"
                  />
                  <Label htmlFor="manual">Manual API Keys</Label>
                </div>
              </div>

              {config.connection_method === 'oauth' && (
                <div className="space-y-4">
                  {config.oauth_connected ? (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <h3 className="font-medium text-green-800 dark:text-green-200">Connected to Stripe</h3>
                          </div>
                          <p className="text-sm text-green-600 dark:text-green-300">
                            Account ID: {config.stripe_account_id}
                          </p>
                          {config.last_sync && (
                            <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                              Last synced: {new Date(config.last_sync).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={disconnectStripeOAuth}
                          disabled={loading}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Connect your Stripe account</h3>
                          <p className="text-sm text-blue-600 dark:text-blue-300 mb-2">
                            Securely connect to Stripe using OAuth. This is the recommended method for security and ease of use.
                          </p>
                          <ul className="text-xs text-blue-500 dark:text-blue-400 mb-3 space-y-1">
                            <li>• No need to manually copy API keys</li>
                            <li>• Automatic key rotation and security updates</li>
                            <li>• Easy to disconnect and reconnect</li>
                          </ul>
                          
                          {/* Configuration Status */}
                          <div className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                            <strong>Configuration Status:</strong>
                            <br />
                            Client ID: {import.meta.env.VITE_STRIPE_CLIENT_ID ? '✅ Configured' : '❌ Not configured'}
                            <br />
                            Redirect URI: {window.location.origin}/admin/billing/stripe-callback
                          </div>
                          
                          {(!import.meta.env.VITE_STRIPE_CLIENT_ID) && (
                            <div className="text-xs text-orange-600 dark:text-orange-400 p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                              <strong>Setup Required:</strong> Add VITE_STRIPE_CLIENT_ID to your environment variables to enable OAuth.
                              <br />
                              For now, you can use the Manual API Keys method below.
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          <Button
                            onClick={initiateStripeOAuth}
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 mb-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Connect with Stripe
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfig(prev => ({ ...prev, connection_method: 'manual' }))}
                            className="w-full text-xs"
                          >
                            Use Manual Setup
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Keys Section - Only show if manual method selected */}
          {config.connection_method === 'manual' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  API Keys
                </CardTitle>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <select
                    value={config.mode}
                    disabled={config.secret_key || config.publishable_key}
                    onChange={(e) => setConfig(prev => ({ ...prev, mode: e.target.value as 'test' | 'live' }))}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-background disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="test">Test Mode</option>
                    <option value="live">Live Mode</option>
                  </select>
                  {(config.secret_key || config.publishable_key) && (
                    <p className="text-xs text-muted-foreground">
                      Mode is auto-detected from your API keys
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center gap-2">
                    {config.connected ? (
                      <Badge className="bg-green-500/20 text-green-600">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/20 text-red-600">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Disconnected
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="publishable_key">Publishable Key</Label>
                  <Input
                    id="publishable_key"
                    type="text"
                    placeholder={`pk_${config.mode}_...`}
                    value={config.publishable_key}
                    onChange={(e) => {
                      const pubKey = e.target.value;
                      const detectedMode = pubKey.startsWith('pk_live_') ? 'live' : 'test';
                      setConfig(prev => ({ 
                        ...prev, 
                        publishable_key: pubKey,
                        mode: detectedMode
                      }));
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="secret_key">Secret Key</Label>
                  <Input
                    id="secret_key"
                    type="password"
                    placeholder={`sk_${config.mode}_...`}
                    value={config.secret_key}
                    onChange={(e) => {
                      const secretKey = e.target.value;
                      const detectedMode = secretKey.startsWith('sk_live_') ? 'live' : 'test';
                      setConfig(prev => ({ 
                        ...prev, 
                        secret_key: secretKey,
                        mode: detectedMode
                      }));
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="webhook_secret">Webhook Secret</Label>
                  <Input
                    id="webhook_secret"
                    type="password"
                    placeholder="whsec_..."
                    value={config.webhook_secret}
                    onChange={(e) => setConfig(prev => ({ ...prev, webhook_secret: e.target.value }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  onClick={testStripeConnection}
                  disabled={testingConnection || !config.secret_key}
                  variant="outline"
                >
                  {testingConnection ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>

                <Button
                  onClick={saveStripeConfig}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Stripe Products
                </div>
                <Button
                  onClick={syncStripeProducts}
                  disabled={syncingProducts || !config.connected}
                  size="sm"
                >
                  {syncingProducts ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Sync Products
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {products.length > 0 ? (
                <div className="space-y-4">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{product.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={product.active ? 'bg-green-500/20 text-green-600' : 'bg-gray-500/20 text-gray-600'}>
                            {product.active ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-sm">
                            ${(product.default_price.unit_amount / 100).toFixed(2)} / {product.default_price.recurring?.interval || 'one-time'}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => importProductToBillingPlans(product)}
                        size="sm"
                        variant="outline"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    {config.connected ? 'No products found. Click "Sync Products" to load from Stripe.' : 'Connect to Stripe to view products.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Webhook Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="webhook_url">Webhook Endpoint URL</Label>
                <Input
                  id="webhook_url"
                  type="url"
                  value={`${window.location.origin}/functions/v1/stripe-webhook`}
                  readOnly
                  className="bg-gray-50 dark:bg-gray-800"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Configure this URL in your Stripe Dashboard → Developers → Webhooks
                </p>
              </div>

              <div>
                <Label>Required Events</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {[
                    'checkout.session.completed',
                    'customer.subscription.updated',
                    'customer.subscription.deleted',
                    'invoice.payment_succeeded',
                    'invoice.payment_failed',
                  ].map((event) => (
                    <Badge key={event} variant="outline" className="justify-start">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>

              {config.last_sync && (
                <div>
                  <Label>Last Sync</Label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(config.last_sync).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
