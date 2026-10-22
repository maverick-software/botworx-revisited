/**
 * Admin Stripe Configuration Edge Function
 * Handles Stripe API key management, connection testing, and product synchronization
 * Secure admin-only function for Stripe integration management
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@14.0.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AdminConfigRequest {
  action: 'save_keys' | 'test_connection' | 'sync_products' | 'get_config' | 'complete_oauth' | 'disconnect_oauth';
  secret_key?: string;
  webhook_secret?: string;
  publishable_key?: string;
  code?: string;
  state?: string;
  stripe_user_id?: string;
}

interface AdminConfigResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Verify admin permissions using existing user_has_role function
 */
async function verifyAdminAccess(userId: string): Promise<boolean> {
  try {
    console.log('Verifying admin access for user:', userId);
    
    const { data: isAdmin, error } = await supabase.rpc('user_has_role', {
      user_id: userId,
      role_name: 'admin'
    });

    console.log('user_has_role result:', { isAdmin, error });

    if (error) {
      console.error('Admin verification RPC error:', error);
      return false;
    }

    const result = isAdmin ?? false;
    console.log('Final admin verification result:', result);
    return result;
  } catch (error) {
    console.error('Admin verification exception:', error);
    return false;
  }
}

/**
 * Save Stripe API keys securely using existing vault pattern
 */
