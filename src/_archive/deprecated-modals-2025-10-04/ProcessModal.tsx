import React from 'react';
import { X, Clock, Brain, Database, Zap, MessageSquare, BarChart3, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronRight, FileText, Hash, Settings, RotateCcw } from 'lucide-react';

interface ProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  processingDetails: any;
}

// Memory Dropdown Component
const MemoryDropdown: React.FC<{
  title: string;
  memories: any[];
  type: 'episodic' | 'semantic';
}> = ({ title, memories, type }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const formatMemoryContent = (content: any) => {
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
      // For episodic memories
      if (content.event) {
        return (
          <div className="space-y-1">
            <div className="font-medium">{content.event}</div>
            {content.context && (
              <div className="text-xs text-gray-500">
                Context: {JSON.stringify(content.context, null, 2).substring(0, 200)}...
              </div>
            )}
            {content.participants && (
              <div className="text-xs text-gray-500">
                Participants: {content.participants.join(', ')}
              </div>
            )}
          </div>
        );
      }
      // For semantic memories or generic objects
      return (
        <pre className="text-xs whitespace-pre-wrap overflow-hidden">
          {JSON.stringify(content, null, 2).substring(0, 300)}...
        </pre>
      );
    }
    return String(content);
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {title} ({memories.length})
      </button>
      {isExpanded && (
        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
          {memories.map((memory, index) => (
            <div
              key={memory.id || index}
              className="p-2 bg-card border border-border rounded text-xs"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  {type === 'episodic' ? (
                    <FileText className="h-3 w-3 text-primary" />
                  ) : (
                    <Hash className="h-3 w-3 text-purple-500" />
                  )}
                  <span className="font-medium text-card-foreground">
                    {type === 'episodic' ? 'Episode' : 'Context'} #{index + 1}
                  </span>
                </div>
                {memory.relevance_score && (
                  <span className="text-xs text-muted-foreground">
                    Relevance: {(memory.relevance_score * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="text-muted-foreground">
                {formatMemoryContent(memory.content)}
              </div>
              {memory.created_at && (
                <div className="text-xs text-muted-foreground/80 mt-1">
                  Created: {new Date(memory.created_at).toLocaleString()}
                </div>
              )}
              {memory.importance && (
                <div className="text-xs text-muted-foreground/80">
                  Importance: {(memory.importance * 100).toFixed(0)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Reasoning Threshold Controls Component
const ReasoningThresholdControls: React.FC<{
  currentScore: number;
  isEnabled: boolean;
  onThresholdChange: (threshold: number) => void;
  agentId?: string;
}> = ({ currentScore, isEnabled, onThresholdChange, agentId }) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  
  // Use localStorage for immediate UI updates
  const [threshold, setThreshold] = React.useState(() => {
    const stored = localStorage.getItem(`reasoning-threshold-${agentId || 'global'}`);
    return stored ? parseFloat(stored) : 0.3;
  });
  
  const [autoAdjust, setAutoAdjust] = React.useState(() => {
    const stored = localStorage.getItem(`reasoning-auto-adjust-${agentId || 'global'}`);
    return stored ? JSON.parse(stored) : true;
  });

  const handleThresholdChange = (newThreshold: number) => {
    setThreshold(newThreshold);
    localStorage.setItem(`reasoning-threshold-${agentId || 'global'}`, newThreshold.toString());
    onThresholdChange(newThreshold);
  };

  const handleAutoAdjustChange = (enabled: boolean) => {
    setAutoAdjust(enabled);
    localStorage.setItem(`reasoning-auto-adjust-${agentId || 'global'}`, JSON.stringify(enabled));
  };

  const resetToDefault = () => {
    handleThresholdChange(0.3);
    handleAutoAdjustChange(true);
  };

  const getThresholdLabel = (value: number) => {
    if (value <= 0.2) return 'Very Low (Always On)';
    if (value <= 0.4) return 'Low (Most Requests)';
    if (value <= 0.6) return 'Medium (Complex Requests)';
    if (value <= 0.8) return 'High (Very Complex Only)';
    return 'Very High (Rarely Active)';
  };

  const getScoreColor = (score: number, threshold: number) => {
    if (score >= threshold) return 'text-green-600';
    if (score >= threshold * 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Reasoning Controls</span>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      {/* Current Status */}
      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-muted-foreground">
          Current Score: <span className={`font-medium ${getScoreColor(currentScore, threshold)}`}>
            {(currentScore * 100).toFixed(1)}%
          </span>
        </span>
        <span className="text-muted-foreground">
          Status: <span className={`font-medium ${isEnabled ? 'text-green-600' : 'text-red-600'}`}>
            {isEnabled ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </span>
      </div>

      {/* Threshold Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Activation Threshold</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{(threshold * 100).toFixed(0)}%</span>
            <button
              onClick={resetToDefault}
              className="p-1 hover:bg-warning/20 rounded"
              title="Reset to default (30%)"
            >
              <RotateCcw className="h-3 w-3 text-warning-foreground" />
            </button>
          </div>
        </div>
        
        <div className="relative">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={threshold}
            onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-lg appearance-none cursor-pointer"
            style={{
              background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 50%, #22c55e 100%)'
            }}
          />
          
          {/* Current Score Indicator */}
          <div 
            className="absolute top-0 w-1 h-2 bg-primary rounded-full shadow-md"
            style={{
              left: `calc(${currentScore * 100}% - 2px)`,
              transform: 'translateY(0px)'
            }}
            title={`Current Score: ${(currentScore * 100).toFixed(1)}%`}
          />
          
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
          
          {/* Score vs Threshold Comparison */}
          <div className="flex justify-between text-xs mt-1">
            <span className={`font-medium ${getScoreColor(currentScore, threshold)}`}>
              Score: {(currentScore * 100).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">
              Threshold: {(threshold * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground italic">
          {getThresholdLabel(threshold)}
        </div>
        
        {/* Quick Preset Buttons */}
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => handleThresholdChange(0.1)}
            className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
          >
            Always On
          </button>
          <button
            onClick={() => handleThresholdChange(0.3)}
            className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
          >
            Default
          </button>
          <button
            onClick={() => handleThresholdChange(0.6)}
            className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
          >
            Complex Only
          </button>
          <button
            onClick={() => handleThresholdChange(0.9)}
            className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
          >
            Rarely
          </button>
        </div>
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Auto-Adjust Threshold</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoAdjust}
                onChange={(e) => handleAutoAdjustChange(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-9 h-5 rounded-full transition-colors ${
                autoAdjust ? 'bg-primary' : 'bg-muted'
              }`}>
                <div className={`w-4 h-4 bg-background rounded-full shadow transform transition-transform ${
                  autoAdjust ? 'translate-x-4' : 'translate-x-0.5'
                } mt-0.5`} />
              </div>
            </label>
          </div>
          
          {/* Reasoning Style Preference */}
          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Preferred Reasoning Style</label>
            <select 
              className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
              defaultValue="auto"
            >
              <option value="auto">Auto-Detect</option>
              <option value="deductive">Deductive (Logical Proof)</option>
              <option value="inductive">Inductive (Pattern Recognition)</option>
              <option value="abductive">Abductive (Best Explanation)</option>
            </select>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Scoring Breakdown:</div>
            <div>• Length: Based on message complexity</div>
            <div>• Keywords: Reasoning-related terms (+30%)</div>
            <div>• Context: Available context density</div>
            <div>• Explicit: Direct reasoning requests (+40%)</div>
          </div>
          
          <div className="bg-muted/50 border border-border rounded p-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">💡 Tips:</div>
            <div>• Lower threshold = More reasoning activation</div>
            <div>• Use "deductive reasoning" for logical analysis</div>
            <div>• Complex questions automatically score higher</div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ProcessModal: React.FC<ProcessModalProps> = ({
  isOpen,
  onClose,
  processingDetails,
}) => {
  if (!isOpen || !processingDetails) return null;

  const { memory_operations, context_operations, tool_operations, reasoning_chain, chat_history, performance, reasoning, discovered_tools } = processingDetails;
  const reasoningGraph = processingDetails?.reasoning_graph as { states?: string[] } | undefined;

  const [showStepModal, setShowStepModal] = React.useState(false);
  const [selectedStep, setSelectedStep] = React.useState<any | null>(null);

  const formatTime = (ms: number) => `${ms}ms`;
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-background">
          <h2 className="text-xl font-semibold text-foreground">Processing Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] bg-background">
          {/* Reasoning Summary Header with Settings */}
          {reasoning && (
            <div className="mb-4 bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-foreground">
                  <span className="font-medium">Reasoning:</span> {reasoning.type || 'none'}
                  <span className="ml-3 font-medium">Score:</span> {((reasoning.score || 0) * 100).toFixed(1)}%
                </div>
                {reasoning.reason && (
                  <div className="text-xs text-muted-foreground">{reasoning.reason}</div>
                )}
              </div>
              
              {/* Reasoning Threshold Controls */}
              <ReasoningThresholdControls 
                currentScore={reasoning.score || 0}
                isEnabled={(() => {
                  // Determine if reasoning was actually executed
                  const score = reasoning?.score || 0;
                  const threshold = reasoning?.threshold || 0.3;
                  const hasSteps = reasoning_chain && reasoning_chain.length > 0;
                  const isExecuted = score >= threshold && hasSteps;
                  
                  // Debug logging
                  console.log('Reasoning Status Debug:', {
                    score,
                    threshold,
                    hasSteps,
                    stepsCount: reasoning_chain?.length || 0,
                    isExecuted,
                    reasoningEnabled: reasoning?.enabled,
                    reasoning: reasoning
                  });
                  
                  // Reasoning is active if score >= threshold AND we have steps, OR if explicitly enabled
                  return isExecuted || reasoning?.enabled || false;
                })()}
                agentId={processingDetails?.agent_id}
                onThresholdChange={(threshold) => {
                  console.log('Reasoning threshold updated to:', threshold);
                  // The threshold will be used in the next message processing
                  // Could potentially trigger a real-time update here
                }}
              />
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Memory Operations */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Memory Operations</h3>
              </div>
              
              {/* Episodic Memory */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${
                    memory_operations?.episodic_search?.status === 'searched' ? 'bg-green-500' :
                    memory_operations?.episodic_search?.status === 'disconnected' ? 'bg-orange-500' :
                    memory_operations?.episodic_search?.status === 'disabled' ? 'bg-gray-400' :
                    memory_operations?.episodic_search?.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                  <span className="font-medium text-sm text-foreground">Episodic Memory</span>
                </div>
                {memory_operations?.episodic_search ? (
                  <div className="ml-4 text-sm text-muted-foreground space-y-1">
                    <div>Status: {
                      memory_operations.episodic_search.status === 'searched' ? 'Searched' :
                      memory_operations.episodic_search.status === 'disconnected' ? 'Disconnected (No Pinecone)' :
                      memory_operations.episodic_search.status === 'disabled' ? 'Disabled' :
                      memory_operations.episodic_search.status === 'error' ? 'Error' : 'Unknown'
                    }</div>
                    {memory_operations.episodic_search.status === 'searched' && (
                      <>
                        <div>Results: {memory_operations.episodic_search.results_count}</div>
                        <div>Search Time: {formatTime(memory_operations.episodic_search.search_time_ms)}</div>
                        {memory_operations.episodic_search.relevance_scores.length > 0 && (
                          <div>Avg Relevance: {formatPercent(memory_operations.episodic_search.relevance_scores.reduce((a, b) => a + b, 0) / memory_operations.episodic_search.relevance_scores.length)}</div>
                        )}
                        {memory_operations.episodic_search.memories && memory_operations.episodic_search.memories.length > 0 && (
                          <MemoryDropdown 
                            title="View Retrieved Memories" 
                            memories={memory_operations.episodic_search.memories}
                            type="episodic"
                          />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="ml-4 text-sm text-muted-foreground/80">No episodic memory search performed</div>
                )}
              </div>

              {/* Semantic Memory */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${
                    memory_operations?.semantic_search?.status === 'searched' ? 'bg-green-500' :
                    memory_operations?.semantic_search?.status === 'disconnected' ? 'bg-orange-500' :
                    memory_operations?.semantic_search?.status === 'disabled' ? 'bg-gray-400' :
                    memory_operations?.semantic_search?.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                  }`} />
                  <span className="font-medium text-sm text-foreground">Semantic Memory</span>
                </div>
                {memory_operations?.semantic_search ? (
                  <div className="ml-4 text-sm text-muted-foreground space-y-1">
                    <div>Status: {
                      memory_operations.semantic_search.status === 'searched' ? 'Searched' :
                      memory_operations.semantic_search.status === 'disconnected' ? 'Disconnected (No GetZep)' :
                      memory_operations.semantic_search.status === 'disabled' ? 'Disabled' :
                      memory_operations.semantic_search.status === 'error' ? 'Error' : 'Unknown'
                    }</div>
                    {memory_operations.semantic_search.status === 'searched' && (
                      <>
                        <div>Results: {memory_operations.semantic_search.results_count}</div>
                        <div>Search Time: {formatTime(memory_operations.semantic_search.search_time_ms)}</div>
                        {memory_operations.semantic_search.concepts_retrieved.length > 0 && (
                          <div>Concepts: {memory_operations.semantic_search.concepts_retrieved.join(', ')}</div>
                        )}
                        {memory_operations.semantic_search.memories && memory_operations.semantic_search.memories.length > 0 && (
                          <MemoryDropdown 
                            title="View Retrieved Context" 
                            memories={memory_operations.semantic_search.memories}
                            type="semantic"
                          />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="ml-4 text-sm text-muted-foreground/80">No semantic memory search performed</div>
                )}
              </div>
            </div>

            {/* Context Operations */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Context Operations</h3>
              </div>
              
              <div className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Sources Used:</span>
                  <div className="ml-2 mt-1">
                    {context_operations?.retrieval_sources?.map((source: string, idx: number) => (
                      <span key={idx} className="inline-block bg-muted text-muted-foreground px-2 py-1 rounded text-xs mr-2 mb-1">
                        {source}
                      </span>
                    )) || 'None'}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    {context_operations?.optimization_applied ? 
                      <CheckCircle className="h-4 w-4 text-green-600" /> : 
                      <XCircle className="h-4 w-4 text-gray-400" />
                    }
                    <span>Optimization Applied</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {context_operations?.compression_applied ? 
                      <CheckCircle className="h-4 w-4 text-green-600" /> : 
                      <XCircle className="h-4 w-4 text-gray-400" />
                    }
                    <span>Compression Applied</span>
                  </div>
                </div>
                
                <div>
                  <span className="font-medium text-foreground">Quality Score:</span>
                  <span className="ml-2">{formatPercent(context_operations?.quality_score || 0)}</span>
                </div>
              </div>
            </div>

            {/* Tool Operations */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Tool Operations</h3>
              </div>
              
              {/* Discovered tools section */}
              <div className="mb-3 text-sm">
                <div className="font-medium text-foreground">Discovered Tools</div>
                <div className="mt-1">
                  {(discovered_tools && discovered_tools.length > 0) ? (
                    discovered_tools.map((t: any, idx: number) => (
                      <span key={idx} className="inline-block bg-muted text-muted-foreground px-2 py-1 rounded text-xs mr-2 mb-1">
                        {t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No tools discovered for this request</span>
                  )}
                </div>
              </div>

              {tool_operations && tool_operations.length > 0 ? (
                <div className="space-y-3">
                  {tool_operations.map((tool: any, idx: number) => (
                    <div key={idx} className="border border-purple-200 rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        {tool.success ? 
                          <CheckCircle className="h-4 w-4 text-green-600" /> : 
                          <XCircle className="h-4 w-4 text-red-600" />
                        }
                        <span className="font-medium text-sm">{tool.name}</span>
                        <span className="text-xs text-gray-500">({formatTime(tool.execution_time_ms)})</span>
                      </div>
                      {tool.error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {tool.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Tools were not requested or inferred in this request</div>
              )}
            </div>

            {/* Reasoning Chain */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Reasoning Chain</h3>
              </div>
              {/* Markov state path */}
              {reasoningGraph?.states?.length ? (
                <div className="mb-3 text-xs text-muted-foreground">
                  <span className="font-medium">Markov Path:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {reasoningGraph.states.map((s, i) => (
                      <span key={`${s}-${i}`} className="px-2 py-0.5 bg-muted text-muted-foreground border border-border rounded">
                        {i + 1}. {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              
              {reasoning_chain && reasoning_chain.length > 0 ? (
                <div className="space-y-3">
                  {reasoning_chain.map((step: any, idx: number) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-muted rounded-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                        {step.step}
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-foreground uppercase">{step.type}</span>
                          <span className="text-xs text-muted-foreground">({formatTime(step.time_ms)})</span>
                          <span className="text-xs text-muted-foreground">Confidence: {formatPercent(step.confidence)}</span>
                          
                          {/* Memory integration indicators */}
                          {(step.episodic_count > 0 || step.semantic_count > 0) && (
                            <div className="flex items-center gap-1">
                              {step.episodic_count > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                                  🧠 {step.episodic_count}
                                </span>
                              )}
                              {step.semantic_count > 0 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
                                  📚 {step.semantic_count}
                                </span>
                              )}
                            </div>
                          )}
                          
                          <button
                            className="ml-auto text-xs px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                            onClick={() => { setSelectedStep(step); setShowStepModal(true); }}
                          >
                            View
                          </button>
                        </div>
                        <div className="text-sm text-foreground">{step.description}</div>
                        
                        {/* Memory insights preview */}
                        {step.memory_insights && step.memory_insights.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                            💡 {step.memory_insights[0]}
                            {step.memory_insights.length > 1 && ` (+${step.memory_insights.length - 1} more insights)`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No reasoning chain captured</div>
              )}
            </div>

            {/* Chat History */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Chat History Context</h3>
              </div>
              
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Messages Considered:</span>
                  <span className="ml-2">{chat_history?.messages_considered || 0}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Context Window Used:</span>
                  <span className="ml-2">{chat_history?.context_window_used || 0} tokens</span>
                </div>
                <div className="flex items-center gap-1">
                  {chat_history?.relevance_filtering ? 
                    <CheckCircle className="h-4 w-4 text-green-600" /> : 
                    <XCircle className="h-4 w-4 text-muted-foreground" />
                  }
                  <span>Relevance Filtering Applied</span>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold text-foreground">Performance Metrics</h3>
              </div>
              
              <div className="space-y-3">
                {/* Stage Timings */}
                <div>
                  <span className="font-medium text-sm mb-2 block text-foreground">Stage Timings:</span>
                  <div className="space-y-1">
                    {performance?.stage_timings && Object.entries(performance.stage_timings).map(([stage, time]: [string, any]) => (
                      <div key={stage} className="flex justify-between text-xs text-muted-foreground">
                        <span className="capitalize">{stage.replace('_', ' ')}:</span>
                        <span>{formatTime(time)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Cache Performance */}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Cache Hits:</span>
                  <span className="text-green-600">{performance?.cache_hits || 0}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Cache Misses:</span>
                  <span className="text-red-600">{performance?.cache_misses || 0}</span>
                </div>
                
                {/* Bottlenecks */}
                {performance?.bottlenecks && performance.bottlenecks.length > 0 && (
                  <div>
                    <span className="font-medium text-sm mb-2 block text-foreground">Bottlenecks:</span>
                    {performance.bottlenecks.map((bottleneck: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3 text-muted-foreground" />
                        <span>{bottleneck}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Step Details Modal */}
      {showStepModal && selectedStep && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={() => setShowStepModal(false)}>
          <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-sm font-semibold text-foreground">Reasoning Step #{selectedStep.step} • {selectedStep.state || selectedStep.type}</div>
              <button onClick={() => setShowStepModal(false)} className="p-1 hover:bg-muted rounded">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm text-foreground">
              {selectedStep.question && (
                <div>
                  <div className="font-medium text-foreground">Question</div>
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedStep.question}</div>
                </div>
              )}
              {selectedStep.hypothesis && (
                <div>
                  <div className="font-medium text-foreground">Hypothesis</div>
                  <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedStep.hypothesis}</div>
                </div>
              )}
              {(selectedStep.action || selectedStep.observation) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="font-medium text-foreground">Action</div>
                    <pre className="mt-1 bg-muted border border-border rounded p-2 text-xs overflow-auto text-foreground">{JSON.stringify(selectedStep.action, null, 2)}</pre>
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Observation</div>
                    <pre className="mt-1 bg-muted border border-border rounded p-2 text-xs overflow-auto text-foreground">{JSON.stringify(selectedStep.observation, null, 2)}</pre>
                  </div>
                </div>
              )}
              
              {/* Memory Integration Section */}
              {(selectedStep.memories_used?.episodic?.length > 0 || selectedStep.memories_used?.semantic?.length > 0) && (
                <div className="space-y-4">
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <span>🧠 Memory Integration</span>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                      {selectedStep.episodic_count || 0} experiences, {selectedStep.semantic_count || 0} concepts
                    </span>
                  </div>
                  
                  {selectedStep.memories_used?.episodic?.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">📖 Past Experiences</div>
                      <div className="space-y-2">
                        {selectedStep.memories_used.episodic.map((memory: any, i: number) => (
                          <div key={i} className="bg-muted border border-border rounded p-2 text-xs">
                            <div className="font-medium text-foreground">
                              {memory.content?.event || 'Experience'}
                            </div>
                            <div className="text-muted-foreground mt-1">
                              Outcome: {memory.content?.outcome || 'N/A'}
                            </div>
                            {memory.relevance_score && (
                              <div className="text-muted-foreground mt-1">
                                Relevance: {(memory.relevance_score * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedStep.memories_used?.semantic?.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-foreground mb-2">📚 Known Concepts</div>
                      <div className="space-y-2">
                        {selectedStep.memories_used.semantic.map((memory: any, i: number) => (
                          <div key={i} className="bg-muted border border-border rounded p-2 text-xs">
                            <div className="text-foreground">
                              {typeof memory.content === 'string' 
                                ? memory.content.substring(0, 200) 
                                : (memory.content?.definition || memory.content?.concept || JSON.stringify(memory.content)).substring(0, 200)
                              }
                              {((typeof memory.content === 'string' ? memory.content : JSON.stringify(memory.content)).length > 200) && '...'}
                            </div>
                            {memory.relevance_score && (
                              <div className="text-muted-foreground mt-1">
                                Relevance: {(memory.relevance_score * 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedStep.memory_insights && selectedStep.memory_insights.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-purple-800 mb-2">💡 Memory Insights</div>
                      <div className="space-y-1">
                        {selectedStep.memory_insights.map((insight: string, i: number) => (
                          <div key={i} className="bg-purple-50 border border-purple-200 rounded p-2 text-xs text-purple-900">
                            {insight}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {Array.isArray(selectedStep.facts_considered) && selectedStep.facts_considered.length > 0 && (
                <div>
                  <div className="font-medium text-gray-900">Facts Considered</div>
                  <ul className="mt-1 list-disc pl-5 space-y-1 text-gray-700">
                    {selectedStep.facts_considered.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t flex justify-end">
              <button onClick={() => setShowStepModal(false)} className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white hover:bg-black">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
