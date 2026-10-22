import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Check, 
  Wrench,
  Mail,
  MessageSquare,
  BarChart3,
  FileText,
  Calendar,
  Search,
  Code,
  Image,
  Database,
  Globe,
  Brain,
  Zap,
  Settings,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIntegrationsByClassification } from '@/integrations/_shared';
import { toast } from 'react-hot-toast';

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

// Task-focused capability categories with friendly descriptions
const CAPABILITY_CATEGORIES = {
  communication: {
    name: 'Communication & Outreach',
    description: 'Send messages, emails, and interact with people',
    icon: Mail,
    gradient: 'from-blue-500 to-cyan-500',
    capabilities: [
      { id: 'gmail', name: 'Send emails and manage inbox', icon: Mail, popular: true },
      { id: 'slack', name: 'Send messages and notifications', icon: MessageSquare, popular: true },
      { id: 'discord', name: 'Chat and community management', icon: MessageSquare, popular: false },
      { id: 'sms', name: 'Send text messages', icon: MessageSquare, popular: false }
    ]
  },
  analysis: {
    name: 'Data & Analysis',
    description: 'Analyze information, create reports, and insights',
    icon: BarChart3,
    gradient: 'from-purple-500 to-indigo-500',
    capabilities: [
      { id: 'web_search', name: 'Search the web for information', icon: Search, popular: true },
      { id: 'data_analysis', name: 'Analyze spreadsheets and data', icon: BarChart3, popular: true },
      { id: 'database_query', name: 'Query databases and systems', icon: Database, popular: false },
      { id: 'report_generation', name: 'Generate reports and summaries', icon: FileText, popular: false }
    ]
  },
  productivity: {
    name: 'Productivity & Organization',
    description: 'Manage tasks, schedules, and workflows',
    icon: Calendar,
    gradient: 'from-green-500 to-emerald-500',
    capabilities: [
      { id: 'calendar', name: 'Schedule meetings and events', icon: Calendar, popular: true },
      { id: 'task_management', name: 'Create and track tasks', icon: Check, popular: true },
      { id: 'file_management', name: 'Organize and manage files', icon: FileText, popular: false },
      { id: 'workflow_automation', name: 'Automate repetitive tasks', icon: Zap, popular: false }
    ]
  },
  development: {
    name: 'Development & Technical',
    description: 'Code assistance, API integrations, and technical tasks',
    icon: Code,
    gradient: 'from-orange-500 to-red-500',
    capabilities: [
      { id: 'code_review', name: 'Review and suggest code improvements', icon: Code, popular: false },
      { id: 'api_integration', name: 'Connect to APIs and services', icon: Globe, popular: false },
      { id: 'system_monitoring', name: 'Monitor systems and services', icon: Settings, popular: false },
      { id: 'documentation', name: 'Generate technical documentation', icon: FileText, popular: false }
    ]
  },
  creative: {
    name: 'Creative & Content',
    description: 'Generate content, images, and creative materials',
    icon: Image,
    gradient: 'from-pink-500 to-rose-500',
    capabilities: [
      { id: 'content_writing', name: 'Write articles, blogs, and copy', icon: FileText, popular: true },
      { id: 'image_generation', name: 'Create and edit images', icon: Image, popular: true },
      { id: 'social_media', name: 'Create social media content', icon: MessageSquare, popular: false },
      { id: 'video_editing', name: 'Edit and create videos', icon: Image, popular: false }
    ]
  }
};

const PERMISSION_LEVELS = [
  {
    id: 'ask_permission',
    name: 'Ask permission before taking actions',
    description: 'I will always ask before using tools or making changes',
    icon: AlertCircle,
    color: 'text-blue-600',
    recommended: true
  },
  {
    id: 'auto_approve_safe',
    name: 'Automatically approve safe actions',
    description: 'I can perform read-only and low-risk actions automatically',
    icon: Check,
    color: 'text-green-600',
    recommended: false
  },
  {
    id: 'full_automation',
    name: 'Full automation (advanced)',
    description: 'I can take all actions automatically without asking',
    icon: Zap,
    color: 'text-orange-600',
    recommended: false
  }
];

