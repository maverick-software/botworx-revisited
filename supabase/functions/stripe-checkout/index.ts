/**
 * Stripe Checkout Edge Function
 * Creates secure Stripe checkout sessions for subscriptions and one-time payments
 * Integrates with Agentopia's user and customer management system
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@14.0.0';
import { corsHeaders } from '../_shared/cors.ts';

// Initialize Stripe with secret key
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CheckoutRequest {
  action: 'create_session';
  mode: 'subscription' | 'payment';
  price_id: string;
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  metadata?: Record<string, string>;
}

interface CheckoutResponse {
  success: boolean;
  session_id?: string;
  checkout_url?: string;
  error?: string;
}

interface StripeCustomer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  customer_email: string;
  customer_name?: string;
}

/**
 * Get or create Stripe customer for user
 */
async function getOrCreateStripeCustomer(userId: string): Promise<StripeCustomer> {
  // Check if customer already exists in database
  const { data: existingCustomer, error: customerError } = await supabase
    .from('stripe_customers')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingCustomer && !customerError) {
    return existingCustomer;
  }

  // Get user profile for customer creation
  const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !user) {
    throw new Error('User not found');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  // Create Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email: user.user.email,
    name: profile?.full_name || user.user.email,
    metadata: {
      user_id: userId,
      agentopia_user: 'true',
    },
  });

  // Store customer in database
  const { data: newCustomer, error: insertError } = await supabase
    .from('stripe_customers')
    .insert({
      user_id: userId,
      stripe_customer_id: stripeCustomer.id,
      customer_email: user.user.email!,
      customer_name: profile?.full_name || user.user.email,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to store customer:', insertError);
    throw new Error('Failed to create customer record');
  }

  return newCustomer;
}

/**
 * Create Stripe checkout session
 */
async function createCheckoutSession(
  userId: string,
  request: CheckoutRequest
): Promise<CheckoutResponse> {
  try {
    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(userId);

    // Validate price exists and get plan information
    const price = await stripe.prices.retrieve(request.price_id);
    if (!price.active) {
      throw new Error('Selected plan is no longer available');
    }

    // Get plan details from database
    const { data: plan } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('stripe_price_id', request.price_id)
      .single();

    // Create checkout session configuration
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: request.mode,
      customer: customer.stripe_customer_id,
      line_items: [{
        price: request.price_id,
        quantity: 1,
      }],
      success_url: request.success_url,
      cancel_url: request.cancel_url,
      metadata: {
        user_id: userId,
        plan_name: plan?.plan_name || 'unknown',
        source: 'agentopia_checkout',
        ...request.metadata,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    };

    // Add subscription-specific configuration
    if (request.mode === 'subscription') {
      sessionConfig.subscription_data = {
        metadata: {
          user_id: userId,
          plan_name: plan?.plan_name || 'unknown',
        },
      };
    }

    // Add payment-specific configuration
    if (request.mode === 'payment') {
      sessionConfig.payment_intent_data = {
        metadata: {
          user_id: userId,
          plan_name: plan?.plan_name || 'unknown',
        },
      };
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Log checkout session creation
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'stripe-checkout',
      action: 'session_created',
      user_id: userId,
      session_id: session.id,
      mode: request.mode,
      price_id: request.price_id,
      plan_name: plan?.plan_name,
    }));

    return {
      success: true,
      session_id: session.id,
      checkout_url: session.url!,
    };

  } catch (error) {
    console.error('Checkout session creation failed:', error);
    return handleCheckoutError(error);
  }
}

/**
 * Handle and categorize checkout errors
 */
function handleCheckoutError(error: any): CheckoutResponse {
  if (error.type === 'StripeCardError') {
    return {
      success: false,
      error: 'Your card was declined. Please try a different payment method.',
    };
  }
  
  if (error.type === 'StripeInvalidRequestError') {
    return {
      success: false,
      error: 'Invalid payment request. Please contact support.',
    };
  }
  
  if (error.code === 'resource_missing') {
    return {
      success: false,
      error: 'The selected plan is no longer available.',
    };
  }

  if (error.message?.includes('User not found')) {
    return {
      success: false,
      error: 'Authentication error. Please log in and try again.',
    };
  }
  
  return {
    success: false,
    error: 'Payment processing is temporarily unavailable. Please try again.',
  };
}

/**
 * Validate request parameters
 */
function validateRequest(body: any): CheckoutRequest {
  if (!body.action || body.action !== 'create_session') {
    throw new Error('Invalid or missing action parameter');
  }

  if (!body.mode || !['subscription', 'payment'].includes(body.mode)) {
    throw new Error('Invalid or missing mode parameter');
  }

  if (!body.price_id || typeof body.price_id !== 'string') {
    throw new Error('Invalid or missing price_id parameter');
  }

  if (!body.success_url || typeof body.success_url !== 'string') {
    throw new Error('Invalid or missing success_url parameter');
  }

  if (!body.cancel_url || typeof body.cancel_url !== 'string') {
    throw new Error('Invalid or missing cancel_url parameter');
  }

  return body as CheckoutRequest;
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

    // Parse and validate request body
    const body = await req.json();
    const validatedRequest = validateRequest(body);

    // Create checkout session
    const result = await createCheckoutSession(user.id, validatedRequest);

    // Return response
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    });

  } catch (error) {
    console.error('Stripe checkout API error:', error);
    
    // Log error for monitoring
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'stripe-checkout',
      action: 'error',
      error: error.message,
      stack: error.stack,
    }));

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
