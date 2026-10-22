# Pricing Modal UI Design - ChatGPT-Inspired Design System
## Research Document for WBS Task 3.3.1 - Pricing Page Components

### **CONTEXT & PURPOSE**
Design sleek, modern pricing modals inspired by ChatGPT's upgrade interface. Create a clean, conversion-focused design that integrates seamlessly with Agentopia's existing UI system while providing clear plan comparison and upgrade paths.

### **DESIGN REFERENCES**
- **Modal 1**: `assets/chatgpt-pricing-modal-1.png` - Business vs Personal toggle with Free/Business plans
- **Modal 2**: `assets/chatgpt-pricing-modal-2.png` - Three-tier pricing (Free/Plus/Pro) with feature comparison

### **DESIGN ANALYSIS FROM REFERENCES**

#### **Modal Layout Patterns**
- **Dark Theme**: Consistent with modern SaaS applications
- **Centered Modal**: Full-screen overlay with centered content
- **Plan Toggle**: Personal/Business segmentation at top
- **Card-Based Layout**: Each plan in distinct card with clear hierarchy
- **Prominent CTAs**: Bright purple/blue buttons for primary actions
- **Feature Lists**: Clear bullet points with icons for feature comparison

#### **Visual Hierarchy**
1. **Modal Title**: "Upgrade your plan" - Clear, action-oriented
2. **Plan Toggle**: Personal/Business segmentation
3. **Plan Cards**: Price, description, features, CTA button
4. **Recommended Badge**: "POPULAR" or "RECOMMENDED" labels
5. **Current Plan**: "Your current plan" indicator

