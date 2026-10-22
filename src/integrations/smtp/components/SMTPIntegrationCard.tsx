/**
 * SMTP Integration Card Component
 * Displays SMTP configurations and provides management interface
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mail, 
  Plus, 
  Settings, 
  TestTube, 
  Trash2, 
  Power, 
  PowerOff,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { SMTPConfiguration, SMTPConfigurationCreate } from '../types/smtp';
import { useSMTPConfigurations } from '../hooks/useSMTPConfigurations';
import { SMTPSetupModal } from './SMTPSetupModal';
import { toast } from 'react-hot-toast';

interface SMTPIntegrationCardProps {
  className?: string;
}

export const SMTPIntegrationCard: React.FC<SMTPIntegrationCardProps> = ({ className }) => {
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SMTPConfiguration | undefined>();
  const [testingConfigId, setTestingConfigId] = useState<string | null>(null);
  
  const {
    configurations,
    loading,
    error,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    testConfiguration,
    toggleActive,
    refresh
  } = useSMTPConfigurations();



  // Refresh configurations on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreateConfiguration = async (config: SMTPConfigurationCreate) => {
    try {
      await createConfiguration(config);
      setIsSetupModalOpen(false);
      toast.success(`Successfully created SMTP configuration "${config.connection_name}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create SMTP configuration");
    }
  };

  const handleEditConfiguration = (config: SMTPConfiguration) => {
    setEditingConfig(config);
    setIsSetupModalOpen(true);
  };

  const handleUpdateConfiguration = async (config: SMTPConfigurationCreate) => {
    if (!editingConfig) return;

    try {
      await updateConfiguration(editingConfig.id, config);
      setIsSetupModalOpen(false);
      setEditingConfig(undefined);
      toast.success(`Successfully updated SMTP configuration "${config.connection_name}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update SMTP configuration");
    }
  };

  const handleDeleteConfiguration = async (configId: string, configName: string) => {
    if (!confirm(`Are you sure you want to delete the SMTP configuration "${configName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteConfiguration(configId);
      toast.success(`Successfully deleted SMTP configuration "${configName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete SMTP configuration");
    }
  };

  const handleTestConnection = async (configId: string, configName: string) => {
    setTestingConfigId(configId);
    
    try {
      const result = await testConfiguration(configId);
      
      if (result.success) {
        toast.success(`SMTP connection to "${configName}" is working properly. Connection time: ${result.connectionTime}ms`);
      } else {
        toast.error(`Failed to connect to "${configName}": ${result.error}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to test SMTP connection");
    } finally {
      setTestingConfigId(null);
    }
  };

  const handleToggleActive = async (configId: string, configName: string, currentActive: boolean) => {
    try {
      await toggleActive(configId, !currentActive);
      toast.success(`Successfully ${!currentActive ? 'activated' : 'deactivated'} "${configName}"`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update SMTP configuration");
    }
  };

  const getStatusIcon = (config: SMTPConfiguration) => {
    if (!config.is_active) {
      return <PowerOff className="h-4 w-4 text-gray-400" />;
    }
    
    switch (config.test_status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (config: SMTPConfiguration) => {
    if (!config.is_active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    switch (config.test_status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Connected</Badge>;
      case 'failed':
        return <Badge variant="destructive">Connection Failed</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline">Not Tested</Badge>;
    }
  };

  const formatLastTested = (lastTested?: string) => {
    if (!lastTested) return 'Never tested';
    
    const date = new Date(lastTested);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'Recently';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Email Integration
          </CardTitle>
          <CardDescription>
            Configure SMTP servers for autonomous email sending
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            SMTP Email Integration
          </CardTitle>
          <CardDescription>
            Configure SMTP servers for autonomous email sending. Agents can send emails through configured SMTP servers with proper permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {configurations.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No SMTP Configurations</h3>
              <p className="text-muted-foreground mb-4">
                Set up your first SMTP server to enable email sending for your agents.
              </p>
              <Button onClick={() => setIsSetupModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add SMTP Configuration
              </Button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {configurations.length} configuration{configurations.length !== 1 ? 's' : ''} configured
                </div>
                <Button onClick={() => setIsSetupModalOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Configuration
                </Button>
              </div>

              <div className="space-y-3">
                {configurations.map((config) => (
                  <div
                    key={config.id}
                    className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(config)}
                          <h4 className="font-medium">{config.connection_name}</h4>
                          {getStatusBadge(config)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-4">
                            <span>📧 {config.from_email}</span>
                            <span>🌐 {config.host}:{config.port}</span>
                            <span>🔒 {config.secure ? 'SSL' : 'TLS'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span>📊 {config.max_emails_per_day}/day limit</span>
                            <span>👥 {config.max_recipients_per_email} recipients max</span>
                            <span>🕒 Last tested: {formatLastTested(config.last_tested_at)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(config.id, config.connection_name)}
                          disabled={testingConfigId === config.id}
                        >
                          {testingConfigId === config.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <TestTube className="h-4 w-4" />
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(config.id, config.connection_name, config.is_active)}
                        >
                          {config.is_active ? (
                            <Power className="h-4 w-4 text-green-600" />
                          ) : (
                            <PowerOff className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditConfiguration(config)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteConfiguration(config.id, config.connection_name)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {config.test_status === 'failed' && config.test_error_message && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Connection Error:</strong> {config.test_error_message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-medium text-sm">Security & Permissions</h4>
                <p className="text-xs text-muted-foreground">
                  SMTP passwords are encrypted using Supabase Vault. Configure agent permissions 
                  in the Agent Management section to control which agents can use each SMTP configuration.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <SMTPSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => {
          setIsSetupModalOpen(false);
          setEditingConfig(undefined);
        }}
        onSave={editingConfig ? handleUpdateConfiguration : handleCreateConfiguration}
        editingConfig={editingConfig}
      />
    </>
  );
};

export default SMTPIntegrationCard;
