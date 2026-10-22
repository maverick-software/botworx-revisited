# SendGrid Tool Definitions Research

## Date: August 2, 2025
## Related WBS Items: 2.3, 4.3

## Overview
This document defines the SendGrid tools that will be available to agents through OpenAI's function calling interface, following the pattern established by the Gmail integration.

## Tool Registry Structure

```typescript
// Location: supabase/functions/chat/sendgrid_tools.ts

export interface SendGridTool extends MCPTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  required_permissions?: string[];  // SendGrid-specific permissions
}

export const SENDGRID_MCP_TOOLS: Record<string, SendGridTool> = {
  // Tool definitions...
};
```

## Core Tool Definitions

### 1. send_email
Basic email sending with rich content support.

```typescript
send_email: {
  name: 'send_email',
  description: 'Send an email using SendGrid. Supports plain text, HTML, and attachments.',
  parameters: {
    type: 'object',
    properties: {
      to: {
        type: 'array',
        description: 'Array of recipient email addresses',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address' },
            name: { type: 'string', description: 'Recipient name (optional)' }
          },
          required: ['email']
        },
        minItems: 1,
        maxItems: 100
      },
      cc: {
        type: 'array',
        description: 'CC recipients',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' }
          }
        }
      },
      bcc: {
        type: 'array',
        description: 'BCC recipients',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' }
          }
        }
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
        maxLength: 200
      },
      text: {
        type: 'string',
        description: 'Plain text content of the email'
      },
      html: {
        type: 'string',
        description: 'HTML content of the email'
      },
      from: {
        type: 'object',
        description: 'Override sender information',
        properties: {
          email: { type: 'string' },
          name: { type: 'string' }
        }
      },
      reply_to: {
        type: 'object',
        description: 'Reply-to address',
        properties: {
          email: { type: 'string' },
          name: { type: 'string' }
        }
      },
      attachments: {
        type: 'array',
        description: 'File attachments',
        items: {
          type: 'object',
          properties: {
            content: { 
              type: 'string', 
              description: 'Base64 encoded file content' 
            },
            filename: { 
              type: 'string', 
              description: 'Name of the file' 
            },
            type: { 
              type: 'string', 
              description: 'MIME type (e.g., "application/pdf")' 
            },
            disposition: {
              type: 'string',
              enum: ['attachment', 'inline'],
              default: 'attachment'
            }
          },
          required: ['content', 'filename']
        },
        maxItems: 10
      },
      categories: {
        type: 'array',
        description: 'Email categories for analytics',
        items: { type: 'string' },
        maxItems: 10
      },
      send_at: {
        type: 'integer',
        description: 'Unix timestamp for scheduled sending'
      },
      custom_args: {
        type: 'object',
        description: 'Custom arguments for tracking'
      }
    },
    required: ['to', 'subject'],
    oneOf: [
      { required: ['text'] },
      { required: ['html'] }
    ]
  },
  required_permissions: ['can_send_email']
}
```

### 2. send_template_email
Send emails using predefined SendGrid templates.

```typescript
send_template_email: {
  name: 'send_template_email',
  description: 'Send an email using a SendGrid dynamic template.',
  parameters: {
    type: 'object',
    properties: {
      template_id: {
        type: 'string',
        description: 'SendGrid template ID'
      },
      to: {
        type: 'array',
        description: 'Recipients with personalization data',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            name: { type: 'string' },
            substitutions: {
              type: 'object',
              description: 'Template variable substitutions for this recipient'
            }
          },
          required: ['email']
        }
      },
      dynamic_template_data: {
        type: 'object',
        description: 'Global template variables'
      },
      from: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          name: { type: 'string' }
        }
      },
      categories: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['template_id', 'to']
  },
  required_permissions: ['can_send_email', 'can_use_templates']
}
```

### 3. send_bulk_email
Send personalized emails to multiple recipients efficiently.

