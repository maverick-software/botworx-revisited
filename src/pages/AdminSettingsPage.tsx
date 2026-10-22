import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Key, Settings as SettingsIcon, CreditCard } from 'lucide-react';

// Import the existing admin pages
import { AdminSystemAPIKeysPage } from './admin/AdminSystemAPIKeysPage';
import { AdminIntegrationManagement } from './AdminIntegrationManagement';
import AdminStripeConfigPage from './admin/AdminStripeConfigPage';

export function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('api-keys');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage system-wide API keys, OAuth integrations, and payment processing
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-muted border border-border">
            <TabsTrigger value="api-keys" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <Key className="w-4 h-4" />
              <span>API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <SettingsIcon className="w-4 h-4" />
              <span>Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="stripe" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <CreditCard className="w-4 h-4" />
              <span>Stripe</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-keys" className="mt-0">
            <AdminSystemAPIKeysPage />
          </TabsContent>

          <TabsContent value="integrations" className="mt-0">
            <AdminIntegrationManagement />
          </TabsContent>

          <TabsContent value="stripe" className="mt-0">
            <AdminStripeConfigPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