async function saveStripeKeys(secretKey: string, webhookSecret: string, publishableKey?: string): Promise<AdminConfigResponse> {
  try {
    console.log('Starting Stripe key storage process...');
    
    // Generate standardized secret names
    const timestamp = Date.now();
    const secretKeyName = `stripe_secret_key_admin_${timestamp}`;
    const webhookSecretName = `stripe_webhook_secret_admin_${timestamp}`;
    
    console.log('Storing secret key in vault using create_vault_secret...');
    
    // Store secret key in vault using the existing create_vault_secret function
    const { data: secretVaultId, error: secretError } = await supabase.rpc('create_vault_secret', {
      p_secret: secretKey,
      p_name: secretKeyName,
      p_description: `Stripe secret key for admin - Created: ${new Date().toISOString()}`
    });

    console.log('Secret key vault result:', { secretVaultId, secretError });

    if (secretError || !secretVaultId) {
      throw new Error(`Failed to store secret key in vault: ${secretError?.message || 'No vault ID returned'}`);
    }

    console.log('Storing webhook secret in vault using create_vault_secret...');

    // Store webhook secret in vault
    const { data: webhookVaultId, error: webhookError } = await supabase.rpc('create_vault_secret', {
      p_secret: webhookSecret,
      p_name: webhookSecretName,
      p_description: `Stripe webhook secret for admin - Created: ${new Date().toISOString()}`
    });

    console.log('Webhook secret vault result:', { webhookVaultId, webhookError });

    if (webhookError || !webhookVaultId) {
      throw new Error(`Failed to store webhook secret in vault: ${webhookError?.message || 'No vault ID returned'}`);
    }

    // Store publishable key in vault if provided
    let publishableVaultId = null;
    if (publishableKey) {
      console.log('Storing publishable key in vault...');
      const publishableKeyName = `stripe_publishable_key_admin_${timestamp}`;
      
      const { data: pubVaultId, error: pubError } = await supabase.rpc('create_vault_secret', {
        p_secret: publishableKey,
        p_name: publishableKeyName,
        p_description: `Stripe publishable key for admin - Created: ${new Date().toISOString()}`
      });

      console.log('Publishable key vault result:', { pubVaultId, pubError });

      if (pubError || !pubVaultId) {
        console.warn('Failed to store publishable key in vault:', pubError?.message);
      } else {
        publishableVaultId = pubVaultId;
      }
    }

    console.log('Storing credential references in admin_integration_credentials...');

    // Store credential references in admin_integration_credentials table
    // Use upsert with onConflict to handle updates properly
    const { error: credError1 } = await supabase
      .from('admin_integration_credentials')
      .upsert({
        integration_type: 'stripe',
        credential_name: 'secret_key',
        vault_secret_id: secretVaultId,
        connection_method: 'manual',
        connection_status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'integration_type,credential_name'
      });

    if (credError1) {
      console.error('Failed to store secret key reference:', credError1);
      throw new Error(`Failed to store secret key reference: ${credError1.message}`);
    }

    const { error: credError2 } = await supabase
      .from('admin_integration_credentials')
      .upsert({
        integration_type: 'stripe',
        credential_name: 'webhook_secret',
        vault_secret_id: webhookVaultId,
        connection_method: 'manual',
        connection_status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'integration_type,credential_name'
      });

    if (credError2) {
      console.error('Failed to store webhook secret reference:', credError2);
      throw new Error(`Failed to store webhook secret reference: ${credError2.message}`);
    }

    // Store publishable key reference if we have it
    if (publishableVaultId) {
      const { error: credError3 } = await supabase
        .from('admin_integration_credentials')
        .upsert({
          integration_type: 'stripe',
          credential_name: 'publishable_key',
          vault_secret_id: publishableVaultId,
          connection_method: 'manual',
          connection_status: 'active',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'integration_type,credential_name'
        });

      if (credError3) {
        console.error('Failed to store publishable key reference:', credError3);
        // Don't fail the whole operation for publishable key
      }
    }

    console.log('Updating admin_settings with public configuration...');

    // Update admin_settings with non-sensitive configuration
    const publicConfig = {
      connection_method: 'manual',
      connected: true,
      last_sync: new Date().toISOString(),
      mode: secretKey.startsWith('sk_live_') ? 'live' : 'test',
      // Store metadata about keys (not the actual keys)
      has_secret_key: true,
      has_webhook_secret: true,
      has_publishable_key: !!publishableKey,
      publishable_key_preview: publishableKey ? `${publishableKey.substring(0, 8)}...${publishableKey.substring(publishableKey.length - 4)}` : null
    };

    const { error: configError } = await supabase
      .from('admin_settings')
      .upsert({
        setting_key: 'stripe_config',
        setting_value: JSON.stringify(publicConfig),
        description: 'Stripe integration configuration (secrets stored in vault)',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (configError) {
      console.error('Failed to update admin_settings:', configError);
      throw new Error(`Failed to update configuration: ${configError.message}`);
    }

    console.log('Stripe configuration saved successfully!');

    return {
      success: true,
      data: { 
        message: 'API keys saved successfully in vault',
        config: publicConfig
      }
    };
  } catch (error: any) {
    console.error('Error in saveStripeKeys:', error);
    return {
      success: false,
      error: error.message || 'Failed to save Stripe configuration'
    };
  }
}

/**
 * Test Stripe connection using stored credentials or provided key
 */
async function testStripeConnection(secretKey?: string): Promise<AdminConfigResponse> {
  try {
    console.log('Testing Stripe connection...');
    let apiKey = secretKey;
    
    // If no key provided, try to get from vault
    if (!apiKey) {
      console.log('No secret key provided, attempting to retrieve from vault...');
      const { data: storedKey, error } = await supabase.rpc('get_admin_credential', {
        p_integration_type: 'stripe',
        p_credential_name: 'secret_key'
      });
      
      console.log('Vault retrieval result:', { hasKey: !!storedKey, error });
      
      if (error) {
        throw new Error(`Failed to retrieve stored key: ${error.message}`);
      }
      
      apiKey = storedKey;
    }

    if (!apiKey) {
      throw new Error('No Stripe secret key available for testing');
    }

    console.log('Creating Stripe client with key prefix:', apiKey?.substring(0, 8));

    const stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });

    // Test the connection by retrieving account info
    console.log('Attempting to retrieve Stripe account info...');
    const account = await stripe.accounts.retrieve();
    console.log('Stripe account retrieved successfully:', { id: account.id, charges_enabled: account.charges_enabled });
    
    return {
      success: true,
      data: {
        account_id: account.id,
        business_profile: account.business_profile,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        country: account.country,
        default_currency: account.default_currency,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Stripe connection failed: ${error.message}`
    };
  }
}

/**
 * Sync products from Stripe using stored credentials or provided key
 */
async function syncStripeProducts(secretKey?: string): Promise<AdminConfigResponse> {
  try {
    let apiKey = secretKey;
    
    // If no key provided, try to get from vault
    if (!apiKey) {
      const { data: storedKey, error } = await supabase.rpc('get_admin_credential', {
        p_integration_type: 'stripe',
        p_credential_name: 'secret_key'
      });
      
      if (error) {
        throw new Error(`Failed to retrieve stored key: ${error.message}`);
      }
      
      apiKey = storedKey;
    }

    if (!apiKey) {
      throw new Error('No Stripe secret key available for product sync');
    }

    const stripe = new Stripe(apiKey, {
      apiVersion: '2023-10-16',
    });

    // Fetch products with their default prices
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
      limit: 100,
    });

    // Transform products for frontend consumption
    const transformedProducts = products.data.map(product => ({
      id: product.id,
      name: product.name,
      description: product.description,
      active: product.active,
      default_price: product.default_price ? {
        id: (product.default_price as Stripe.Price).id,
        unit_amount: (product.default_price as Stripe.Price).unit_amount,
        currency: (product.default_price as Stripe.Price).currency,
        recurring: (product.default_price as Stripe.Price).recurring,
      } : null,
      metadata: product.metadata,
      created: product.created,
      updated: product.updated,
    }));

    // Sync to database
    for (const product of transformedProducts) {
      if (product.default_price) {
        await supabase
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
          }, {
            onConflict: 'stripe_price_id'
          });
      }
    }

    // Update last sync time
    await supabase
      .from('admin_settings')
      .update({
        setting_value: supabase.rpc('jsonb_set', {
          target: supabase.rpc('coalesce', {
            value: supabase.from('admin_settings').select('setting_value').eq('setting_key', 'stripe_config').single(),
            default_value: '{}'
          }),
          path: '{last_sync}',
          new_value: JSON.stringify(new Date().toISOString())
        }),
        updated_by: null
      })
      .eq('setting_key', 'stripe_config');

    return {
      success: true,
      data: {
        products: transformedProducts,
        count: transformedProducts.length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Product sync failed: ${error.message}`
    };
  }
}

/**
 * Get current Stripe configuration (metadata only, no actual keys)
 */
async function getStripeConfig(): Promise<AdminConfigResponse> {
  try {
    console.log('Getting Stripe config from admin_settings...');
    
    const { data: configData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'stripe_config')
      .single();

    console.log('Config fetch result:', { configData, fetchError });

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No config found, return empty config
        console.log('No Stripe config found, returning empty config');
        return {
          success: true,
          data: {
            connected: false,
            mode: 'test',
            connection_method: 'manual',
            has_secret_key: false,
            has_webhook_secret: false,
            has_publishable_key: false
          }
        };
      }
      throw fetchError;
    }

    // Handle both string and object formats for setting_value
    let config;
    if (configData?.setting_value) {
      if (typeof configData.setting_value === 'string') {
        config = JSON.parse(configData.setting_value);
      } else {
        // Already an object, use directly
        config = configData.setting_value;
      }
    } else {
      config = {
        connected: false,
        mode: 'test',
        connection_method: 'manual',
        has_secret_key: false,
        has_webhook_secret: false,
        has_publishable_key: false
      };
    }

    console.log('Returning config:', config);

    return {
      success: true,
      data: config
    };
  } catch (error: any) {
    console.error('Error in getStripeConfig:', error);
    return {
      success: false,
      error: `Failed to get config: ${error.message}`
    };
  }
}

