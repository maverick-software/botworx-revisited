import { IntegrationSetupRegistry } from '../types/IntegrationSetup';
import { DiscordSetupModal } from '../../discord/components/DiscordSetupModal';
import { DigitalOceanSetupModal } from '../../digitalocean/components/DigitalOceanSetupModal';
import { GmailSetupModal } from '../../gmail/components/GmailSetupModal';
import { WebSearchSetupModal } from '../../web-search/components/WebSearchSetupModal';
import { SendGridSetupModal } from '../../sendgrid/components/SendGridSetupModal';
import { MailgunSetupModal } from '../../mailgun/components/MailgunSetupModal';
import { SMTPSetupModal } from '../../smtp/components/SMTPSetupModal';
import { EmailRelaySetupModal } from '../../email-relay/components/EmailRelaySetupModal';
import { PineconeSetupModal } from '../../pinecone/components/PineconeSetupModal';
import { GetZepSetupModal } from '../../getzep/components/GetZepSetupModal';
import { SerperAPISetupModal } from '../../serper-api/components/SerperAPISetupModal';
import { SerpAPISetupModal } from '../../serpapi/components/SerpAPISetupModal';
import { BraveSearchSetupModal } from '../../brave-search/components/BraveSearchSetupModal';
import { MicrosoftTeamsSetupModal } from '../../microsoft-teams/components/MicrosoftTeamsSetupModal';
import { MicrosoftOneDriveSetupModal } from '../../microsoft-onedrive/components/MicrosoftOneDriveSetupModal';
import { MicrosoftOutlookSetupModal } from '../../microsoft-outlook/components/MicrosoftOutlookSetupModal';
import { MistralOCRSetupModal } from '../../mistral-ocr/components/MistralOCRSetupModal';
import { AzureDocumentIntelligenceSetupModal } from '../../azure-document-intelligence/components/AzureDocumentIntelligenceSetupModal';
import { ClickSendSetupModal } from '../../clicksend/components/ClickSendSetupModal';

/**
 * Registry of all integration setup components
 * Each integration should register its setup component here
 */
