import { ReactElement } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { User } from '@supabase/supabase-js';

/**
 * Common interface for all integration setup components
 * Each integration should export a setup component that implements this interface
 */
export interface IntegrationSetupProps {
  /** Integration metadata from the database */
  integration: {
    id: string;
    name: string;
    description?: string;
    icon_name?: string;
    status: string;
    agent_classification: 'tool' | 'channel';
    required_oauth_provider_id?: string;
    configuration_schema?: any;
    documentation_url?: string;
  };
  
  /** Whether the setup is currently active/visible */
  isOpen: boolean;
  
  /** Function to close/cancel the setup */
  onClose: () => void;
  
  /** Function called when setup completes successfully */
  onSuccess: (connection: {
    connection_id: string;
    connection_name: string;
    provider_name: string;
    external_username?: string;
    scopes_granted: string[];
  }) => void;
  
  /** Function called when setup encounters an error */
  onError: (error: string) => void;
  
  /** Current authenticated user */
  user: User | null;
  
  /** Supabase client instance */
  supabase: SupabaseClient;
  
  /** Optional initial form data */
  initialData?: Record<string, any>;
}

/**
 * Type definition for integration setup components
 */
export type IntegrationSetupComponent = (props: IntegrationSetupProps) => ReactElement;

/**
 * Registry entry for an integration setup component
 */
export interface IntegrationSetupRegistryEntry {
  /** The setup component */
  component: IntegrationSetupComponent;
  
  /** Credential type this integration uses */
  credentialType: 'oauth' | 'api_key' | 'server_config' | 'custom';
  
  /** Default scopes for this integration */
  defaultScopes: string[];
  
  /** Capabilities this integration provides */
  capabilities: Array<{
    key: string;
    label: string;
    description?: string;
  }>;
}

/**
 * Integration setup registry type
 */
export type IntegrationSetupRegistry = Record<string, IntegrationSetupRegistryEntry>;
