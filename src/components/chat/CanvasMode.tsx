/**
 * CanvasMode Component
 * Split-screen layout with chat on left and Monaco editor on right
 */

import React, { useState, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import Split from 'react-split';
import {
  X,
  Download,
  Send,
  Paperclip,
  Sliders,
  FileText,
  X as CloseIcon,
  Code
} from 'lucide-react';
import { CanvasModeProps, ARTIFACT_LANGUAGE_MAP } from '@/types/artifacts';
import { toast } from 'react-hot-toast';
import type { Message } from '@/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMediaLibraryUrl } from '@/hooks/useMediaLibraryUrl';
import { useCanvasSession } from '@/hooks/useCanvasSession';
import { InlineThinkingIndicator } from '../InlineThinkingIndicator';
import { Sidebar } from '@/components/Sidebar';

export const CanvasMode: React.FC<CanvasModeProps> = ({
  artifact,
  onClose,
  onSave,
  onDownload,
  messages = [],
  agent,
  user,
  onSendMessage,
  thinkingMessageIndex,
  currentProcessingDetails,
  aiState,
  currentTool,
  processSteps
}) => {
  const [content, setContent] = useState(artifact.content);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [canvasInput, setCanvasInput] = useState('');
  const [localMessages, setLocalMessages] = useState(messages);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true); // Always collapsed in canvas mode
  const resolvedAvatarUrl = useMediaLibraryUrl(agent?.avatar_url);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [selectionMenuPosition, setSelectionMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const editorRef = React.useRef<any>(null);
  const [selectedContexts, setSelectedContexts] = useState<Array<{ 
    id: string;
    text: string; 
    lines: string; 
    language: string;
  }>>([]);

  // Canvas session for auto-saving work-in-progress
  const canvasSession = useCanvasSession({
    userId: user?.id || '',
    agentId: agent?.id || '',
    artifactId: artifact.id,
    conversationSessionId: null, // TODO: Pass actual conversation session ID if available
    autoSaveInterval: 3000 // 3 seconds
  });

  // Sync content when artifact prop changes (after successful save)
  useEffect(() => {
    console.log('[Canvas] Artifact changed - syncing content', {
      newContent: artifact.content?.substring(0, 100),
      newVersion: artifact.version,
      currentContent: content?.substring(0, 100)
    });
    setContent(artifact.content);
  }, [artifact.content, artifact.version]); // Re-sync when version changes

  // Detect content changes
  useEffect(() => {
    const hasChanges = content !== artifact.content;
    console.log('[Canvas] Content change detection', {
      hasChanges,
      contentLength: content?.length,
      artifactContentLength: artifact.content?.length,
      contentPreview: content?.substring(0, 50),
      artifactContentPreview: artifact.content?.substring(0, 50)
    });
    setHasUnsavedChanges(hasChanges);
  }, [content, artifact.content]);

  // Auto-resize textarea when input changes
  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200;
      const newHeight = Math.min(scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, []);

  // Resize on input change
  useEffect(() => {
    resizeTextarea();
  }, [canvasInput, resizeTextarea]);

  // Sync messages from parent
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  // Load canvas session on mount
  useEffect(() => {
    const initSession = async () => {
      if (user?.id && agent?.id) {
        try {
          const savedContent = await canvasSession.loadSession(artifact.content);
          if (savedContent && savedContent !== artifact.content) {
            setContent(savedContent);
            toast.info('Restored your previous work-in-progress');
          }
        } catch (error) {
          console.error('[Canvas] Error loading session:', error);
          // Continue with artifact content
        }
      }
    };
    initSession();
  }, []); // Only run once on mount

  // Auto-save to canvas session (not artifacts)
  useEffect(() => {
    if (content && user?.id && agent?.id && canvasSession.session) {
      canvasSession.autoSave(content);
    }
  }, [content, canvasSession, user?.id, agent?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // Escape to close
      if (e.key === 'Escape') {
        handleClose();
      }
      
      // Ctrl+D or Cmd+D to download
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        onDownload(artifact);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content]);

  const handleSave = async () => {
    console.log('[Canvas] handleSave called!', {
      hasUnsavedChanges,
      contentLength: content?.length,
      isSaving
    });
    
    if (!hasUnsavedChanges) {
      console.log('[Canvas] No unsaved changes, skipping save');
      return;
    }

    console.log('[Canvas] Starting save...', {
      contentLength: content.length,
      contentPreview: content.substring(0, 100)
    });

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      // Save to artifacts (creates new version)
      await onSave(content);
      console.log('[Canvas] Successfully saved to artifacts');
      
      // Clear canvas session after successful artifact save
      await canvasSession.clearSession();
      console.log('[Canvas] Cleared canvas session');
      
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      toast.success('Saved to database!');
      
      // Reset success indicator after 2 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('[Canvas] Failed to save artifact:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirm) return;
    }
    onClose();
  };

  const handleCanvasSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canvasInput.trim()) return;
    
    // Build message with selected contexts if present
    let messageContent = canvasInput.trim();
    let displayContent = canvasInput.trim();
    
    if (selectedContexts.length > 0) {
      // Build context block with all selections for agent
      const contextBlocks = selectedContexts.map((ctx, idx) => 
        `[Selection ${idx + 1} - ${ctx.lines}]:\n\`\`\`${ctx.language}\n${ctx.text}\n\`\`\``
      ).join('\n\n');
      
      messageContent = `${contextBlocks}\n\n${messageContent}`;
      displayContent = `${contextBlocks}\n\n${messageContent}`; // Show full context in UI too
    }
    
    // Add user message to local state immediately for UI feedback
    const userMessage: any = {
      role: 'user',
      content: displayContent, // Show the full message with selections
      timestamp: new Date()
    };
    setLocalMessages(prev => [...prev, userMessage]);
    
    // Clear input, contexts, and reset height
    setCanvasInput('');
    setSelectedContexts([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // If parent provided a send handler, use it (sends full context to agent)
    if (onSendMessage) {
      try {
        await onSendMessage(messageContent);
      } catch (error) {
        console.error('[Canvas] Error sending message:', error);
        toast.error('Failed to send message');
      }
    } else {
      // Otherwise show info toast
      toast.info('Canvas chat integration coming soon - message added locally');
    }
  };

  const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCanvasSend(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCanvasInput(e.target.value);
  };

  // Handle text selection in Monaco editor
  const handleEditorSelection = (editor: any) => {
    const selection = editor.getSelection();
    
    if (selection && !selection.isEmpty()) {
      const selectedText = editor.getModel().getValueInRange(selection);
      const startLine = selection.startLineNumber;
      const endLine = selection.endLineNumber;
      
      // Use Monaco's layoutContentWidget to get the actual screen position
      // Create a temporary measurement element at the selection position
      const position = selection.getStartPosition();
      
      // Get the coordinates for the position
      const coords = editor.getScrolledVisiblePosition(position);
      
      if (coords) {
        // Get the editor's DOM node bounding rect
        const editorDom = editor.getDomNode();
        const editorRect = editorDom?.getBoundingClientRect();
        
        // Get the scroll offset
        const scrollTop = editor.getScrollTop();
        const scrollLeft = editor.getScrollLeft();
        
        if (editorRect) {
          // Calculate the actual screen position
          // Monaco's coords are relative to the viewport after scrolling
          const menuX = editorRect.left + coords.left;
          const menuY = editorRect.top + coords.top - 45; // 45px above
          
          console.log('[Canvas] Position details:', {
            editorRect: { left: editorRect.left, top: editorRect.top, width: editorRect.width },
            monacoCoords: coords,
            scroll: { top: scrollTop, left: scrollLeft },
            final: { x: menuX, y: menuY }
          });
          
          setSelectedText(selectedText);
          setSelectionRange({ start: startLine, end: endLine });
          setSelectionMenuPosition({ x: menuX, y: menuY });
          setShowSelectionMenu(true);
        }
      }
    } else {
      setShowSelectionMenu(false);
    }
  };

  // Add selected text to chat as a context bubble
  const handleAddToChat = () => {
    // Check if we've reached the limit
    if (selectedContexts.length >= 5) {
      toast.error('Maximum 5 selections allowed');
      setShowSelectionMenu(false);
      return;
    }
    
    const language = ARTIFACT_LANGUAGE_MAP[artifact.file_type] || artifact.file_type;
    const lineInfo = selectionRange 
      ? `Lines ${selectionRange.start}-${selectionRange.end}` 
      : 'Selection';
    
    // Add to contexts array
    const newContext = {
      id: `sel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: selectedText,
      lines: lineInfo,
      language: language
    };
    
    setSelectedContexts(prev => [...prev, newContext]);
    setShowSelectionMenu(false);
    
    // Focus the chat input
    textareaRef.current?.focus();
    
    toast.success(`Selection ${selectedContexts.length + 1}/5 added`);
  };

  // Remove a specific context
  const removeContext = (id: string) => {
    setSelectedContexts(prev => prev.filter(ctx => ctx.id !== id));
  };

  // Clear all contexts
  const clearAllContexts = () => {
    setSelectedContexts([]);
  };

  const editorLanguage = ARTIFACT_LANGUAGE_MAP[artifact.file_type] || 'plaintext';

  // Determine if this is a new artifact or existing
  const isNewArtifact = !artifact.id || artifact.id === 'new';
  const saveButtonText = isNewArtifact ? 'Create Artifact' : 'Save';

  return (
    <div className="fixed inset-0 z-40 bg-[#212121] flex">
      {/* Sidebar - Always collapsed in canvas mode */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      
      {/* Canvas content area */}
      <div className="flex-1 flex flex-col">
        {/* Header - Canvas Mode */}
        <div className="h-12 bg-[#2f2f2f] flex items-center justify-between px-4">
        {/* Left: File name and draft status */}
        <div className="flex items-center gap-3 flex-1">
          <FileText className="h-4 w-4 text-gray-400" />
          <h2 className="font-medium text-sm text-white">{artifact.title}</h2>
          {canvasSession.saving ? (
            <span className="text-xs text-gray-400">
              • Saving draft...
            </span>
          ) : (
            <span className="text-xs text-gray-400">
              • Draft saved
            </span>
          )}
        </div>

        {/* Center: Canvas Mode badge */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <span className="text-xs font-medium text-white">
            Canvas Mode
          </span>
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2 flex-1 justify-end">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              hasUnsavedChanges
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-[#3f3f3f] text-gray-500 cursor-not-allowed'
            }`}
            title={hasUnsavedChanges ? `${saveButtonText} (Ctrl+S)` : 'No changes to save'}
          >
            {isSaving ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Saving...
              </>
            ) : saveSuccess && !hasUnsavedChanges ? (
              <>
                <span className="mr-1">✓</span>
                Saved
              </>
            ) : (
              saveButtonText
            )}
          </button>

          {/* Download Button */}
          <button
            onClick={() => onDownload(artifact)}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-lg transition-colors"
            title="Download file"
          >
            <Download className="h-4 w-4" />
          </button>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-lg transition-colors"
            title="Close canvas"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Adjustable Split Layout */}
      <Split
        className="flex h-[calc(100vh-3rem)]"
        sizes={[30, 70]}
        minSize={[300, 400]}
        gutterSize={12}
        gutterAlign="center"
        snapOffset={30}
        dragInterval={1}
        direction="horizontal"
        cursor="col-resize"
      >
        {/* Left Panel: Chat Interface */}
        <div className="h-full bg-background border-r border-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="space-y-4">
              {localMessages.length > 0 ? (
                localMessages.map((message, index) => {
                  // Handle thinking messages with inline indicator
                  if (message.role === 'thinking') {
                    const isCurrentThinking = index === thinkingMessageIndex && !message.metadata?.isCompleted;
                    if (!isCurrentThinking) {
                      return null; // Hide completed thinking messages
                    }
                    return (
                      <InlineThinkingIndicator
                        key={`thinking-${index}`}
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
                        }))}
                      />
                    );
                  }

                  return (
                  <div
                    key={index}
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
                                console.warn('Canvas avatar failed to load:', resolvedAvatarUrl);
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
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            const timestamp = message.timestamp;
                            if (!timestamp) return '';
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
                            if (isNaN(date.getTime())) return '';
                            return date.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            });
                          })()}
                        </span>
                      </div>
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
                              p: ({children}: any) => (
                                <p className="my-3 leading-7 break-words overflow-wrap-anywhere max-w-full">{children}</p>
                              ),
                              ul: ({children}: any) => (
                                <ul className="my-3 pl-6 list-disc space-y-2">{children}</ul>
                              ),
                              ol: ({children}: any) => (
                                <ol className="my-3 pl-6 list-decimal space-y-2">{children}</ol>
                              ),
                              li: ({children}: any) => (
                                <li className="my-1 leading-7 break-words overflow-wrap-anywhere">{children}</li>
                              )
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="bg-[#343541] text-white rounded-2xl inline-block max-w-full text-left overflow-hidden">
                          <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none break-words overflow-wrap-anywhere px-4 py-2.5
                            prose-headings:mt-2 prose-headings:mb-2 prose-headings:font-semibold
                            prose-p:my-2 prose-p:leading-6 prose-p:break-words prose-p:overflow-wrap-anywhere
                            prose-pre:my-0 prose-pre:p-3 prose-pre:bg-[#2a2b32] prose-pre:rounded prose-pre:overflow-x-auto prose-pre:max-w-full
                            prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-[#2a2b32] prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:break-words prose-code:text-gray-200
                            prose-strong:font-semibold prose-strong:text-white
                            [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({children}: any) => (
                                  <p className="my-2 leading-6 break-words overflow-wrap-anywhere max-w-full">{children}</p>
                                ),
                                code: ({inline, children, ...props}: any) => (
                                  inline 
                                    ? <code className="px-1.5 py-0.5 bg-[#2a2b32] rounded text-xs font-mono text-gray-200" {...props}>{children}</code>
                                    : <code className="block text-xs font-mono text-gray-200" {...props}>{children}</code>
                                )
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-sm mb-2">Continue the conversation</p>
                  <p className="text-xs">Ask the agent to make changes to the document</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Chat Input - exactly matches AgentChatPage style */}
          <div className="border-t border-border px-4 py-4">
            <form onSubmit={handleCanvasSend} className="relative">
              {/* Selected context bubbles */}
              {selectedContexts.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {/* Header with count and clear all */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {selectedContexts.length} selection{selectedContexts.length > 1 ? 's' : ''} ({selectedContexts.length}/5)
                    </span>
                    <button
                      type="button"
                      onClick={clearAllContexts}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  
                  {/* Context bubbles */}
                  {selectedContexts.map((context, idx) => (
                    <div 
                      key={context.id}
                      className="bg-muted/40 border border-border/50 rounded-md px-2.5 py-1.5 flex items-center gap-2"
                    >
                      <Code className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-medium">
                          {idx + 1}. {context.lines}
                        </span>
                        <span className="text-xs text-muted-foreground/70 truncate">
                          {context.text.split('\n')[0]}
                          {context.text.split('\n').length > 1 && '...'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeContext(context.id)}
                        className="flex-shrink-0 p-0.5 hover:bg-muted rounded transition-colors"
                      >
                        <CloseIcon className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Text input container */}
              <div className="relative bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-ring/40 focus-within:shadow-md">
                <div className="px-4 py-3">
                  <textarea
                    ref={textareaRef}
                    value={canvasInput}
                    onChange={handleInputChange}
                    onKeyDown={handleCanvasKeyDown}
                    placeholder="Ask to edit the document..."
                    rows={1}
                    className="w-full resize-none bg-transparent text-foreground placeholder-muted-foreground/60 border-0 outline-none text-[15px] leading-relaxed scrollbar-thin"
                    style={{ 
                      minHeight: '24px',
                      maxHeight: '200px',
                      overflowY: 'hidden'
                    }}
                  />
                </div>
                
                {/* Bottom toolbar - Inside container with visual separation */}
                <div className="flex items-center justify-between px-3 pb-2 pt-0 border-t border-border/20">
                  {/* Left side tools */}
                  <div className="flex items-center space-x-1">
                    {/* File attachment */}
                    <button
                      type="button"
                      onClick={() => toast.info('File attachment coming soon in Canvas mode')}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      title="Attach file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>

                    {/* Settings/Tools button */}
                    <button
                      type="button"
                      onClick={() => toast.info('Canvas settings coming soon')}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      title="Canvas Settings"
                    >
                      <Sliders className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Right side - Send button */}
                  <button
                    type="submit"
                    disabled={!canvasInput.trim()}
                    className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel: Clean Editor - Seamless background */}
        <div className="h-full overflow-hidden bg-background">
          <div className="h-full flex justify-center">
            <div className="w-full max-w-[800px] h-full">
              <Editor
                height="100%"
                language={editorLanguage}
                value={content}
                onChange={(value) => setContent(value || '')}
                onMount={(editor) => {
                  console.log('[Canvas] Monaco editor mounted, setting up selection listener');
                  editorRef.current = editor;
                  
                  // Listen for selection changes
                  editor.onDidChangeCursorSelection(() => {
                    handleEditorSelection(editor);
                  });
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 16,
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  lineDecorationsWidth: 0,
                  lineNumbersMinChars: 0,
                  renderLineHighlight: 'none',
                  scrollbar: {
                    vertical: 'auto',
                    horizontal: 'hidden',
                    useShadows: false,
                    verticalScrollbarSize: 10
                  },
                  rulers: [],
                  wordWrap: 'on',
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 48, bottom: 48, left: 64, right: 64 },
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  tabSize: 2,
                  insertSpaces: true,
                  fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontLigatures: false,
                  cursorStyle: 'line',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                  contextmenu: false,
                  overviewRulerBorder: false,
                  hideCursorInOverviewRuler: true,
                  lineHeight: 24
                }}
              />
            </div>
          </div>
        </div>
      </Split>

      {/* Floating "Add to Chat" button for text selection */}
      {showSelectionMenu && (
        <div
          className="fixed z-50 animate-in fade-in-0 slide-in-from-bottom-1 duration-100"
          style={{
            left: `${selectionMenuPosition.x}px`,
            top: `${selectionMenuPosition.y}px`,
          }}
        >
          <button
            onClick={handleAddToChat}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-md flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Send className="h-3 w-3" />
            Add to Chat
          </button>
        </div>
      )}
      </div>
    </div>
  );
};
