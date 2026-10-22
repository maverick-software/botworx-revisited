/**
 * SMTP API Edge Function
 * Handles SMTP operations for agents including:
 * - Email sending via SMTP servers
 * - SMTP connection testing
 * - Secure credential handling
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import nodemailer from 'npm:nodemailer@6.9.8';
import type { 
  Transporter, 
  SendMailOptions, 
  SentMessageInfo 
} from 'npm:nodemailer@6.9.8';

// =============================================
// Types and Interfaces
// =============================================

interface SMTPRequest {
  action: 'send_email' | 'test_connection';
  agent_id: string;
  user_id: string;
  params: Record<string, any>;
}

interface SMTPConfiguration {
  id: string;
  user_id: string;
  connection_name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  vault_password_id: string;
  from_email: string;
  from_name?: string;
  reply_to_email?: string;
  connection_timeout: number;
  socket_timeout: number;
  greeting_timeout: number;
  max_emails_per_day: number;
  max_recipients_per_email: number;
  is_active: boolean;
}

interface SMTPResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    execution_time_ms: number;
    retry_count?: number;
    [key: string]: any;
  };
}

// =============================================
// SMTP Manager Class
// =============================================

class SMTPManager {
  private transporters = new Map<string, Transporter>();
  
  /**
   * Create SMTP transporter with configuration
   */
  async createTransporter(config: SMTPConfiguration, password: string): Promise<Transporter> {
    const transporterConfig = {
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.username,
        pass: password,
      },
      connectionTimeout: config.connection_timeout,
      greetingTimeout: config.greeting_timeout,
      socketTimeout: config.socket_timeout,
      tls: {
        rejectUnauthorized: true, // Security: validate certificates
        minVersion: 'TLSv1.2', // Require modern TLS
      },
      pool: true, // Use connection pooling
      maxConnections: 5,
      maxMessages: 100,
    };

    const transporter = nodemailer.createTransport(transporterConfig);
    
    // Cache transporter for reuse
    this.transporters.set(config.id, transporter);
    
    // Clean up after 5 minutes of inactivity
    setTimeout(() => {
      this.transporters.delete(config.id);
      transporter.close();
    }, 5 * 60 * 1000);
    
    return transporter;
  }

  /**
   * Get or create transporter for configuration
   */
  async getTransporter(config: SMTPConfiguration, password: string): Promise<Transporter> {
    if (this.transporters.has(config.id)) {
      return this.transporters.get(config.id)!;
    }
    
    return await this.createTransporter(config, password);
  }

  /**
   * Test SMTP connection
   */
  async testConnection(config: SMTPConfiguration, password: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      const transporter = await this.createTransporter(config, password);
      
      // Verify connection
      const isConnected = await transporter.verify();
      
      if (!isConnected) {
        throw new Error('SMTP server verification failed');
      }

      const connectionTime = Date.now() - startTime;
      
      return {
        success: true,
        connectionTime,
        serverInfo: {
          host: config.host,
          port: config.port,
          secure: config.secure,
        }
      };
    } catch (error) {
      console.error('SMTP connection test failed:', error);
      
      return {
        success: false,
        connectionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmail(
    config: SMTPConfiguration,
    password: string,
    mailOptions: SendMailOptions,
    maxRetries: number = 3
  ): Promise<SentMessageInfo> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const transporter = await this.getTransporter(config, password);
        const result = await transporter.sendMail(mailOptions);
        
        console.log(`Email sent successfully on attempt ${attempt}:`, result.messageId);
        return result;
        
      } catch (error) {
        lastError = error as Error;
        console.error(`SMTP send attempt ${attempt} failed:`, error);
        
        // Don't retry on authentication errors or permanent failures
        if (this.isPermanentError(error)) {
          throw error;
        }
        
        if (attempt < maxRetries) {
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          const jitter = Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check if error is permanent (don't retry)
   */
  private isPermanentError(error: any): boolean {
    const permanentCodes = [
      'EAUTH',           // Authentication failed
      'ESOCKET',         // Socket error
      'ECONNREFUSED',    // Connection refused
      'ENOTFOUND',       // Host not found
      'ETIMEDOUT',       // Connection timeout
    ];
    
    return permanentCodes.includes(error.code) || 
           (error.responseCode && error.responseCode >= 500 && error.responseCode < 600);
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const transporter of this.transporters.values()) {
      transporter.close();
    }
    this.transporters.clear();
  }
}

// =============================================
// Validation Functions
// =============================================

function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validateEmailList(emails: string): string[] {
  if (!emails || emails.trim() === '') {
    return [];
  }

  const emailList = emails.split(',').map(e => e.trim());
  const invalidEmails: string[] = [];

  for (const email of emailList) {
    if (!validateEmailAddress(email)) {
      invalidEmails.push(email);
    }
  }

  if (invalidEmails.length > 0) {
    throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
  }

  return emailList;
}

function validateSendEmailParams(params: any): SendMailOptions {
  const errors: string[] = [];

  // Validate required fields
  if (!params.to || typeof params.to !== 'string') {
    errors.push('Recipient (to) is required');
  }

  if (!params.subject || typeof params.subject !== 'string') {
    errors.push('Subject is required');
  }

  if (!params.body || typeof params.body !== 'string') {
    errors.push('Body is required');
  }

  // Validate email addresses
  if (params.to && !validateEmailAddress(params.to)) {
    errors.push('Invalid recipient email address');
  }

  if (params.reply_to && !validateEmailAddress(params.reply_to)) {
    errors.push('Invalid reply-to email address');
  }

  // Validate email lists
  let ccList: string[] = [];
  let bccList: string[] = [];

  try {
    if (params.cc) {
      ccList = validateEmailList(params.cc);
    }
  } catch (error) {
    errors.push(`CC validation error: ${error.message}`);
  }

  try {
    if (params.bcc) {
      bccList = validateEmailList(params.bcc);
    }
  } catch (error) {
    errors.push(`BCC validation error: ${error.message}`);
  }

  // Validate content length
  if (params.subject && params.subject.length > 200) {
    errors.push('Subject must be 200 characters or less');
  }

  if (params.body && params.body.length > 1000000) { // 1MB limit
    errors.push('Body must be 1MB or less');
  }

  // Validate priority
  if (params.priority && !['high', 'normal', 'low'].includes(params.priority)) {
    errors.push('Priority must be one of: high, normal, low');
  }

  if (errors.length > 0) {
    throw new Error('Validation errors: ' + errors.join(', '));
  }

  // Build mail options
  const mailOptions: SendMailOptions = {
    to: params.to.trim(),
    subject: params.subject.trim(),
    text: params.html ? undefined : params.body,
    html: params.html ? params.body : undefined,
  };

  if (ccList.length > 0) {
    mailOptions.cc = ccList;
  }

  if (bccList.length > 0) {
    mailOptions.bcc = bccList;
  }

  if (params.reply_to) {
    mailOptions.replyTo = params.reply_to.trim();
  }

  if (params.priority) {
    mailOptions.priority = params.priority;
  }

  return mailOptions;
}

// =============================================
// Database Functions
// =============================================

async function getSMTPConfiguration(
  supabase: any,
  configId: string,
  userId: string
): Promise<SMTPConfiguration> {
  // Use the new helper function to get credentials and configuration
  const { data: credentials, error } = await supabase
    .rpc('get_smtp_credentials', {
      p_config_id: configId,
      p_user_id: userId
    });

  if (error || !credentials || credentials.length === 0) {
    throw new Error('SMTP configuration not found or access denied');
  }

  const cred = credentials[0];
  
  // Convert to SMTPConfiguration format
  return {
    id: configId,
    user_id: userId,
    connection_name: cred.connection_name || 'SMTP Connection',
    host: cred.host,
    port: cred.port,
    secure: cred.secure,
    username: cred.username,
    from_email: cred.from_email,
    from_name: cred.from_name,
    reply_to_email: cred.reply_to_email,
    // These will need to be fetched separately or have defaults
    connection_timeout: 60000,
    socket_timeout: 60000,
    greeting_timeout: 30000,
    max_emails_per_day: 100,
    max_recipients_per_email: 50,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

async function getDecryptedPassword(
  supabase: any,
  userId: string,
  vaultId: string
): Promise<string> {
  const { data: decryptedPassword, error } = await supabase
    .rpc('get_smtp_password', { 
      p_user_id: userId, 
      p_vault_id: vaultId 
    });

  if (error || !decryptedPassword) {
    throw new Error('Failed to decrypt SMTP password: ' + (error?.message || 'Unknown error'));
  }

  return decryptedPassword;
}

async function validateAgentPermissions(
  supabase: any,
  agentId: string,
  userId: string,
  configId: string,
  permissionType: string
): Promise<boolean> {
  const { data: hasPermission, error } = await supabase
    .rpc('validate_agent_smtp_permissions', {
      p_agent_id: agentId,
      p_user_id: userId,
      p_smtp_config_id: configId,
      p_permission_type: permissionType
    });

  if (error) {
    console.error('Permission validation error:', error);
    return false;
  }

  return Boolean(hasPermission);
}

async function checkRateLimit(
  supabase: any,
  userId: string,
  agentId: string,
  configId: string
): Promise<void> {
  const { error } = await supabase
    .rpc('check_smtp_rate_limit', {
      p_user_id: userId,
      p_agent_id: agentId,
      p_smtp_config_id: configId
    });

  if (error) {
    throw new Error(error.message);
  }
}

async function logOperation(
  supabase: any,
  userId: string,
  agentId: string,
  configId: string,
  operationType: string,
  params: any,
  result: any,
  status: string,
  errorMessage?: string,
  executionTime?: number,
  recipientsCount?: number
): Promise<void> {
  try {
    await supabase.rpc('log_smtp_operation', {
      p_user_id: userId,
      p_agent_id: agentId,
      p_smtp_config_id: configId,
      p_operation_type: operationType,
      p_operation_params: params,
      p_operation_result: result,
      p_status: status,
      p_error_message: errorMessage,
      p_recipients_count: recipientsCount || 0,
      p_execution_time_ms: executionTime || 0
    });
  } catch (error) {
    console.error('Failed to log SMTP operation:', error);
    // Don't throw - logging failure shouldn't break the main operation
  }
}

// =============================================
// Action Handlers
// =============================================

async function handleSendEmail(
  supabase: any,
  supabaseAdmin: any,
  smtpManager: SMTPManager,
  agentId: string,
  userId: string,
  params: any
): Promise<SMTPResponse> {
  const startTime = Date.now();
  
  try {
    console.log('[SMTP-API] handleSendEmail called with:', { agentId, userId, params });
    
    // Validate parameters
    const mailOptions = validateSendEmailParams(params);
    console.log('[SMTP-API] Mail options validated:', mailOptions);
    
    // If smtp_config_id is provided, use it. Otherwise, find the agent's SMTP configuration automatically
    let credentials;
    let credError;
    
    // ============================================
    // ACCOUNT-LEVEL SMTP CONFIGURATION
    // ============================================
    if (params.smtp_config_id) {
      console.log('[SMTP-API] Using provided smtp_config_id:', params.smtp_config_id);
      // Use specific config ID if provided
      const result = await supabase
        .rpc('get_smtp_credentials', {
          p_config_id: params.smtp_config_id,
          p_user_id: userId
        });
      credentials = result.data;
      credError = result.error;
    } else {
      console.log('[SMTP-API] Auto-discovering account-level SMTP configuration for user:', userId);
      
      // Get account_id from user
      const { data: accountData, error: accountError } = await supabase
        .from('user_accounts')
        .select('account_id')
        .eq('user_id', userId)
        .single();
      
      if (accountError || !accountData) {
        console.error('[SMTP-API] Failed to get account for user:', accountError);
        credError = new Error('Failed to retrieve user account information');
        credentials = null;
      } else {
        const accountId = accountData.account_id;
        
        // Auto-discover SMTP configuration for this account
        const result = await supabase
          .from('user_integration_credentials')
          .select(`
            id,
            connection_name,
            vault_access_token_id,
            encrypted_access_token,
            external_username,
            connection_metadata,
            service_providers!inner(name)
          `)
          .eq('account_id', accountId)
          .eq('service_providers.name', 'smtp')
          .eq('connection_status', 'active')
          .limit(1)
          .single();
          
        console.log('[SMTP-API] Auto-discovery result:', { data: result.data, error: result.error });
        
      if (result.error) {
        credError = result.error;
        credentials = null;
      } else if (!result.data) {
        console.log('[SMTP-API] No SMTP credentials found for user');
        credError = new Error('No SMTP credentials found for user');
        credentials = null;
      } else {
        // Get SMTP configuration from connection_metadata and password from vault
        console.log('[SMTP-API] Found connection, loading SMTP configuration');
        
        let smtpConfig: any = {};
        let password: string = '';
        
        // First, get the SMTP config from connection_metadata (stored by SMTPSetupModal from IntegrationsPage)
        if (result.data.connection_metadata) {
          console.log('[SMTP-API] Using SMTP config from connection_metadata:', result.data.connection_metadata);
          smtpConfig = result.data.connection_metadata;
        }
        
        // Then get the password from vault
        if (result.data.vault_access_token_id) {
          console.log('[SMTP-API] Decrypting password from vault ID:', result.data.vault_access_token_id);
          
          const { data: decryptedData, error: vaultError } = await supabaseAdmin
            .rpc('vault_decrypt', { vault_id: result.data.vault_access_token_id });
            
          if (vaultError || !decryptedData) {
            console.error('[SMTP-API] Failed to decrypt from vault:', vaultError);
            credError = new Error('Failed to decrypt SMTP password from vault');
            credentials = null;
          } else {
            console.log('[SMTP-API] Successfully decrypted password from vault');
            
            // Check if it's JSON (from channels modal) or plain text (from integrations page)
            try {
              const jsonConfig = JSON.parse(decryptedData);
              console.log('[SMTP-API] Vault contains JSON config (from channels modal)');
              // Override with the complete config from vault
              smtpConfig = jsonConfig;
              password = jsonConfig.auth?.pass || jsonConfig.password;
            } catch (e) {
              // Plain text password (from integrations page SMTPSetupModal)
              console.log('[SMTP-API] Vault contains password only (from integrations page)');
              password = decryptedData;
            }
          }
        } else if (result.data.encrypted_access_token) {
          console.log('[SMTP-API] No vault ID, using encrypted_access_token');
          try {
            smtpConfig = JSON.parse(result.data.encrypted_access_token);
            console.log('[SMTP-API] Parsed SMTP configuration from encrypted_access_token');
          } catch (e) {
            // Legacy format: just the password
            console.log('[SMTP-API] encrypted_access_token is not JSON, treating as password only');
            const connectionName = result.data.connection_name?.toLowerCase() || '';
            const username = result.data.external_username;
            
            if (connectionName.includes('smtp.com') || connectionName === 'smtp.com') {
              smtpConfig = {
                host: 'mail.smtp.com',
                port: 587,
                secure: false,
                auth: {
                  user: username,
                  pass: result.data.encrypted_access_token
                },
                from_email: username,
                from_name: result.data.connection_name
              };
            } else {
              // Default to smtp.com settings
              smtpConfig = {
                host: 'mail.smtp.com',
                port: 587,
                secure: false,
                auth: {
                  user: username,
                  pass: result.data.encrypted_access_token
                },
                from_email: username,
                from_name: result.data.connection_name
              };
            }
          }
        } else {
          console.error('[SMTP-API] No vault_access_token_id or encrypted_access_token found');
          credError = new Error('No SMTP configuration found');
          credentials = null;
        }
        
                 // Format credentials for SMTP manager
         if (!credError && smtpConfig) {
           // Handle both formats: connection_metadata + password OR complete JSON config
           const finalPassword = password || smtpConfig.auth?.pass || smtpConfig.password;
           const finalUsername = smtpConfig.username || smtpConfig.auth?.user || result.data.external_username;
           
           credentials = [{
             connection_name: result.data.connection_name,
             host: smtpConfig.host,
             port: smtpConfig.port || 587,
             secure: smtpConfig.secure || false,
             username: finalUsername,
             password: finalPassword,
             from_email: smtpConfig.from_email || finalUsername,
             from_name: smtpConfig.from_name || result.data.connection_name,
             reply_to_email: smtpConfig.reply_to_email || smtpConfig.from_email || finalUsername
           }];
           console.log('[SMTP-API] Formatted SMTP credentials for use:', {
             host: credentials[0].host,
             port: credentials[0].port,
             username: credentials[0].username,
             from_email: credentials[0].from_email,
             secure: credentials[0].secure,
             has_password: !!credentials[0].password
           });
         }
        }
      }
    } // End of account-level SMTP configuration

    if (credError || !credentials || credentials.length === 0) {
      console.error('[SMTP-API] Failed to get valid credentials:', { credError, credentialsLength: credentials?.length });
      throw new Error('SMTP configuration not found or access denied. Please ensure you have connected SMTP credentials.');
    }
    
    console.log('[SMTP-API] About to attempt email sending with credentials');

    const cred = credentials[0];
    const config = {
      id: params.smtp_config_id || 'auto-discovered',
      user_id: userId,
      connection_name: cred.connection_name || 'SMTP Connection',
      host: cred.host,
      port: cred.port,
      secure: cred.secure,
      username: cred.username,
      from_email: cred.from_email,
      from_name: cred.from_name,
      reply_to_email: cred.reply_to_email,
      connection_timeout: 60000,
      socket_timeout: 60000,
      greeting_timeout: 30000,
      max_emails_per_day: 100,
      max_recipients_per_email: 50,
      is_active: true
    };
    const password = cred.password;

         // Skip permission validation for now - the agent has already been granted access
     // through agent_integration_permissions table
     const configId = config.id;

    // Set from address
    mailOptions.from = config.from_name 
      ? `"${config.from_name}" <${config.from_email}>`
      : config.from_email;

    // Set reply-to if not specified and config has default
    if (!mailOptions.replyTo && config.reply_to_email) {
      mailOptions.replyTo = config.reply_to_email;
    }

    // Send email
    console.log('[SMTP-API] Calling smtpManager.sendEmail with config:', {
      host: config.host,
      port: config.port,
      username: config.username,
      from_email: config.from_email
    });
    
    let result;
    try {
      result = await smtpManager.sendEmail(config, password, mailOptions);
      console.log('[SMTP-API] Email sent successfully:', {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
      });
    } catch (emailError) {
      console.error('[SMTP-API] Failed to send email:', emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    // Count recipients
    const recipientsCount = [
      mailOptions.to,
      ...(Array.isArray(mailOptions.cc) ? mailOptions.cc : []),
      ...(Array.isArray(mailOptions.bcc) ? mailOptions.bcc : [])
    ].filter(Boolean).length;

         // Skip logging for now - smtp_operation_logs table doesn't exist

    return {
      success: true,
      data: {
        messageId: result.messageId,
        recipients: recipientsCount,
        accepted: result.accepted,
        rejected: result.rejected,
        pending: result.pending,
        response: result.response
      },
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
         // Skip logging for now - smtp_operation_logs table doesn't exist

    return {
      success: false,
      error: errorMessage,
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

async function handleTestConnection(
  supabase: any,
  smtpManager: SMTPManager,
  userId: string,
  params: any
): Promise<SMTPResponse> {
  const startTime = Date.now();
  
  try {
    const configId = params.smtp_config_id;

    if (!configId) {
      throw new Error('smtp_config_id is required');
    }

    // Get SMTP configuration with credentials
    const { data: credentials, error: credError } = await supabase
      .rpc('get_smtp_credentials', {
        p_config_id: configId,
        p_user_id: userId
      });

    if (credError || !credentials || credentials.length === 0) {
      throw new Error('SMTP configuration not found or access denied');
    }

    const cred = credentials[0];
    const config = {
      id: configId,
      user_id: userId,
      connection_name: cred.connection_name || 'SMTP Connection',
      host: cred.host,
      port: cred.port,
      secure: cred.secure,
      username: cred.username,
      from_email: cred.from_email,
      from_name: cred.from_name,
      reply_to_email: cred.reply_to_email,
      connection_timeout: 60000,
      socket_timeout: 60000,
      greeting_timeout: 30000,
      max_emails_per_day: 100,
      max_recipients_per_email: 50,
      is_active: true
    };
    const password = cred.password;

    // Test connection
    const result = await smtpManager.testConnection(config, password);

    // Update configuration test status
    await supabase
      .from('smtp_configurations')
      .update({
        last_tested_at: new Date().toISOString(),
        test_status: result.success ? 'success' : 'failed',
        test_error_message: result.success ? null : result.error
      })
      .eq('id', configId);

    // Log operation
    await logOperation(
      supabase, userId, null, configId, 'test_connection',
      { smtp_config_id: configId },
      result,
      result.success ? 'success' : 'error',
      result.success ? undefined : result.error,
      Date.now() - startTime
    );

    return {
      success: true,
      data: result,
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed operation
    await logOperation(
      supabase, userId, null, params.smtp_config_id, 'test_connection',
      { smtp_config_id: params.smtp_config_id },
      null,
      'error',
      errorMessage,
      Date.now() - startTime
    );

    return {
      success: false,
      error: errorMessage,
      metadata: {
        execution_time_ms: Date.now() - startTime
      }
    };
  }
}

// =============================================
// Main Handler
// =============================================

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  const smtpManager = new SMTPManager();

  try {
    // Parse request body
    const body: SMTPRequest = await req.json();
    console.log('[SMTP-API] Received request body:', JSON.stringify(body, null, 2));
    
    const { action, agent_id, user_id, params } = body;

    // Validate required fields
    if (!action || !user_id || !params) {
      console.error('[SMTP-API] Missing required fields:', { action, user_id, params: !!params });
      throw new Error('Missing required fields: action, user_id, params');
    }
    
    console.log('[SMTP-API] Validated fields:', { action, agent_id, user_id, params });

    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Create Supabase client for user operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { 
        global: { 
          headers: { Authorization: authHeader } 
        } 
      }
    );
    
    // Create service role client for vault operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let result: SMTPResponse;

    // Route to appropriate handler
    switch (action) {
      case 'send_email':
        if (!agent_id) {
          throw new Error('agent_id is required for send_email action');
        }
        result = await handleSendEmail(supabase, supabaseAdmin, smtpManager, agent_id, user_id, params);
        break;

             case 'test_connection':
         // Test connection not implemented yet - would need smtp_configurations table
         throw new Error('Test connection not implemented');

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('SMTP API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } finally {
    // Clean up connections
    smtpManager.closeAll();
  }
});
