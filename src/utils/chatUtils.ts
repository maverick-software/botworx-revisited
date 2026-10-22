import { CHAT_CONSTANTS } from '../constants/chat';

/**
 * Normalize Markdown for consistent initial rendering
 */
export const formatMarkdown = (text: string): string => {
  if (!text) return '';
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isList = /^([-*+]\s|\d+\.\s)/.test(trimmed);
    const isHeader = /^#{1,6}\s/.test(trimmed);
    // Ensure a blank line before lists and headers when missing
    if ((isList || isHeader) && out.length > 0 && out[out.length - 1].trim() !== '') {
      out.push('');
    }
    out.push(line);
  }
  return out.join('\n');
};

/**
 * Scroll to bottom of messages container
 */
export const scrollToBottom = (messagesEndRef: React.RefObject<HTMLDivElement>) => {
  if (messagesEndRef.current) {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }
    });
  }
};

/**
 * Auto-resize textarea based on content with clean scrollbar
 */
export const adjustTextareaHeight = (textareaRef: React.RefObject<HTMLTextAreaElement>) => {
  if (textareaRef.current) {
    // Reset height to auto to get the correct scrollHeight
    textareaRef.current.style.height = 'auto';
    const scrollHeight = textareaRef.current.scrollHeight;
    
    // Set the height, capped at maxHeight
    const newHeight = Math.min(scrollHeight, CHAT_CONSTANTS.MAX_TEXTAREA_HEIGHT);
    textareaRef.current.style.height = `${newHeight}px`;
    
    // Enable overflow when content exceeds maxHeight
    textareaRef.current.style.overflowY = scrollHeight > CHAT_CONSTANTS.MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }
};

/**
 * Generate conversation title from message text
 */
export const generateConversationTitle = (messageText: string): string => {
  const words = messageText.trim().split(/\s+/).slice(0, 6);
  const titleCase = words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return titleCase || 'New Conversation';
};

/**
 * Get localStorage key for agent-specific settings
 */
export const getAgentStorageKey = (agentId: string, setting: string): string => {
  return `agent_${agentId}_${setting}`;
};

/**
 * Check if user is near bottom of scroll container
 */
export const isNearBottom = (container: Element): boolean => {
  return container.scrollTop >= container.scrollHeight - container.clientHeight - CHAT_CONSTANTS.SCROLL_THRESHOLD;
};

/**
 * Validate file for upload
 */
export const validateFile = (file: File, uploadType: 'document' | 'image'): { valid: boolean; error?: string } => {
  // Check file size
  if (file.size > CHAT_CONSTANTS.MAX_FILE_SIZE) {
    return { valid: false, error: `File ${file.name} exceeds 50MB limit` };
  }

  // Check file type
  const allowedTypes = uploadType === 'image' 
    ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    : ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
       'application/msword', 'text/plain', 'application/vnd.ms-powerpoint', 
       'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} not supported for ${uploadType} upload` };
  }

  return { valid: true };
};
