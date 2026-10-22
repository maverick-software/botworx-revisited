/**
 * Microsoft Outlook Integration - Utility Functions
 * Shared utility functions for Microsoft Graph API integration
 * Follows existing Gmail integration patterns with LLM-friendly error handling
 */

export interface OutlookAPIRequest {
  agent_id: string;
  action: string;
  params: Record<string, any>;
  user_id: string;
}

export interface OutlookAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    action: string;
    agent_id: string;
    user_id: string;
    execution_time: number;
    api_calls: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates incoming request structure and parameters
 */
export function validateRequest(request: any): ValidationResult {
  const errors: string[] = [];

  // Check required top-level fields
  if (!request.action) {
    errors.push('Question: What Outlook action would you like me to perform? Please specify send_email, get_emails, create_event, get_events, or get_contacts.');
  }

  if (!request.agent_id) {
    errors.push('Missing agent context. Please retry with proper agent identification.');
  }

  if (!request.user_id) {
    errors.push('Missing user context. Please ensure you are properly authenticated.');
  }

  if (!request.params) {
    errors.push('Question: What details would you like me to use for this Outlook action? Please provide the necessary parameters.');
  }

  // Action-specific parameter validation
  if (request.action && request.params) {
    const actionErrors = validateActionParameters(request.action, request.params);
    errors.push(...actionErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates action-specific parameters
 */
function validateActionParameters(action: string, params: any): string[] {
  const errors: string[] = [];

  switch (action) {
    case 'send_email':
      if (!params.to) {
        errors.push('Question: Who should I send this email to? Please provide the recipient email address.');
      } else if (!validateEmailAddress(params.to)) {
        errors.push('Question: The recipient email address appears invalid. Please provide a valid email address like "name@example.com".');
      }
      
      if (!params.subject) {
        errors.push('Question: What should be the subject of this email? Please provide a subject line.');
      }
      
      if (!params.body && !params.html) {
        errors.push('Question: What should be the content of this email? Please provide the email body or HTML content.');
      }
      break;

    case 'get_emails':
    case 'search_emails':
      if (action === 'search_emails' && !params.query) {
        errors.push('Question: What should I search for in your emails? Please provide search terms or criteria.');
      }
      break;

    case 'create_calendar_event':
      if (!params.subject) {
        errors.push('Question: What should be the title of this calendar event? Please provide an event subject.');
      }
      
      if (!params.start) {
        errors.push('Question: When should this event start? Please provide a start date and time.');
      }
      
      if (!params.end) {
        errors.push('Question: When should this event end? Please provide an end date and time.');
      }
      break;

    case 'get_calendar_events':
      // Optional parameters, no validation needed
      break;

    case 'get_contacts':
    case 'search_contacts':
      if (action === 'search_contacts' && !params.query) {
        errors.push('Question: What contact information should I search for? Please provide a name, email, or company to search.');
      }
      break;

    default:
      errors.push(`Question: I don't recognize the action "${action}". Available actions are: send_email, get_emails, search_emails, create_calendar_event, get_calendar_events, get_contacts, search_contacts.`);
  }

  return errors;
}

/**
 * Formats response in consistent structure
 */
export function formatResponse(
  data: any, 
  action: string, 
  context: { agentId: string; userId: string }, 
  success: boolean = true
): OutlookAPIResponse {
  return {
    success,
    data: success ? data : undefined,
    error: success ? undefined : data,
    metadata: {
      action,
      agent_id: context.agentId,
      user_id: context.userId,
      execution_time: Date.now(),
      api_calls: 1
    }
  };
}

/**
 * Transforms Microsoft Graph API errors to LLM-friendly messages
 */
export function enhanceErrorForLLM(error: any, action: string): string {
  const errorCode = error.response?.data?.error?.code;
  const errorMessage = error.response?.data?.error?.message || error.message;

  // Authentication and authorization errors
  if (errorCode === 'InvalidAuthenticationToken' || errorCode === 'TokenExpired') {
    return "Question: Your Outlook connection has expired. Please reconnect your Outlook account in the integrations settings and try again.";
  }

  if (errorCode === 'Forbidden' || errorCode === 'Unauthorized') {
    return "Question: I don't have permission to perform this Outlook action. Please check that you've granted the necessary permissions for Outlook integration.";
  }

  // Rate limiting errors
  if (errorCode === 'TooManyRequests') {
    return "Question: I'm making too many requests to Outlook right now. Please wait a moment and try again.";
  }

  // Not found errors - context-specific messages
  if (errorCode === 'ItemNotFound' || errorCode === 'NotFound') {
    if (action.includes('email')) {
      return "Question: I couldn't find that email. Could you provide more specific details like the subject line, sender, or date range?";
    }
    if (action.includes('event') || action.includes('calendar')) {
      return "Question: I couldn't find that calendar event. Could you provide the event title, date, or more specific details?";
    }
    if (action.includes('contact')) {
      return "Question: I couldn't find that contact. Could you provide the contact's name, email address, or company name?";
    }
    return "Question: I couldn't find that item. Could you provide more specific details to help me locate it?";
  }

  // Validation and format errors
  if (errorCode === 'InvalidRequest' || errorCode === 'BadRequest') {
    if (errorMessage.includes('email') || errorMessage.includes('address')) {
      return "Question: The email address format seems incorrect. Please provide a valid email address like 'name@example.com'.";
    }
    if (errorMessage.includes('date') || errorMessage.includes('time')) {
      return "Question: The date or time format is invalid. Please provide a date like 'September 15, 2025 2:00 PM' or use ISO format.";
    }
    return "Question: Some of the information provided is invalid. Could you please check and provide the correct details?";
  }

  // Conflict errors
  if (errorCode === 'ConflictingEvent' || errorCode === 'Conflict') {
    return "Question: This time slot conflicts with another event in your calendar. Would you like me to suggest alternative times or create the event anyway?";
  }

  // Quota and limits
  if (errorCode === 'QuotaLimitExceeded') {
    return "Question: Your Outlook storage quota is full. Please free up some space in your mailbox and try again.";
  }

  // Service unavailable
  if (errorCode === 'ServiceUnavailable' || errorCode === 'InternalServerError') {
    return "Question: Outlook services are temporarily unavailable. Please try again in a few minutes.";
  }

  // Network and timeout errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return "Question: There was a network issue connecting to Outlook. Please try again in a moment.";
  }

  // Default fallback with context
  return `Question: I encountered an issue with Outlook: ${errorMessage}. Could you try again or provide different information?`;
}

/**
 * Validates email address format
 */
export function validateEmailAddress(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates phone number format (basic validation)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  // Basic phone validation - accepts various formats
  const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)\.]{7,15}$/;
  return phoneRegex.test(phone.trim());
}

