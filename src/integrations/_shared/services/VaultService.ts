import { SupabaseClient } from '@supabase/supabase-js';

export class VaultService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Create encrypted secret in Supabase Vault
   * @param name Unique identifier for the secret
   * @param secret The sensitive value to encrypt
   * @param description Human-readable description
   * @returns Vault UUID for database storage
   */
  async createSecret(name: string, secret: string, description?: string): Promise<string> {
    if (!name || !secret) {
      throw new Error('Name and secret are required');
    }

    // Use RPC function for secure vault creation
    const { data: secretId, error } = await this.supabase.rpc('create_vault_secret', {
      p_secret: secret,
      p_name: name,
      p_description: description || `Secret created: ${new Date().toISOString()}`,
    });

    if (error) {
      console.error('VaultService: Failed to create secret:', error);
      throw new Error(`Failed to create vault secret: ${error.message}`);
    }

    if (!secretId) {
      throw new Error('Vault secret creation returned null');
    }

    return secretId;
  }

  /**
   * Retrieve decrypted secret from Supabase Vault
   * @param secretId Vault UUID
   * @returns Decrypted secret value
   */
  async getSecret(secretId: string): Promise<string | null> {
    if (!secretId) {
      throw new Error('Secret ID is required');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(secretId)) {
      throw new Error('Invalid vault UUID format');
    }

    // Use RPC function for secure decryption
    const { data: secretValue, error } = await this.supabase.rpc('vault_decrypt', {
      vault_id: secretId,
    });

    if (error) {
      console.error('VaultService: Failed to decrypt secret:', error);
      throw new Error(`Failed to decrypt vault secret: ${error.message}`);
    }

    return secretValue;
  }

  /**
   * Generate standardized secret name
   * @param provider Service provider (e.g., 'openai', 'gmail')
   * @param type Secret type ('api_key', 'access_token', 'refresh_token')
   * @param userId User identifier
   * @returns Standardized secret name
   */
  static generateSecretName(
    provider: string,
    type: 'api_key' | 'access_token' | 'refresh_token',
    userId: string
  ): string {
    const timestamp = Date.now();
    return `${provider}_${type}_${userId}_${timestamp}`;
  }

  /**
   * Generate standardized secret description
   * @param provider Service provider
   * @param type Secret type
   * @param userId User identifier
   * @returns Human-readable description
   */
  static generateSecretDescription(
    provider: string,
    type: string,
    userId: string
  ): string {
    const timestamp = new Date().toISOString();
    return `${provider} ${type} for user ${userId} - Created: ${timestamp}`;
  }
} 