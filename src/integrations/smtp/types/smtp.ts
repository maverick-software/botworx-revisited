/**
 * SMTP Integration Type Definitions
 * TypeScript interfaces for SMTP functionality
 */

// =============================================
// Core SMTP Types
// =============================================

export interface SMTPConfiguration {
  id: string;
  user_id: string;
  connection_name: string;
  
  // SMTP Server Settings
  host: string;
  port: number;
  secure: boolean;  // true for SSL (465), false for TLS (587)
  
  // Authentication
  username: string;
  vault_password_id: string;  // Reference to encrypted password
  
  // Email Defaults
  from_email: string;
  from_name?: string;
  reply_to_email?: string;
  
  // Connection Settings
  connection_timeout: number;
  socket_timeout: number;
  greeting_timeout: number;
  
  // Rate Limiting
  max_emails_per_day: number;
  max_recipients_per_email: number;
  
  // Status
  is_active: boolean;
  last_tested_at?: string;
  test_status: 'success' | 'failed' | 'pending';
  test_error_message?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface SMTPConfigurationCreate {
  connection_name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;  // Will be encrypted and stored as vault_password_id
  from_email: string;
  from_name?: string;
  reply_to_email?: string;
  connection_timeout?: number;
  socket_timeout?: number;
  greeting_timeout?: number;
  max_emails_per_day?: number;
  max_recipients_per_email?: number;
}

export interface SMTPConfigurationUpdate {
  connection_name?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;  // If provided, will update vault_password_id
  from_email?: string;
  from_name?: string;
  reply_to_email?: string;
  connection_timeout?: number;
  socket_timeout?: number;
  greeting_timeout?: number;
  max_emails_per_day?: number;
  max_recipients_per_email?: number;
}

// =============================================
// Agent Permission Types
// =============================================

export interface AgentSMTPPermission {
  id: string;
  agent_id: string;
  smtp_config_id: string;
  
  // Permissions
  can_send_email: boolean;
  can_send_attachments: boolean;
  can_use_custom_from: boolean;
  
  // Rate Limits (override config defaults)
  daily_email_limit?: number;
  recipients_per_email_limit?: number;
  
  // Restrictions
  allowed_recipients: string[];  // Email patterns
  blocked_recipients: string[];  // Email patterns
  
  // Metadata
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentSMTPPermissionCreate {
  agent_id: string;
  smtp_config_id: string;
  can_send_email?: boolean;
  can_send_attachments?: boolean;
  can_use_custom_from?: boolean;
  daily_email_limit?: number;
  recipients_per_email_limit?: number;
  allowed_recipients?: string[];
  blocked_recipients?: string[];
  expires_at?: string;
}

export interface AgentSMTPPermissionUpdate {
  can_send_email?: boolean;
  can_send_attachments?: boolean;
  can_use_custom_from?: boolean;
  daily_email_limit?: number;
  recipients_per_email_limit?: number;
  allowed_recipients?: string[];
  blocked_recipients?: string[];
  expires_at?: string;
  is_active?: boolean;
}

// =============================================
// Operation Log Types
// =============================================

export interface SMTPOperationLog {
  id: string;
  user_id: string;
  agent_id?: string;
  smtp_config_id: string;
  
  // Operation Details
  operation_type: 'send_email' | 'test_connection';
  operation_params?: Record<string, any>;
  operation_result?: Record<string, any>;
  
  // Email Details
  recipients_count: number;
  has_attachments: boolean;
  email_size_bytes?: number;
  
  // Status
  status: 'success' | 'error' | 'timeout';
  error_message?: string;
  error_code?: string;
  
  // Performance
  execution_time_ms: number;
  retry_count: number;
  
  // Audit
  client_ip?: string;
  user_agent?: string;
  
