import React, { useRef, useCallback, useEffect } from 'react';
import { Send, Paperclip, Sliders, X, FileText, Mic, AudioLines } from 'lucide-react';
import type { Database } from '../../types/database.types';
import { VoiceInputButton } from '@/components/voice/VoiceInputButton';
import { cn } from '@/lib/utils';

export type ChatMode = 'text' | 'voice' | 'realtime';

type Agent = Database['public']['Tables']['agents']['Row'];

interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadStatus: 'uploading' | 'completed' | 'error';
  tempId?: string; // Temporary ID used during upload
}

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  agent: Agent | null;
  sending: boolean;
  uploading: boolean;
  uploadProgress: {[key: string]: number};
  attachedDocuments?: AttachedDocument[];
  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
  onSubmit: (e: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFileUpload: (files: FileList, type: 'document' | 'image') => void;
  onRemoveAttachment?: (documentId: string) => void;
  adjustTextareaHeight: () => void;
  onShowAgentSettings?: () => void;
}

export function ChatInput({ 
  input, 
  setInput, 
  agent, 
  sending, 
  uploading, 
  uploadProgress, 
  attachedDocuments = [],
  chatMode = 'text',
  onChatModeChange,
  onSubmit, 
  onKeyDown, 
  onFileUpload,
  onRemoveAttachment,
  adjustTextareaHeight,
  onShowAgentSettings
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [input, resizeTextarea]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  }, [setInput, adjustTextareaHeight]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files, 'document'); // Default to document type
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, [onFileUpload]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex-shrink-0 bg-background pb-6">
      <div className="max-w-3xl mx-auto px-4 py-2">
        {/* ChatGPT-style document attachments display */}
        {attachedDocuments.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-2">
              {attachedDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                    doc.uploadStatus === 'completed' 
                      ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200' 
                      : doc.uploadStatus === 'uploading'
                      ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200'
                      : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
                  }`}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate max-w-[200px]" title={doc.name}>
                      {doc.name}
                    </span>
                    <span className="text-xs opacity-75">
                      {doc.uploadStatus === 'uploading' ? 'Uploading...' : formatFileSize(doc.size)}
                    </span>
                  </div>
                  {doc.uploadStatus === 'completed' && onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(doc.id)}
                      className="p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {doc.uploadStatus === 'uploading' && (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="relative">
          {/* Text input container - Expanding textarea with clean scrollbar */}
          <div className="relative bg-card border border-border/50 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 focus-within:border-ring/40 focus-within:shadow-md">
            <div className="px-4 py-3 flex items-start gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={onKeyDown}
                placeholder={`Message ${agent?.name || 'Agent'}...`}
                className="flex-1 resize-none bg-transparent text-foreground placeholder-muted-foreground/60 border-0 outline-none text-[15px] leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed scrollbar-thin"
                disabled={!agent}
                rows={1}
                style={{ 
                  minHeight: '24px', 
                  maxHeight: '200px',
                  overflowY: 'hidden'
                }}
              />
            </div>
            
            {/* Tools row - Inside container with visual separation */}
            <div className="flex items-center justify-between px-3 pb-2 pt-0 border-t border-border/20">
            {/* Left side tools */}
            <div className="flex items-center space-x-1">
              {/* File attachment */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.html,.rtf,.odt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-foreground/70 hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                disabled={!agent || uploading}
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Settings/Tools button */}
              {onShowAgentSettings && (
                <button
                  type="button"
                  onClick={onShowAgentSettings}
                  className="p-2 text-foreground/70 hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                  disabled={!agent}
                  title="Agent Settings"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              )}

              {/* Upload progress indicator */}
              {uploading && Object.keys(uploadProgress).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Uploading... {Math.round(Object.values(uploadProgress)[0] || 0)}%
                </div>
              )}
            </div>

              {/* Right side - Voice modes and Send button */}
              <div className="flex items-center space-x-1">
                {/* Voice input button - triggers recording */}
                <VoiceInputButton
                  onTranscription={(text) => {
                    setInput(text);
                    adjustTextareaHeight();
                  }}
                  disabled={!agent}
                  className="p-2 rounded-lg transition-colors text-foreground/70 hover:text-foreground hover:bg-accent"
                />

                {/* Real-time voice mode button */}
                {onChatModeChange && (
                  <button
                    type="button"
                    onClick={() => onChatModeChange('realtime')}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      chatMode === 'realtime'
                        ? 'text-foreground bg-accent'
                        : 'text-foreground/70 hover:text-foreground hover:bg-accent'
                    )}
                    disabled={!agent}
                    title="Real-time voice mode"
                  >
                    <AudioLines className="w-4 h-4" />
                  </button>
                )}

                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() || !agent || sending}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
