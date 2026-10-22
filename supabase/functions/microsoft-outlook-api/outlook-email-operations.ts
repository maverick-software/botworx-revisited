/**
 * Microsoft Outlook Email Operations
 * Handles email sending, reading, and searching via Microsoft Graph API
 * Follows existing Gmail integration patterns with Graph API specifics
 */

import { OutlookGraphClient } from './outlook-graph-client.ts';
import { validateEmailAddress, enhanceErrorForLLM } from './outlook-utils.ts';

export interface EmailSendParams {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

export interface EmailListParams {
  limit?: number;
  folder?: string;
  unreadOnly?: boolean;
}

export interface EmailSearchParams {
  query: string;
  limit?: number;
  folder?: string;
}

/**
 * Main handler for email operations
 */
export async function handleEmailOperation(
  action: string,
  params: any,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log(`[outlook-email] Handling action: ${action}`);

    switch (action) {
      case 'send_email':
        return await sendEmail(params, graphClient, context);
      
      case 'get_emails':
        return await getEmails(params, graphClient, context);
      
      case 'search_emails':
        return await searchEmails(params, graphClient, context);
      
      default:
        throw new Error(`Question: I don't recognize the email action "${action}". Available actions are: send_email, get_emails, search_emails.`);
    }
  } catch (error) {
    console.error(`[outlook-email] Error in ${action}:`, error);
    throw error;
  }
}

/**
 * Send email via Microsoft Graph API
 */
async function sendEmail(
  params: EmailSendParams,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log('[outlook-email] Sending email');

    // Validate required parameters
    if (!params.to) {
      throw new Error('Question: Who should I send this email to? Please provide the recipient email address.');
    }

    if (!params.subject) {
      throw new Error('Question: What should be the subject of this email? Please provide a subject line.');
    }

    if (!params.body && !params.html) {
      throw new Error('Question: What should be the content of this email? Please provide the email body.');
    }

    // Validate email addresses
    const recipients = params.to.split(',').map(email => email.trim());
    for (const recipient of recipients) {
      if (!validateEmailAddress(recipient)) {
        throw new Error(`Question: The email address "${recipient}" appears invalid. Please provide a valid email address like "name@example.com".`);
      }
    }

    // Build email message for Microsoft Graph API
    const message: any = {
      subject: params.subject,
      body: {
        contentType: params.html ? 'HTML' : 'Text',
        content: params.html || params.body
      },
      toRecipients: recipients.map(email => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0] // Use part before @ as display name
        }
      }))
    };

    // Add CC recipients if provided
    if (params.cc) {
      const ccRecipients = params.cc.split(',').map(email => email.trim());
      for (const ccEmail of ccRecipients) {
        if (!validateEmailAddress(ccEmail)) {
          throw new Error(`Question: The CC email address "${ccEmail}" appears invalid. Please provide a valid email address.`);
        }
      }
      message.ccRecipients = ccRecipients.map(email => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0]
        }
      }));
    }

    // Add BCC recipients if provided
    if (params.bcc) {
      const bccRecipients = params.bcc.split(',').map(email => email.trim());
      for (const bccEmail of bccRecipients) {
        if (!validateEmailAddress(bccEmail)) {
          throw new Error(`Question: The BCC email address "${bccEmail}" appears invalid. Please provide a valid email address.`);
        }
      }
      message.bccRecipients = bccRecipients.map(email => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0]
        }
      }));
    }

    // Add attachments if provided
    if (params.attachments && params.attachments.length > 0) {
      message.attachments = params.attachments.map(attachment => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: attachment.filename,
        contentBytes: attachment.content,
        contentType: attachment.contentType || 'application/octet-stream'
      }));
    }

    // Send email via Microsoft Graph API
    const result = await graphClient.post('/me/sendMail', {
      message: message,
      saveToSentItems: true
    });

    console.log('[outlook-email] Email sent successfully');

    return {
      success: true,
      message: `Email sent successfully to ${params.to}`,
      messageId: result?.id,
      recipients: recipients.length,
      subject: params.subject
    };

  } catch (error) {
    console.error('[outlook-email] Send email error:', error);
    throw new Error(enhanceErrorForLLM(error, 'send_email'));
  }
}

/**
 * Get emails from user's mailbox
 */
