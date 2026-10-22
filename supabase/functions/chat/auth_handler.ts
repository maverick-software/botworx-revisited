import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.7';
import { RateLimiter } from 'npm:limiter@3.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ChatRequestBody {
    agentId: string | null; // Can be null if message is just from user
    message: string;
    authorId?: string; // Keep if used elsewhere
    workspaceId?: string; // NEW - ID of the workspace
    channelId?: string; // NEW - ID of the channel within the workspace
}

interface AuthenticationResult {
  success: boolean;
  userId?: string;
  error?: string;
  statusCode?: number;
}

interface ValidationResult {
  success: boolean;
  data?: ChatRequestBody;
  error?: string;
  statusCode?: number;
}

/**
 * Handles CORS preflight requests
 * @param req - The incoming request
 * @returns Response with CORS headers if OPTIONS request
 */
export function handleCORS(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

/**
 * Authenticates the user from the request authorization header
 * @param req - The incoming request
 * @param supabaseClient - Supabase client instance
 * @returns Authentication result with user ID or error
 */
export async function authenticateUser(
  req: Request, 
  supabaseClient: SupabaseClient
): Promise<AuthenticationResult> {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'Missing or invalid authorization header',
        statusCode: 401
      };
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return {
        success: false,
        error: 'Authentication failed',
        statusCode: 401
      };
    }

    return {
      success: true,
      userId: user.id
    };
  } catch (error) {
    console.error('Unexpected authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
      statusCode: 401
    };
  }
}

/**
 * Checks rate limiting for the request
 * @param rateLimiter - Rate limiter instance
 * @returns Boolean indicating if request is within rate limits
 */
export function checkRateLimit(rateLimiter: RateLimiter): boolean {
  return rateLimiter.tryRemoveTokens(1);
}

/**
 * Validates and parses the request body
 * @param req - The incoming request
 * @returns Validation result with parsed data or error
 */
export async function validateRequestBody(req: Request): Promise<ValidationResult> {
  try {
    const reqData: ChatRequestBody = await req.json();
    
    if (!reqData.message?.trim()) {
      return {
        success: false,
        error: 'Message content is required.',
        statusCode: 400
      };
    }

    return {
      success: true,
      data: reqData
    };
  } catch (error) {
    console.error('Error parsing request body:', error);
    return {
      success: false,
      error: 'Invalid request body',
      statusCode: 400
    };
  }
}

/**
 * Creates an error response with CORS headers
 * @param message - Error message
 * @param statusCode - HTTP status code
 * @returns Response object with error and CORS headers
 */
export function createErrorResponse(message: string, statusCode: number = 500): Response {
  return new Response(
    JSON.stringify({ error: message }), 
    { 
      status: statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Creates a success response with CORS headers
 * @param data - Response data
 * @param statusCode - HTTP status code
 * @returns Response object with data and CORS headers
 */
export function createSuccessResponse(data: any, statusCode: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { 
      status: statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
} 