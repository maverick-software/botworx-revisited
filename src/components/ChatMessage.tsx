import React, { useState, useMemo, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clipboard, Check, Settings, Wrench } from 'lucide-react';
import type { Message, ToolCall } from '../types';
import type { WorkspaceMemberDetail } from '@/hooks/useWorkspaceMembers';
import ToolCallIndicator from './ToolCallIndicator';
import { ToolCategorizer } from '@/lib/toolCategorization';
import { MessageAudioButton } from '@/components/voice/MessageAudioButton';

interface ChatMessageProps {
  message: Message;
  members?: WorkspaceMemberDetail[];
}

const formatMentions = (content: string, members: WorkspaceMemberDetail[] = []): React.ReactNode => {
  let formattedContent: React.ReactNode[] = [content];
  
  // Add safety check for members array
  if (!members || !Array.isArray(members) || members.length === 0) {
    return content;
  }
  
  members.forEach(member => {
      if (member.agent?.name) {
          const mentionTag = `@${member.agent.name}`;
          const newFormattedContent: React.ReactNode[] = [];
          formattedContent.forEach(node => {
              if (typeof node === 'string') {
                  const parts = node.split(mentionTag);
                  for (let i = 0; i < parts.length; i++) {
                      newFormattedContent.push(parts[i]);
                      if (i < parts.length - 1) {
                          newFormattedContent.push(<strong key={`${member.id}-${i}`} className="text-primary font-semibold">{mentionTag}</strong>);
                      }
                  }
              } else {
                  newFormattedContent.push(node);
              }
          });
          formattedContent = newFormattedContent;
      }
  });

  return formattedContent;
};

