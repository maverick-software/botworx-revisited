/**
 * SMTP Integrations Page
 * Dedicated page for managing SMTP configurations
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { SMTPIntegrationCard } from '../components/SMTPIntegrationCard';

export const SMTPIntegrationsPage: React.FC = () => {
  return (
    <div className="flex-1 space-y-6 p-4 pt-6">
      {/* Header with Back Button */}
      <div className="flex items-center space-x-4">
        <Link to="/integrations">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Integrations
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">SMTP Email Integration</h2>
          <p className="text-muted-foreground">
            Configure SMTP servers for autonomous email sending by your agents
          </p>
        </div>
      </div>

      {/* SMTP Integration Card */}
      <SMTPIntegrationCard />
    </div>
  );
};

export default SMTPIntegrationsPage;
