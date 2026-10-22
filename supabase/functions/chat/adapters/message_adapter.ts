// Message Format Adapter
// V2 Chat System Only - V1 deprecated and removed

import { 
  AdvancedChatMessage, 
  MessageContent, 
  MessageRole,
  MessageMetadata,
  MessageContext 
} from '../types/message.types.ts';
import { ChatMessage } from '../context_builder.ts';
import { generateMessageId, generateConversationId, generateTimestamp } from '../types/utils.ts';

/**
 * Adapter for V2 message format
 */
export class MessageFormatAdapter {
  /**
   * Convert legacy ChatMessage to V2 format (for internal compatibility)
   */
  static toV2(
    oldMessage: ChatMessage, 
    context?: Partial<MessageContext>
  ): Partial<AdvancedChatMessage> {
    // Handle content that might be a string or object
    const contentStr = typeof oldMessage.content === 'string' 
      ? oldMessage.content 
      : (oldMessage.content?.text || JSON.stringify(oldMessage.content));
    
    // Create V2 message structure
    const v2Message: Partial<AdvancedChatMessage> = {
      id: generateMessageId(),
      version: '2.0.0',
      role: oldMessage.role as MessageRole,
      content: {
        type: 'text',
        text: contentStr,
        tokens: Math.ceil(contentStr.length / 4), // Simple estimation
      },
      timestamp: oldMessage.timestamp || generateTimestamp(),
      created_at: oldMessage.timestamp || generateTimestamp(),
      metadata: {},
      context: {
        conversation_id: context?.conversation_id || generateConversationId(),
        session_id: context?.session_id || generateConversationId(),
        ...context,
        agent_id: oldMessage.agentName ? context?.agent_id : undefined,
      },
    };
    
    // Add agent context if available
    if (oldMessage.agentName) {
      v2Message.metadata!.original_agent_name = oldMessage.agentName;
    }
    
    return v2Message;
  }
  
  /**
   * Validate if a message is V2 format
   */
  static isV2Message(message: any): message is AdvancedChatMessage {
    return (
      message &&
      typeof message === 'object' &&
      'version' in message &&
      message.version.startsWith('2.') &&
      'content' in message &&
      typeof message.content === 'object' &&
      'type' in message.content
    );
  }
}

/**
 * Simple adapter wrapper for easier instance-based usage
 */
export class MessageAdapter {
  /**
   * Build V2 request from legacy format (for internal compatibility)
   */
  v1ToV2(v1Request: any): any {
    // Support both camelCase (agentId) and snake_case (agent_id) for backward compatibility
    const agentId = v1Request.agentId || v1Request.agent_id;
    const userId = v1Request.userId || v1Request.user_id;
    const conversationId = v1Request.conversationId || v1Request.conversation_id;
    const sessionId = v1Request.sessionId || v1Request.session_id;
    const channelId = v1Request.channelId || v1Request.channel_id;
    
    // Get the last message from V1 request (the actual user message)
    const messages = v1Request.messages || [];
    const lastMessage = messages[messages.length - 1];
    
    // Create a proper V2 message
    const v2Message = lastMessage ? MessageFormatAdapter.toV2(lastMessage, {
      conversation_id: conversationId || generateConversationId(),
      session_id: sessionId || generateConversationId(),
      user_id: userId || undefined,
      agent_id: agentId || undefined,
    }) : {
      id: generateMessageId(),
      version: '2.0.0',
      role: 'user',
      content: {
        type: 'text',
        text: v1Request.message || '',
        tokens: 0,
      },
      timestamp: generateTimestamp(),
      context: {
        conversation_id: conversationId || generateConversationId(),
        session_id: sessionId || generateConversationId(),
        user_id: userId || undefined,
        agent_id: agentId || undefined,
      },
      metadata: {},
    };
    
    // Build context object, omitting null/undefined values
    const context: any = {
      agent_id: agentId || undefined,
      user_id: userId || undefined,
      conversation_id: conversationId || generateConversationId(),
      session_id: sessionId || generateConversationId(),
    };
    
    // Only include channel_id if it's not null/undefined
    if (v1Request.channelId) {
      context.channel_id = v1Request.channelId;
    }
    
    return {
      version: '2.0.0',
      message: v2Message,
      context,
      options: {
        response: {
          stream: v1Request.stream || false,
          include_metadata: true,
          include_metrics: true,
          max_tokens: v1Request.max_tokens,
        },
        memory: {
          enabled: true,
          types: ['episodic', 'semantic'],
          max_results: 10,
          min_relevance: 0.3,
        },
        state: {
          save_checkpoint: false,
          include_shared: true,
        },
        tools: {
          enabled: true,
          parallel_execution: true,
          timeout_ms: 30000,
        },
        context: {
          max_messages: v1Request.options?.context?.max_messages || 20,
          token_limit: 4000,
        },
        reasoning: {
          enabled: true,
          mode: 'summary',
          threshold: 0.6,
          max_steps: 6,
          max_tool_calls: 3,
        },
      },
    };
  }
  
  /**
   * Extract message content from V2 response
   */
  v2ToV1Response(v2Response: any): any {
    // Extract the actual message content
    let messageContent = '';
    
    if (v2Response.data?.message?.content) {
      const content = v2Response.data.message.content;
      if (content.type === 'text') {
        messageContent = content.text;
      } else if (typeof content === 'string') {
        messageContent = content;
      }
    } else if (v2Response.message?.content) {
      const content = v2Response.message.content;
      if (content.type === 'text') {
        messageContent = content.text;
      } else if (typeof content === 'string') {
        messageContent = content;
      }
    } else if (typeof v2Response.message === 'string') {
      messageContent = v2Response.message;
    }
    
    return {
      message: messageContent,
      agent: {
        id: v2Response.data?.message?.context?.agent_id || v2Response.message?.context?.agent_id,
        name: 'AI Assistant',
      },
      conversationId: v2Response.data?.conversation?.id || v2Response.message?.context?.conversation_id,
      sessionId: v2Response.data?.session?.id || v2Response.message?.context?.session_id,
      metrics: v2Response.metrics,
      processing_details: v2Response.processing_details, // Pass through detailed processing info
    };
  }
}
