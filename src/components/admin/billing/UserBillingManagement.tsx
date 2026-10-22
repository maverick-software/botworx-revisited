/**
 * User Billing Management - Admin Interface
 * Comprehensive user billing overview with subscription status,
 * payment history, and account management capabilities
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  Search, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  CreditCard,
  RefreshCw,
  Mail,
  Calendar,
  TrendingUp,
  TrendingDown,
  Filter
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

interface UserBilling {
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
  subscription?: {
    id: string;
    plan_name: string;
    status: string;
    billing_amount: number;
    billing_interval: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
  };
  customer?: {
    stripe_customer_id: string;
    customer_email: string;
  };
  total_paid: number;
  invoice_count: number;
  last_payment: string | null;
  payment_status: 'current' | 'past_due' | 'canceled' | 'none';
}

interface BillingStats {
  total_users: number;
  active_subscriptions: number;
  past_due_count: number;
  monthly_revenue: number;
  churn_rate: number;
}

export function UserBillingManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserBilling[]>([]);
  const [stats, setStats] = useState<BillingStats>({
    total_users: 0,
    active_subscriptions: 0,
    past_due_count: 0,
    monthly_revenue: 0,
    churn_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserBilling | null>(null);

  useEffect(() => {
    loadUserBillingData();
    loadBillingStats();
  }, []);

  const loadUserBillingData = async () => {
    try {
      setLoading(true);
      
      // Get comprehensive user billing data
      const { data, error } = await supabase.rpc('get_user_billing_overview');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Failed to load user billing data:', error);
      toast.error('Failed to load user billing data');
    } finally {
      setLoading(false);
    }
  };

  const loadBillingStats = async () => {
    try {
      // Get billing statistics
      const { data, error } = await supabase.rpc('get_billing_statistics');
      
      if (error) throw error;
      setStats(data || stats);
    } catch (error) {
      console.error('Failed to load billing stats:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || user.payment_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      current: { color: 'bg-green-500/20 text-green-600 border-green-500/30', icon: CheckCircle },
      past_due: { color: 'bg-red-500/20 text-red-600 border-red-500/30', icon: AlertTriangle },
      canceled: { color: 'bg-gray-500/20 text-gray-600 border-gray-500/30', icon: Clock },
      none: { color: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: Users },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.none;
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status === 'none' ? 'Free' : status.replace('_', ' ')}
      </Badge>
    );
  };

  const handleUserAction = async (userId: string, action: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-billing-actions', {
        body: {
          action,
          user_id: userId,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Action ${action} completed successfully`);
        loadUserBillingData(); // Refresh data
      } else {
        throw new Error(data.error || 'Action failed');
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      toast.error(`Failed to ${action}: ${error.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
                <p className="text-2xl font-bold">{stats.total_users}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Subscriptions</p>
                <p className="text-2xl font-bold">{stats.active_subscriptions}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Past Due</p>
                <p className="text-2xl font-bold text-red-600">{stats.past_due_count}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.monthly_revenue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              User Billing Management
            </div>
            <Button onClick={loadUserBillingData} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search users by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-background"
              >
                <option value="all">All Status</option>
                <option value="current">Current</option>
                <option value="past_due">Past Due</option>
                <option value="canceled">Canceled</option>
                <option value="none">Free Users</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading user billing data...
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div key={user.user_id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="font-medium">{user.full_name || 'No Name'}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-500">
                          Joined {formatDate(user.created_at)}
                        </p>
                      </div>
                      {getStatusBadge(user.payment_status)}
                    </div>

                    <div className="flex items-center gap-6">
                      {user.subscription && (
                        <div className="text-right">
                          <p className="font-medium">{user.subscription.plan_name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatCurrency(user.subscription.billing_amount)} / {user.subscription.billing_interval}
                          </p>
                          <p className="text-xs text-gray-500">
                            Next: {formatDate(user.subscription.current_period_end)}
                          </p>
                        </div>
                      )}

                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(user.total_paid)}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {user.invoice_count} invoices
                        </p>
                        {user.last_payment && (
                          <p className="text-xs text-gray-500">
                            Last: {formatDate(user.last_payment)}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedUser(user)}
                        >
                          View Details
                        </Button>
                        
                        {user.payment_status === 'past_due' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUserAction(user.user_id, 'send_payment_reminder')}
                          >
                            <Mail className="w-4 h-4 mr-1" />
                            Remind
                          </Button>
                        )}
                        
                        {user.subscription && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUserAction(user.user_id, 'cancel_subscription')}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    No users found matching your criteria.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Detail Modal would go here */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>User Details: {selectedUser.email}</span>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Detailed user information would go here */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Account Information</h4>
                  <p>Email: {selectedUser.email}</p>
                  <p>Name: {selectedUser.full_name || 'Not provided'}</p>
                  <p>Joined: {formatDate(selectedUser.created_at)}</p>
                </div>
                
                {selectedUser.subscription && (
                  <div>
                    <h4 className="font-medium">Subscription Details</h4>
                    <p>Plan: {selectedUser.subscription.plan_name}</p>
                    <p>Status: {selectedUser.subscription.status}</p>
                    <p>Amount: {formatCurrency(selectedUser.subscription.billing_amount)}</p>
                    <p>Next Billing: {formatDate(selectedUser.subscription.current_period_end)}</p>
                  </div>
                )}
                
                <div>
                  <h4 className="font-medium">Payment Summary</h4>
                  <p>Total Paid: {formatCurrency(selectedUser.total_paid)}</p>
                  <p>Invoice Count: {selectedUser.invoice_count}</p>
                  {selectedUser.last_payment && (
                    <p>Last Payment: {formatDate(selectedUser.last_payment)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