/**
 * Complete Stripe OAuth flow using proper vault integration
 */
async function completeStripeOAuth(code: string, state: string): Promise<AdminConfigResponse> {
  try {
    // Verify state parameter
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      throw new Error('Invalid state parameter');
    }

    // Exchange authorization code for access token
    const clientId = Deno.env.get('STRIPE_CLIENT_ID');
    const clientSecret = Deno.env.get('STRIPE_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      throw new Error('Missing Stripe OAuth credentials');
    }

    const tokenResponse = await fetch('https://connect.stripe.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${clientSecret}`,
      },
      body: new URLSearchParams({
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'OAuth token exchange failed');
    }

    // Store OAuth access token in vault using proper admin credential function
    const { error: tokenError } = await supabase.rpc('store_admin_credential', {
      p_integration_type: 'stripe',
      p_credential_name: 'oauth_access_token',
      p_credential_value: tokenData.access_token,
      p_connection_method: 'oauth'
    });

    if (tokenError) {
      throw new Error(`Failed to store OAuth token: ${tokenError.message}`);
    }

    // Store publishable key if provided
    if (tokenData.stripe_publishable_key) {
      const { error: pubKeyError } = await supabase.rpc('store_admin_credential', {
        p_integration_type: 'stripe',
        p_credential_name: 'publishable_key',
        p_credential_value: tokenData.stripe_publishable_key,
        p_connection_method: 'oauth'
      });

      if (pubKeyError) {
        console.warn('Failed to store publishable key:', pubKeyError);
      }
    }

    // Save OAuth configuration in admin_settings (non-sensitive data only)
    const oauthConfig = {
      oauth_connected: true,
      stripe_user_id: tokenData.stripe_user_id,
      stripe_account_id: tokenData.stripe_user_id,
      connection_method: 'oauth',
      connected: true,
      last_sync: new Date().toISOString(),
      mode: tokenData.livemode ? 'live' : 'test'
    };

    const { error: settingsError } = await supabase
      .from('admin_settings')
      .upsert({
        setting_key: 'stripe_config',
        setting_value: JSON.stringify(oauthConfig),
        description: 'Stripe OAuth configuration (tokens stored in vault)',
        updated_by: null
      });

    if (settingsError) {
      throw new Error(`Failed to update configuration: ${settingsError.message}`);
    }

    return {
      success: true,
      data: {
        message: 'OAuth connection completed successfully',
        account: {
          id: tokenData.stripe_user_id,
          display_name: tokenData.stripe_user_id,
        },
        config: oauthConfig
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: `OAuth completion failed: ${error.message}`,
    };
  }
}

