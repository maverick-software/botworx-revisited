import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Types matching the database schema
export interface IntegrationCategory {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  display_order: number;
  total_integrations?: number;
  available_integrations?: number;
  user_connected_integrations?: number;
}

export interface Integration {
  id: string;
  category_id: string;
  name: string;
  description: string;
  icon_name: string;
  status: 'available' | 'beta' | 'coming_soon' | 'deprecated';
  agent_classification?: 'tool' | 'channel';
  is_popular: boolean;
  documentation_url?: string;
  display_order: number;
  user_connection_status?: 'connected' | 'disconnected' | 'error' | 'pending';
  user_connection_count?: number;
}

export interface UserIntegration {
  id: string;
  user_id: string;
  integration_id: string;
  connection_name?: string;
  connection_status: 'connected' | 'disconnected' | 'error' | 'pending';
  configuration: Record<string, any>;
  last_sync_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationStats {
  total_available_integrations: number;
  total_connected_integrations: number;
  total_categories: number;
  recent_connections: number;
}

// Hook for fetching integration categories with counts
export function useIntegrationCategories() {
  const [categories, setCategories] = useState<IntegrationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try using the custom function first
      const { data: functionData, error: functionError } = await supabase.rpc(
        'get_integration_categories_with_counts'
      );

      if (functionData && !functionError) {
        // Successfully got data from database function
        setCategories(functionData);
        return;
      }

      // If function doesn't exist, try basic table query
      const { data, error: queryError } = await supabase
        .from('integration_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
        .order('name');

      if (queryError) {
        // If table doesn't exist, return dummy data
        if (queryError.code === '42P01') {
          console.log('Integration categories table not found, using dummy data');
          setCategories(getDummyCategories());
        } else {
          throw queryError;
        }
      } else {
        // Successfully got data from basic query
        setCategories(data || []);
      }
    } catch (err) {
      console.error('Error fetching integration categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch integration categories');
      // Return dummy data as fallback
      setCategories(getDummyCategories());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return { categories, loading, error, refetch: fetchCategories };
}

// Hook for fetching integrations by category - now uses service_providers
export function useIntegrationsByCategory(categoryId?: string) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        setLoading(true);
        setError(null);

        console.log('[useIntegrationsByCategory] Now using service_providers table instead of integrations');

        // Fetch from service_providers table and transform to Integration format
        const { data: oauthProviders, error: queryError } = await supabase
          .from('service_providers')
          .select('*')
          .eq('is_enabled', true)
          .order('name');

        if (queryError) {
          console.error('Error fetching service_providers:', queryError);
          // Fallback to dummy data
          setIntegrations(categoryId ? getDummyIntegrations(categoryId) : getAllDummyIntegrations());
          return;
        }

        // Get all categories for mapping
        const { data: categoriesData } = await supabase
          .from('integration_categories')
          .select('id, name')
          .eq('is_active', true);

        const categoryMap = new Map(categoriesData?.map(cat => [cat.name, cat.id]) || []);

        // Transform service_providers to Integration format
        const transformedIntegrations: Integration[] = (oauthProviders || []).map((provider, index) => {
          // Determine category based on provider name
          const categoryName = getProviderCategoryName(provider.name);
          const actualCategoryId = categoryMap.get(categoryName);
          
          // Skip if filtering by category and this provider doesn't match
          if (categoryId && actualCategoryId !== categoryId) {
            return null;
          }

          return {
            id: provider.id,
            category_id: actualCategoryId || categoryMap.get('API Integrations') || 'unknown',
            name: provider.display_name,
            description: getProviderDescription(provider.name),
            icon_name: getProviderIcon(provider.name),
            status: provider.is_enabled ? 'available' : 'coming_soon',
            agent_classification: 'tool',
            is_popular: isPopularProvider(provider.name),
            documentation_url: getProviderDocumentationUrl(provider.name),
            display_order: index + 1
          } as Integration;
        }).filter(Boolean) as Integration[];

        setIntegrations(transformedIntegrations);
      } catch (err) {
        console.error('Error fetching integrations from service_providers:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
        // Return dummy data as fallback
        setIntegrations(categoryId ? getDummyIntegrations(categoryId) : getAllDummyIntegrations());
      } finally {
        setLoading(false);
      }
    }

    fetchIntegrations();
  }, [categoryId]);

  return { integrations, loading, error };
}

