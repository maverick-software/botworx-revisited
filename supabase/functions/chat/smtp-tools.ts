/**
 * SMTP Tool Definitions
 * Defines SMTP tools for the function calling system
 * Following the established MCP tool pattern
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  required_scopes: string[];
}

/**
 * SMTP MCP Tools
 * Available tools for SMTP email operations
 */
export const SMTP_MCP_TOOLS: Record<string, MCPTool> = {
  smtp_send_email: {
    name: 'smtp_send_email',
    description: 'Send an email via SMTP server. Use when Gmail OAuth is not available.',
    inputSchema: {
      type: 'object',
      properties: {
        smtp_config_id: {
          type: 'string',
          description: 'ID of the SMTP configuration to use for sending'
        },
        to: {
          type: 'string',
          description: 'Recipient email address'
        },
        subject: {
          type: 'string',
          description: 'Email subject line'
        },
        body: {
          type: 'string',
          description: 'Email body content (plain text or HTML)'
        },
        cc: {
          type: 'string',
          description: 'CC recipients (comma-separated email addresses)'
        },
        bcc: {
          type: 'string',
          description: 'BCC recipients (comma-separated email addresses)'
        },
        html: {
          type: 'boolean',
          description: 'Whether the body content is HTML (default: false)'
        },
        reply_to: {
          type: 'string',
          description: 'Reply-to email address (overrides configuration default)'
        },
        priority: {
          type: 'string',
          description: 'Email priority: high, normal, low (default: normal)',
          enum: ['high', 'normal', 'low']
        }
      },
      required: ['smtp_config_id', 'to', 'subject', 'body']
    },
    required_scopes: ['send_email']
  },

  smtp_test_connection: {
    name: 'smtp_test_connection',
    description: 'Test SMTP server connection and authentication',
    inputSchema: {
      type: 'object',
      properties: {
        smtp_config_id: {
          type: 'string',
          description: 'ID of the SMTP configuration to test'
        }
      },
      required: ['smtp_config_id']
    },
    required_scopes: ['test_connection']
  }
};

/**
 * SMTP Tool Permissions
 * Maps tool names to permission checks
 */
export const SMTP_TOOL_PERMISSIONS: Record<string, string> = {
  send_email: 'send_email',
  test_connection: 'test_connection'  // Always allowed for agents with SMTP access
};

/**
 * SMTP Tool Validation
 * Validates tool parameters before execution
 */
export class SMTPToolValidator {
  /**
   * Validate email address format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate email list (comma-separated)
   */
  static validateEmailList(emails: string): string[] {
    if (!emails || emails.trim() === '') {
      return [];
    }

    const emailList = emails.split(',').map(e => e.trim());
    const invalidEmails: string[] = [];

    for (const email of emailList) {
      if (!this.validateEmail(email)) {
        invalidEmails.push(email);
      }
    }

    if (invalidEmails.length > 0) {
      throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }

    return emailList;
  }