#### **Color Scheme Analysis**
- **Background**: Dark gray/black (#1a1a1a or similar)
- **Cards**: Slightly lighter gray (#2a2a2a)
- **Primary CTA**: Purple/blue gradient (#6366f1 to #8b5cf6)
- **Text**: White primary, gray secondary
- **Accents**: Green checkmarks, purple badges

### **AGENTOPIA INTEGRATION STRATEGY**

#### **Existing UI Components to Leverage**
```typescript
// From existing Agentopia components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

#### **Proposed Component Structure**
```typescript
// PricingModal.tsx - Main modal component
interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan?: string;
  onPlanSelect: (planId: string) => void;
}

// PricingCard.tsx - Individual plan card
interface PricingCardProps {
  plan: {
    id: string;
    name: string;
    displayName: string;
    price: number;
    interval: 'month' | 'year';
    description: string;
    features: string[];
    recommended?: boolean;
    current?: boolean;
  };
  onSelect: (planId: string) => void;
}

// PlanToggle.tsx - Personal/Business toggle
interface PlanToggleProps {
  value: 'personal' | 'business';
  onChange: (value: 'personal' | 'business') => void;
}
```

### **PROPOSED AGENTOPIA PLAN STRUCTURE**

#### **Personal Plans**
```typescript
const personalPlans = [
  {
    id: 'free',
    name: 'Free',
    displayName: 'Free',
    price: 0,
    interval: 'month',
    description: 'Intelligence for everyday tasks',
    features: [
      'Access to GPT-4',
      '2 AI agents',
      '1 workspace',
      'Basic integrations',
      'Community support'
    ],
    current: true // if user is on free plan
  },
  {
    id: 'pro',
    name: 'Pro',
    displayName: 'Pro',
    price: 29,
    interval: 'month',
    description: 'Advanced features for power users',
    features: [
      'Everything in Free',
      'Unlimited agents',
      '10 workspaces',
      'Advanced memory',
      'Priority integrations',
      'Email support'
    ],
    recommended: true
  }
];
```

#### **Business Plans**
```typescript
const businessPlans = [
  {
    id: 'team',
    name: 'Team',
    displayName: 'Team',
    price: 59,
    interval: 'month',
    description: 'Collaboration for small teams',
    features: [
      'Everything in Pro',
      'Team workspaces',
      'User management',
      'Advanced analytics',
      'SSO integration',
      'Priority support'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    displayName: 'Enterprise',
    price: 199,
    interval: 'month',
    description: 'Full features for organizations',
    features: [
      'Everything in Team',
      'Unlimited everything',
      'Custom integrations',
      'Dedicated support',
      'SLA guarantee',
      'Custom contracts'
    ],
    recommended: true
  }
];
```

### **MODAL IMPLEMENTATION DESIGN**

#### **Main Modal Component**
```typescript
export function PricingModal({ isOpen, onClose, currentPlan, onPlanSelect }: PricingModalProps) {
  const [planType, setPlanType] = useState<'personal' | 'business'>('personal');
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader className="text-center pb-6">
          <DialogTitle className="text-2xl font-semibold text-white">
            Upgrade your plan
          </DialogTitle>
          
          {/* Plan Type Toggle */}
          <div className="flex justify-center mt-4">
            <Tabs value={planType} onValueChange={setPlanType} className="w-auto">
              <TabsList className="bg-gray-800 border-gray-700">
                <TabsTrigger value="personal" className="text-gray-300">Personal</TabsTrigger>
                <TabsTrigger value="business" className="text-gray-300">Business</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </DialogHeader>
        
        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {(planType === 'personal' ? personalPlans : businessPlans).map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              onSelect={onPlanSelect}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

#### **Pricing Card Component**
```typescript
export function PricingCard({ plan, onSelect }: PricingCardProps) {
  return (
    <Card className={`relative bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors ${
      plan.recommended ? 'ring-2 ring-purple-500' : ''
    }`}>
      {plan.recommended && (
        <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white">
          RECOMMENDED
        </Badge>
      )}
      
      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl text-white">{plan.displayName}</CardTitle>
        <div className="mt-2">
          <span className="text-3xl font-bold text-white">${plan.price}</span>
          <span className="text-gray-400 ml-1">USD / {plan.interval}</span>
        </div>
        <p className="text-gray-300 text-sm mt-2">{plan.description}</p>
      </CardHeader>
      
      <CardContent className="pt-0">
        {plan.current ? (
          <Button disabled className="w-full mb-4 bg-gray-700 text-gray-400">
            Your current plan
          </Button>
        ) : (
          <Button 
            onClick={() => onSelect(plan.id)}
            className="w-full mb-4 bg-purple-600 hover:bg-purple-700 text-white"
          >
            Get {plan.displayName}
          </Button>
        )}
        
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-center text-sm text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
```

### **RESPONSIVE DESIGN CONSIDERATIONS**

#### **Mobile Optimization**
- **Single Column**: Stack cards vertically on mobile
- **Reduced Padding**: Optimize spacing for smaller screens
- **Touch Targets**: Ensure buttons are at least 44px tall
- **Scrollable**: Allow vertical scrolling for feature lists

#### **Tablet Optimization**
- **Two Columns**: Show 2 cards per row on tablets
- **Balanced Layout**: Maintain visual hierarchy
- **Touch-Friendly**: Optimize for touch interactions

### **ACCESSIBILITY FEATURES**
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Proper ARIA labels and descriptions
- **High Contrast**: Ensure sufficient color contrast
- **Focus Indicators**: Clear focus states for all interactive elements

### **ANIMATION AND INTERACTIONS**
```typescript
// Smooth modal entrance
const modalVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 }
};

// Card hover effects
const cardVariants = {
  hover: { 
    scale: 1.02,
    borderColor: '#6366f1',
    transition: { duration: 0.2 }
  }
};
```

### **INTEGRATION WITH STRIPE CHECKOUT**
```typescript
const handlePlanSelect = async (planId: string) => {
  try {
    // Get plan details
    const plan = allPlans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');
    
    // Create checkout session
    const { data } = await supabase.functions.invoke('stripe-checkout', {
      body: {
        action: 'create_session',
        mode: 'subscription',
        price_id: plan.stripePriceId,
        success_url: `${window.location.origin}/billing/success`,
        cancel_url: window.location.href,
        metadata: {
          plan_id: planId,
          source: 'pricing_modal'
        }
      }
    });
    
    if (data.success) {
      window.location.href = data.checkout_url;
    }
  } catch (error) {
    toast.error('Failed to start checkout process');
  }
};
```

### **TESTING REQUIREMENTS**
- **Visual Testing**: Compare with reference images
- **Responsive Testing**: Test on various screen sizes
- **Accessibility Testing**: Screen reader and keyboard navigation
- **Integration Testing**: Test with Stripe checkout flow
- **Performance Testing**: Modal load and animation performance

### **IMPLEMENTATION NOTES**
- **File Size**: Keep PricingModal.tsx under 300 lines
- **Component Separation**: Split into PricingCard, PlanToggle components
- **Theme Integration**: Use Agentopia's existing dark theme variables
- **Error Handling**: Handle checkout failures gracefully
- **Loading States**: Show loading during checkout creation

### **BACKUP INSTRUCTIONS**
Before implementing:
1. **Component Backup**: No existing pricing modal to backup
2. **UI Dependencies**: Ensure all Shadcn components are available
3. **Theme Variables**: Verify dark theme CSS variables exist
4. **Store**: `docs/plans/stripe_integration/backups/pre_pricing_modal/`

### **DEPENDENCIES**
- **Shadcn UI Components**: Card, Button, Badge, Dialog, Tabs
- **Icons**: Lucide React icons (CheckCircle, etc.)
- **Stripe Integration**: stripe-checkout Edge Function
- **Authentication**: User context for current plan detection
- **Toast Notifications**: React Hot Toast for error handling
