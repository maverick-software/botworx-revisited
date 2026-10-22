/**
 * Agent SMTP Permissions Modal
 * Manages SMTP permissions for individual agents
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  Shield, 
  Plus, 
  Trash2, 
  Settings, 
  Clock,
  Users,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';
import { 
  SMTPConfiguration,
  AgentSMTPPermission,
  AgentSMTPPermissionCreate,
  AgentSMTPPermissionUpdate
} from '@/integrations/smtp';
import { Agent } from '@/types/database';
import { useSMTPConfigurations } from '@/integrations/smtp';
import { toast } from 'react-hot-toast';

interface AgentSMTPPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent;
}

export const AgentSMTPPermissionsModal: React.FC<AgentSMTPPermissionsModalProps> = ({
  isOpen,
  onClose,
  agent
}) => {
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [newPermission, setNewPermission] = useState<Partial<AgentSMTPPermissionCreate>>({
    can_send_email: true,
    can_send_attachments: false,
    can_use_custom_from: false,
    daily_email_limit: undefined,
    recipients_per_email_limit: undefined,
    allowed_recipients: [],
    blocked_recipients: [],
    expires_at: undefined
  });
  const [editingPermission, setEditingPermission] = useState<AgentSMTPPermission | null>(null);
  const [allowedRecipientsText, setAllowedRecipientsText] = useState('');
  const [blockedRecipientsText, setBlockedRecipientsText] = useState('');
  const [expiresAtDate, setExpiresAtDate] = useState('');
  const [loading, setLoading] = useState(false);

  const { configurations } = useSMTPConfigurations();
  const {
    permissions,
    loading: permissionsLoading,
    error,
    addPermission,
    updatePermission,
    removePermission,
    refresh
  } = useSMTPPermissions(agent.id);



  // Refresh permissions when modal opens
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedConfigId('');
      setEditingPermission(null);
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setNewPermission({
      can_send_email: true,
      can_send_attachments: false,
      can_use_custom_from: false,
      daily_email_limit: undefined,
      recipients_per_email_limit: undefined,
      allowed_recipients: [],
      blocked_recipients: [],
      expires_at: undefined
    });
    setAllowedRecipientsText('');
    setBlockedRecipientsText('');
    setExpiresAtDate('');
  };

  const parseEmailList = (text: string): string[] => {
    if (!text.trim()) return [];
    return text.split(',').map(email => email.trim()).filter(email => email.length > 0);
  };

  const handleAddPermission = async () => {
    if (!selectedConfigId) {
      toast.error("Please select an SMTP configuration");
      return;
    }

    setLoading(true);
    try {
      const permissionData: AgentSMTPPermissionCreate = {
        agent_id: agent.id,
        smtp_config_id: selectedConfigId,
        can_send_email: newPermission.can_send_email ?? true,
        can_send_attachments: newPermission.can_send_attachments ?? false,
        can_use_custom_from: newPermission.can_use_custom_from ?? false,
        daily_email_limit: newPermission.daily_email_limit || undefined,
        recipients_per_email_limit: newPermission.recipients_per_email_limit || undefined,
        allowed_recipients: parseEmailList(allowedRecipientsText),
        blocked_recipients: parseEmailList(blockedRecipientsText),
        expires_at: expiresAtDate || undefined
      };

      await addPermission(permissionData);
      
      toast.success("SMTP permission has been granted to the agent");

      resetForm();
      setSelectedConfigId('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add SMTP permission");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePermission = async (permission: AgentSMTPPermission) => {
    setLoading(true);
    try {
      const updates: AgentSMTPPermissionUpdate = {
        can_send_email: permission.can_send_email,
        can_send_attachments: permission.can_send_attachments,
        can_use_custom_from: permission.can_use_custom_from,
        daily_email_limit: permission.daily_email_limit || undefined,
        recipients_per_email_limit: permission.recipients_per_email_limit || undefined,
        allowed_recipients: permission.allowed_recipients,
        blocked_recipients: permission.blocked_recipients,
        expires_at: permission.expires_at || undefined,
        is_active: permission.is_active
      };

      await updatePermission(permission.id, updates);
      
      toast.success("SMTP permission has been updated");

      setEditingPermission(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update SMTP permission");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePermission = async (permissionId: string, configName: string) => {
    if (!confirm(`Are you sure you want to remove SMTP access to "${configName}" for this agent?`)) {
      return;
    }

    setLoading(true);
    try {
      await removePermission(permissionId);
      
      toast.success(`SMTP access to "${configName}" has been revoked`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove SMTP permission");
    } finally {
      setLoading(false);
    }
  };

  const getConfigurationName = (configId: string): string => {
    const config = configurations.find(c => c.id === configId);
    return config ? `${config.connection_name} (${config.from_email})` : 'Unknown Configuration';
  };

  const availableConfigurations = configurations.filter(config => 
    config.is_active && !permissions.some(p => p.smtp_config_id === config.id && p.is_active)
  );

  const formatExpiresAt = (expiresAt?: string) => {
    if (!expiresAt) return 'Never';
    
    const date = new Date(expiresAt);
    const now = new Date();
    
    if (date < now) {
      return 'Expired';
    }
    
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SMTP Permissions for {agent.name}
          </DialogTitle>
          <DialogDescription>
            Manage which SMTP configurations this agent can use and what permissions it has.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Add New Permission */}
          {availableConfigurations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Grant SMTP Access
                </CardTitle>
                <CardDescription>
                  Give this agent access to an SMTP configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>SMTP Configuration</Label>
                  <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an SMTP configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConfigurations.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          {config.connection_name} ({config.from_email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can_send_email"
                      checked={newPermission.can_send_email ?? true}
                      onCheckedChange={(checked) => 
                        setNewPermission(prev => ({ ...prev, can_send_email: checked }))
                      }
                    />
                    <Label htmlFor="can_send_email" className="text-sm">
                      Can Send Emails
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can_send_attachments"
                      checked={newPermission.can_send_attachments ?? false}
                      onCheckedChange={(checked) => 
                        setNewPermission(prev => ({ ...prev, can_send_attachments: checked }))
                      }
                    />
                    <Label htmlFor="can_send_attachments" className="text-sm">
                      Can Send Attachments
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can_use_custom_from"
                      checked={newPermission.can_use_custom_from ?? false}
                      onCheckedChange={(checked) => 
                        setNewPermission(prev => ({ ...prev, can_use_custom_from: checked }))
                      }
                    />
                    <Label htmlFor="can_use_custom_from" className="text-sm">
                      Can Use Custom From
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="daily_limit">Daily Email Limit (Optional)</Label>
                    <Input
                      id="daily_limit"
                      type="number"
                      placeholder="Leave empty for config default"
                      value={newPermission.daily_email_limit || ''}
                      onChange={(e) => 
                        setNewPermission(prev => ({ 
                          ...prev, 
                          daily_email_limit: e.target.value ? parseInt(e.target.value) : undefined 
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recipients_limit">Recipients Per Email Limit (Optional)</Label>
                    <Input
                      id="recipients_limit"
                      type="number"
                      placeholder="Leave empty for config default"
                      value={newPermission.recipients_per_email_limit || ''}
                      onChange={(e) => 
                        setNewPermission(prev => ({ 
                          ...prev, 
                          recipients_per_email_limit: e.target.value ? parseInt(e.target.value) : undefined 
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="allowed_recipients">Allowed Recipients (Optional)</Label>
                    <Input
                      id="allowed_recipients"
                      placeholder="user@domain.com, *@company.com"
                      value={allowedRecipientsText}
                      onChange={(e) => setAllowedRecipientsText(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of allowed email patterns
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="blocked_recipients">Blocked Recipients (Optional)</Label>
                    <Input
                      id="blocked_recipients"
                      placeholder="spam@domain.com, *@blocked.com"
                      value={blockedRecipientsText}
                      onChange={(e) => setBlockedRecipientsText(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of blocked email patterns
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expires_at">Expires At (Optional)</Label>
                  <Input
                    id="expires_at"
                    type="date"
                    value={expiresAtDate}
                    onChange={(e) => setExpiresAtDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty for permanent access
                  </p>
                </div>

                <Button 
                  onClick={handleAddPermission} 
                  disabled={loading || !selectedConfigId}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Adding Permission...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Grant SMTP Access
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Existing Permissions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Current SMTP Permissions</h3>
              <Badge variant="outline">
                {permissions.length} configuration{permissions.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {permissionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : permissions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-semibold mb-2">No SMTP Permissions</h4>
                  <p className="text-muted-foreground">
                    This agent doesn't have access to any SMTP configurations yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {permissions.map((permission) => (
                  <Card key={permission.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold flex items-center gap-2">
                            {permission.is_active ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            {getConfigurationName(permission.smtp_config_id)}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Granted on {new Date(permission.granted_at).toLocaleDateString()}
                            {permission.expires_at && (
                              <> • Expires: {formatExpiresAt(permission.expires_at)}</>
                            )}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPermission(permission)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemovePermission(
                              permission.id, 
                              getConfigurationName(permission.smtp_config_id)
                            )}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={permission.can_send_email ? "default" : "secondary"}>
                            {permission.can_send_email ? "✓" : "✗"} Send Emails
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={permission.can_send_attachments ? "default" : "secondary"}>
                            {permission.can_send_attachments ? "✓" : "✗"} Attachments
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={permission.can_use_custom_from ? "default" : "secondary"}>
                            {permission.can_use_custom_from ? "✓" : "✗"} Custom From
                          </Badge>
                        </div>
                      </div>

                      {(permission.daily_email_limit || permission.recipients_per_email_limit) && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                            {permission.daily_email_limit && (
                              <div>Daily Limit: {permission.daily_email_limit} emails</div>
                            )}
                            {permission.recipients_per_email_limit && (
                              <div>Recipients Limit: {permission.recipients_per_email_limit} per email</div>
                            )}
                          </div>
                        </div>
                      )}

                      {(permission.allowed_recipients.length > 0 || permission.blocked_recipients.length > 0) && (
                        <div className="mt-3 pt-3 border-t">
                          {permission.allowed_recipients.length > 0 && (
                            <div className="text-sm">
                              <span className="font-medium text-green-600">Allowed:</span>{' '}
                              {permission.allowed_recipients.join(', ')}
                            </div>
                          )}
                          {permission.blocked_recipients.length > 0 && (
                            <div className="text-sm">
                              <span className="font-medium text-red-600">Blocked:</span>{' '}
                              {permission.blocked_recipients.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {availableConfigurations.length === 0 && permissions.length === 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No SMTP configurations are available. Create SMTP configurations in the Integrations 
                section before granting permissions to agents.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AgentSMTPPermissionsModal;
