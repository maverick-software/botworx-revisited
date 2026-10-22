# Codebase Analysis for Stripe Integration

## Current Architecture Overview

### **Database Schema**
- **Organizations Table**: Has `subscription_tier` with values: 'free', 'pro', 'enterprise'
- **Organizations Table**: Has `billing_email` field for billing contacts
- **Roles System**: Existing role-based access control with `roles` and user profile integration
- **No Existing Payment Tables**: No Stripe-specific tables found in current schema

### **Authentication System**
- **Supabase Auth**: Standard auth.users table with user profiles
- **Role-Based Access**: Existing roles system with admin/user roles
- **User Context**: AuthContext provides user state management
- **Protected Routes**: Existing route protection patterns

### **Edge Functions Architecture**
- **Standard Pattern**: All functions use serve() with CORS handling
- **Database Integration**: Functions use createClient with service role key
- **Error Handling**: Consistent error response patterns
- **Action-Based Routing**: Functions use action parameter for multiple operations

### **Frontend Component Patterns**
- **UI Components**: Shadcn UI with Card, Button, Badge, Dialog components
- **Page Structure**: Pages use hooks for data fetching and state management
- **Modal System**: Extensive modal-based UI for settings and configurations
- **Toast Notifications**: React Hot Toast for user feedback

### **Integration Patterns**
- **Unified Connections**: useConnections hook for managing integrations
- **MCP Architecture**: Model Context Protocol for tool integration
- **Secure Storage**: Supabase Vault for credential encryption
- **Permission System**: agent_integration_permissions for access control

### **Existing Payment-Related Elements**
- **Organizations**: subscription_tier field suggests multi-tenant structure
- **Billing Email**: Organizations have billing_email field
- **No Stripe Integration**: No existing Stripe functions or components found

## Implementation Strategy

### **Database Requirements**
1. Create Stripe-specific tables (customers, subscriptions, invoices, payments)
2. Integrate with existing organizations.subscription_tier
3. Maintain existing role system for plan-based access control

### **Edge Functions Required**
1. `stripe-checkout` - Create checkout sessions
2. `stripe-webhook` - Handle Stripe webhooks
3. `stripe-customer-portal` - Manage customer portal access
4. `stripe-admin` - Admin management functions

### **Frontend Components Required**
1. PricingPage - Display subscription plans
2. CheckoutFlow - Handle subscription selection
3. BillingDashboard - User billing management
4. AdminBilling - Admin billing interface

### **Integration Points**
1. Organizations table subscription_tier updates
2. Role-based feature access control
3. Existing modal and page patterns
4. Current authentication system
