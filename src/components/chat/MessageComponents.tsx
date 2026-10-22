import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart3, Brain, ChevronRight, FileText, Paperclip } from 'lucide-react';
import { InlineThinkingIndicator } from '../InlineThinkingIndicator';
import type { Message } from '../../types';
import type { Database } from '../../types/database.types';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import { ArtifactCard } from './ArtifactCard';
import { CanvasMode } from './CanvasMode';
import { useArtifacts } from '@/hooks/useArtifacts';
import type { Artifact } from '@/types/artifacts';
import { supabase } from '@/lib/supabase';
import { ToolUserInputCard } from './ToolUserInputCard';
import { MessageAudioButton } from '@/components/voice/MessageAudioButton';

type Agent = Database['public']['Tables']['agents']['Row'];

interface MessageListProps {
  messages: Message[];
  agent: Agent | null;
  user: any;
  thinkingMessageIndex: number | null;
  formatMarkdown: (content: string) => string;
  currentProcessingDetails?: any;
  onShowProcessModal?: (messageDetails?: any) => void;
  onShowDebugModal?: (processingDetails: any) => void;
  aiState?: any;
  currentTool?: any;
  processSteps?: any[];
  onCanvasSendMessage?: (message: string, artifactId: string) => Promise<void>;
  onRetryToolWithInput?: (message: Message, userInputs: Record<string, any>) => Promise<void>;
}