// Hook for fetching integrations by agent classification (tool or channel) - now uses service_providers
export function useIntegrationsByClassification(classification: 'tool' | 'channel') {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        setLoading(true);
        setError(null);

        console.log('[useIntegrationsByClassification] Now using service_providers table instead of integrations');

        // Fetch from service_providers table and transform to Integration format
        const { data: oauthProviders, error: queryError } = await supabase
          .from('service_providers')
          .select('*')
          .eq('is_enabled', true)
          .order('name');

        if (queryError) {
          console.error('Error fetching service_providers for classification:', queryError);
          setIntegrations(getDummyIntegrationsByClassification(classification));
          return;
        }

        // Get all categories for mapping
        const { data: categoriesData } = await supabase
          .from('integration_categories')
          .select('id, name')
          .eq('is_active', true);

        const categoryMap = new Map(categoriesData?.map(cat => [cat.name, cat.id]) || []);

        // Transform service_providers to Integration format and filter by classification
        const transformedIntegrations: Integration[] = (oauthProviders || []).map((provider, index) => {
          const categoryName = getProviderCategoryName(provider.name);
          const actualCategoryId = categoryMap.get(categoryName);
          const providerClassification = getProviderClassification(provider.name);
          
          // Skip if this provider doesn't match the requested classification
          if (providerClassification !== classification) {
            return null;
          }

          return {
            id: provider.id,
            category_id: actualCategoryId || categoryMap.get('API Integrations') || 'unknown',
            name: provider.display_name,
            description: getProviderDescription(provider.name),
            icon_name: getProviderIcon(provider.name),
            status: provider.is_enabled ? 'available' : 'coming_soon',
            agent_classification: providerClassification,
            is_popular: isPopularProvider(provider.name),
            documentation_url: getProviderDocumentationUrl(provider.name),
            display_order: index + 1
          } as Integration;
        }).filter(Boolean) as Integration[];

        setIntegrations(transformedIntegrations);
      } catch (err) {
        console.error('Error fetching integrations by classification from service_providers:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
        setIntegrations(getDummyIntegrationsByClassification(classification));
      } finally {
        setLoading(false);
      }
    }

    fetchIntegrations();
  }, [classification]);

  return { integrations, loading, error };
}

// Hook for fetching user integration statistics
export function useIntegrationStats() {
  const [stats, setStats] = useState<IntegrationStats>({
    total_available_integrations: 0,
    total_connected_integrations: 0,
    total_categories: 0,
    recent_connections: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);

        // Try using the custom function first
        const { data: functionData, error: functionError } = await supabase.rpc(
          'get_user_integration_stats'
        );

        if (functionData && functionData.length > 0 && !functionError) {
          // Successfully got data from database function
          setStats(functionData[0]);
          return;
        }

        // If function doesn't exist, try to get basic stats from service_providers
        const { data: categoriesData } = await supabase
          .from('integration_categories')
          .select('*')
          .eq('is_active', true);

        const { data: integrationsData } = await supabase
          .from('service_providers')
          .select('*')
          .eq('is_enabled', true);

        const { data: userIntegrationsData } = await supabase
          .from('user_integrations')
          .select('*')
          .eq('connection_status', 'connected');

        if (categoriesData && integrationsData && userIntegrationsData !== null) {
          // Successfully got data from basic queries
          setStats({
            total_available_integrations: integrationsData.length,
            total_connected_integrations: userIntegrationsData.length,
            total_categories: categoriesData.length,
            recent_connections: userIntegrationsData.filter(ui => {
              const createdAt = new Date(ui.created_at);
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return createdAt > thirtyDaysAgo;
            }).length
          });
          return;
        }

        // If no tables exist, use dummy data
        console.log('Integration stats tables not found, using dummy data');
        setStats({
          total_available_integrations: 18,
          total_connected_integrations: 12,
          total_categories: 6,
          recent_connections: 3
        });
      } catch (err) {
        console.error('Error fetching integration stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch integration stats');
        // Return dummy data as fallback
        setStats({
          total_available_integrations: 18,
          total_connected_integrations: 12,
          total_categories: 6,
          recent_connections: 3
        });
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}

// Hook for managing user integration connections
export function useUserIntegrations() {
  const [userIntegrations, setUserIntegrations] = useState<UserIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserIntegrations() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: queryError } = await supabase
          .from('user_integrations')
          .select('*')
          .order('created_at', { ascending: false });

        if (queryError) {
          if (queryError.code === '42P01') {
            // Table doesn't exist yet, return empty array
            setUserIntegrations([]);
          } else {
            throw queryError;
          }
        } else {
          setUserIntegrations(data || []);
        }
      } catch (err) {
        console.error('Error fetching user integrations:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch user integrations');
        setUserIntegrations([]);
      } finally {
        setLoading(false);
      }
    }

    fetchUserIntegrations();
  }, []);

  const connectIntegration = async (integrationId: string, connectionName?: string, configuration?: Record<string, any>) => {
    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .insert({
          integration_id: integrationId,
          connection_name: connectionName,
          connection_status: 'pending',
          configuration: configuration || {}
        })
        .select()
        .single();

      if (error) throw error;

      setUserIntegrations(prev => [data, ...prev]);
      return { data, error: null };
    } catch (err) {
      console.error('Error connecting integration:', err);
      return { data: null, error: err instanceof Error ? err.message : 'Failed to connect integration' };
    }
  };

  const disconnectIntegration = async (userIntegrationId: string) => {
    try {
      const { error } = await supabase
        .from('user_integrations')
        .update({ connection_status: 'disconnected' })
        .eq('id', userIntegrationId);

      if (error) throw error;

      setUserIntegrations(prev => 
        prev.map(integration => 
          integration.id === userIntegrationId 
            ? { ...integration, connection_status: 'disconnected' as const }
            : integration
        )
      );
      return { error: null };
    } catch (err) {
      console.error('Error disconnecting integration:', err);
      return { error: err instanceof Error ? err.message : 'Failed to disconnect integration' };
    }
  };

  return { 
    userIntegrations, 
    loading, 
    error, 
    connectIntegration, 
    disconnectIntegration 
  };
}

