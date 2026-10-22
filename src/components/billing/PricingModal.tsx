/**
 * Enhanced Pricing Modal Component
 * Modern, themed pricing modal with proper plan structure and delegated access for business plans
 * Matches AgentChatPage settings modal design with rounded edges and consistent theming
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  Loader2, 
  X, 
  Crown, 
  Users, 
  Shield, 
  Zap, 
  Star,
  Infinity,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface BillingPlan {
  id: string;
  plan_name: string;
  display_name: string;
  description: string;
  stripe_price_id: string;
  amount: number;
  currency: string;
  billing_interval: 'month' | 'year';
  features: string[];
  limits: Record<string, number>;
  plan_type: 'personal' | 'business';
  is_featured: boolean;
  sort_order: number;
}

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  onPlanSelect?: (planName: string) => void;
}

interface PricingCardProps {
  plan: BillingPlan;
  isCurrentPlan: boolean;
  isLoading: boolean;
  onSelect: (planName: string) => void;
}

function PricingCard({ plan, isCurrentPlan, isLoading, onSelect }: PricingCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const getPlanIcon = () => {
    if (plan.plan_name === 'free') return <Zap className="w-5 h-5" />;
    if (plan.plan_type === 'business') return <Users className="w-5 h-5" />;
    return <Crown className="w-5 h-5" />;
  };

  const getPlanColor = () => {
    if (plan.is_featured) return 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
    if (plan.plan_type === 'business') return 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20';
    return 'border-border bg-card';
  };

  const getButtonStyle = () => {
    if (isCurrentPlan) return 'bg-green-600 hover:bg-green-700 text-white';
    if (plan.is_featured) return 'bg-blue-600 hover:bg-blue-700 text-white';
    if (plan.plan_type === 'business') return 'bg-purple-600 hover:bg-purple-700 text-white';
    return 'bg-primary hover:bg-primary/90 text-primary-foreground';
  };

  return (
    <Card className={`relative rounded-xl transition-all duration-200 hover:shadow-lg ${getPlanColor()}`}>
      {plan.is_featured && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium">
            <Star className="w-3 h-3 mr-1" />
            Most Popular
          </Badge>
        </div>
      )}
      
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center mb-2">
          <div className={`p-2 rounded-lg ${plan.is_featured ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' : 'bg-muted text-muted-foreground'}`}>
            {getPlanIcon()}
          </div>
        </div>
        
        <CardTitle className="text-xl font-bold">{plan.display_name}</CardTitle>
        
        <div className="mt-2">
          {plan.amount === 0 ? (
            <div className="text-3xl font-bold">Free</div>
          ) : (
            <div className="flex items-baseline justify-center">
              <span className="text-3xl font-bold">{formatCurrency(plan.amount)}</span>
              <span className="text-muted-foreground ml-1">/{plan.billing_interval}</span>
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">{plan.description}</p>
      </CardHeader>
      
      <CardContent className="pt-0">
        <ul className="space-y-3 mb-6">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-foreground">{feature}</span>
            </li>
          ))}
          
          {/* Highlight delegated access for business plans */}
          {plan.plan_type === 'business' && (
            <li className="flex items-start gap-2 text-sm">
              <Shield className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span className="text-foreground font-medium">
                Delegated Access Control - Manage team permissions and access levels
              </span>
            </li>
          )}
        </ul>
        
        <Button
          onClick={() => onSelect(plan.plan_name)}
          disabled={isLoading || isCurrentPlan}
          className={`w-full rounded-lg font-medium transition-colors ${getButtonStyle()}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : (
            <>
              {plan.amount === 0 ? 'Get Started' : 'Upgrade Now'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Main pricing modal component
 */
export function PricingModal({ isOpen, onClose, currentPlan, onPlanSelect }: PricingModalProps) {
  const { user } = useAuth();
  const [planType, setPlanType] = useState<'personal' | 'business'>('personal');
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Load billing plans
  useEffect(() => {
    if (isOpen) {
      loadBillingPlans();
    }
  }, [isOpen]);

  const loadBillingPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Failed to load billing plans:', error);
      toast.error('Failed to load pricing plans');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (planName: string) => {
    if (!user) {
      toast.error('Please log in to upgrade your plan');
      return;
    }

    // Handle free plan selection
    if (planName === 'free') {
      onPlanSelect?.(planName);
      onClose();
      return;
    }

    try {
      setCheckoutLoading(planName);
      
      // Find the selected plan
      const selectedPlan = plans.find(p => p.plan_name === planName);
      if (!selectedPlan) {
        throw new Error('Selected plan not found');
      }

      // Create checkout session
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: {
          action: 'create_session',
          mode: 'subscription',
          price_id: selectedPlan.stripe_price_id,
          success_url: `${window.location.origin}/billing?success=true&plan=${planName}`,
          cancel_url: window.location.href,
          metadata: {
            plan_name: planName,
            plan_type: selectedPlan.plan_type,
            source: 'pricing_modal',
            user_id: user.id,
          }
        }
      });

      if (error) throw error;

      if (data.success && data.checkout_url) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data.error || 'Failed to create checkout session');
      }

    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error(error.message || 'Failed to start checkout process');
    } finally {
      setCheckoutLoading(null);
    }
  };

  // Filter plans based on selected type
  const filteredPlans = plans.filter(plan => plan.plan_type === planType);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-background border-border rounded-2xl p-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="text-center py-6 px-6 border-b border-border rounded-t-2xl">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1" />
            <DialogTitle className="text-2xl font-bold text-foreground">
              Choose Your Plan
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <p className="text-muted-foreground text-sm">
            Select the perfect plan for your AI agent needs
          </p>
        </DialogHeader>
        
        {/* Plan Cards */}
        <div className="p-6">
          <Tabs value={planType} onValueChange={(value) => setPlanType(value as 'personal' | 'business')}>
            {/* Plan Type Toggle */}
            <div className="flex justify-center mb-6">
              <TabsList className="bg-muted rounded-lg p-1">
                <TabsTrigger 
                  value="personal" 
                  className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground px-6 py-2 rounded-md font-medium transition-colors"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Personal
                </TabsTrigger>
                <TabsTrigger 
                  value="business" 
                  className="text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground px-6 py-2 rounded-md font-medium transition-colors"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Business
                </TabsTrigger>
              </TabsList>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading plans...</span>
              </div>
            ) : (
              <>
                <TabsContent value="personal" className="mt-0">
                  <div className={`grid gap-6 ${plans.filter(p => p.plan_type === 'personal').length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {plans.filter(p => p.plan_type === 'personal').map((plan) => (
                      <PricingCard
                        key={plan.id}
                        plan={plan}
                        isCurrentPlan={currentPlan === plan.plan_name}
                        isLoading={checkoutLoading === plan.plan_name}
                        onSelect={handlePlanSelect}
                      />
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="business" className="mt-0">
                  <div className={`grid gap-6 ${plans.filter(p => p.plan_type === 'business').length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {plans.filter(p => p.plan_type === 'business').map((plan) => (
                      <PricingCard
                        key={plan.id}
                        plan={plan}
                        isCurrentPlan={currentPlan === plan.plan_name}
                        isLoading={checkoutLoading === plan.plan_name}
                        onSelect={handlePlanSelect}
                      />
                    ))}
                  </div>

                  {/* Business Plan Benefits */}
                  <div className="mt-8 p-6 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="w-5 h-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-foreground">Business Plan Benefits</h3>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>**Delegated Access Control** - Assign team members specific permissions and access levels</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>**Team Collaboration** - Share agents and resources across your organization</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>**Advanced Admin Controls** - Manage users, permissions, and billing centrally</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                        <span>**Enterprise Security** - Advanced security features and audit logging</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {filteredPlans.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No plans available for this category.</p>
                  </div>
                )}
              </>
            )}
          </Tabs>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 rounded-b-2xl">
          <p className="text-xs text-muted-foreground text-center">
            All plans include our core AI agent features. Cancel anytime. No hidden fees.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}