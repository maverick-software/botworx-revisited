/**
 * Stripe Webhook Handler Edge Function
 * Processes Stripe webhook events for real-time subscription and payment updates
 * Handles subscription lifecycle, payment confirmations, and customer updates
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@14.0.0';

// Initialize Stripe with secret key
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Webhook secret for signature verification
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

interface WebhookResponse {
  success: boolean;
  message: string;
  processed_event?: string;
}

/**
 * Log webhook event for monitoring and debugging
 */
function logWebhookEvent(eventType: string, eventId: string, success: boolean, error?: string) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'stripe-webhook',
    event_type: eventType,
    event_id: eventId,
    success,
    error: error || null,
  }));
}

/**
 * Handle checkout.session.completed event
 * Creates or updates subscription when checkout is successful
 */
async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  
  if (!session.customer || !session.metadata?.user_id) {
    throw new Error('Missing customer or user_id in session metadata');
  }

  // Handle subscription checkout
  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    
    // Get plan information
    const priceId = subscription.items.data[0]?.price.id;
    const { data: plan } = await supabase
      .from('billing_plans')
      .select('*')
      .eq('stripe_price_id', priceId)
      .single();

    if (!plan) {
      throw new Error(`Plan not found for price ID: ${priceId}`);
    }

    // Create subscription record
    const { error: subscriptionError } = await supabase
      .from('stripe_subscriptions')
      .upsert({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: session.customer as string,
        user_id: session.metadata.user_id,
        stripe_price_id: priceId,
        plan_name: plan.plan_name,
        billing_interval: subscription.items.data[0]?.price.recurring?.interval || 'month',
        billing_amount: subscription.items.data[0]?.price.unit_amount || 0,
        currency: subscription.currency,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        default_payment_method: subscription.default_payment_method as string,
        subscription_metadata: subscription.metadata,
      }, {
        onConflict: 'stripe_subscription_id'
      });

    if (subscriptionError) {
      throw new Error(`Failed to create subscription: ${subscriptionError.message}`);
    }

    // Log subscription creation in history
    await supabase
      .from('subscription_history')
      .insert({
        subscription_id: (await supabase
          .from('stripe_subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .single()).data?.id,
        user_id: session.metadata.user_id,
        change_type: 'created',
        new_status: subscription.status,
        new_plan_name: plan.plan_name,
        change_reason: 'checkout_completed',
        stripe_event_id: event.id,
      });
  }

  // Handle one-time payment checkout
  if (session.mode === 'payment' && session.payment_intent) {
    // Log payment completion - could be used for token purchases or other one-time payments
    console.log(`Payment completed: ${session.payment_intent}`);
  }
}

/**
 * Handle customer.subscription.updated event
 * Updates subscription status, plan changes, cancellations
 */
async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  
  // Get current subscription from database
  const { data: currentSub } = await supabase
    .from('stripe_subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!currentSub) {
    throw new Error(`Subscription not found: ${subscription.id}`);
  }

  // Get plan information
  const priceId = subscription.items.data[0]?.price.id;
  const { data: plan } = await supabase
    .from('billing_plans')
    .select('*')
    .eq('stripe_price_id', priceId)
    .single();

  // Update subscription
  const { error: updateError } = await supabase
    .from('stripe_subscriptions')
    .update({
      stripe_price_id: priceId,
      plan_name: plan?.plan_name || currentSub.plan_name,
      billing_interval: subscription.items.data[0]?.price.recurring?.interval || currentSub.billing_interval,
      billing_amount: subscription.items.data[0]?.price.unit_amount || currentSub.billing_amount,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      default_payment_method: subscription.default_payment_method as string,
      subscription_metadata: subscription.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (updateError) {
    throw new Error(`Failed to update subscription: ${updateError.message}`);
  }

  // Determine change type
  let changeType = 'updated';
  if (currentSub.status !== subscription.status) {
    if (subscription.status === 'canceled') changeType = 'canceled';
    else if (currentSub.status === 'canceled' && subscription.status === 'active') changeType = 'reactivated';
  }
  if (currentSub.plan_name !== plan?.plan_name) {
    changeType = 'plan_changed';
  }

  // Log change in history
  await supabase
    .from('subscription_history')
    .insert({
      subscription_id: currentSub.id,
      user_id: currentSub.user_id,
      change_type: changeType,
      old_status: currentSub.status,
      new_status: subscription.status,
      old_plan_name: currentSub.plan_name,
      new_plan_name: plan?.plan_name || currentSub.plan_name,
      change_reason: 'stripe_webhook',
      stripe_event_id: event.id,
    });
}

/**
 * Handle customer.subscription.deleted event
 * Marks subscription as canceled
 */
async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  
  const { error } = await supabase
    .from('stripe_subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }

  // Log cancellation
  const { data: currentSub } = await supabase
    .from('stripe_subscriptions')
    .select('id, user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (currentSub) {
    await supabase
      .from('subscription_history')
      .insert({
        subscription_id: currentSub.id,
        user_id: currentSub.user_id,
        change_type: 'canceled',
        new_status: 'canceled',
        change_reason: 'stripe_webhook',
        stripe_event_id: event.id,
      });
  }
}

/**
 * Handle invoice.payment_succeeded event
 * Updates payment status and processes successful payments
 */
async function handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  
  // Log successful payment
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'stripe-webhook',
    action: 'invoice_paid',
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount_paid: invoice.amount_paid,
    subscription_id: invoice.subscription,
  }));

  // If this is a subscription invoice, ensure subscription is active
  if (invoice.subscription) {
    await supabase
      .from('stripe_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', invoice.subscription as string);
  }
}

/**
 * Handle invoice.payment_failed event
 * Updates subscription status and logs payment failure
 */
async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  
  // Log failed payment
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'stripe-webhook',
    action: 'payment_failed',
    invoice_id: invoice.id,
    customer_id: invoice.customer,
    amount_due: invoice.amount_due,
    subscription_id: invoice.subscription,
  }));

  // Update subscription status if applicable
  if (invoice.subscription) {
    const { data: currentSub } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .single();

    if (currentSub) {
      await supabase
        .from('stripe_subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription as string);

      // Log payment failure
      await supabase
        .from('subscription_history')
        .insert({
          subscription_id: currentSub.id,
          user_id: currentSub.user_id,
          change_type: 'payment_failed',
          old_status: currentSub.status,
          new_status: 'past_due',
          change_reason: 'payment_failed',
          stripe_event_id: event.id,
        });
    }
  }
}

/**
 * Process webhook event based on type
 */
async function processWebhookEvent(event: Stripe.Event): Promise<WebhookResponse> {
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event);
        break;
        
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event);
        break;
        
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event);
        break;
        
      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
        break;
    }

    logWebhookEvent(event.type, event.id, true);
    
    return {
      success: true,
      message: `Successfully processed ${event.type}`,
      processed_event: event.id,
    };

  } catch (error) {
    logWebhookEvent(event.type, event.id, false, error.message);
    throw error;
  }
}

/**
 * Main webhook handler
 */
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Get request body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      throw new Error('Missing Stripe signature header');
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Invalid signature', { status: 400 });
    }

    // Process the event
    const result = await processWebhookEvent(event);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Webhook processing failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