export function MessageList({ messages, agent, user, thinkingMessageIndex, formatMarkdown, currentProcessingDetails, onShowProcessModal, onShowDebugModal, aiState, currentTool, processSteps, onCanvasSendMessage }: MessageListProps) {
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const [canvasArtifact, setCanvasArtifact] = useState<Artifact | null>(null);
  const { updateArtifact, downloadArtifact, getArtifact } = useArtifacts();

  // Extract artifacts from message metadata
  const getArtifactsFromMessage = (message: Message): Artifact[] => {
    if (!message.metadata?.artifacts) return [];
    const artifacts = Array.isArray(message.metadata.artifacts)
      ? message.metadata.artifacts
      : [message.metadata.artifacts];
    return artifacts.filter((a: any) => a && typeof a === 'object');
  };

  // Handle opening canvas mode
  const handleOpenCanvas = async (artifact: Artifact) => {
    // Always fetch the latest version from the database
    console.log('[MessageList] Opening canvas for artifact:', artifact.id);
    const latest = await getArtifact(artifact.id);
    if (latest) {
      console.log('[MessageList] Loaded latest artifact version:', latest.version, 'content length:', latest.content?.length);
      setCanvasArtifact(latest);
    } else {
      console.warn('[MessageList] Could not load latest artifact, using message version');
      setCanvasArtifact(artifact);
    }
  };

  // Handle saving artifact from canvas
  const handleSaveArtifact = async (content: string, changes_note?: string) => {
    if (!canvasArtifact || !agent?.id) {
      console.error('[MessageList] Cannot save - missing artifact or agent', {
        hasArtifact: !!canvasArtifact,
        hasAgent: !!agent?.id
      });
      return;
    }
    
    console.log('[MessageList] Saving artifact...', {
      artifactId: canvasArtifact.id,
      contentLength: content.length,
      contentPreview: content.substring(0, 100)
    });
    
    const updated = await updateArtifact(
      {
        artifact_id: canvasArtifact.id,
        content,
        changes_note
      },
      agent.id
    );

    if (updated) {
      console.log('[MessageList] Artifact updated successfully', {
        newVersion: updated.version,
        newContentLength: updated.content?.length
      });
      setCanvasArtifact(updated);
    } else {
      console.error('[MessageList] updateArtifact returned null/undefined');
    }
  };
  
  // Filter out completed/stale thinking messages before rendering
  const displayMessages = messages.filter((message, index) => {
    if (message.role === 'thinking') {
      // Only show the thinking message if it's the current active one
      return index === thinkingMessageIndex && !message.metadata?.isCompleted;
    }
    return true; // Show all non-thinking messages
  });

  return (
    <>
    <div className="space-y-4">
      {displayMessages.map((message, index) => {
        // Handle thinking messages with inline indicator
        if (message.role === 'thinking') {
          return (
            <InlineThinkingIndicator
              key={`thinking-${message.timestamp?.getTime() || index}`}
              isVisible={true}
              currentState={aiState}
              currentTool={currentTool}
              processSteps={processSteps?.map(step => ({
                state: step.state,
                label: step.label,
                duration: step.duration,
                details: step.details,
                completed: step.completed,
                toolInfo: step.toolInfo
              })) || []}
              agentName={agent?.name || 'Agent'}
              agentAvatarUrl={agent?.avatar_url}
              isCompleted={false}
              className="mb-4"
            />
          );
        }

        // Handle regular messages
        return (
          <div
            key={`${message.role}-${index}-${(() => {
              try {
                if (message.timestamp instanceof Date) {
                  return message.timestamp.toISOString();
                } else if (typeof message.timestamp === 'string' || typeof message.timestamp === 'number') {
                  return String(message.timestamp);
                }
                return index;
              } catch {
                return index;
              }
            })()}`}
            className={`flex items-start space-x-4 animate-fade-in max-w-full ${
              message.role === 'user' ? 'flex-row-reverse space-x-reverse !mb-10' : '!mt-10'
            }`}
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {message.role === 'user' ? (
                <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
              ) : (
                <>
                  {resolvedAvatarUrl ? (
                    <img 
                      src={resolvedAvatarUrl} 
                      alt={agent?.name || 'Agent'}
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        console.warn('Message avatar failed to load:', resolvedAvatarUrl);
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                    style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}
                  >
                    <span className="text-white text-sm font-medium">
                      {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {/* Message Content */}
            <div className={`flex-1 min-w-0 max-w-[70%] overflow-hidden ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}>
              <div className={`mb-1 flex items-center space-x-2 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}>
                <span className="text-sm font-medium text-foreground">
                  {message.role === 'user' ? 'You' : (agent?.name || 'Assistant')}
                </span>
                
                {/* Process button for assistant messages */}
                {message.role === 'assistant' && onShowProcessModal && (
                  <button
                    onClick={() => {
                      console.log('[MessageList] Process button clicked');
                      onShowProcessModal(message.metadata || {});
                    }}
                    className="flex items-center space-x-1 px-2 py-1 bg-muted/50 hover:bg-muted rounded-md transition-colors"
                    title="View processing details"
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Process</span>
                  </button>
                )}
                
                {/* Debug button for assistant messages - Show LLM calls */}
                {message.role === 'assistant' && message.metadata?.processingDetails && onShowDebugModal && (
                  <button
                    onClick={() => {
                      console.log('[MessageList] Debug button clicked for message:', message);
                      onShowDebugModal(message.metadata?.processingDetails);
                    }}
                    className="flex items-center space-x-1 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 rounded-md transition-colors"
                    title="View LLM requests and responses"
                  >
                    <svg className="h-3.5 w-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span className="text-xs font-medium text-purple-500">Debug</span>
                  </button>
                )}
                
                {/* Thoughts and Process buttons for assistant messages - ALWAYS show Process button */}
                {message.role === 'assistant' && false && (
                  <div className="flex items-center space-x-2">
                    {/* Thoughts Dropdown - only show if there are process steps */}
                    {message.metadata?.aiProcessDetails?.steps && message.metadata.aiProcessDetails.steps.length > 0 && (
                      <details className="group">
                        <summary className="flex items-center space-x-1 cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors">
                          <Brain className="h-3 w-3 text-muted-foreground group-open:text-purple-500" />
                          <span className="text-xs text-muted-foreground group-open:text-foreground">
                            Thoughts
                          </span>
                          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="absolute z-50 mt-1 p-3 bg-popover border border-border rounded-lg shadow-lg min-w-80 max-w-96">
                          <div className="text-xs space-y-2">
                            {message.metadata.aiProcessDetails.steps.map((step: any, idx: number) => (
                              <div key={idx} className="border-b border-border pb-2 last:border-0">
                                <div className="font-medium text-foreground">{step.label}</div>
                                {step.details && <div className="text-muted-foreground mt-1">{step.details}</div>}
                                {step.duration && <div className="text-muted-foreground/70 mt-1">{step.duration}ms</div>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    )}
                    
                    {/* Process Button - ALWAYS show for assistant messages */}
                    {onShowProcessModal && (
                      <button
                        onClick={() => {
                          console.log('[MessageList] Process button clicked for message:', message);
                          onShowProcessModal(message.metadata?.processingDetails || { conversation_id: message.metadata?.conversation_id });
                        }}
                        className="flex items-center space-x-1 cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-0.5 transition-colors"
                        title="View detailed processing information"
                      >
                        <BarChart3 className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Process</span>
                      </button>
                    )}
                    
                    {/* Debug Button - Show LLM calls and responses */}
                    {message.metadata?.processingDetails && onShowDebugModal && (
                      <button
                        onClick={() => {
                          console.log('[MessageList] Debug button clicked for message:', message);
                          onShowDebugModal(message.metadata?.processingDetails);
                        }}
                        className="flex items-center space-x-1 cursor-pointer hover:bg-purple-500/20 rounded-md px-1.5 py-0.5 transition-colors"
                        title="View LLM requests and responses"
                      >
                        <svg className="h-3 w-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                        </svg>
                        <span className="text-xs text-purple-500">Debug</span>
                      </button>
                    )}
                  </div>
                )}
                
                <span className="text-xs text-muted-foreground">
                  {(() => {
                    const timestamp = message.timestamp;
                    if (!timestamp) return '';
                    
                    // Handle different timestamp formats
                    let date: Date;
                    if (timestamp instanceof Date) {
                      date = timestamp;
                    } else if (typeof timestamp === 'string') {
                      date = new Date(timestamp);
                    } else if (typeof timestamp === 'number') {
                      date = new Date(timestamp);
                    } else {
                      return '';
                    }
                    
                    // Check if date is valid
                    if (isNaN(date.getTime())) {
                      return '';
                    }
                    
                    return date.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    });
                  })()}
                </span>
              </div>
            <div className={`text-left break-words overflow-wrap-anywhere ${
                message.role === 'user' 
                  ? 'bg-[#343541] text-white px-4 py-2.5 rounded-2xl inline-block max-w-full' 
                  : 'text-foreground w-full'
              }`}>
                {message.role === 'assistant' ? (
                  <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere
                    prose-headings:mt-4 prose-headings:mb-3 prose-headings:font-semibold
                    prose-p:my-3 prose-p:leading-7 prose-p:break-words prose-p:overflow-wrap-anywhere
                    prose-ul:my-3 prose-ul:pl-6 prose-ul:list-disc prose-ul:space-y-2
                    prose-ol:my-3 prose-ol:pl-6 prose-ol:list-decimal prose-ol:space-y-2
                    prose-li:my-1 prose-li:leading-7 prose-li:break-words prose-li:overflow-wrap-anywhere
                    prose-pre:my-4 prose-pre:p-4 prose-pre:bg-muted prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:max-w-full prose-pre:break-all prose-pre:whitespace-pre-wrap
                    prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-muted prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:break-words
                    prose-blockquote:border-l-4 prose-blockquote:border-muted-foreground/30 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:my-4
                    prose-strong:font-semibold prose-strong:text-foreground
                    prose-a:text-primary prose-a:underline prose-a:underline-offset-2 prose-a:break-words
                    prose-hr:my-6 prose-hr:border-muted-foreground/30
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        // Custom paragraph renderer to ensure spacing and proper word breaking
                        p: ({children}: any) => (
                          <p className="my-3 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</p>
                        ),
                        // Custom list renderers
                        ul: ({children}: any) => (
                          <ul className="my-3 pl-6 list-disc space-y-2">{children}</ul>
                        ),
                        ol: ({children}: any) => (
                          <ol className="my-3 pl-6 list-decimal space-y-2">{children}</ol>
                        ),
                        li: ({children}: any) => (
                          <li className="my-1 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</li>
                        ),
                        // Headers with spacing
                        h1: ({children}: any) => (
                          <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>
                        ),
                        h2: ({children}: any) => (
                          <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>
                        ),
                        h3: ({children}: any) => (
                          <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
                        ),
                        // Ensure code blocks render properly with proper overflow handling
                        code: ({node, inline, className, children, ...props}: any) => {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <pre className="my-4 p-4 bg-muted rounded-lg overflow-x-auto max-w-full">
                              <code className={`text-sm font-mono break-all whitespace-pre-wrap ${className}`} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code className="px-1.5 py-0.5 bg-muted rounded text-sm font-mono break-all" {...props}>
                              {children}
                            </code>
                          );
                        },
                        // Links
                        a: ({href, children}: any) => (
                          <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                        // Horizontal rule
                        hr: () => (
                          <hr className="my-6 border-muted-foreground/30" />
                        ),
                      }}
                    >
                      {formatMarkdown(message.content)}
                    </ReactMarkdown>
                    
                    {/* Render Artifact Cards for assistant messages */}
                    {(() => {
                      const artifacts = getArtifactsFromMessage(message);
                      if (artifacts.length > 0) {
                        return (
                          <div className="mt-4 space-y-2">
                            {artifacts.map((artifact) => (
                              <ArtifactCard
                                key={artifact.id}
                                artifact={artifact}
                                onOpenCanvas={handleOpenCanvas}
                                onDownload={downloadArtifact}
                              />
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Render Tool User Input Card if tool requires additional input */}
                    {message.metadata?.requires_user_input && message.metadata?.user_input_request && (
                      <div className="mt-4">
                        <ToolUserInputCard
                          request={{
                            id: message.id || '',
                            tool_name: message.metadata.user_input_request.tool_name,
                            tool_call_id: message.metadata.tool_call_id || `tool_${Date.now()}`,
                            reason: message.metadata.user_input_request.reason,
                            required_fields: message.metadata.user_input_request.required_fields,
                            status: 'pending'
                          }}
                          onSubmit={async (toolCallId: string, inputs: Record<string, any>) => {
                            try {
                              // Store the user input in the database
                              await supabase.functions.invoke('tool-user-input', {
                                body: {
                                  action: 'submit_response',
                                  tool_call_id: toolCallId,
                                  user_inputs: inputs
                                }
                              });
                              
                              // The LLM just needs to know the user provided this info
                              // Format it as a continuation message with the tool parameters
                              const inputSummary = Object.entries(inputs)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(', ');
                              
                              // Simply tell the LLM to retry with these parameters
                              // The existing retry mechanism will handle the rest
                              console.log('[ToolUserInput] User provided:', inputSummary);
                              console.log('[ToolUserInput] The LLM will see this in conversation context and retry automatically');
                              
                              // Force a re-render to show the completed state
                              window.dispatchEvent(new CustomEvent('user-input-submitted', { 
                                detail: { toolCallId, inputs } 
                              }));
                            } catch (error) {
                              console.error('[ToolUserInput] Failed to submit user input:', error);
                              throw error;
                            }
                          }}
                          onCancel={(toolCallId: string) => {
                            console.log('[ToolUserInput] User cancelled input request:', toolCallId);
                            // TODO: Mark the request as cancelled
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Copy and Audio Buttons for assistant messages */}
                    <div className="mt-3 flex items-center justify-start gap-2">
                      <button
                        onClick={(e) => {
                          navigator.clipboard.writeText(message.content);
                          const button = e.currentTarget;
                          const icon = button.querySelector('svg');
                          if (icon) {
                            icon.innerHTML = '<path d="M20 6L9 17l-5-5"></path>'; // Checkmark icon
                            button.classList.add('text-green-500');
                            setTimeout(() => {
                              icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>'; // Copy icon
                              button.classList.remove('text-green-500');
                            }, 2000);
                          }
                        }}
                        className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors p-1.5 rounded-md hover:bg-muted/50"
                        title="Copy message"
                      >
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="1.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                      </button>
                      <MessageAudioButton 
                        text={message.content} 
                        className="!opacity-100 hover:bg-muted/50 p-1.5 rounded-md"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                    {/* Display attachment indicators for user messages */}
                    {message.role === 'user' && message.metadata?.attachments && message.metadata.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {message.metadata.attachments.map((attachment: any, idx: number) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-md text-xs"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span className="font-medium truncate max-w-[120px]" title={attachment.name}>
                              {attachment.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="w-full">
                      <span className="break-words overflow-wrap-anywhere">{message.content}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Canvas Mode Modal */}
    {canvasArtifact && (
      <CanvasMode
        artifact={canvasArtifact}
        onClose={() => setCanvasArtifact(null)}
        onSave={handleSaveArtifact}
        onDownload={downloadArtifact}
        messages={messages}
        agent={agent}
        user={user}
        onSendMessage={async (message) => {
          if (onCanvasSendMessage && canvasArtifact) {
            await onCanvasSendMessage(message, canvasArtifact.id);
          }
        }}
        thinkingMessageIndex={thinkingMessageIndex}
        currentProcessingDetails={currentProcessingDetails}
        aiState={aiState}
        currentTool={currentTool}
        processSteps={processSteps}
      />
    )}
    </>
  );
}

interface ChatStarterScreenProps {
  agent: Agent | null;
  user?: any;
}

export function ChatStarterScreen({ agent, user }: ChatStarterScreenProps) {
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const [firstName, setFirstName] = React.useState('');
  
  // Fetch user's first name from profile
  React.useEffect(() => {
    const fetchFirstName = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', user.id)
        .single();
      
      if (profile?.first_name) {
        setFirstName(profile.first_name);
      } else if (user?.email) {
        setFirstName(user.email.split('@')[0]);
      } else {
        setFirstName('there');
      }
    };
    
    fetchFirstName();
  }, [user?.id, user?.email]);
  
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md mx-auto px-6 animate-fade-in">
        {resolvedAvatarUrl ? (
          <img 
            src={resolvedAvatarUrl} 
            alt={agent?.name || 'Agent'}
            className="w-16 h-16 rounded-full object-cover mx-auto mb-6 shadow-lg"
            onError={(e) => {
              console.warn('Avatar image failed to load:', resolvedAvatarUrl);
              // Hide the broken image and show fallback
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        <div 
          className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
          style={{ display: resolvedAvatarUrl ? 'none' : 'flex' }}
        >
          <span className="text-white text-xl font-medium">
            {agent?.name?.charAt(0)?.toUpperCase() || 'A'}
          </span>
        </div>
        <h2 className="text-xl font-medium text-muted-foreground mb-2">
          {agent?.name || 'Agent'}
        </h2>
        <h3 className="text-4xl font-semibold text-foreground">
          Hi {firstName || 'there'}, How Can I Help?
        </h3>
      </div>
    </div>
  );
}
