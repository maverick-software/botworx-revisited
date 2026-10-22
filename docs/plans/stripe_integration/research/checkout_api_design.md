# Checkout API Design - Stripe Checkout Edge Function
## Research Document for WBS Task 3.2.1

### **CONTEXT & PURPOSE**
Design the `stripe-checkout` Edge Function that creates Stripe checkout sessions for both subscription and one-time payments. This function serves as the secure bridge between Agentopia's frontend and Stripe's payment processing.

### **EXISTING EDGE FUNCTION PATTERNS**
- **Standard Structure**: All functions use `serve()` with CORS handling
- **Authentication**: JWT token validation from Supabase auth
- **Error Handling**: Consistent error response format
- **Database Integration**: Service role client for database operations
- **Action Routing**: Functions use action parameter for multiple operations

### **STRIPE CHECKOUT REQUIREMENTS**
- **Session Creation**: Create secure checkout sessions
- **Customer Management**: Link to existing or create new Stripe customers
- **Subscription Handling**: Support recurring billing
- **One-time Payments**: Support single purchases
- **Success/Cancel URLs**: Handle post-payment redirects
- **Metadata**: Store session metadata for tracking

### **PROPOSED FUNCTION STRUCTURE**
```typescript
// File: supabase/functions/stripe-checkout/index.ts
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@14.0.0';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

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
```

### **SESSION CREATION LOGIC**
```typescript
async function createCheckoutSession(
  supabase: SupabaseClient,
  userId: string,
  request: CheckoutRequest
): Promise<CheckoutResponse> {
  try {
    // 1. Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(supabase, userId);
    
    // 2. Validate price exists in Stripe
    const price = await stripe.prices.retrieve(request.price_id);
    
    // 3. Create checkout session
    const session = await stripe.checkout.sessions.create({
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
        ...request.metadata,
      },
      // Subscription-specific options
      ...(request.mode === 'subscription' && {
        subscription_data: {
          metadata: {
            user_id: userId,
          },
        },
      }),
      // Payment-specific options
      ...(request.mode === 'payment' && {
        payment_intent_data: {
          metadata: {
            user_id: userId,
          },
        },
      }),
    });

    return {
      success: true,
      session_id: session.id,
      checkout_url: session.url!,
    };
  } catch (error) {
    console.error('Checkout session creation failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

### **CUSTOMER MANAGEMENT INTEGRATION**
```typescript
async function getOrCreateStripeCustomer(
  supabase: SupabaseClient,
  userId: string
) {
  // Check if customer already exists
  const { data: existingCustomer } = await supabase
    .from('stripe_customers')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existingCustomer) {
    return existingCustomer;
  }

  // Get user profile for customer creation
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  // Create Stripe customer
  const stripeCustomer = await stripe.customers.create({
    email: profile?.email,
    name: profile?.full_name,
    metadata: {
      user_id: userId,
    },
  });

  // Store customer in database
  const { data: newCustomer } = await supabase
    .from('stripe_customers')
    .insert({
      user_id: userId,
      stripe_customer_id: stripeCustomer.id,
      customer_email: profile?.email,
      customer_name: profile?.full_name,
    })
    .select()
    .single();

  return newCustomer;
}
```

### **ERROR HANDLING STRATEGY**
```typescript
// Comprehensive error handling
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
  
  return {
    success: false,
    error: 'Payment processing is temporarily unavailable. Please try again.',
  };
}
```

### **SECURITY CONSIDERATIONS**
- **Authentication**: Verify JWT token on all requests
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Input Validation**: Validate all input parameters
- **Price Validation**: Verify price exists and is active
- **Customer Verification**: Ensure customer belongs to authenticated user
- **Metadata Security**: Sanitize metadata to prevent injection

### **CORS AND REQUEST HANDLING**
```typescript
serve(async (req) => {
  // Handle CORS preflight
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

    // Parse request body
    const body: CheckoutRequest = await req.json();
    
    // Validate required fields
    if (!body.action || !body.price_id || !body.success_url || !body.cancel_url) {
      throw new Error('Missing required parameters');
    }

    // Route to appropriate handler
    let result: CheckoutResponse;
    switch (body.action) {
      case 'create_session':
        result = await createCheckoutSession(supabase, user.id, body);
        break;
      default:
        throw new Error(`Unknown action: ${body.action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 400,
    });

  } catch (error) {
    console.error('Checkout API error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
```

### **INTEGRATION WITH FRONTEND**
```typescript
// Frontend usage example
const createCheckoutSession = async (priceId: string, mode: 'subscription' | 'payment') => {
  const response = await supabase.functions.invoke('stripe-checkout', {
    body: {
      action: 'create_session',
      mode,
      price_id: priceId,
      success_url: `${window.location.origin}/billing/success`,
      cancel_url: `${window.location.origin}/billing/canceled`,
      metadata: {
        source: 'pricing_page',
      },
    },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  if (response.data.success) {
    // Redirect to Stripe Checkout
    window.location.href = response.data.checkout_url;
  }
};
```

### **TESTING REQUIREMENTS**
- **Authentication Testing**: Test with valid/invalid tokens
- **Parameter Validation**: Test missing/invalid parameters
- **Stripe Integration**: Test with Stripe test mode
- **Customer Creation**: Test new and existing customers
- **Error Scenarios**: Test various error conditions
- **CORS**: Test cross-origin requests
- **Rate Limiting**: Test request rate limits

### **PERFORMANCE CONSIDERATIONS**
- **Customer Caching**: Cache customer lookups
- **Price Validation**: Cache price information
- **Database Connections**: Optimize database queries
- **Error Logging**: Structured logging for debugging
- **Response Time**: Target sub-500ms response times

### **MONITORING AND LOGGING**
```typescript
// Structured logging
const logCheckoutEvent = (userId: string, action: string, result: any) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'stripe-checkout',
    user_id: userId,
    action,
    success: result.success,
    error: result.error || null,
    session_id: result.session_id || null,
  }));
};
```

### **BACKUP INSTRUCTIONS**
Before implementing:
1. **Function Backup**: No existing stripe-checkout function to backup
2. **Dependencies**: Ensure Stripe credentials are configured
3. **Database**: Ensure stripe_customers table exists
4. **Testing**: Set up Stripe test environment

### **DEPENDENCIES**
- **Stripe Account**: Test and live API keys configured
- **Database Tables**: stripe_customers table must exist
- **Environment Variables**: STRIPE_SECRET_KEY configured
- **CORS Configuration**: corsHeaders utility available
- **Authentication**: Supabase auth system working

### **ROLLBACK PLAN**
1. **Remove Function**: Delete stripe-checkout directory
2. **Remove Routes**: Remove any frontend routes calling function
3. **Database Cleanup**: No database changes to rollback
4. **Stripe Cleanup**: No Stripe configuration to rollback

### **IMPLEMENTATION NOTES**
- **File Size**: Keep function under 300 lines total
- **Error Messages**: Provide user-friendly error messages
- **Logging**: Include comprehensive logging for debugging
- **Documentation**: Add inline comments explaining logic
- **Testing**: Include test data generation functions

