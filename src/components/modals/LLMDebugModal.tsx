import React, { useState } from 'react';
import { X, ChevronDown, ChevronRight, Code, Sparkles, MessageSquare, Brain, Zap, Copy, Check } from 'lucide-react';

interface LLMDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  processingDetails: any;
}

interface LLMCall {
  stage: string;
  description: string;
  request: {
    model?: string;
    messages?: any[];
    tools?: any[];
    temperature?: number;
    max_tokens?: number;
    [key: string]: any;
  };
  response: {
    content?: string;
    tool_calls?: any[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    [key: string]: any;
  };
  timestamp?: string;
  duration_ms?: number;
}

export const LLMDebugModal: React.FC<LLMDebugModalProps> = ({
  isOpen,
  onClose,
  processingDetails,
}) => {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [copiedStage, setCopiedStage] = useState<string | null>(null);

  if (!isOpen) return null;

  // ✨ NEW: Use LLM calls directly from processing details (captured in real-time from chat handler)
  // This is the PRIMARY source of data - all LLM calls are tracked in memory during chat processing
  const llmCalls: LLMCall[] = processingDetails?.llm_calls || [];
  
  console.log('[LLMDebugModal] Displaying LLM calls:', {
    totalCalls: llmCalls.length,
    stages: llmCalls.map(c => c.stage),
    processingDetails: processingDetails,
  });
  
  // LEGACY FALLBACK: If llm_calls is not available (shouldn't happen after this update)
  // This code is kept for backward compatibility with old messages
  const legacyLLMCalls: LLMCall[] = [];
  
  if (llmCalls.length === 0) {
    console.warn('[LLMDebugModal] No llm_calls found, using legacy reconstruction');
    
    // 1. Contextual Awareness Stage (LEGACY)
    if (processingDetails?.contextual_awareness) {
      legacyLLMCalls.push({
        stage: 'contextual_awareness',
        description: '🧠 Contextual Awareness Analysis',
        request: {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Contextual awareness system prompt...',
            },
            {
              role: 'user',
              content: processingDetails.contextual_awareness.user_message || '',
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        response: {
          content: JSON.stringify(processingDetails.contextual_awareness.interpretation || {}, null, 2),
          usage: processingDetails.contextual_awareness.usage,
        },
        duration_ms: processingDetails.contextual_awareness.analysis_time_ms,
      });
    }

    // 2. Intent Classification Stage (LEGACY)
    if (processingDetails?.intent_classification) {
      legacyLLMCalls.push({
        stage: 'intent_classification',
        description: '🎯 Intent Classification',
      request: {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Intent classifier system prompt...',
          },
          ...(processingDetails.intent_classification.context_messages || []),
          {
            role: 'user',
            content: `Classify this message: "${processingDetails.intent_classification.user_message || ''}"`,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      },
      response: {
        content: JSON.stringify(processingDetails.intent_classification.result || {}, null, 2),
        usage: processingDetails.intent_classification.usage,
      },
      duration_ms: processingDetails.intent_classification.classification_time_ms,
    });
  }

    // 3. Main LLM Call Stage (LEGACY)
    if (processingDetails?.llm_calls) {
      processingDetails.llm_calls.forEach((call: any, index: number) => {
        legacyLLMCalls.push({
          stage: `llm_call_${index}`,
          description: `💬 Main LLM Call ${index > 0 ? `(Retry ${index})` : ''}`,
          request: {
            model: call.model || 'gpt-4',
            messages: call.messages || [],
            tools: call.tools || [],
            temperature: call.temperature,
            max_tokens: call.max_tokens,
          },
          response: {
            content: call.response?.content || '',
            tool_calls: call.response?.tool_calls || [],
            usage: call.response?.usage,
          },
          duration_ms: call.duration_ms,
          timestamp: call.timestamp,
        });
      });
    }

    // 4. Tool Execution Stages (LEGACY)
    if (processingDetails?.tool_operations) {
      processingDetails.tool_operations.forEach((op: any, index: number) => {
        legacyLLMCalls.push({
          stage: `tool_${index}`,
          description: `🔧 Tool: ${op.tool_name || 'Unknown'}`,
          request: {
            tool_name: op.tool_name,
            parameters: op.parameters,
          },
          response: {
            content: typeof op.result === 'string' ? op.result : JSON.stringify(op.result, null, 2),
            success: op.success,
            error: op.error,
          },
          duration_ms: op.execution_time_ms,
        });
      });
    }

    // 5. Retry Analysis (if any retries happened) (LEGACY)
    if (processingDetails?.retry_analysis) {
      processingDetails.retry_analysis.forEach((retry: any, index: number) => {
        legacyLLMCalls.push({
          stage: `retry_analysis_${index}`,
          description: `🔄 Retry Analysis ${index + 1}`,
          request: {
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Analyze why the tool failed and suggest a fix...',
              },
              {
                role: 'user',
                content: `Tool: ${retry.tool_name}\nError: ${retry.error}\nSuggest a fix.`,
              },
            ],
          },
          response: {
            content: retry.suggested_fix || '',
            usage: retry.usage,
          },
          duration_ms: retry.analysis_time_ms,
        });
      });
    }
  }  // Close the if (llmCalls.length === 0) block
  