export const integrationSetupRegistry: IntegrationSetupRegistry = {
  // Gmail - OAuth-based email integration
  'Gmail': {
    component: GmailSetupModal,
    credentialType: 'oauth',
    defaultScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
    capabilities: [
      { key: 'send_email', label: 'Send and receive emails' },
      { key: 'read_email', label: 'Read and search email messages' },
      { key: 'manage_labels', label: 'Manage email labels and folders' },
      { key: 'oauth_auth', label: 'Secure OAuth authentication' }
    ]
  },

  // Web Search - API key-based search integration  
  'Web Search': {
    component: WebSearchSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search', 'local_search'],
    capabilities: [
      { key: 'web_search', label: 'Search the web for information' },
      { key: 'news_search', label: 'Search for news articles' },
      { key: 'image_search', label: 'Search for images' },
      { key: 'local_search', label: 'Search for local business information' }
    ]
  },

  // Email Relay - Unified email provider integration
  'Email Relay': {
    component: EmailRelaySetupModal,
    credentialType: 'api_key', // All email providers use api_key credential type
    defaultScopes: ['send_email', 'email_templates', 'email_stats'],
    capabilities: [
      { key: 'send_email', label: 'Send transactional and marketing emails' },
      { key: 'email_templates', label: 'Use email templates and branding' },
      { key: 'email_stats', label: 'Track email delivery and engagement' },
      { key: 'email_validation', label: 'Email validation and verification' }
    ]
  },

  // SendGrid - API key-based email sending
  'SendGrid': {
    component: SendGridSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['send_email', 'templates', 'analytics'],
    capabilities: [
      { key: 'send_email', label: 'Send transactional emails' },
      { key: 'templates', label: 'Use email templates' },
      { key: 'analytics', label: 'Email delivery analytics' }
    ]
  },

  // Mailgun - API key-based email service
  'Mailgun': {
    component: MailgunSetupModal,
    credentialType: 'api_key', 
    defaultScopes: ['send_email', 'validate', 'stats', 'suppressions'],
    capabilities: [
      { key: 'send_email', label: 'Send and receive emails' },
      { key: 'validate', label: 'Email validation' },
      { key: 'stats', label: 'Delivery statistics' },
      { key: 'suppressions', label: 'Suppression list management' }
    ]
  },

  // Discord - Custom bot setup
  'Discord': {
    component: DiscordSetupModal,
    credentialType: 'oauth',
    defaultScopes: ['bot', 'messages.read', 'messages.write', 'guilds'],
    capabilities: [
      { key: 'bot', label: 'Discord bot functionality' },
      { key: 'messages.read', label: 'Read messages in Discord servers' },
      { key: 'messages.write', label: 'Send messages to Discord channels' },
      { key: 'guilds', label: 'Access Discord server information' }
    ]
  },

  // DigitalOcean - API key-based cloud management
  'DigitalOcean': {
    component: DigitalOceanSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['droplet:read', 'droplet:create', 'droplet:delete', 'image:read', 'region:read', 'size:read'],
    capabilities: [
      { key: 'droplet:read', label: 'View droplets and infrastructure' },
      { key: 'droplet:create', label: 'Create new droplets' },
      { key: 'droplet:delete', label: 'Delete droplets' },
      { key: 'image:read', label: 'View available images' },
      { key: 'region:read', label: 'View available regions' },
      { key: 'size:read', label: 'View available droplet sizes' }
    ]
  },

  // SMTP - SMTP server configuration
  'SMTP': {
    component: SMTPSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['send_email'],
    capabilities: [
      { key: 'send_email', label: 'Send emails through SMTP server' },
      { key: 'custom_from', label: 'Custom from addresses and names' },
      { key: 'reply_to', label: 'Reply-to email configuration' },
      { key: 'secure_credentials', label: 'Secure credential management' }
    ]
  },

  // Pinecone - Vector database for AI memory
  'Pinecone': {
    component: PineconeSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['vector_search', 'vector_upsert', 'vector_delete', 'index_stats'],
    capabilities: [
      { key: 'vector_search', label: 'Store and retrieve vector embeddings' },
      { key: 'semantic_search', label: 'Semantic similarity search' },
      { key: 'memory_storage', label: 'Long-term memory storage' },
      { key: 'context_aware', label: 'Context-aware responses' }
    ]
  },

  // GetZep - Knowledge graph for AI memory
  'GetZep': {
    component: GetZepSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['memory_read', 'memory_write', 'session_management', 'knowledge_graph'],
    capabilities: [
      { key: 'knowledge_graph', label: 'Knowledge graph memory storage' },
      { key: 'concept_extraction', label: 'Semantic concept extraction' },
      { key: 'relationship_mapping', label: 'Relationship mapping' },
      { key: 'context_reasoning', label: 'Context-aware reasoning' }
    ]
  },

  // Serper API - Fast Google search results
  'Serper API': {
    component: SerperAPISetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search', 'local_search'],
    capabilities: [
      { key: 'web_search', label: 'Fast Google web search' },
      { key: 'news_search', label: 'News search and monitoring' },
      { key: 'image_search', label: 'Image search capabilities' },
      { key: 'local_search', label: 'Local business search' }
    ]
  },

  // SerpAPI - Comprehensive search engine results
  'SerpAPI': {
    component: SerpAPISetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search', 'video_search', 'shopping_search'],
    capabilities: [
      { key: 'multi_engine_search', label: 'Multi-engine web search' },
      { key: 'news_search', label: 'News and article search' },
      { key: 'media_search', label: 'Image and video search' },
      { key: 'shopping_search', label: 'Shopping and product search' }
    ]
  },

  // Brave Search API - Privacy-focused search
  'Brave Search API': {
    component: BraveSearchSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['web_search', 'news_search', 'image_search'],
    capabilities: [
      { key: 'privacy_search', label: 'Privacy-focused web search' },
      { key: 'news_search', label: 'News search without tracking' },
      { key: 'image_search', label: 'Image search capabilities' },
      { key: 'independent_results', label: 'Independent search results' }
    ]
  },

  // Microsoft Teams - Team collaboration and messaging
  'Microsoft Teams': {
    component: MicrosoftTeamsSetupModal,
    credentialType: 'oauth',
    defaultScopes: [
      'https://graph.microsoft.com/Chat.ReadWrite',
      'https://graph.microsoft.com/Team.ReadBasic.All',
      'https://graph.microsoft.com/Channel.ReadBasic.All',
      'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
      'https://graph.microsoft.com/User.Read'
    ],
    capabilities: [
      { key: 'send_messages', label: 'Send messages to teams and chats' },
      { key: 'read_messages', label: 'Read team and chat messages' },
      { key: 'create_meetings', label: 'Create and manage online meetings' },
      { key: 'team_info', label: 'Access team and channel information' },
      { key: 'user_profile', label: 'Read user profile information' }
    ]
  },

  // Microsoft OneDrive - File storage and sharing
  'Microsoft OneDrive': {
    component: MicrosoftOneDriveSetupModal,
    credentialType: 'oauth',
    defaultScopes: [
      'https://graph.microsoft.com/Files.Read',
      'https://graph.microsoft.com/Files.ReadWrite',
      'https://graph.microsoft.com/Files.Read.All',
      'https://graph.microsoft.com/Files.ReadWrite.All',
      'https://graph.microsoft.com/Sites.Read.All',
      'https://graph.microsoft.com/Sites.ReadWrite.All',
      'https://graph.microsoft.com/User.Read'
    ],
    capabilities: [
      { key: 'upload_files', label: 'Upload and store files' },
      { key: 'download_files', label: 'Download and access files' },
      { key: 'share_files', label: 'Share files and folders' },
      { key: 'manage_files', label: 'Organize and manage file structure' },
      { key: 'search_files', label: 'Search through files and content' }
    ]
  },

  // Microsoft Outlook - Email, calendar, and contacts
  'Microsoft Outlook': {
    component: MicrosoftOutlookSetupModal,
    credentialType: 'oauth',
    defaultScopes: [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.ReadWrite',
      'https://graph.microsoft.com/Calendars.Read',
      'https://graph.microsoft.com/Calendars.ReadWrite',
      'https://graph.microsoft.com/Contacts.Read',
      'https://graph.microsoft.com/User.Read'
    ],
    capabilities: [
      { key: 'send_email', label: 'Send and manage emails' },
      { key: 'read_email', label: 'Read and search email messages' },
      { key: 'calendar_events', label: 'Create and manage calendar events' },
      { key: 'contacts', label: 'Access and manage contacts' },
      { key: 'user_profile', label: 'Read user profile information' }
    ]
  },

  // Mistral AI - Advanced AI-powered document processing
  'Mistral AI': {
    component: MistralOCRSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['ocr', 'document_processing'],
    capabilities: [
      { key: 'high_accuracy_ocr', label: 'High-accuracy OCR with AI models' },
      { key: 'multi_page_processing', label: 'Multi-page document processing' },
      { key: 'structured_output', label: 'Structured data extraction' },
      { key: 'image_extraction', label: 'Extract images from documents' },
      { key: 'markdown_output', label: 'Markdown-formatted text output' },
      { key: 'bbox_annotation', label: 'Bounding box annotations' },
      { key: 'document_annotation', label: 'Document-level annotations' }
    ]
  },

  // Azure Document Intelligence - Enterprise-grade document processing
  'Azure Document Intelligence': {
    component: AzureDocumentIntelligenceSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['document_analysis', 'form_processing', 'table_extraction', 'layout_analysis'],
    capabilities: [
      { key: 'document_analysis', label: 'Advanced document analysis and text extraction', description: 'Extract text with enterprise-grade accuracy and layout understanding' },
      { key: 'form_processing', label: 'Form and invoice processing', description: 'Extract structured data from forms, invoices, and receipts' },
      { key: 'table_extraction', label: 'Table data extraction', description: 'Extract and structure data from tables within documents' },
      { key: 'layout_analysis', label: 'Document layout analysis', description: 'Understand document structure including headers, paragraphs, and sections' },
      { key: 'multi_format', label: 'Multiple format support', description: 'Support for PDF, images, Office documents, and more' },
      { key: 'enterprise_grade', label: 'Enterprise-grade accuracy', description: 'Microsoft Azure-powered document intelligence' }
    ]
  },

  // ClickSend SMS/MMS - SMS and MMS messaging service
  'ClickSend SMS': {
    component: ClickSendSetupModal,
    credentialType: 'api_key',
    defaultScopes: ['sms', 'mms', 'balance', 'history', 'delivery_receipts'],
    capabilities: [
      { key: 'send_sms', label: 'Send SMS messages', description: 'Send text messages to phone numbers worldwide' },
      { key: 'send_mms', label: 'Send MMS messages', description: 'Send multimedia messages with images, videos, and audio' },
      { key: 'get_balance', label: 'Check account balance', description: 'View account balance and credit information' },
      { key: 'sms_history', label: 'SMS message history', description: 'View sent SMS messages and delivery status' },
      { key: 'mms_history', label: 'MMS message history', description: 'View sent MMS messages and delivery status' },
      { key: 'delivery_receipts', label: 'Delivery receipts', description: 'Track message delivery and read receipts' },
      { key: 'international_sms', label: 'International SMS', description: 'Send SMS messages to international numbers' },
      { key: 'scheduled_messages', label: 'Scheduled messaging', description: 'Schedule messages for future delivery' }
    ]
  }
};

/**
 * Get setup component for an integration
 */
export function getIntegrationSetupComponent(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  if (!entry) {
    throw new Error(`No setup component registered for integration: ${integrationName}`);
  }
  
  return entry.component;
}

/**
 * Get integration capabilities
 */
export function getIntegrationCapabilities(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  return entry?.capabilities || [];
}

/**
 * Get integration default scopes
 */
export function getIntegrationDefaultScopes(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  return entry?.defaultScopes || [];
}

/**
 * Get integration credential type
 */
export function getIntegrationCredentialType(integrationName: string) {
  const entry = integrationSetupRegistry[integrationName];
  return entry?.credentialType || 'oauth';
}
