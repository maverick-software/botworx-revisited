/**
 * Billing Page
 * Main billing management page for users
 * Integrates with the billing dashboard component
 */

import React from 'react';
import { BillingDashboard } from '@/components/billing/BillingDashboard';

export function BillingPage() {
  return (
    <div className="min-h-screen bg-background">
      <BillingDashboard />
    </div>
  );
}

export default BillingPage;
