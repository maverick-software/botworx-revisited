import { supabase } from '@/lib/supabase';

export interface ServiceProvider {
  id: string;
  name: string;
  display_name: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revoke_endpoint?: string;
  discovery_endpoint?: string;
  scopes_supported: any[];
  pkce_required: boolean;
  client_credentials_location: string;
  is_enabled: boolean;
  configuration_metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface ServiceProviderData {
  name: string;
  display_name: string;
  authorization_endpoint: string;
  token_endpoint: string;
  revoke_endpoint?: string;
  discovery_endpoint?: string;
  scopes_supported: any[];
  pkce_required: boolean;
  client_credentials_location: string;
  is_enabled: boolean;
  configuration_metadata?: any;
}

class AdminServiceProvidersAPI {
  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    return session.access_token;
  }

  private async makeRequest(action: string, data?: any): Promise<any> {
    const token = await this.getAuthToken();
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-service-providers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        data
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || `Failed to ${action} service provider`);
    }

    return result.data;
  }

  async list(): Promise<ServiceProvider[]> {
    return await this.makeRequest('list');
  }

  async create(data: ServiceProviderData): Promise<ServiceProvider> {
    return await this.makeRequest('create', data);
  }

  async update(id: string, data: Partial<ServiceProviderData>): Promise<ServiceProvider> {
    return await this.makeRequest('update', { ...data, id });
  }

  async delete(id: string): Promise<ServiceProvider> {
    return await this.makeRequest('delete', { id });
  }
}

export const adminServiceProviders = new AdminServiceProvidersAPI();