// Dummy data functions for fallback when database tables don't exist yet
function getDummyCategories(): IntegrationCategory[] {
  return [
    {
      id: 'api',
      name: 'API Integrations',
      description: 'Connect to external APIs and services',
      icon_name: 'Globe',
      display_order: 1,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 2
    },
    {
      id: 'database',
      name: 'Database Connectors',
      description: 'Connect to various database systems',
      icon_name: 'Database',
      display_order: 2,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 1
    },
    {
      id: 'authentication',
      name: 'Authentication',
      description: 'Secure authentication and authorization',
      icon_name: 'Shield',
      display_order: 3,
      total_integrations: 3,
      available_integrations: 2,
      user_connected_integrations: 1
    },
    {
      id: 'messaging',
      name: 'Messaging & Communication',
      description: 'Communication and messaging platforms',
      icon_name: 'MessageSquare',
      display_order: 4,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 2
    },
    {
      id: 'cloud',
      name: 'Cloud Services',
      description: 'Cloud platforms and services',
      icon_name: 'Cloud',
      display_order: 5,
      total_integrations: 3,
      available_integrations: 2,
      user_connected_integrations: 1
    },
    {
      id: 'automation',
      name: 'Automation & Workflows',
      description: 'Workflow automation and triggers',
      icon_name: 'Zap',
      display_order: 6,
      total_integrations: 3,
      available_integrations: 3,
      user_connected_integrations: 2
    }
  ];
}

function getAllDummyIntegrations(): Integration[] {
  const categories = getDummyCategories();
  const allIntegrations: Integration[] = [];
  
  categories.forEach(category => {
    allIntegrations.push(...getDummyIntegrations(category.id));
  });
  
  return allIntegrations;
}

