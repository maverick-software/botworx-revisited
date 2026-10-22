/**
 * Admin Stripe Configuration Page
 * Wrapper page for the Stripe Configuration Panel component
 * Accessible at /admin/billing/stripe-config
 */

import React from 'react';
import { StripeConfigurationPanel } from '@/components/admin/billing/StripeConfigurationPanel';

export default function AdminStripeConfigPage() {
  return (
    <div className="space-y-6">
      <StripeConfigurationPanel />
    </div>
  );
}