```typescript
send_bulk_email: {
  name: 'send_bulk_email',
  description: 'Send personalized emails to multiple recipients in a single API call.',
  parameters: {
    type: 'object',
    properties: {
      personalizations: {
        type: 'array',
        description: 'Array of recipient groups with their personalization',
        items: {
          type: 'object',
          properties: {
            to: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' }
                }
              }
            },
            cc: { type: 'array', items: { type: 'object' } },
            bcc: { type: 'array', items: { type: 'object' } },
            subject: { type: 'string' },
            substitutions: { type: 'object' },
            custom_args: { type: 'object' },
            send_at: { type: 'integer' }
          },
          required: ['to']
        },
        minItems: 1,
        maxItems: 1000
      },
      subject: {
        type: 'string',
        description: 'Default subject for all personalizations'
      },
      text: {
        type: 'string',
        description: 'Plain text content template'
      },
      html: {
        type: 'string',
        description: 'HTML content template'
      },
      from: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          name: { type: 'string' }
        }
      }
    },
    required: ['personalizations'],
    oneOf: [
      { required: ['text'] },
      { required: ['html'] }
    ]
  },
  required_permissions: ['can_send_email', 'can_send_bulk']
}
```

### 4. get_email_status
Check the delivery status of sent emails.

```typescript
get_email_status: {
  name: 'get_email_status',
  description: 'Get the delivery status and events for a sent email.',
  parameters: {
    type: 'object',
    properties: {
      message_id: {
        type: 'string',
        description: 'SendGrid message ID returned when sending'
      },
      email: {
        type: 'string',
        description: 'Recipient email to check status for'
      },
      events: {
        type: 'array',
        description: 'Specific events to filter by',
        items: {
          type: 'string',
          enum: ['processed', 'dropped', 'delivered', 'deferred', 'bounce', 'open', 'click', 'spam_report', 'unsubscribe']
        }
      },
      limit: {
        type: 'integer',
        description: 'Number of events to return',
        default: 20,
        minimum: 1,
        maximum: 100
      }
    },
    oneOf: [
      { required: ['message_id'] },
      { required: ['email'] }
    ]
  },
  required_permissions: ['can_send_email']
}
```

### 5. list_inbound_emails
View emails received through Inbound Parse.

```typescript
list_inbound_emails: {
  name: 'list_inbound_emails',
  description: 'List emails received by the agent through SendGrid Inbound Parse.',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        description: 'Number of emails to return',
        default: 50,
        minimum: 1,
        maximum: 200
      },
      offset: {
        type: 'integer',
        description: 'Pagination offset',
        default: 0
      },
      from_email: {
        type: 'string',
        description: 'Filter by sender email address'
      },
      subject_contains: {
        type: 'string',
        description: 'Filter by subject containing text'
      },
      date_from: {
        type: 'string',
        description: 'Filter emails after this date (ISO 8601)'
      },
      date_to: {
        type: 'string',
        description: 'Filter emails before this date (ISO 8601)'
      },
      has_attachments: {
        type: 'boolean',
        description: 'Filter for emails with attachments'
      },
      include_body: {
        type: 'boolean',
        description: 'Include full email body in response',
        default: false
      }
    }
  },
  required_permissions: ['can_receive_emails']
}
```

### 6. create_email_template
Create or update email templates.

```typescript
create_email_template: {
  name: 'create_email_template',
  description: 'Create a new email template in SendGrid.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Template name',
        maxLength: 100
      },
      subject: {
        type: 'string',
        description: 'Subject line template (supports variables)'
      },
      content: {
        type: 'array',
        description: 'Template content blocks',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['text/plain', 'text/html']
            },
            value: {
              type: 'string',
              description: 'Content with {{variables}}'
            }
          },
          required: ['type', 'value']
        },
        minItems: 1
      },
      test_data: {
        type: 'object',
        description: 'Test data for template variables'
      }
    },
    required: ['name', 'content']
  },
  required_permissions: ['can_manage_templates']
}
```

### 7. search_email_analytics
Search email analytics and statistics.

```typescript
search_email_analytics: {
  name: 'search_email_analytics',
  description: 'Get email statistics and analytics data.',
  parameters: {
    type: 'object',
    properties: {
      start_date: {
        type: 'string',
        description: 'Start date (YYYY-MM-DD)'
      },
      end_date: {
        type: 'string',
        description: 'End date (YYYY-MM-DD)'
      },
      aggregated_by: {
        type: 'string',
        enum: ['day', 'week', 'month'],
        default: 'day'
      },
      categories: {
        type: 'array',
        description: 'Filter by email categories',
        items: { type: 'string' }
      },
      metrics: {
        type: 'array',
        description: 'Specific metrics to include',
        items: {
          type: 'string',
          enum: ['requests', 'delivered', 'opens', 'unique_opens', 'clicks', 'unique_clicks', 'bounces', 'spam_reports']
        }
      }
    },
    required: ['start_date']
  },
  required_permissions: ['can_view_analytics']
}
```

