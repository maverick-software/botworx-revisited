import { SupabaseClient } from '@supabase/supabase-js';

export class VaultService {
  private supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  async createSecret(name: string, secret: string, description?: string): Promise<string> {
    const { data, error } = await this.supabase.functions.invoke('create-secret', {
      body: { name, secret, description },
    });

    if (error) {
      throw new Error(`Failed to create secret: ${error.message}`);
    }

    return data.id;
  }

  async getSecret(secretId: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('get_secret', { secret_id: secretId });

    if (error) {
      console.error('Error fetching secret:', error);
      return null;
    }

    return data;
  }
} 