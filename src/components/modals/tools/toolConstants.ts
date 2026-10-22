export interface SearchProvider {
  id: string;
  name: string;
  setupUrl: string;
  rateLimit: string;
  description: string;
}

// Search providers configuration
export const SEARCH_PROVIDERS: SearchProvider[] = [
  { 
    id: 'serper_api', 
    name: 'Serper API', 
    setupUrl: 'https://serper.dev/api-key', 
    rateLimit: '1,000 queries/month free',
    description: 'Google search results with rich snippets and knowledge graph'
  },
  { 
    id: 'serpapi', 
    name: 'SerpAPI', 
    setupUrl: 'https://serpapi.com/manage-api-key', 
    rateLimit: '100 queries/month free',
    description: 'Reliable search engine results API with multiple engines'
  },
  { 
    id: 'brave_search', 
    name: 'Brave Search API', 
    setupUrl: 'https://api.search.brave.com/app/keys', 
    rateLimit: '2,000 queries/month free',
    description: 'Independent search results with privacy focus'
  }
];

// Default scopes for different providers
export const getDefaultScopesForProvider = (provider: string): string[] => {
  // For Gmail OAuth provider
  if (provider === 'gmail') {
    return ['gmail_send_email','gmail_read_emails','gmail_search_emails','gmail_email_actions'];
  }
  // For unified web search or individual search providers
  if (['serper_api','serpapi','brave_search','web_search'].includes(provider)) {
    return ['web_search','news_search','image_search','local_search'];
  }
  // For email providers - using unique tool names now
  if (provider === 'smtp') {
    return ['smtp_send_email','smtp_email_templates','smtp_email_stats'];
  }
  if (provider === 'sendgrid') {
    return ['sendgrid_send_email','sendgrid_email_templates','sendgrid_email_stats'];
  }
  if (provider === 'mailgun') {
    return ['mailgun_send_email','mailgun_email_templates','mailgun_email_stats','mailgun_email_validation','mailgun_suppression_management'];
  }
  return [];
};