  created_at: string;
}

// =============================================
// Tool Parameter Types
// =============================================

export interface SendEmailParams {
  smtp_config_id: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  html?: boolean;
  reply_to?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface TestConnectionParams {
  smtp_config_id: string;
}

// =============================================
// Tool Result Types
// =============================================

export interface SMTPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    retry_count?: number;
    [key: string]: any;
  };
}

export interface SendEmailResult {
  messageId: string;
  recipients: number;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string;
}

export interface TestConnectionResult {
  success: boolean;
  connectionTime: number;
  serverInfo?: {
    host: string;
    port: number;
    secure: boolean;
    greeting?: string;
  };
  error?: string;
}

// =============================================
// UI Component Types
// =============================================

export interface SMTPConfigurationFormData {
  connection_name: string;
  host: string;
  port: string;  // String for form input
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  reply_to_email: string;
  connection_timeout: string;  // String for form input
  socket_timeout: string;
  greeting_timeout: string;
  max_emails_per_day: string;
  max_recipients_per_email: string;
}

export interface SMTPConfigurationCardProps {
  configuration: SMTPConfiguration;
  onEdit: (config: SMTPConfiguration) => void;
  onDelete: (configId: string) => void;
  onTest: (configId: string) => void;
  onToggleActive: (configId: string, isActive: boolean) => void;
}

export interface SMTPSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: SMTPConfigurationCreate) => Promise<void>;
  editingConfig?: SMTPConfiguration;
}

export interface AgentSMTPPermissionsProps {
  agentId: string;
  permissions: AgentSMTPPermission[];
  availableConfigs: SMTPConfiguration[];
  onAddPermission: (permission: AgentSMTPPermissionCreate) => Promise<void>;
  onUpdatePermission: (permissionId: string, updates: AgentSMTPPermissionUpdate) => Promise<void>;
  onRemovePermission: (permissionId: string) => Promise<void>;
}

// =============================================
// API Response Types
// =============================================

export interface SMTPAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SMTPConfigurationListResponse {
  configurations: SMTPConfiguration[];
  total: number;
}

export interface SMTPPermissionListResponse {
  permissions: AgentSMTPPermission[];
  total: number;
}

export interface SMTPOperationLogListResponse {
  logs: SMTPOperationLog[];
  total: number;
  hasMore: boolean;
}

// =============================================
// Hook Types
// =============================================

