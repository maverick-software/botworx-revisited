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

// Hook for fetching integrations by category
export function useIntegrationsByCategory(categoryId?: string) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        setLoading(true);
        setError(null);

        if (categoryId) {
          // Try using the custom function first
          const { data: functionData, error: functionError } = await supabase.rpc(
            'get_integrations_by_category',
            { p_category_id: categoryId }
          );

          if (functionData && !functionError) {
            // Successfully got data from database function
            setIntegrations(functionData);
            return;
          }

          // If function doesn't exist, try basic table query
          const { data, error: queryError } = await supabase
            .from('integrations')
            .select('*')
            .eq('category_id', categoryId)
            .eq('is_active', true)
            .order('display_order')
            .order('name');

          if (queryError) {
            // If table doesn't exist, return dummy data
            if (queryError.code === '42P01') {
              console.log('Integrations table not found, using dummy data');
              setIntegrations(getDummyIntegrations(categoryId));
            } else {
              throw queryError;
            }
          } else {
            // Successfully got data from basic query
            setIntegrations(data || []);
          }
        } else {
          // Fetch all integrations when no categoryId is provided
          const { data, error: queryError } = await supabase
            .from('integrations')
            .select('*')
            .eq('is_active', true)
            .order('display_order')
            .order('name');

          if (queryError) {
            // If table doesn't exist, return dummy data
            if (queryError.code === '42P01') {
              console.log('Integrations table not found, using dummy data');
              setIntegrations(getAllDummyIntegrations());
            } else {
              throw queryError;
            }
          } else {
            // Successfully got data from basic query
            setIntegrations(data || []);
          }
        }
      } catch (err) {
        console.error('Error fetching integrations:', err);
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

// Hook for fetching integrations by agent classification (tool or channel)
export function useIntegrationsByClassification(classification: 'tool' | 'channel') {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        setLoading(true);
        setError(null);

        // Query integrations by agent classification
        const { data, error: queryError } = await supabase
          .from('integrations')
          .select('*')
          .eq('agent_classification', classification)
          .eq('is_active', true)
          .order('display_order')
          .order('name');

        if (queryError) {
          throw queryError;
        } else {
          // Successfully got data from basic query
          setIntegrations(data || []);
        }
              } catch (err) {
        console.error('Error fetching integrations by classification:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch integrations');
        setIntegrations([]);
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

        // If function doesn't exist, try to get basic stats
        const { data: categoriesData } = await supabase
          .from('integration_categories')
          .select('*')
          .eq('is_active', true);

        const { data: integrationsData } = await supabase
          .from('integrations')
          .select('*')
          .eq('is_active', true)
          .eq('status', 'available');

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