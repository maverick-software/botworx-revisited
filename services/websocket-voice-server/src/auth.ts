/**
 * Authentication middleware for WebSocket connections
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email?: string;
  };
  error?: string;
}

/**
 * Authenticate a WebSocket connection using a Supabase JWT token
 * @param supabase - Supabase client with service role key
 * @param token - JWT token from client
 * @returns Authentication result with user info or error
 */
export async function authenticateConnection(
  supabase: SupabaseClient,
  token: string
): Promise<AuthResult> {
  try {
    // Verify JWT token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message || 'Invalid token'
      };
    }

    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication error'
    };
  }
}

