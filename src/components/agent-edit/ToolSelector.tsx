import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { 
    Settings, 
    Mail, 
    Database, 
    Globe, 
    Code, 
    Bot, 
    Zap,
    Wrench,
    Search,
    MessageSquare,
    Calendar,
    FileText,
    Image
} from 'lucide-react';
import { useIntegrationsByClassification, getAgentIntegrationPermissions } from '@/integrations/_shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ToolSelectorProps {
    agentId: string;
    selectedTools: string[];
    onToolSelectionChange: (selectedTools: string[]) => void;
    disabled?: boolean;
}

interface AgentTool {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    isAvailable: boolean;
    isConnected: boolean;
}

// Icon mapping for different tool types
const getToolIcon = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
        'mail': Mail,
        'database': Database,
        'globe': Globe,
        'code': Code,
        'bot': Bot,
        'zap': Zap,
        'tool': Wrench,
        'search': Search,
        'message-square': MessageSquare,
        'calendar': Calendar,
        'file-text': FileText,
        'image': Image,
        'settings': Settings
    };
    
    return iconMap[iconName] || Wrench;
};

export const ToolSelector: React.FC<ToolSelectorProps> = ({
    agentId,
    selectedTools,
    onToolSelectionChange,
    disabled = false
}) => {
    const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    
    const { integrations: toolIntegrations, loading: integrationsLoading } = useIntegrationsByClassification('tool');

    useEffect(() => {
        fetchAvailableTools();
    }, [agentId, toolIntegrations]);

    const fetchAvailableTools = async () => {
        try {
            setLoading(true);
            setError(null);

            // Get agent permissions to see which tools are connected
            const permissions = user?.id ? await getAgentIntegrationPermissions(agentId, user.id) : [];

            // Combine integrations with permission status
            const tools: AgentTool[] = toolIntegrations.map(integration => {
                const permission = permissions?.find((p: any) => 
                    p.integration_name === integration.name
                );

                return {
                    id: integration.id,
                    name: integration.name,
                    description: integration.description,
                    icon: integration.icon_name,
                    category: integration.category_id,
                    isAvailable: integration.status === 'available',
                    isConnected: !!permission && permission.is_active
                };
            });

            // Add built-in tools that don't require external integrations
            const builtInTools: AgentTool[] = [
                {
                    id: 'web-search',
                    name: 'Web Search',
                    description: 'Search the web for current information',
                    icon: 'search',
                    category: 'search',
                    isAvailable: true,
                    isConnected: true
                },
                {
                    id: 'code-execution',
                    name: 'Code Execution',
                    description: 'Execute code snippets and scripts',
                    icon: 'code',
                    category: 'development',
                    isAvailable: true,
                    isConnected: true
                },
                {
                    id: 'file-operations',
                    name: 'File Operations',
                    description: 'Read, write, and manipulate files',
                    icon: 'file-text',
                    category: 'productivity',
                    isAvailable: true,
                    isConnected: true
                },
                {
                    id: 'data-analysis',
                    name: 'Data Analysis',
                    description: 'Analyze and process data',
                    icon: 'database',
                    category: 'analytics',
                    isAvailable: true,
                    isConnected: true
                }
            ];

            setAvailableTools([...builtInTools, ...tools]);
        } catch (err) {
            console.error('Error fetching available tools:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch available tools');
        } finally {
            setLoading(false);
        }
    };

    const handleToolToggle = (toolId: string, isChecked: boolean) => {
        if (disabled) return;

        const newSelectedTools = isChecked
            ? [...selectedTools, toolId]
            : selectedTools.filter(id => id !== toolId);
            
        onToolSelectionChange(newSelectedTools);
    };

    const handleSelectAll = () => {
        if (disabled) return;
        
        const availableToolIds = availableTools
            .filter(tool => tool.isAvailable && tool.isConnected)
            .map(tool => tool.id);
            
        onToolSelectionChange(availableToolIds);
    };

    const handleSelectNone = () => {
        if (disabled) return;
        onToolSelectionChange([]);
    };

    if (loading || integrationsLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Available Tools</CardTitle>
                    <CardDescription>Loading available tools...</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Available Tools</CardTitle>
                    <CardDescription>Error loading tools</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-red-500 text-sm">{error}</div>
                </CardContent>
            </Card>
        );
    }

    const connectedTools = availableTools.filter(tool => tool.isConnected);
    const disconnectedTools = availableTools.filter(tool => !tool.isConnected);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>Available Tools</span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            disabled={disabled || connectedTools.length === 0}
                        >
                            Select All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectNone}
                            disabled={disabled || selectedTools.length === 0}
                        >
                            Select None
                        </Button>
                    </div>
                </CardTitle>
                <CardDescription>
                    Choose which tools this task can use. Only connected tools are available.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {connectedTools.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-green-600 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Connected Tools ({connectedTools.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            {connectedTools.map(tool => {
                                const Icon = getToolIcon(tool.icon);
                                const isSelected = selectedTools.includes(tool.id);
                                
                                return (
                                    <div
                                        key={tool.id}
                                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                                            isSelected 
                                                ? 'bg-primary/5 border-primary' 
                                                : 'bg-background border-border hover:bg-muted/50'
                                        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        onClick={() => !disabled && handleToolToggle(tool.id, !isSelected)}
                                    >
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={(checked) => handleToolToggle(tool.id, !!checked)}
                                            disabled={disabled}
                                            className="mt-0.5"
                                        />
                                        <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-sm font-medium cursor-pointer">
                                                    {tool.name}
                                                </Label>
                                                <Badge variant="secondary" className="text-xs">
                                                    Connected
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {tool.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {disconnectedTools.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-orange-600 flex items-center gap-2">
                            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                            Available but Not Connected ({disconnectedTools.length})
                        </h4>
                        <div className="grid grid-cols-1 gap-3">
                            {disconnectedTools.map(tool => {
                                const Icon = getToolIcon(tool.icon);
                                
                                return (
                                    <div
                                        key={tool.id}
                                        className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-muted/30 opacity-75"
                                    >
                                        <Checkbox
                                            checked={false}
                                            disabled={true}
                                            className="mt-0.5"
                                        />
                                        <Icon className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-sm font-medium text-muted-foreground">
                                                    {tool.name}
                                                </Label>
                                                <Badge variant="outline" className="text-xs">
                                                    Not Connected
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {tool.description}
                                            </p>
                                            <p className="text-xs text-orange-600 mt-1">
                                                Connect this tool in the Integrations section to use it in tasks
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {connectedTools.length === 0 && disconnectedTools.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                                                    <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No tools available</p>
                        <p className="text-xs mt-1">Connect some integrations first to make tools available for tasks</p>
                    </div>
                )}

                {selectedTools.length > 0 && (
                    <div className="pt-4 border-t border-border">
                        <Label className="text-sm font-medium">Selected Tools ({selectedTools.length})</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedTools.map(toolId => {
                                const tool = availableTools.find(t => t.id === toolId);
                                if (!tool) return null;
                                
                                const Icon = getToolIcon(tool.icon);
                                
                                return (
                                    <Badge key={toolId} variant="secondary" className="flex items-center gap-1">
                                        <Icon className="h-3 w-3" />
                                        {tool.name}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}; 