/**
 * Formats date/time for Microsoft Graph API
 */
export function formatDateTime(dateTime: string, timezone: string = 'UTC'): { dateTime: string; timeZone: string } {
  try {
    // Handle various input formats
    let date: Date;
    
    if (dateTime.includes('T') || dateTime.includes('Z')) {
      // ISO format
      date = new Date(dateTime);
    } else {
      // Natural language or other formats
      date = new Date(dateTime);
    }
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date format');
    }
    
    return {
      dateTime: date.toISOString(),
      timeZone: timezone
    };
  } catch (error) {
    throw new Error(`Question: The date/time format "${dateTime}" is not recognized. Please use a format like "September 15, 2025 2:00 PM" or "2025-09-15T14:00:00Z".`);
  }
}

/**
 * Gets required OAuth scopes for specific actions
 */
export function getRequiredScopes(action: string): string[] {
  const scopeMap: Record<string, string[]> = {
    'send_email': ['https://graph.microsoft.com/Mail.Send'],
    'get_emails': ['https://graph.microsoft.com/Mail.Read'],
    'search_emails': ['https://graph.microsoft.com/Mail.Read'],
    'create_calendar_event': ['https://graph.microsoft.com/Calendars.ReadWrite'],
    'get_calendar_events': ['https://graph.microsoft.com/Calendars.Read'],
    'get_contacts': ['https://graph.microsoft.com/Contacts.Read'],
    'search_contacts': ['https://graph.microsoft.com/Contacts.Read']
  };

  return scopeMap[action] || [];
}

/**
 * Sanitizes and validates contact data
 */
export function sanitizeContactData(contact: any): any {
  const sanitized: any = {};

  // Basic contact information
  if (contact.displayName) sanitized.displayName = String(contact.displayName).trim();
  if (contact.givenName) sanitized.givenName = String(contact.givenName).trim();
  if (contact.surname) sanitized.surname = String(contact.surname).trim();

  // Email addresses
  if (contact.emailAddresses && Array.isArray(contact.emailAddresses)) {
    sanitized.emailAddresses = contact.emailAddresses
      .filter((email: any) => email.address && validateEmailAddress(email.address))
      .map((email: any) => ({
        address: email.address.trim().toLowerCase(),
        name: email.name ? String(email.name).trim() : undefined
      }));
  }

  // Phone numbers
  if (contact.phoneNumbers && Array.isArray(contact.phoneNumbers)) {
    sanitized.phoneNumbers = contact.phoneNumbers
      .filter((phone: any) => phone.number)
      .map((phone: any) => ({
        number: String(phone.number).trim(),
        type: phone.type || 'other'
      }));
  }

  return sanitized;
}

/**
 * Creates a delay for retry mechanisms
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