export interface UseSMTPConfigurationsResult {
  configurations: SMTPConfiguration[];
  loading: boolean;
  error: string | null;
  createConfiguration: (config: SMTPConfigurationCreate) => Promise<SMTPConfiguration>;
  updateConfiguration: (id: string, updates: SMTPConfigurationUpdate) => Promise<SMTPConfiguration>;
  deleteConfiguration: (id: string) => Promise<void>;
  testConfiguration: (id: string) => Promise<TestConnectionResult>;
  toggleActive: (id: string, isActive: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseSMTPPermissionsResult {
  permissions: AgentSMTPPermission[];
  loading: boolean;
  error: string | null;
  addPermission: (permission: AgentSMTPPermissionCreate) => Promise<AgentSMTPPermission>;
  updatePermission: (id: string, updates: AgentSMTPPermissionUpdate) => Promise<AgentSMTPPermission>;
  removePermission: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export interface UseSMTPLogsResult {
  logs: SMTPOperationLog[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  filter: (filters: SMTPLogFilters) => void;
}

export interface SMTPLogFilters {
  agentId?: string;
  configId?: string;
  operationType?: 'send_email' | 'test_connection';
  status?: 'success' | 'error' | 'timeout';
  dateFrom?: string;
  dateTo?: string;
}

// =============================================
// Validation Types
// =============================================

export interface SMTPValidationError {
  field: string;
  message: string;
}

export interface SMTPValidationResult {
  isValid: boolean;
  errors: SMTPValidationError[];
}

// =============================================
// Common SMTP Provider Presets
// =============================================

export interface SMTPProviderPreset {
  name: string;
  displayName: string;
  host: string;
  port: number;
  secure: boolean;
  description: string;
  authType: 'password' | 'oauth' | 'app_password';
  setupInstructions?: string;
}

export const SMTP_PROVIDER_PRESETS: SMTPProviderPreset[] = [
  {
    name: 'gmail',
    displayName: 'Gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    description: 'Google Gmail SMTP',
    authType: 'app_password',
    setupInstructions: 'Use your Gmail address and an App Password (not your regular password). Enable 2FA and generate an App Password in Google Account settings.'
  },
  {
    name: 'outlook',
    displayName: 'Outlook/Hotmail',
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    description: 'Microsoft Outlook/Hotmail SMTP',
    authType: 'password',
    setupInstructions: 'Use your full email address and password. Modern authentication may be required.'
  },
  {
    name: 'yahoo',
    displayName: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    description: 'Yahoo Mail SMTP',
    authType: 'app_password',
    setupInstructions: 'Use your Yahoo email and an App Password. Generate App Password in Yahoo Account Security settings.'
  },
  {
    name: 'icloud',
    displayName: 'Apple iCloud',
    host: 'smtp.mail.me.com',
    port: 587,
    secure: false,
    description: 'Apple iCloud Mail SMTP',
    authType: 'app_password',
    setupInstructions: 'Use your Apple ID email and an app-specific password. Enable 2FA and generate app password in Apple ID settings.'
  },
  {
    name: 'zoho',
    displayName: 'Zoho Mail',
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    description: 'Zoho Mail SMTP',
    authType: 'password',
    setupInstructions: 'Use your Zoho email and password. For free accounts, SMTP may need to be enabled in settings.'
  },
  {
    name: 'protonmail',
    displayName: 'ProtonMail',
    host: '127.0.0.1',
    port: 1025,
    secure: false,
    description: 'ProtonMail SMTP (via Bridge)',
    authType: 'password',
    setupInstructions: 'Requires ProtonMail Bridge app running locally. Use Bridge credentials, not ProtonMail password.'
  },
  {
    name: 'amazonses',
    displayName: 'Amazon SES',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
    description: 'Amazon Simple Email Service',
    authType: 'password',
    setupInstructions: 'Use your SES SMTP username and password. Update host to your region (e.g., email-smtp.eu-west-1.amazonaws.com). Verify your domain/email in AWS SES console first.'
  },
  {
    name: 'sendgrid',
    displayName: 'SendGrid SMTP',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    description: 'SendGrid SMTP API',
    authType: 'password',
    setupInstructions: 'Username is "apikey", password is your SendGrid API key.'
  },
  {
    name: 'mailjet',
    displayName: 'Mailjet',
    host: 'in-v3.mailjet.com',
    port: 587,
    secure: false,
    description: 'Mailjet SMTP Service',
    authType: 'password',
    setupInstructions: 'Use your Mailjet API Key as username and Secret Key as password.'
  },
  {
    name: 'smtpcom',
    displayName: 'SMTP.com',
    host: 'send.smtp.com',
    port: 2525,
    secure: false,
    description: 'SMTP.com Professional Email Service',
    authType: 'password',
    setupInstructions: 'Use your SMTP.com username and password. Alternative ports: 25, 587, 2082. Port 2525 is recommended for best deliverability.'
  },
  {
    name: 'custom',
    displayName: 'Custom SMTP Server',
    host: '',
    port: 587,
    secure: false,
    description: 'Custom SMTP server configuration',
    authType: 'password',
    setupInstructions: 'Enter your custom SMTP server details manually.'
  }
];

// =============================================
// Export all types
// =============================================

export type {
  // Core types
  SMTPConfiguration,
  SMTPConfigurationCreate,
  SMTPConfigurationUpdate,
  
  // Permission types
  AgentSMTPPermission,
  AgentSMTPPermissionCreate,
  AgentSMTPPermissionUpdate,
  
  // Log types
  SMTPOperationLog,
  
  // Tool types
  SendEmailParams,
  TestConnectionParams,
  SMTPToolResult,
  SendEmailResult,
  TestConnectionResult,
  
  // UI types
  SMTPConfigurationFormData,
  SMTPConfigurationCardProps,
  SMTPSetupModalProps,
  AgentSMTPPermissionsProps,
  
  // API types
  SMTPAPIResponse,
  SMTPConfigurationListResponse,
  SMTPPermissionListResponse,
  SMTPOperationLogListResponse,
  
  // Hook types
  UseSMTPConfigurationsResult,
  UseSMTPPermissionsResult,
  UseSMTPLogsResult,
  SMTPLogFilters,
  
  // Validation types
  SMTPValidationError,
  SMTPValidationResult,
  
  // Provider types
  SMTPProviderPreset
};
