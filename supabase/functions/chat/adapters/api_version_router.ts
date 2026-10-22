// API Version Router for Backward Compatibility
// Routes requests to appropriate handlers based on API version

import { createErrorResponse, createSuccessResponse } from '../auth_handler.ts';
import { MessageFormatAdapter } from './message_adapter.ts';
import { FeatureFlags, getFeatureFlags } from './feature_flags.ts';
import { ChatRequestV2, AdvancedChatMessage } from '../types/message.types.ts';

// Legacy types for V1 API
interface ChatRequestV1 {
  message?: string;
  agentId?: string;
  channelId?: string;
  workspaceId?: string;
}

interface ChatResponseV1 {
  message: string;
  agent?: {
    id: string;
    name: string;
  };
  success?: boolean;
}

interface ChatResponseV2 {
  version: string;
  message: AdvancedChatMessage;
  session: {
    id: string;
    conversation_id: string;
    message_count: number;
  };
  metadata: {
    processing_time_ms: number;
    tokens_used: number;
    model: string;
  };
}

/**
 * API Version Router - handles version negotiation and routing
 */
export class APIVersionRouter {
  private featureFlags: FeatureFlags;
  
  constructor() {
    this.featureFlags = getFeatureFlags();
  }
  
  /**
   * Determine API version from request
   */
  static detectVersion(req: Request): string {
    // Check explicit version header
    const versionHeader = req.headers.get('X-API-Version');
    if (versionHeader) return versionHeader;
    
    // Check accept header for version
    const acceptHeader = req.headers.get('Accept');
    if (acceptHeader?.includes('application/vnd.agentopia.v2+json')) return '2.0';
    if (acceptHeader?.includes('application/vnd.agentopia.v1+json')) return '1.0';
    
    // Check URL for version
    const url = new URL(req.url);
    if (url.pathname.includes('/v2/')) return '2.0';
    if (url.pathname.includes('/v1/')) return '1.0';
    
    // Default to V2 by design
    return '2.0';
  }
  
  /**
   * Route request to appropriate handler
   */
  async routeRequest(
    req: Request, 
    v1Handler: (req: Request) => Promise<Response>,
    v2Handler: (req: Request) => Promise<Response>
  ): Promise<Response> {
    const version = APIVersionRouter.detectVersion(req);
    
    console.log(`[APIRouter] Detected API version: ${version}`);
    
    // Version-specific routing
    switch (version.split('.')[0]) {
      case '1':
        return this.handleV1Request(req, v1Handler);
      case '2':
        return this.handleV2Request(req, v2Handler);
      default:
        return createErrorResponse(
          `Unsupported API version: ${version}. Supported versions: 1.0, 2.0`,
          400
        );
    }
  }
  
  /**
   * Handle V1 API request
   */
  private async handleV1Request(
    req: Request,
    handler: (req: Request) => Promise<Response>
  ): Promise<Response> {
    try {
      // Log V1 usage for migration tracking
      console.log('[APIRouter] Processing V1 request');
      
      // Execute V1 handler
      const response = await handler(req);
      
      // Add version header to response
      const headers = new Headers(response.headers);
      headers.set('X-API-Version', '1.0');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error('[APIRouter] V1 handler error:', error);
      return createErrorResponse('Internal server error', 500);
    }
  }
  
  /**
   * Handle V2 API request
   */
  private async handleV2Request(
    req: Request,
    handler: (req: Request) => Promise<Response>
  ): Promise<Response> {
    try {
      // Check if V2 is enabled
      if (!this.featureFlags.use_advanced_messages) {
        return createErrorResponse(
          'API v2 is currently disabled. Please use v1 or contact support.',
          503
        );
      }
      
      console.log('[APIRouter] Processing V2 request');
      
      // Execute V2 handler
      const response = await handler(req);
      
      // Add version headers to response
      const headers = new Headers(response.headers);
      headers.set('X-API-Version', '2.0');
      headers.set('X-Features-Enabled', JSON.stringify({
        memory: this.featureFlags.enable_memory_system,
        state: this.featureFlags.enable_state_management,
        streaming: this.featureFlags.enable_streaming_responses,
      }));
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error('[APIRouter] V2 handler error:', error);
      return createErrorResponse('Internal server error', 500);
    }
  }
  
  /**
   * Convert request between versions
   */
  static async convertRequest(
    req: Request,
    fromVersion: string,
    toVersion: string
  ): Promise<any> {
    const body = await req.json();
    
    if (fromVersion === '1.0' && toVersion === '2.0') {
      const v1Request = body as ChatRequestV1;
      
      const v2Request: ChatRequestV2 = {
        version: '2.0.0',
        message: {
          role: 'user',
          content: {
            type: 'text',
            text: v1Request.message || '',
          },
          context: {
            agent_id: v1Request.agentId,
            channel_id: v1Request.channelId,
            workspace_id: v1Request.workspaceId,
          },
        },
      };
      
      return v2Request;
    }
    
    if (fromVersion === '2.0' && toVersion === '1.0') {
      const v2Request = body as ChatRequestV2;
      
      const v1Request: ChatRequestV1 = {
        message: v2Request.message.content?.text || 
                 JSON.stringify(v2Request.message.content),
        agentId: v2Request.message.context?.agent_id,
        channelId: v2Request.message.context?.channel_id,
        workspaceId: v2Request.message.context?.workspace_id,
      };
      
      return v1Request;
    }
    
    throw new Error(`Unsupported version conversion: ${fromVersion} to ${toVersion}`);
  }
  
  /**
   * Convert response between versions
   */
  static convertResponse(
    response: any,
    fromVersion: string,
    toVersion: string,
    additionalData?: any
  ): any {
    if (fromVersion === '2.0' && toVersion === '1.0') {
      const v2Response = response as ChatResponseV2;
      
      const v1Response: ChatResponseV1 = {
        message: MessageFormatAdapter.toV1(v2Response.message).content,
        agent: v2Response.message.context.agent_id ? {
          id: v2Response.message.context.agent_id,
          name: additionalData?.agentName || 'Agent',
        } : undefined,
        success: true,
      };
      
      return v1Response;
    }
    
    if (fromVersion === '1.0' && toVersion === '2.0') {
      const v1Response = response as ChatResponseV1;
      
      // This is a simplified conversion - in practice, you'd need more context
      const v2Response: Partial<ChatResponseV2> = {
        version: '2.0',
        message: MessageFormatAdapter.toV2({
          role: 'assistant',
          content: v1Response.message,
          timestamp: new Date().toISOString(),
          agentName: v1Response.agent?.name,
        }) as AdvancedChatMessage,
        metadata: {
          processing_time_ms: 0,
          tokens_used: Math.ceil(v1Response.message.length / 4),
          model: 'gpt-4',
        },
      };
      
      return v2Response;
    }
    
    return response; // Return as-is if same version
  }
  
  /**
   * Create a version-aware response
   */
  static createVersionedResponse(
    req: Request,
    data: any,
    fromVersion: string
  ): Response {
    const targetVersion = APIVersionRouter.detectVersion(req);
    
    // Convert response if needed
    const responseData = APIVersionRouter.convertResponse(
      data,
      fromVersion,
      targetVersion
    );
    
    return createSuccessResponse(responseData);
  }
}