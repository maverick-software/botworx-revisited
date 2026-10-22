/**
 * Credential status utilities for checking OAuth token validity
 */

import { CredentialStatus } from './types.ts';

/**
 * Determines the status of a credential based on connection status and token expiration
 */
export function getCredentialStatus(credential: any): CredentialStatus {
  // Check if connection status is explicitly set to expired or error
  if (credential.connection_status === 'expired') {
    return {
      status: 'expired',
      error_message: 'OAuth token has expired. Please re-authorize this integration.'
    };
  }
  
  if (credential.connection_status === 'error') {
    return {
      status: 'error',
      error_message: 'Integration connection has an error. Please check your credentials.'
    };
  }
  
  // Check if OAuth token is expired based on timestamp
  if (credential.token_expires_at) {
    const expiresAt = new Date(credential.token_expires_at);
    const now = new Date();
    
    if (expiresAt < now) {
      return {
        status: 'expired',
        error_message: `OAuth token expired on ${expiresAt.toLocaleDateString()}. Please re-authorize this integration.`
      };
    }
  }
  
  // Default to active
  return { status: 'active' };
}