  // Use the appropriate array (primary llm_calls or legacy fallback)
  const displayCalls = llmCalls.length > 0 ? llmCalls : legacyLLMCalls;

  const toggleStage = (stage: string) => {
    const newExpanded = new Set(expandedStages);
    if (newExpanded.has(stage)) {
      newExpanded.delete(stage);
    } else {
      newExpanded.add(stage);
    }
    setExpandedStages(newExpanded);
  };

  const copyToClipboard = async (stage: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedStage(stage);
      setTimeout(() => setCopiedStage(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  const totalInputTokens = displayCalls.reduce(
    (sum, call) => sum + (call.response?.usage?.prompt_tokens || 0),
    0
  );

  const totalOutputTokens = displayCalls.reduce(
    (sum, call) => sum + (call.response?.usage?.completion_tokens || 0),
    0
  );

  const totalTokens = totalInputTokens + totalOutputTokens;

  const totalDuration = displayCalls.reduce(
    (sum, call) => sum + (call.duration_ms || 0),
    0
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-background">
          <div>
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Code className="h-5 w-5 text-purple-500" />
              LLM Debug Viewer
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              View all LLM requests and responses for this conversation turn
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 px-6 py-3 bg-muted/30 border-b border-border text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-muted-foreground">Total Stages:</span>
            <span className="font-semibold text-foreground">{displayCalls.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">Total Tokens:</span>
            <span className="font-semibold text-foreground">{totalTokens.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">
              (<span className="text-blue-400">↓{totalInputTokens}</span> / <span className="text-green-400">↑{totalOutputTokens}</span>)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Total Time:</span>
            <span className="font-semibold text-foreground">{totalDuration}ms</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {displayCalls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No LLM calls recorded for this message</p>
              <p className="text-sm mt-2">Processing details may not have been captured</p>
            </div>
          ) : (
            displayCalls.map((call, index) => {
              const isExpanded = expandedStages.has(call.stage);
              const isCopied = copiedStage === call.stage;

              return (
                <div
                  key={call.stage}
                  className="border border-border rounded-lg bg-card overflow-hidden"
                >
                  {/* Stage Header */}
                  <button
                    onClick={() => toggleStage(call.stage)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-muted-foreground">
                          #{index + 1}
                        </span>
                        <span className="font-semibold text-foreground">
                          {call.description}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {call.response?.usage && (
                        <>
                          <span className="text-muted-foreground">
                            <span className="text-blue-400">↓</span> {call.response.usage.prompt_tokens || 0}
                          </span>
                          <span className="text-muted-foreground">
                            <span className="text-green-400">↑</span> {call.response.usage.completion_tokens || 0}
                          </span>
                        </>
                      )}
                      {call.duration_ms && (
                        <span className="text-muted-foreground">
                          {call.duration_ms}ms
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Request Section */}
                      <div className="p-4 bg-muted/20">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                            Request
                          </h4>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                `${call.stage}_request`,
                                formatJSON(call.request)
                              )
                            }
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Copy request"
                          >
                            {isCopied === `${call.stage}_request` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <pre className="text-xs bg-black/40 text-green-400 p-3 rounded-md overflow-x-auto font-mono">
                          {formatJSON(call.request)}
                        </pre>
                      </div>

                      {/* Response Section */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-yellow-500" />
                            Response
                          </h4>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                `${call.stage}_response`,
                                formatJSON(call.response)
                              )
                            }
                            className="p-1 hover:bg-muted rounded transition-colors"
                            title="Copy response"
                          >
                            {copiedStage === `${call.stage}_response` ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <pre className="text-xs bg-black/40 text-blue-400 p-3 rounded-md overflow-x-auto font-mono">
                          {formatJSON(call.response)}
                        </pre>
                      </div>

                      {/* Usage Stats */}
                      {call.response?.usage && (
                        <div className="px-4 pb-4">
                          <div className="flex gap-4 text-xs bg-muted/30 rounded-md p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-blue-400 font-semibold">↓ Input:</span>
                              <span className="text-foreground font-mono">{call.response.usage.prompt_tokens || 0}</span>
                              <span className="text-muted-foreground">tokens</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-green-400 font-semibold">↑ Output:</span>
                              <span className="text-foreground font-mono">{call.response.usage.completion_tokens || 0}</span>
                              <span className="text-muted-foreground">tokens</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-purple-400 font-semibold">Σ Total:</span>
                              <span className="text-foreground font-mono">{call.response.usage.total_tokens || 0}</span>
                              <span className="text-muted-foreground">tokens</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/20">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              💡 Tip: Click any stage to expand and view the full LLM request/response
            </span>
            <button
              onClick={() => setExpandedStages(new Set(displayCalls.map(c => c.stage)))}
              className="px-3 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
            >
              Expand All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};