export function ToolsModal({
  isOpen,
  onClose,
  agentId,
  agentData,
  onAgentUpdated
}: ToolsModalProps) {
  const { user } = useAuth();
  const { integrations, loading: loadingIntegrations } = useIntegrationsByClassification('tool');
  
  // State
  const [enabledCapabilities, setEnabledCapabilities] = useState<string[]>([]);
  const [permissionLevel, setPermissionLevel] = useState('ask_permission');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize from agent data (this would need to be implemented based on your data structure)
  useEffect(() => {
    if (isOpen && agentData) {
      // This would load the agent's current tool configurations
      // For now, we'll start with some common defaults
      setEnabledCapabilities(['gmail', 'web_search', 'content_writing']);
      setPermissionLevel('ask_permission');
      setSaved(false);
    }
  }, [isOpen, agentData]);

  // Clear saved state after 3 seconds
  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const handleToggleCapability = (capabilityId: string) => {
    setEnabledCapabilities(prev => 
      prev.includes(capabilityId) 
        ? prev.filter(id => id !== capabilityId)
        : [...prev, capabilityId]
    );
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    setLoading(true);
    try {
      // Here you would save the enabled capabilities to the database
      // This might involve updating agent_integrations or a similar table
      
      // For now, we'll just simulate the save
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success('Capabilities updated! 🛠️');
      setSaved(true);
      
      // Notify parent component
      if (onAgentUpdated) {
        onAgentUpdated({ capabilities: enabledCapabilities, permission_level: permissionLevel });
      }
      
    } catch (error: any) {
      console.error('Error updating capabilities:', error);
      toast.error('Failed to update capabilities');
    } finally {
      setLoading(false);
    }
  }, [agentId, enabledCapabilities, permissionLevel, user, onAgentUpdated]);

  const getEnabledCount = () => enabledCapabilities.length;
  const getTotalCapabilities = () => {
    return Object.values(CAPABILITY_CATEGORIES).reduce((total, category) => 
      total + category.capabilities.length, 0
    );
  };

  const hasChanges = () => {
    // This would compare with the original loaded state
    return true; // For now, always allow saving
  };

  const getSelectedPermission = () => {
    return PERMISSION_LEVELS.find(level => level.id === permissionLevel);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold flex items-center">
            ⚡ Tools
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose what tasks I can help you with and set permission preferences.
          </DialogDescription>
        </DialogHeader>
        
        <div className="px-6 space-y-6">
          {/* Capabilities by Category */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">What tasks can I help you with?</h3>
              <Badge variant="outline" className="text-xs">
                {getEnabledCount()} of {getTotalCapabilities()} enabled
              </Badge>
            </div>

            {loadingIntegrations ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading capabilities...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(CAPABILITY_CATEGORIES).map(([categoryKey, category]) => {
                  const Icon = category.icon;
                  const enabledInCategory = category.capabilities.filter(cap => 
                    enabledCapabilities.includes(cap.id)
                  ).length;
                  
                  return (
                    <div key={categoryKey} className="space-y-3">
                      {/* Category Header */}
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${category.gradient} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{category.name}</h4>
                          <p className="text-xs text-muted-foreground">{category.description}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {enabledInCategory}/{category.capabilities.length}
                        </Badge>
                      </div>

                      {/* Capabilities in Category */}
                      <div className="ml-11 space-y-2">
                        {category.capabilities.map(capability => {
                          const CapIcon = capability.icon;
                          const isEnabled = enabledCapabilities.includes(capability.id);
                          
                          return (
                            <div
                              key={capability.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                isEnabled
                                  ? 'border-primary bg-primary/5 shadow-sm'
                                  : 'border-border hover:border-border hover:bg-accent/50'
                              }`}
                            >
                              <div className="flex items-center space-x-3 flex-1">
                                <CapIcon className={`h-4 w-4 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="text-sm font-medium">{capability.name}</span>
                                {capability.popular && (
                                  <Badge variant="secondary" className="text-xs">Popular</Badge>
                                )}
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => handleToggleCapability(capability.id)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Permission Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Permission Settings</h3>
            <div className="space-y-2">
              {PERMISSION_LEVELS.map(level => {
                const LevelIcon = level.icon;
                const isSelected = permissionLevel === level.id;
                
                return (
                  <div
                    key={level.id}
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-border hover:bg-accent/50'
                    }`}
                    onClick={() => setPermissionLevel(level.id)}
                  >
                    <LevelIcon className={`h-5 w-5 mt-0.5 ${level.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{level.name}</span>
                        {level.recommended && (
                          <Badge variant="secondary" className="text-xs">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{level.description}</p>
                    </div>
                    {isSelected && (
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary */}
          {(getEnabledCount() > 0 || permissionLevel !== 'ask_permission') && (
            <div className="p-4 bg-muted/50 rounded-lg border border-muted">
              <div className="text-sm font-medium mb-2 flex items-center">
                <Brain className="h-4 w-4 mr-2" />
                Summary of my capabilities:
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Can help with {getEnabledCount()} different types of tasks</li>
                <li>• Will {getSelectedPermission()?.name.toLowerCase()}</li>
                {getEnabledCount() > 0 && (
                  <li>• Ready to assist with {Object.keys(CAPABILITY_CATEGORIES).filter(cat => 
                    CAPABILITY_CATEGORIES[cat].capabilities.some(cap => enabledCapabilities.includes(cap.id))
                  ).length} different areas</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-card/50">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={loading || !hasChanges()}
            className="min-w-[120px]"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {loading ? 'Saving...' : saved ? 'Saved!' : 'Update Tools'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}