async function getEmails(
  params: EmailListParams,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log('[outlook-email] Getting emails');

    // Build query parameters
    const queryParams: Record<string, any> = {
      '$top': Math.min(params.limit || 25, 999), // Microsoft Graph limit
      '$select': 'id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments',
      '$orderby': 'receivedDateTime desc'
    };

    // Add filter for unread emails if requested
    if (params.unreadOnly) {
      queryParams['$filter'] = 'isRead eq false';
    }

    // Get emails from specified folder or inbox
    const endpoint = params.folder ? `/me/mailFolders/${params.folder}/messages` : '/me/messages';
    const result = await graphClient.get(endpoint, queryParams);

    if (!result.value) {
      throw new Error('Unexpected response format from Outlook API');
    }

    // Format emails for agent consumption
    const emails = result.value.map((email: any) => ({
      id: email.id,
      subject: email.subject || '(No Subject)',
      from: email.from?.emailAddress?.address || 'Unknown Sender',
      fromName: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown',
      receivedDateTime: email.receivedDateTime,
      isRead: email.isRead,
      preview: email.bodyPreview || '',
      hasAttachments: email.hasAttachments || false
    }));

    console.log(`[outlook-email] Retrieved ${emails.length} emails`);

    return {
      success: true,
      emails: emails,
      count: emails.length,
      hasMore: result['@odata.nextLink'] ? true : false,
      folder: params.folder || 'inbox'
    };

  } catch (error) {
    console.error('[outlook-email] Get emails error:', error);
    throw new Error(enhanceErrorForLLM(error, 'get_emails'));
  }
}

/**
 * Search emails in user's mailbox
 */
async function searchEmails(
  params: EmailSearchParams,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log('[outlook-email] Searching emails');

    if (!params.query) {
      throw new Error('Question: What should I search for in your emails? Please provide search terms.');
    }

    // Build query parameters for search
    const queryParams: Record<string, any> = {
      '$search': `"${params.query}"`,
      '$top': Math.min(params.limit || 25, 999),
      '$select': 'id,subject,from,receivedDateTime,isRead,bodyPreview,hasAttachments',
      '$orderby': 'receivedDateTime desc'
    };

    // Search in specified folder or all folders
    const endpoint = params.folder ? `/me/mailFolders/${params.folder}/messages` : '/me/messages';
    const result = await graphClient.get(endpoint, queryParams);

    if (!result.value) {
      throw new Error('Unexpected response format from Outlook search');
    }

    // Format search results for agent consumption
    const emails = result.value.map((email: any) => ({
      id: email.id,
      subject: email.subject || '(No Subject)',
      from: email.from?.emailAddress?.address || 'Unknown Sender',
      fromName: email.from?.emailAddress?.name || email.from?.emailAddress?.address || 'Unknown',
      receivedDateTime: email.receivedDateTime,
      isRead: email.isRead,
      preview: email.bodyPreview || '',
      hasAttachments: email.hasAttachments || false,
      relevanceScore: email['@search.score'] || 0
    }));

    console.log(`[outlook-email] Found ${emails.length} emails matching "${params.query}"`);

    return {
      success: true,
      emails: emails,
      count: emails.length,
      query: params.query,
      hasMore: result['@odata.nextLink'] ? true : false,
      folder: params.folder || 'all'
    };

  } catch (error) {
    console.error('[outlook-email] Search emails error:', error);
    
    // Handle specific search errors
    if (error.message && error.message.includes('search')) {
      throw new Error(`Question: I had trouble searching your emails for "${params.query}". Could you try different search terms or be more specific?`);
    }
    
    throw new Error(enhanceErrorForLLM(error, 'search_emails'));
  }
}

/**
 * Get detailed email content (for future use)
 */
export async function getEmailDetails(
  emailId: string,
  graphClient: OutlookGraphClient
): Promise<any> {
  try {
    const result = await graphClient.get(`/me/messages/${emailId}`, {
      '$select': 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,attachments,isRead'
    });

    return {
      id: result.id,
      subject: result.subject,
      from: result.from?.emailAddress,
      to: result.toRecipients?.map((r: any) => r.emailAddress) || [],
      cc: result.ccRecipients?.map((r: any) => r.emailAddress) || [],
      receivedDateTime: result.receivedDateTime,
      body: result.body?.content || '',
      bodyType: result.body?.contentType || 'Text',
      attachments: result.attachments?.value || [],
      isRead: result.isRead
    };

  } catch (error) {
    console.error('[outlook-email] Get email details error:', error);
    throw new Error(enhanceErrorForLLM(error, 'get_email_details'));
  }
}
