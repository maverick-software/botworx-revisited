/**
 * Billing Dashboard Component
 * User-facing billing management interface with subscription status,
 * invoice history, and plan management capabilities
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Download, 
  Calendar, 
  DollarSign, 
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { PricingModal } from './PricingModal';

interface Subscription {
  id: string;
  plan_name: string;
  status: string;
  billing_amount: number;
  billing_interval: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
}

interface Invoice {
  id: string;
  stripe_invoice_id: string;
  invoice_number: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  total: number;
  currency: string;
  invoice_created: string;
  due_date: string;
  paid_at: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
}

interface BillingPlan {
  plan_name: string;
  display_name: string;
  description: string;
  features: string[];
}

export function BillingDashboard() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentPlan, setCurrentPlan] = useState<BillingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPricingModal, setShowPricingModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadBillingData();
    }
  }, [user]);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      
      // Load current subscription
      const { data: subData, error: subError } = await supabase
        .from('stripe_subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        console.error('Error loading subscription:', subError);
      } else if (subData) {
        setSubscription(subData);
        
        // Load plan details
        const { data: planData } = await supabase
          .from('billing_plans')
          .select('*')
          .eq('plan_name', subData.plan_name)
          .single();
        
        if (planData) {
          setCurrentPlan(planData);
        }
      }

      // Load recent invoices
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('stripe_invoices')
        .select('*')
        .eq('user_id', user?.id)
        .order('invoice_created', { ascending: false })
        .limit(10);

      if (invoiceError) {
        console.error('Error loading invoices:', invoiceError);
      } else {
        setInvoices(invoiceData || []);
      }

    } catch (error) {
      console.error('Failed to load billing data:', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: CheckCircle },
      trialing: { color: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: Clock },
      past_due: { color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30', icon: AlertCircle },
      canceled: { color: 'bg-red-500/20 text-red-600 border-red-500/30', icon: AlertCircle },
      paid: { color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: CheckCircle },
      open: { color: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30', icon: Clock },
      draft: { color: 'bg-gray-500/20 text-gray-600 border-gray-500/30', icon: Clock },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading billing information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Subscription</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your subscription and billing information</p>
        </div>
        <Button onClick={() => setShowPricingModal(true)} className="bg-purple-600 hover:bg-purple-700">
          Upgrade Plan
        </Button>
      </div>

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">
                  {subscription && currentPlan ? currentPlan.display_name : 'Free Plan'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {subscription && currentPlan 
                    ? currentPlan.description 
                    : 'Perfect for getting started with AI agents'
                  }
                </p>
                <div className="flex items-center gap-4 mt-2">
                  {subscription ? (
                    getStatusBadge(subscription.status)
                  ) : (
                    <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {subscription 
                      ? `${formatCurrency(subscription.billing_amount)} / ${subscription.billing_interval}`
                      : '$0.00 / month'
                    }
                  </span>
                </div>
              </div>
              <div className="text-right">
                {subscription ? (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Next billing date</p>
                    <p className="font-medium">{formatDate(subscription.current_period_end)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Plan Type</p>
                    <p className="font-medium">Free Tier</p>
                  </>
                )}
              </div>
            </div>

            {subscription?.cancel_at_period_end && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-800 dark:text-yellow-200">
                    Your subscription will be canceled at the end of the current billing period.
                  </span>
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Plan Features</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {subscription && currentPlan ? (
                  currentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))
                ) : (
                  // Default free plan features
                  <>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      3 AI agents
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      Basic chat interface
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      Community support
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      1GB storage
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      Basic integrations
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={() => setShowPricingModal(true)} className="bg-purple-600 hover:bg-purple-700">
                {subscription ? 'Change Plan' : 'Upgrade Plan'}
              </Button>
              {subscription && (
                <Button variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manage Billing
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Recent Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">
                        {invoice.invoice_number || `Invoice ${invoice.stripe_invoice_id.slice(-8)}`}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(invoice.invoice_created)}
                      </p>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(invoice.total, invoice.currency)}</p>
                      {invoice.status === 'paid' && invoice.paid_at && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Paid {formatDate(invoice.paid_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {invoice.invoice_pdf && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.invoice_pdf!, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {invoice.hosted_invoice_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(invoice.hosted_invoice_url!, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No invoices found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={subscription?.plan_name}
      />
    </div>
  );
}