## Permission Mapping

```typescript
// Permission requirements for each tool
const TOOL_PERMISSIONS = {
  send_email: ['can_send_email'],
  send_template_email: ['can_send_email', 'can_use_templates'],
  send_bulk_email: ['can_send_email', 'can_send_bulk'],
  get_email_status: ['can_send_email'],
  list_inbound_emails: ['can_receive_emails'],
  create_email_template: ['can_manage_templates'],
  search_email_analytics: ['can_view_analytics']
};
```

## Error Response Format

```typescript
interface SendGridToolError {
  success: false;
  error: string;
  error_code?: string;
  details?: {
    field_errors?: Record<string, string>;
    rate_limit?: {
      limit: number;
      remaining: number;
      reset_at: string;
    };
    sendgrid_error?: {
      message: string;
      field?: string;
      error_id?: string;
    };
  };
}
```

## Success Response Format

```typescript
interface SendGridToolSuccess {
  success: true;
  data: {
    message_id?: string;        // For send operations
    message_ids?: string[];     // For bulk operations
    template_id?: string;       // For template operations
    emails?: any[];            // For list operations
    analytics?: any;           // For analytics operations
    [key: string]: any;
  };
  metadata?: {
    credits_used?: number;
    execution_time_ms?: number;
    api_calls_made?: number;
  };
}
```

## Tool Usage Examples

### Example 1: Send Simple Email
```json
{
  "name": "send_email",
  "arguments": {
    "to": [{"email": "user@example.com", "name": "John Doe"}],
    "subject": "Meeting Reminder",
    "text": "Don't forget about our meeting tomorrow at 2 PM.",
    "categories": ["reminder", "meeting"]
  }
}
```

### Example 2: Send Template Email
```json
{
  "name": "send_template_email",
  "arguments": {
    "template_id": "d-abc123def456",
    "to": [{
      "email": "customer@example.com",
      "substitutions": {
        "first_name": "Jane",
        "order_number": "12345"
      }
    }],
    "dynamic_template_data": {
      "company_name": "Acme Corp"
    }
  }
}
```

### Example 3: Check Email Status
```json
{
  "name": "get_email_status",
  "arguments": {
    "message_id": "msg_xyz789",
    "events": ["delivered", "open", "click"]
  }
}
```

## Integration with FunctionCallingManager

```typescript
// In supabase/functions/chat/function_calling.ts

private async getSendGridTools(agentId: string, userId: string): Promise<OpenAIFunction[]> {
  // Check user has SendGrid configured
  const config = await this.getUserSendGridConfig(userId);
  if (!config) return [];
  
  // Get agent permissions
  const permissions = await this.getAgentSendGridPermissions(agentId, userId);
  if (!permissions) return [];
  
  // Filter tools based on permissions
  const availableTools = Object.entries(SENDGRID_MCP_TOOLS)
    .filter(([_, tool]) => {
      return tool.required_permissions?.every(perm => 
        permissions[perm] === true
      );
    })
    .map(([_, tool]) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  
  return availableTools;
}
```

## Rate Limiting Considerations

1. **Per-Agent Limits**: Enforce daily/hourly limits per agent
2. **Per-Operation Limits**: Different limits for send vs. bulk operations
3. **Global Account Limits**: Respect SendGrid account limits
4. **Backoff Strategy**: Exponential backoff on rate limit errors

## Security Validations

1. **Email Address Validation**: Validate all email addresses
2. **Content Sanitization**: Sanitize HTML content
3. **Attachment Scanning**: Validate file types and sizes
4. **Domain Restrictions**: Enforce allowed recipient domains
5. **Template Access**: Verify agent can use requested template

## Future Tool Considerations

1. **manage_suppressions**: Manage unsubscribe lists
2. **create_contact_list**: Manage marketing contacts
3. **schedule_campaign**: Schedule marketing campaigns
4. **manage_webhooks**: Configure event webhooks
5. **validate_email**: Single email validation