// Function to get dummy integrations by agent classification
function getDummyIntegrationsByClassification(classification: 'tool' | 'channel'): Integration[] {
  const channelIntegrations: Integration[] = [
    {
      id: 'gmail',
      category_id: 'messaging',
      name: 'Gmail',
      description: 'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
      icon_name: 'MessageSquare',
      status: 'available',
      is_popular: true,
      display_order: 1,
      documentation_url: 'https://developers.google.com/gmail/api'
    },
    {
      id: 'slack',
      category_id: 'messaging',
      name: 'Slack',
      description: 'Send messages to Slack channels and manage workspace communications',
      icon_name: 'MessageSquare',
      status: 'available',
      is_popular: true,
      display_order: 2
    },
    {
      id: 'discord',
      category_id: 'messaging',
      name: 'Discord',
      description: 'Interact with Discord servers and manage bot communications',
      icon_name: 'MessageSquare',
      status: 'available',
      is_popular: true,
      display_order: 3
    }
  ];

  const toolIntegrations: Integration[] = [
    {
      id: 'serper-api',
      category_id: 'api',
      name: 'Serper API',
      description: 'Google Search API with fast, reliable results. Perfect for web search, news, images, and location-based queries. Offers 1000 free searches per month.',
      icon_name: 'Search',
      status: 'available',
      is_popular: true,
      display_order: 1
    },
    {
      id: 'serpapi',
      category_id: 'api',
      name: 'SerpAPI',
      description: 'Comprehensive search API supporting Google, Bing, Yahoo and Baidu. Advanced features include device simulation and multiple search engines.',
      icon_name: 'Search',
      status: 'available',
      is_popular: true,
      display_order: 2
    },
    {
      id: 'brave-search-api',
      category_id: 'api',
      name: 'Brave Search API',
      description: 'Privacy-focused search API from Brave. No tracking, independent index, and high monthly quota. Perfect for privacy-conscious applications.',
      icon_name: 'Search',
      status: 'available',
      is_popular: true,
      display_order: 3
    },
    {
      id: 'rest-api',
      category_id: 'api',
      name: 'REST API',
      description: 'Connect to RESTful web services',
      icon_name: 'Globe',
      status: 'available',
      is_popular: true,
      display_order: 2
    },
    {
      id: 'graphql',
      category_id: 'api',
      name: 'GraphQL',
      description: 'Query APIs with GraphQL',
      icon_name: 'Globe',
      status: 'available',
      is_popular: true,
      display_order: 3
    },
    {
      id: 'postgresql',
      category_id: 'database',
      name: 'PostgreSQL',
      description: 'Connect to PostgreSQL databases',
      icon_name: 'Database',
      status: 'available',
      is_popular: true,
      display_order: 1
    },
    {
      id: 'mongodb',
      category_id: 'database',
      name: 'MongoDB',
      description: 'Connect to MongoDB collections',
      icon_name: 'Database',
      status: 'available',
      is_popular: true,
      display_order: 2
    },
    {
      id: 'aws',
      category_id: 'cloud',
      name: 'AWS',
      description: 'Amazon Web Services integration',
      icon_name: 'Cloud',
      status: 'available',
      is_popular: true,
      display_order: 1
    },
    {
      id: 'github-actions',
      category_id: 'automation',
      name: 'GitHub Actions',
      description: 'Trigger GitHub workflow actions',
      icon_name: 'Zap',
      status: 'available',
      is_popular: true,
      display_order: 1
    }
  ];

  return classification === 'channel' ? channelIntegrations : toolIntegrations;
}

