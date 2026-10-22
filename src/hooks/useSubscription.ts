/**
 * useSubscription Hook
 * Manages user subscription status and billing information
 * Provides real-time subscription data for UI components
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionStatus {
  plan_name: string;
  display_name: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'none';
  billing_amount: number;
  billing_interval: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  is_trial: boolean;
  trial_end: string | null;
}

interface BillingPlan {
  id: string;
  plan_name: string;
  display_name: string;
  description: string;
  features: string[];
  is_featured: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [currentPlan, setCurrentPlan] = useState<BillingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscriptionStatus = async () => {
    if (!user?.id) {
      setSubscription(null);
      setCurrentPlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current active subscription
      const { data: subData, error: subError } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'past_due', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Use maybeSingle instead of single to handle no results gracefully

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error fetching subscription:', subError);
        // Don't throw error for no subscription found
        if (subError.code !== 'PGRST116') {
          setError('Failed to load subscription status');
        }
      }

      if (subData) {
        // User has an active subscription
        const subscriptionStatus: SubscriptionStatus = {
          plan_name: subData.plan_name,
          display_name: subData.plan_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          status: subData.status,
          billing_amount: subData.billing_amount || 0,
          billing_interval: subData.billing_interval || 'month',
          current_period_end: subData.current_period_end,
          cancel_at_period_end: subData.cancel_at_period_end || false,
          is_trial: !!subData.trial_end && new Date(subData.trial_end) > new Date(),
          trial_end: subData.trial_end,
        };

        setSubscription(subscriptionStatus);

        // Get plan details
        const { data: planData } = await supabase
          .from('billing_plans')
          .select('*')
          .eq('plan_name', subData.plan_name)
          .single();

        if (planData) {
          setCurrentPlan(planData);
        }
      } else {
        // User has no active subscription - set to free plan
        const freeSubscription: SubscriptionStatus = {
          plan_name: 'free',
          display_name: 'Free Plan',
          status: 'active', // Free plan is considered "active"
          billing_amount: 0,
          billing_interval: 'month',
          current_period_end: null,
          cancel_at_period_end: false,
          is_trial: false,
          trial_end: null,
        };

        setSubscription(freeSubscription);
        
        // Set free plan details
        const freePlan: BillingPlan = {
          id: 'free-plan',
          plan_name: 'free',
          display_name: 'Free Plan',
          description: 'Perfect for getting started with AI agents',
          features: ['3 AI agents', 'Basic chat interface', 'Community support', '1GB storage', 'Basic integrations'],
          is_featured: false,
        };
        
        setCurrentPlan(freePlan);
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
      setError('Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  // Fetch subscription status on mount and user change
  useEffect(() => {
    fetchSubscriptionStatus();
  }, [user?.id]);

  // Helper functions
  const isPaidPlan = subscription?.status === 'active' && subscription?.billing_amount > 0;
  const isTrialing = subscription?.is_trial || false;
  const isPastDue = subscription?.status === 'past_due';
  const isCanceled = subscription?.status === 'canceled';
  const isFreePlan = subscription?.plan_name === 'free' || subscription?.billing_amount === 0;

  const formatCurrency = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusColor = () => {
    if (isPastDue) return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300';
    if (isCanceled) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300';
    if (isTrialing) return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300';
    if (isPaidPlan) return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300';
    return 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300';
  };

  const getStatusIcon = () => {
    if (isPaidPlan) return '👑'; // Crown for paid plans
    if (isTrialing) return '⭐'; // Star for trial
    if (isPastDue) return '⚠️'; // Warning for past due
    if (isCanceled) return '❌'; // X for canceled
    return '🆓'; // Free emoji for free plan
  };

  return {
    subscription,
    currentPlan,
    loading,
    error,
    isPaidPlan,
    isTrialing,
    isPastDue,
    isCanceled,
    isFreePlan,
    formatCurrency,
    getStatusColor,
    getStatusIcon,
    refetch: fetchSubscriptionStatus,
  };
}