  /**
   * Validate send_email parameters
   */
  static validateSendEmailParams(params: any): {
    smtp_config_id: string;
    to: string;
    subject: string;
    body: string;
    cc?: string[];
    bcc?: string[];
    html?: boolean;
    reply_to?: string;
    priority?: string;
  } {
    const errors: string[] = [];

    // Validate required fields
    if (!params.smtp_config_id || typeof params.smtp_config_id !== 'string') {
      errors.push('smtp_config_id is required and must be a string');
    }

    if (!params.to || typeof params.to !== 'string') {
      errors.push('Recipient (to) is required and must be a string');
    }

    if (!params.subject || typeof params.subject !== 'string') {
      errors.push('Subject is required and must be a string');
    }

    if (!params.body || typeof params.body !== 'string') {
      errors.push('Body is required and must be a string');
    }

    // Validate email addresses
    if (params.to && !this.validateEmail(params.to)) {
      errors.push('Invalid recipient email address');
    }

    if (params.reply_to && !this.validateEmail(params.reply_to)) {
      errors.push('Invalid reply-to email address');
    }

    // Validate email lists
    let ccList: string[] = [];
    let bccList: string[] = [];

    try {
      if (params.cc) {
        ccList = this.validateEmailList(params.cc);
      }
    } catch (error) {
      errors.push(`CC validation error: ${error.message}`);
    }

    try {
      if (params.bcc) {
        bccList = this.validateEmailList(params.bcc);
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

    return {
      smtp_config_id: params.smtp_config_id.trim(),
      to: params.to.trim().toLowerCase(),
      subject: params.subject.trim(),
      body: params.body,
      cc: ccList.length > 0 ? ccList.map(e => e.toLowerCase()) : undefined,
      bcc: bccList.length > 0 ? bccList.map(e => e.toLowerCase()) : undefined,
      html: Boolean(params.html),
      reply_to: params.reply_to ? params.reply_to.trim().toLowerCase() : undefined,
      priority: params.priority || 'normal'
    };
  }

  /**
   * Validate test_connection parameters
   */
  static validateTestConnectionParams(params: any): {
    smtp_config_id: string;
  } {
    const errors: string[] = [];

    if (!params.smtp_config_id || typeof params.smtp_config_id !== 'string') {
      errors.push('smtp_config_id is required and must be a string');
    }

    if (errors.length > 0) {
      throw new Error('Validation errors: ' + errors.join(', '));
    }

    return {
      smtp_config_id: params.smtp_config_id.trim()
    };
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  static sanitizeParamsForLogging(params: any): any {
    const sanitized = { ...params };
    
    // Remove or mask sensitive fields
    if (sanitized.body && sanitized.body.length > 500) {
      sanitized.body = sanitized.body.substring(0, 500) + '... [truncated]';
    }

    return sanitized;
  }
}

/**
 * SMTP Tool Result Formatter
 * Formats tool execution results for display
 */
export class SMTPToolResultFormatter {
  /**
   * Format send_email result
   */
  static formatSendEmailResult(result: any, success: boolean): string {
    if (success) {
      const messageId = result?.messageId || 'N/A';
      const recipients = result?.recipients || 1;
      return `Email sent successfully to ${recipients} recipient(s). Message ID: ${messageId}`;
    } else {
      return `Failed to send email: ${result?.error || 'Unknown error'}`;
    }
  }

  /**
   * Format test_connection result
   */
  static formatTestConnectionResult(result: any, success: boolean): string {
    if (success) {
      const connectionTime = result?.connectionTime || 'N/A';
      return `SMTP connection test passed successfully. Connection time: ${connectionTime}ms`;
    } else {
      return `SMTP connection test failed: ${result?.error || 'Unknown error'}`;
    }
  }

  /**
   * Format generic SMTP tool result
   */
  static formatResult(toolName: string, result: any, success: boolean): string {
    switch (toolName) {
      case 'send_email':
        return this.formatSendEmailResult(result, success);
      case 'test_connection':
        return this.formatTestConnectionResult(result, success);
      default:
        if (success) {
          return `SMTP tool ${toolName} executed successfully`;
        } else {
          return `SMTP tool ${toolName} failed: ${result?.error || 'Unknown error'}`;
        }
    }
  }
}

/**
 * SMTP Configuration Helper
 * Utilities for working with SMTP configurations
 */
export class SMTPConfigHelper {
  /**
   * Get display name for SMTP configuration
   */
  static getDisplayName(config: any): string {
    if (config.connection_name) {
      return `${config.connection_name} (${config.from_email})`;
    }
    return `${config.host}:${config.port} (${config.from_email})`;
  }

  /**
   * Get connection summary for logging
   */
  static getConnectionSummary(config: any): string {
    const secure = config.secure ? 'SSL' : 'TLS';
    return `${config.host}:${config.port} (${secure})`;
  }

  /**
   * Validate SMTP configuration completeness
   */
  static validateConfiguration(config: any): boolean {
    const required = ['host', 'port', 'username', 'vault_password_id', 'from_email'];
    return required.every(field => config[field] !== null && config[field] !== undefined);
  }
}

export default SMTP_MCP_TOOLS;