function getDummyIntegrations(categoryId: string): Integration[] {
  const allIntegrations: Record<string, Integration[]> = {
    'api': [
      {
        id: 'rest-api',
        category_id: 'api',
        name: 'REST API',
        description: 'Connect to RESTful web services',
        icon_name: 'Globe',
        status: 'available',
        is_popular: true,
        display_order: 1
      },
      {
        id: 'graphql',
        category_id: 'api',
        name: 'GraphQL',
        description: 'Query APIs with GraphQL',
        icon_name: 'Globe',
        status: 'available',
        is_popular: true,
        display_order: 2
      },
      {
        id: 'webhook',
        category_id: 'api',
        name: 'Webhooks',
        description: 'Receive real-time notifications',
        icon_name: 'Globe',
        status: 'available',
        is_popular: false,
        display_order: 3
      }
    ],
    'database': [
      {
        id: 'postgresql',
        category_id: 'database',
        name: 'PostgreSQL',
        description: 'Connect to PostgreSQL databases',
        icon_name: 'Database',
        status: 'available',
        is_popular: true,
        display_order: 1
      },
      {
        id: 'mongodb',
        category_id: 'database',
        name: 'MongoDB',
        description: 'Connect to MongoDB collections',
        icon_name: 'Database',
        status: 'available',
        is_popular: true,
        display_order: 2
      },
      {
        id: 'mysql',
        category_id: 'database',
        name: 'MySQL',
        description: 'Connect to MySQL databases',
        icon_name: 'Database',
        status: 'available',
        is_popular: false,
        display_order: 3
      }
    ],
    'messaging': [
      {
        id: 'gmail',
        category_id: 'messaging',
        name: 'Gmail',
        description: 'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
        icon_name: 'MessageSquare',
        status: 'available',
        is_popular: true,
        display_order: 1,
        documentation_url: 'https://developers.google.com/gmail/api'
      },
      {
        id: 'slack',
        category_id: 'messaging',
        name: 'Slack',
        description: 'Send messages to Slack channels and manage workspace communications',
        icon_name: 'MessageSquare',
        status: 'available',
        is_popular: true,
        display_order: 2
      },
      {
        id: 'discord',
        category_id: 'messaging',
        name: 'Discord',
        description: 'Interact with Discord servers and manage bot communications',
        icon_name: 'MessageSquare',
        status: 'available',
        is_popular: true,
        display_order: 3
      }
    ],
    'authentication': [
      {
        id: 'oauth2',
        category_id: 'authentication',
        name: 'OAuth 2.0',
        description: 'Secure OAuth 2.0 authentication flow',
        icon_name: 'Shield',
        status: 'available',
        is_popular: true,
        display_order: 1
      },
      {
        id: 'jwt',
        category_id: 'authentication',
        name: 'JWT Tokens',
        description: 'JSON Web Token authentication',
        icon_name: 'Shield',
        status: 'available',
        is_popular: true,
        display_order: 2
      },
      {
        id: 'saml',
        category_id: 'authentication',
        name: 'SAML',
        description: 'SAML single sign-on authentication',
        icon_name: 'Shield',
        status: 'coming_soon',
        is_popular: false,
        display_order: 3
      }
    ],
    'cloud': [
      {
        id: 'aws',
        category_id: 'cloud',
        name: 'AWS',
        description: 'Amazon Web Services integration',
        icon_name: 'Cloud',
        status: 'available',
        is_popular: true,
        display_order: 1
      },
      {
        id: 'azure',
        category_id: 'cloud',
        name: 'Azure',
        description: 'Microsoft Azure services',
        icon_name: 'Cloud',
        status: 'available',
        is_popular: false,
        display_order: 2
      },
      {
        id: 'gcp',
        category_id: 'cloud',
        name: 'Google Cloud',
        description: 'Google Cloud Platform services',
        icon_name: 'Cloud',
        status: 'coming_soon',
        is_popular: false,
        display_order: 3
      }
    ],
    'automation': [
      {
        id: 'zapier',
        category_id: 'automation',
        name: 'Zapier',
        description: 'Connect with Zapier workflows',
        icon_name: 'Zap',
        status: 'available',
        is_popular: true,
        display_order: 1
      },
      {
        id: 'github-actions',
        category_id: 'automation',
        name: 'GitHub Actions',
        description: 'Trigger GitHub workflow actions',
        icon_name: 'Zap',
        status: 'available',
        is_popular: true,
        display_order: 2
      },
      {
        id: 'scheduled-tasks',
        category_id: 'automation',
        name: 'Scheduled Tasks',
        description: 'Schedule automated tasks',
        icon_name: 'Zap',
        status: 'available',
        is_popular: false,
        display_order: 3
      }
    ]
    // Add other categories as needed
  };

  return allIntegrations[categoryId] || [];
}

// Helper functions to map service_providers to integration metadata
function getProviderCategoryName(providerName: string): string {
  const categoryMap: Record<string, string> = {
    'gmail': 'Messaging & Communication',
    'smtp': 'Messaging & Communication',
    'sendgrid': 'Messaging & Communication',
    'mailgun': 'Messaging & Communication',
    'serper_api': 'API Integrations',
    'serpapi': 'API Integrations',
    'brave_search': 'API Integrations',
    'pinecone': 'Database Connectors',
    'getzep': 'Database Connectors',
    'digitalocean': 'Cloud Services',
    'discord': 'Messaging & Communication',
    'zapier': 'Automation & Workflows',
    'microsoft-teams': 'Communication',
    'microsoft-outlook': 'Productivity',
    'microsoft-onedrive': 'Storage'
  };
  
  return categoryMap[providerName] || 'API Integrations';
}

