/**
 * Admin User Billing Management Page
 * Wrapper page for the User Billing Management component
 * Accessible at /admin/billing/users
 */

import React from 'react';
import { UserBillingManagement } from '@/components/admin/billing/UserBillingManagement';

export default function AdminUserBillingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">User Billing Management</h1>
          <p className="text-muted-foreground">
            View and manage billing information for all users, including subscription status, payment history, and account actions.
          </p>
        </div>
        
        <UserBillingManagement />
      </div>
    </div>
  );
}