export const ChatMessage = React.memo(function ChatMessage({ message, members = [] }: ChatMessageProps) {
  useEffect(() => {
      if (message.role === 'assistant') {
          console.log('[ChatMessage] Rendering Assistant Message:', message);
          console.log('[ChatMessage] Received Members Prop:', members);
          // Use the correct agentId field from Message interface
          const senderAgentId = message.agentId;
          const foundMember = members?.find(m => m.agent_id === senderAgentId);
          console.log('[ChatMessage] Found Member based on agentId:', foundMember);
      }
  }, [message, members]);

  const [isCopied, setIsCopied] = useState(false);

  // Enhanced agent name lookup - prioritize all possible sources of the agent name
  const agentDisplayName = useMemo(() => {
    // First check if the message already has the agent name property (with type guard)
    const agentName = 'agentName' in message ? (message as any).agentName : null;
    if (agentName) {
      return agentName;
    }
    
    // Next try to find the agent in the members list
    if (message.role === 'assistant' && members && members.length > 0) {
      // Try matching by sender_agent_id if available (with type guard)
      const senderAgentId = 'sender_agent_id' in message ? (message as any).sender_agent_id : null;
      if (senderAgentId) {
        const foundMember = members.find(m => m.agent_id === senderAgentId);
        if (foundMember?.agent?.name) {
          return foundMember.agent.name;
        }
      }
      
      // Try matching by agentId as fallback
      if (message.agentId) {
        const foundByAgentId = members.find(m => m.agent_id === message.agentId);
        if (foundByAgentId?.agent?.name) {
          return foundByAgentId.agent.name;
        }
      }
    }
    
    // Return a default if no agent name was found
    return message.role === 'assistant' ? 'Agent' : null;
  }, [message, members]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 1500);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };

  const formattedContent = useMemo(() => {
      return formatMentions(message.content, members || []);
  }, [message.content, members]);

  return (
    <div
      className={`flex mb-4 ${
        message.role === 'user' ? 'justify-end ml-auto max-w-[85%]' : 'justify-start mr-auto max-w-[85%]'
      }`}
    >
      <div className="flex flex-col space-y-2 w-full">
        {/* Tool calls display - shown above the message */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((toolCall, index) => (
              <ToolCallIndicator
                key={toolCall.id || `tool-${index}`}
                toolCall={{
                  tool_name: toolCall.tool_name,
                  tool_provider: toolCall.tool_provider,
                  parameters: toolCall.parameters,
                  status: toolCall.status,
                  execution_time_ms: toolCall.execution_time_ms,
                  error_message: toolCall.error_message,
                  result: toolCall.result,
                  created_at: toolCall.created_at,
                }}
              />
            ))}
          </div>
        )}

        {/* Main message content */}
      <div
        className={`relative group rounded-lg p-3 text-sm break-words overflow-wrap-anywhere shadow-sm ${
          message.role === 'user'
            ? 'bg-muted/50 text-foreground'
            : 'bg-secondary/50 text-secondary-foreground'
        }`}
      >
          <div className="flex items-start justify-between">
            <div className="flex-1">
        {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-muted-foreground">{agentDisplayName}</p>
                  {message.isToolResponse && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">
                      <Wrench className="w-3 h-3" />
                      <span>Tool Response</span>
                    </div>
                  )}
                </div>
        )}
        <div className="break-words overflow-wrap-anywhere w-full">
          {formattedContent}
        </div>
            </div>
            
          {message.role === 'assistant' && (
            <div className="flex items-center gap-1 ml-2">
              <MessageAudioButton text={message.content} />
              <button
                onClick={handleCopy}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded opacity-50 group-hover:opacity-100"
                title="Copy response"
              >
                {isCopied ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Clipboard className="w-3 h-3" />
                )}
              </button>
            </div>
          )}
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground opacity-80">
                {(() => {
                  try {
                    // Handle multiple timestamp formats
                    let timestamp: Date;
                    
                    if (message.timestamp instanceof Date) {
                      timestamp = message.timestamp;
                    } else if (typeof message.timestamp === 'string') {
                      timestamp = new Date(message.timestamp);
                    } else if (typeof message.timestamp === 'number') {
                      timestamp = new Date(message.timestamp);
                    } else {
                      return '--:--';
                    }
                    
                    // Check if the date is valid
                    if (isNaN(timestamp.getTime())) {
                      return '--:--';
                    }
                    
                    return timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                  } catch (error) {
                    console.warn('Error formatting timestamp:', message.timestamp, error);
                    return '--:--';
                  }
                })()}
              </p>
{/* Smart tool categorization tags */}
              {message.toolCalls && message.toolCalls.length > 0 && (() => {
                // Extract tool names and categorize them
                const toolNames = message.toolCalls.map(tc => tc.function?.name || '').filter(Boolean);
                const allCategories = toolNames.flatMap(toolName => 
                  ToolCategorizer.categorizeByTool(toolName)
                );
                
                // Remove duplicates and get primary categories
                const uniqueCategories = Array.from(
                  new Map(allCategories.map(cat => [cat.id, cat])).values()
                ).slice(0, 2); // Show max 2 categories
                
                // Also analyze message content for additional context
                const contentCategories = ToolCategorizer.categorizeByContent(message.content || '');
                const allCombined = [...uniqueCategories, ...contentCategories];
                const finalCategories = Array.from(
                  new Map(allCombined.map(cat => [cat.id, cat])).values()
                ).slice(0, 2);
                
                if (finalCategories.length > 0) {
                  return (
                    <div className="flex items-center gap-1">
                      {finalCategories.map(category => (
                        <div 
                          key={category.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            category.color === 'blue' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                            category.color === 'green' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                            category.color === 'purple' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                            category.color === 'orange' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300' :
                            category.color === 'red' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300' :
                            category.color === 'cyan' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-300' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300'
                          }`}
                        >
                          <span>{category.icon}</span>
                          <span>{category.label.toLowerCase()}</span>
                        </div>
                      ))}
                    </div>
                  );
                }
                
                // Fallback to generic tool counter if no categories detected
                return (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Settings className="w-3 h-3" />
                    <span>{message.toolCalls.length} tool{message.toolCalls.length !== 1 ? 's' : ''}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;