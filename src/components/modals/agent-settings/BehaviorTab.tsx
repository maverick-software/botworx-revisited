import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { 
  Loader2, 
  Check, 
  Plus,
  X,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface CustomContext {
  id: string;
  name: string;
  content: string;
}

interface Rule {
  id: string;
  content: string;
}

interface BehaviorTabProps {
  agentId: string;
  agentData?: {
    name?: string;
  };
  onAgentUpdated?: (updatedData: any) => void;
}

import { TabRef } from './types';

export const BehaviorTab = forwardRef<TabRef, BehaviorTabProps>(({ agentId, agentData, onAgentUpdated }, ref) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  // Core Behavior state
  const [role, setRole] = useState('');
  const [instructions, setInstructions] = useState('');
  const [constraints, setConstraints] = useState('');
  const [tools, setTools] = useState('');
  const [customContexts, setCustomContexts] = useState<CustomContext[]>([]);

  // Rules state
  const [rules, setRules] = useState<Rule[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formattingTools, setFormattingTools] = useState(false);
  
  // Track original values for change detection
  const [originalRole, setOriginalRole] = useState('');
  const [originalInstructions, setOriginalInstructions] = useState('');
  const [originalConstraints, setOriginalConstraints] = useState('');
  const [originalTools, setOriginalTools] = useState('');
  const [originalCustomContexts, setOriginalCustomContexts] = useState<CustomContext[]>([]);
  const [originalRules, setOriginalRules] = useState<Rule[]>([]);

  // Load agent settings
  useEffect(() => {
    const loadAgentSettings = async () => {
      if (!agentId) return;
      
      setLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('agents')
          .select('metadata')
          .eq('id', agentId)
          .single();

        if (error) throw error;

        const metadata = data?.metadata || {};
        const behavior = metadata.behavior || {};
        
        // Load Core Behavior sections
        const loadedRole = behavior.role || '';
        const loadedInstructions = behavior.instructions || '';
        const loadedConstraints = behavior.constraints || '';
        const loadedTools = behavior.tools || '';
        const loadedContexts = behavior.custom_contexts || [];
        const loadedRules = behavior.rules || [];
        
        setRole(loadedRole);
        setInstructions(loadedInstructions);
        setConstraints(loadedConstraints);
        setTools(loadedTools);
        setCustomContexts(loadedContexts);
        setRules(loadedRules);
        
        // Store original values
        setOriginalRole(loadedRole);
        setOriginalInstructions(loadedInstructions);
        setOriginalConstraints(loadedConstraints);
        setOriginalTools(loadedTools);
        setOriginalCustomContexts(loadedContexts);
        setOriginalRules(loadedRules);

      } catch (error) {
        console.error('Error loading agent settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadAgentSettings();
  }, [agentId, supabase]);



  // Helper functions for custom contexts
  const addCustomContext = () => {
    const newContext: CustomContext = {
      id: Date.now().toString(),
      name: '',
      content: ''
    };
    setCustomContexts([...customContexts, newContext]);
  };

  const updateCustomContext = (id: string, field: 'name' | 'content', value: string) => {
    setCustomContexts(customContexts.map(ctx => 
      ctx.id === id ? { ...ctx, [field]: value } : ctx
    ));
  };

  const removeCustomContext = (id: string) => {
    setCustomContexts(customContexts.filter(ctx => ctx.id !== id));
  };

  // UI state for editing
  const [editingSection, setEditingSection] = React.useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = React.useState<string | null>(null);
  
  const addRule = () => {
    if (rules.length >= 50) {
      toast.error('Maximum 50 rules allowed');
      return;
    }
    const newRule: Rule = {
      id: Date.now().toString(),
      content: ''
    };
    setRules([...rules, newRule]);
    setEditingRuleId(newRule.id); // Auto-open for editing
  };

  const updateRule = (id: string, content: string) => {
    // Validate word count (max 50 words)
    const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount > 50) {
      toast.error('Rule must be 50 words or less');
      return;
    }
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, content } : rule
    ));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    
    const startTime = Date.now();
    setLoading(true);
    setSaveSuccess(false);
    
    try {
      // Get current metadata
      const { data: currentData } = await supabase
        .from('agents')
        .select('metadata')
        .eq('id', agentId)
        .single();

      const currentMetadata = currentData?.metadata || {};
      
      // Build the system prompt
      let systemPrompt = '';

      if (role.trim()) {
        systemPrompt += `## Role ##\n\n${role.trim()}\n\n`;
      }

      if (instructions.trim()) {
        systemPrompt += `## Instructions ##\n\n${instructions.trim()}\n\n`;
      }

      if (constraints.trim()) {
        systemPrompt += `## Constraints ##\n\n${constraints.trim()}\n\n`;
      }

      if (tools.trim()) {
        systemPrompt += `## Tools ##\n\n${tools.trim()}\n\n`;
      }

      // Add custom contexts
      customContexts.forEach(ctx => {
        if (ctx.name.trim() && ctx.content.trim()) {
          systemPrompt += `## ${ctx.name.trim()} ##\n\n${ctx.content.trim()}\n\n`;
        }
      });

      // Add rules section
      const activeRules = rules.filter(rule => rule.content.trim());
      if (activeRules.length > 0) {
        systemPrompt += `## Rules ##\n\n`;
        activeRules.forEach((rule, index) => {
          systemPrompt += `${index + 1}. ${rule.content.trim()}\n`;
        });
      }

      systemPrompt = systemPrompt.trim();
      
      const updatedMetadata = {
        ...currentMetadata,
        behavior: {
          role,
          instructions,
          constraints,
          tools,
          custom_contexts: customContexts,
          rules
        },
        settings: {
          ...currentMetadata.settings,
          custom_instructions: systemPrompt // This is what gets sent to the LLM
        }
      };

      // Update agent
      const { data, error } = await supabase
        .from('agents')
        .update({
          metadata: updatedMetadata
        })
        .eq('id', agentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Behavior settings updated successfully! 🎯');
      
      if (onAgentUpdated) {
        onAgentUpdated(data);
      }
      
    } catch (error: any) {
      console.error('Error updating agent behavior:', error);
      toast.error('Failed to update behavior settings');
    } finally {
      // Ensure minimum 1 second spinner duration
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 1000 - elapsedTime);
      
      await new Promise(resolve => setTimeout(resolve, remainingTime));
      setLoading(false);
      setSaveSuccess(true);
      
      // Update original values after successful save
      setOriginalRole(role);
      setOriginalInstructions(instructions);
      setOriginalConstraints(constraints);
      setOriginalTools(tools);
      setOriginalCustomContexts(customContexts);
      setOriginalRules(rules);
      
      // Reset success state after 2 seconds
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  }, [agentId, user, role, instructions, constraints, tools, customContexts, rules, supabase, onAgentUpdated]);

  // Detect if there are unsaved changes
  const hasChanges = 
    role !== originalRole ||
    instructions !== originalInstructions ||
    constraints !== originalConstraints ||
    tools !== originalTools ||
    JSON.stringify(customContexts) !== JSON.stringify(originalCustomContexts) ||
    JSON.stringify(rules) !== JSON.stringify(originalRules);
  
  // Expose save method and state to parent via ref
  useImperativeHandle(ref, () => ({
    save: handleSave,
    hasChanges,
    saving: loading,
    saveSuccess
  }));

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
        {/* Header */}
      <div>
          <h3 className="text-lg font-medium">Agent Behavior</h3>
        <p className="text-sm text-muted-foreground">
            Define your agent's role, instructions, constraints, and operational rules.
        </p>
      </div>

        {/* Core Behavior Section */}
      <Card>
        <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Core Behavior</CardTitle>
          <CardDescription>
                  Define the fundamental aspects of how your agent operates and communicates
          </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCustomContext}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Context
              </Button>
            </div>
        </CardHeader>
          <CardContent className="space-y-1">
            {/* Role */}
            {editingSection === 'role' ? (
              <div className="bg-muted/30 rounded p-3 space-y-2">
                <Label htmlFor="role" className="text-sm font-medium">Role</Label>
                <p className="text-xs text-muted-foreground">
                  What is your agent's primary role or job function?
                </p>
                <Textarea
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Example: You are a professional customer support specialist focused on resolving technical issues."
                  rows={3}
                  className="w-full"
                  autoFocus
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection(null)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative"
                onMouseLeave={() => openMenuId === 'role' && setOpenMenuId(null)}
              >
                <div className="flex-1 pr-8">
                  <p className="text-sm font-medium text-foreground">Role</p>
                  {role && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{role}</p>}
                  {!role && <p className="text-xs text-muted-foreground italic">Not set</p>}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === 'role' ? null : 'role')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                  >
                    <span className="text-muted-foreground">⋯</span>
                  </button>
                  {openMenuId === 'role' && (
                    <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSection('role');
                          setOpenMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-border/30 my-1"></div>

            {/* Instructions */}
            {editingSection === 'instructions' ? (
              <div className="bg-muted/30 rounded p-3 space-y-2">
                <Label htmlFor="instructions" className="text-sm font-medium">Instructions</Label>
                <p className="text-xs text-muted-foreground">
                  How should your agent behave and communicate?
                </p>
                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Example: Always be polite, helpful, and solution-focused. Listen carefully to customer concerns and provide clear, step-by-step guidance."
                  rows={4}
                  className="w-full"
                  autoFocus
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection(null)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative"
                onMouseLeave={() => openMenuId === 'instructions' && setOpenMenuId(null)}
              >
                <div className="flex-1 pr-8">
                  <p className="text-sm font-medium text-foreground">Instructions</p>
                  {instructions && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{instructions}</p>}
                  {!instructions && <p className="text-xs text-muted-foreground italic">Not set</p>}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === 'instructions' ? null : 'instructions')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                  >
                    <span className="text-muted-foreground">⋯</span>
                  </button>
                  {openMenuId === 'instructions' && (
                    <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSection('instructions');
                          setOpenMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-border/30 my-1"></div>

            {/* Constraints */}
            {editingSection === 'constraints' ? (
              <div className="bg-muted/30 rounded p-3 space-y-2">
                <Label htmlFor="constraints" className="text-sm font-medium">Constraints</Label>
                <p className="text-xs text-muted-foreground">
                  What boundaries or limitations should your agent follow?
                </p>
                <Textarea
                  id="constraints"
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  placeholder="Example: Never share confidential information, never make promises about refunds without checking policy, always escalate billing issues to human agents."
                  rows={4}
                  className="w-full"
                  autoFocus
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection(null)}
                  >
                    Done
                  </Button>
                      </div>
                    </div>
            ) : (
              <div 
                className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative"
                onMouseLeave={() => openMenuId === 'constraints' && setOpenMenuId(null)}
              >
                <div className="flex-1 pr-8">
                  <p className="text-sm font-medium text-foreground">Constraints</p>
                  {constraints && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{constraints}</p>}
                  {!constraints && <p className="text-xs text-muted-foreground italic">Not set</p>}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === 'constraints' ? null : 'constraints')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                  >
                    <span className="text-muted-foreground">⋯</span>
                  </button>
                  {openMenuId === 'constraints' && (
                    <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSection('constraints');
                          setOpenMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
          </div>
            )}

            {/* Separator */}
            <div className="border-t border-border/30 my-1"></div>

            {/* Tools */}
            {editingSection === 'tools' ? (
              <div className="bg-muted/30 rounded p-3 space-y-2">
          <div className="flex items-center justify-between">
                  <Label htmlFor="tools" className="text-sm font-medium">Tools</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={formattingTools}
                    onClick={async () => {
                      setFormattingTools(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('format-mcp-tools', {
                          body: { agentId }
                        });
                        
                        if (error) throw error;
                        
                        if (data?.success && data?.formattedTools) {
                          setTools(data.formattedTools);
                          toast.success('MCP tools formatted successfully!');
                        } else {
                          throw new Error(data?.error || 'Failed to format tools');
                        }
                      } catch (err: any) {
                        console.error('Error formatting MCP tools:', err);
                        toast.error(err.message || 'Failed to format MCP tools');
                      } finally {
                        setFormattingTools(false);
                      }
                    }}
                  >
                    {formattingTools ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Formatting...
                      </>
                    ) : (
                      'Update from MCP'
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  How should your agent use available tools and integrations? Click "Update from MCP" to auto-generate from connected MCP servers.
                </p>
                <Textarea
                  id="tools"
                  value={tools}
                  onChange={(e) => setTools(e.target.value)}
                  placeholder="Example: Use the knowledge base search tool for technical documentation. Use email integration to send follow-up confirmations after resolving issues."
                  rows={8}
                  className="w-full font-mono text-sm"
                  autoFocus
                />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection(null)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div 
                className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative"
                onMouseLeave={() => openMenuId === 'tools' && setOpenMenuId(null)}
              >
                <div className="flex-1 pr-8">
                  <p className="text-sm font-medium text-foreground">Tools</p>
                  {tools && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{tools}</p>}
                  {!tools && <p className="text-xs text-muted-foreground italic">Not set</p>}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(openMenuId === 'tools' ? null : 'tools')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                  >
                    <span className="text-muted-foreground">⋯</span>
                  </button>
                  {openMenuId === 'tools' && (
                    <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSection('tools');
                          setOpenMenuId(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
              </div>
            </div>
            )}

            {/* Custom Contexts */}
            {customContexts.map((context, index) => {
                const isEditingContext = editingSection === `context-${context.id}`;
                
                if (isEditingContext) {
                  return (
                    <React.Fragment key={context.id}>
                      {index > 0 && <div className="border-t border-border/30 my-1"></div>}
                      <div className="bg-muted/30 rounded p-3 space-y-2">
                      <Input
                        value={context.name}
                        onChange={(e) => updateCustomContext(context.id, 'name', e.target.value)}
                        placeholder="Context name (e.g., Company Values)"
                        className="w-full"
                      />
                      <Textarea
                        value={context.content}
                        onChange={(e) => updateCustomContext(context.id, 'content', e.target.value)}
                        placeholder="Enter context content..."
                        rows={3}
                        className="w-full"
                      />
                      <div className="flex justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomContext(context.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSection(null)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                    </React.Fragment>
                  );
                }
                
                return (
                  <React.Fragment key={context.id}>
                    {index > 0 && <div className="border-t border-border/30 my-1"></div>}
                    <div
                    className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative"
                    onMouseLeave={() => openMenuId === `context-${context.id}` && setOpenMenuId(null)}
                  >
                    <div className="flex-1 pr-8">
                      <p className="text-sm font-medium text-foreground">{context.name || 'New Context'}</p>
                      {context.content && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{context.content}</p>}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === `context-${context.id}` ? null : `context-${context.id}`)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                      >
                        <span className="text-muted-foreground">⋯</span>
                      </button>
                      {openMenuId === `context-${context.id}` && (
                        <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSection(`context-${context.id}`);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeCustomContext(context.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-muted transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
          </div>
                  </React.Fragment>
                );
              })}
        </CardContent>
      </Card>

        {/* Rules Section */}
      <Card>
        <CardHeader>
            <CardTitle>Rules</CardTitle>
          <CardDescription>
              Specific rules your agent must follow (max 50 rules, 50 words each)
          </CardDescription>
        </CardHeader>
          <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>{rules.length} / 50 rules</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRule}
                disabled={rules.length >= 50}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Rule
              </Button>
            </div>

            {rules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No rules defined yet.</p>
                <p className="text-xs mt-1">Click "Add Rule" to create specific guidelines for your agent.</p>
          </div>
            )}

            <div className="space-y-1">
              {rules.map((rule, index) => {
                const isEditing = editingRuleId === rule.id;
                const showMenu = openMenuId === rule.id;
                const wordCount = rule.content.trim().split(/\s+/).filter(word => word.length > 0).length;
                const isOverLimit = wordCount > 50;
                
                // If editing, show the edit form
                if (isEditing) {
                  return (
                    <React.Fragment key={rule.id}>
                      {index > 0 && <div className="border-t border-border/30 my-1"></div>}
                      <div className="bg-muted/30 rounded p-3 space-y-2">
              <Textarea
                        value={rule.content}
                        onChange={(e) => updateRule(rule.id, e.target.value)}
                        placeholder="Enter a specific rule (max 50 words)..."
                        rows={2}
                        className={`w-full ${isOverLimit ? 'border-red-500' : ''}`}
                        autoFocus
                      />
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {wordCount} / 50 words
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (rule.content.trim()) {
                                setEditingRuleId(null);
                              } else {
                                // If empty, remove it
                                removeRule(rule.id);
                              }
                            }}
                          >
                            {rule.content.trim() ? 'Save' : 'Cancel'}
                          </Button>
                        </div>
              </div>
            </div>
                    </React.Fragment>
                  );
                }
                
                // If not editing and has content, show closed state
                if (rule.content.trim()) {
                  return (
                    <React.Fragment key={rule.id}>
                      {index > 0 && <div className="border-t border-border/30 my-1"></div>}
                      <div 
                      className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative"
                      onMouseLeave={() => setOpenMenuId(null)}
                    >
                      <p className="text-sm text-foreground flex-1 pr-8">
                        {rule.content}
                      </p>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(showMenu ? null : rule.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                        >
                          <span className="text-muted-foreground">⋯</span>
                        </button>
                        {showMenu && (
                          <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRuleId(rule.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeRule(rule.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-muted transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        )}
            </div>
            </div>
                    </React.Fragment>
                  );
                }
                
                // Skip rendering if no content and not editing (shouldn't happen)
                return null;
              })}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
});