// Legacy function for backward compatibility
function getProviderCategory(providerName: string): { id: string; name: string } {
  const categoryName = getProviderCategoryName(providerName);
  return { id: categoryName.toLowerCase().replace(/\s+/g, '_'), name: categoryName };
}

function getProviderDescription(providerName: string): string {
  const descriptionMap: Record<string, string> = {
    'gmail': 'Send, receive, and manage Gmail emails with comprehensive tools for email automation',
    'smtp': 'Send emails through SMTP servers with custom configurations and templates',
    'sendgrid': 'Professional email delivery service with advanced analytics and templates',
    'mailgun': 'Powerful email API for sending, receiving and tracking emails programmatically',
    'serper_api': 'Google Search API with fast, reliable results. Perfect for web search, news, images, and location-based queries. Offers 1000 free searches per month.',
    'serpapi': 'Comprehensive search API supporting Google, Bing, Yahoo and Baidu. Advanced features include device simulation and multiple search engines.',
    'brave_search': 'Privacy-focused search API from Brave. No tracking, independent index, and high monthly quota. Perfect for privacy-conscious applications.',
    'pinecone': 'Vector database for AI applications with fast similarity search and real-time updates',
    'getzep': 'Memory store for AI assistants with conversation history and semantic search',
    'digitalocean': 'Cloud infrastructure platform for deploying and scaling applications',
    'discord': 'Interact with Discord servers and manage bot communications',
    'zapier': 'Connect with Zapier workflows to automate tasks across thousands of apps',
    'microsoft-teams': 'Send messages, create meetings, and collaborate in Microsoft Teams channels and chats',
    'microsoft-outlook': 'Send emails, manage calendar events, and access contacts in Microsoft Outlook',
    'microsoft-onedrive': 'Upload, download, share, and manage files in Microsoft OneDrive'
  };
  
  return descriptionMap[providerName] || `Integration for ${providerName}`;
}

function getProviderIcon(providerName: string): string {
  const iconMap: Record<string, string> = {
    'gmail': 'Mail',
    'smtp': 'Mail',
    'sendgrid': 'Mail',
    'mailgun': 'Mail',
    'serper_api': 'Search',
    'serpapi': 'Search',
    'brave_search': 'Search',
    'pinecone': 'Database',
    'getzep': 'Database',
    'digitalocean': 'Cloud',
    'discord': 'MessageSquare',
    'zapier': 'Zap',
    'microsoft-teams': 'MessageSquare',
    'microsoft-outlook': 'Mail',
    'microsoft-onedrive': 'Cloud'
  };
  
  return iconMap[providerName] || 'Globe';
}

function isPopularProvider(providerName: string): boolean {
  const popularProviders = ['gmail', 'serper_api', 'brave_search', 'serpapi', 'discord', 'zapier', 'microsoft-teams', 'microsoft-outlook', 'microsoft-onedrive'];
  return popularProviders.includes(providerName);
}

function getProviderDocumentationUrl(providerName: string): string | undefined {
  const docMap: Record<string, string> = {
    'gmail': 'https://developers.google.com/gmail/api',
    'serper_api': 'https://serper.dev/api-key',
    'serpapi': 'https://serpapi.com/search-api',
    'brave_search': 'https://api.search.brave.com/app/documentation',
    'sendgrid': 'https://docs.sendgrid.com/',
    'mailgun': 'https://documentation.mailgun.com/',
    'pinecone': 'https://docs.pinecone.io/',
    'getzep': 'https://docs.getzep.com/',
    'digitalocean': 'https://docs.digitalocean.com/reference/api/',
    'discord': 'https://discord.com/developers/docs',
    'zapier': 'https://zapier.com/developer',
    'microsoft-teams': 'https://docs.microsoft.com/en-us/graph/api/resources/teams-api-overview',
    'microsoft-outlook': 'https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview',
    'microsoft-onedrive': 'https://docs.microsoft.com/en-us/graph/api/resources/onedrive'
  };
  
  return docMap[providerName];
}

function getProviderClassification(providerName: string): 'tool' | 'channel' {
  // Channel integrations are primarily for communication/messaging
  const channelProviders = ['gmail', 'smtp', 'sendgrid', 'mailgun', 'discord', 'microsoft-teams', 'microsoft-outlook'];
  
  if (channelProviders.includes(providerName)) {
    return 'channel';
  }
  
  // Everything else is considered a tool
  return 'tool';
} 