/**
 * Disconnect Stripe OAuth
 */
async function disconnectStripeOAuth(stripeUserId: string): Promise<AdminConfigResponse> {
  try {
    // Revoke OAuth access
    const clientSecret = Deno.env.get('STRIPE_CLIENT_SECRET');
    if (clientSecret) {
      const revokeResponse = await fetch('https://connect.stripe.com/oauth/deauthorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_secret: clientSecret,
          stripe_user_id: stripeUserId,
        }),
      });

      if (!revokeResponse.ok) {
        console.warn('Failed to revoke Stripe OAuth access');
      }
    }

    // Remove from Supabase
    const { error } = await supabase
      .from('admin_settings')
      .delete()
      .eq('setting_key', 'stripe_config');

    if (error) throw error;

    return {
      success: true,
      message: 'OAuth connection disconnected successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Disconnect failed: ${error.message}`,
    };
  }
}

/**
 * Main request handler
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Verify admin access
    const isAdmin = await verifyAdminAccess(user.id);
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    // Parse request body
    const body: AdminConfigRequest = await req.json();
    
    let result: AdminConfigResponse;

    // Route to appropriate handler
    switch (body.action) {
      case 'save_keys':
        if (!body.secret_key || !body.webhook_secret) {
          throw new Error('Missing required keys');
        }
        result = await saveStripeKeys(body.secret_key, body.webhook_secret, body.publishable_key);
        break;
        
      case 'test_connection':
        console.log('Processing test_connection action');
        result = await testStripeConnection(body.secret_key);
        console.log('test_connection result:', result);
        break;
        
      case 'sync_products':
        if (!body.secret_key) {
          throw new Error('Missing secret key');
        }
        result = await syncStripeProducts(body.secret_key);
        break;
        
      case 'get_config':
        console.log('Processing get_config action');
        result = await getStripeConfig();
        console.log('get_config result:', result);
        break;
        
      case 'complete_oauth':
        if (!body.code || !body.state) {
          throw new Error('Missing OAuth code or state');
        }
        result = await completeStripeOAuth(body.code, body.state);
        break;
        
      case 'disconnect_oauth':
        if (!body.stripe_user_id) {
          throw new Error('Missing Stripe user ID');
        }
        result = await disconnectStripeOAuth(body.stripe_user_id);
        break;
        
      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    // Log admin action
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'admin-stripe-config',
      action: body.action,
      admin_user_id: user.id,
      success: result.success,
    }));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    });

  } catch (error) {
    console.error('Admin Stripe config error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
