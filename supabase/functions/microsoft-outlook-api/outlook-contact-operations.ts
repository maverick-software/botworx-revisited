/**
 * Microsoft Outlook Contact Operations
 * Handles contact retrieval and searching via Microsoft Graph API
 * Follows existing Gmail integration patterns with Graph API specifics
 */

import { OutlookGraphClient } from './outlook-graph-client.ts';
import { sanitizeContactData, enhanceErrorForLLM } from './outlook-utils.ts';

export interface ContactListParams {
  limit?: number;
  orderBy?: 'displayName' | 'surname' | 'givenName';
  folderId?: string;
}

export interface ContactSearchParams {
  query: string;
  limit?: number;
  folderId?: string;
}

/**
 * Main handler for contact operations
 */
export async function handleContactOperation(
  action: string,
  params: any,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log(`[outlook-contacts] Handling action: ${action}`);

    switch (action) {
      case 'get_contacts':
        return await getContacts(params, graphClient, context);
      
      case 'search_contacts':
        return await searchContacts(params, graphClient, context);
      
      default:
        throw new Error(`Question: I don't recognize the contact action "${action}". Available actions are: get_contacts, search_contacts.`);
    }
  } catch (error) {
    console.error(`[outlook-contacts] Error in ${action}:`, error);
    throw error;
  }
}

/**
 * Get contacts from user's address book
 */
async function getContacts(
  params: ContactListParams,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log('[outlook-contacts] Getting contacts');

    // Build query parameters
    const queryParams: Record<string, any> = {
      '$top': Math.min(params.limit || 50, 999), // Microsoft Graph limit
      '$select': 'id,displayName,givenName,surname,emailAddresses,phoneNumbers,companyName,jobTitle,businessAddress,homeAddress'
    };

    // Add ordering
    const orderBy = params.orderBy || 'displayName';
    queryParams['$orderby'] = orderBy;

    // Get contacts from specified folder or default contacts
    const endpoint = params.folderId ? `/me/contactFolders/${params.folderId}/contacts` : '/me/contacts';
    const result = await graphClient.get(endpoint, queryParams);

    if (!result.value) {
      throw new Error('Unexpected response format from Outlook Contacts API');
    }

    // Format contacts for agent consumption
    const contacts = result.value.map((contact: any) => {
      const sanitized = sanitizeContactData(contact);
      
      return {
        id: contact.id,
        displayName: contact.displayName || 'Unknown Contact',
        firstName: contact.givenName || '',
        lastName: contact.surname || '',
        emails: contact.emailAddresses?.map((email: any) => ({
          address: email.address,
          name: email.name || contact.displayName
        })) || [],
        phoneNumbers: contact.phoneNumbers?.map((phone: any) => ({
          number: phone.number,
          type: phone.type || 'other'
        })) || [],
        company: contact.companyName || '',
        jobTitle: contact.jobTitle || '',
        businessAddress: contact.businessAddress ? {
          street: contact.businessAddress.street || '',
          city: contact.businessAddress.city || '',
          state: contact.businessAddress.state || '',
          postalCode: contact.businessAddress.postalCode || '',
          country: contact.businessAddress.countryOrRegion || ''
        } : null,
        homeAddress: contact.homeAddress ? {
          street: contact.homeAddress.street || '',
          city: contact.homeAddress.city || '',
          state: contact.homeAddress.state || '',
          postalCode: contact.homeAddress.postalCode || '',
          country: contact.homeAddress.countryOrRegion || ''
        } : null
      };
    });

    console.log(`[outlook-contacts] Retrieved ${contacts.length} contacts`);

    return {
      success: true,
      contacts: contacts,
      count: contacts.length,
      hasMore: result['@odata.nextLink'] ? true : false,
      orderBy: orderBy,
      folderId: params.folderId || 'default'
    };

  } catch (error) {
    console.error('[outlook-contacts] Get contacts error:', error);
    throw new Error(enhanceErrorForLLM(error, 'get_contacts'));
  }
}

/**
 * Search contacts in user's address book
 */
async function searchContacts(
  params: ContactSearchParams,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log('[outlook-contacts] Searching contacts');

    if (!params.query) {
      throw new Error('Question: What contact information should I search for? Please provide a name, email, or company to search.');
    }

    // Build query parameters for search
    const queryParams: Record<string, any> = {
      '$search': `"${params.query}"`,
      '$top': Math.min(params.limit || 50, 999),
      '$select': 'id,displayName,givenName,surname,emailAddresses,phoneNumbers,companyName,jobTitle,businessAddress,homeAddress'
    };

    // Search in specified folder or all contacts
    const endpoint = params.folderId ? `/me/contactFolders/${params.folderId}/contacts` : '/me/contacts';
    const result = await graphClient.get(endpoint, queryParams);

    if (!result.value) {
      throw new Error('Unexpected response format from Outlook Contacts search');
    }

    // Format search results for agent consumption
    const contacts = result.value.map((contact: any) => {
      const sanitized = sanitizeContactData(contact);
      
      return {
        id: contact.id,
        displayName: contact.displayName || 'Unknown Contact',
        firstName: contact.givenName || '',
        lastName: contact.surname || '',
        emails: contact.emailAddresses?.map((email: any) => ({
          address: email.address,
          name: email.name || contact.displayName
        })) || [],
        phoneNumbers: contact.phoneNumbers?.map((phone: any) => ({
          number: phone.number,
          type: phone.type || 'other'
        })) || [],
        company: contact.companyName || '',
        jobTitle: contact.jobTitle || '',
        businessAddress: contact.businessAddress ? {
          street: contact.businessAddress.street || '',
          city: contact.businessAddress.city || '',
          state: contact.businessAddress.state || '',
          postalCode: contact.businessAddress.postalCode || '',
          country: contact.businessAddress.countryOrRegion || ''
        } : null,
        homeAddress: contact.homeAddress ? {
          street: contact.homeAddress.street || '',
          city: contact.homeAddress.city || '',
          state: contact.homeAddress.state || '',
          postalCode: contact.homeAddress.postalCode || '',
          country: contact.homeAddress.countryOrRegion || ''
        } : null,
        relevanceScore: contact['@search.score'] || 0
      };
    });

    console.log(`[outlook-contacts] Found ${contacts.length} contacts matching "${params.query}"`);

    return {
      success: true,
      contacts: contacts,
      count: contacts.length,
      query: params.query,
      hasMore: result['@odata.nextLink'] ? true : false,
      folderId: params.folderId || 'all'
    };

  } catch (error) {
    console.error('[outlook-contacts] Search contacts error:', error);
    
    // Handle specific search errors
    if (error.message && error.message.includes('search')) {
      throw new Error(`Question: I had trouble searching your contacts for "${params.query}". Could you try different search terms or be more specific?`);
    }
    
    throw new Error(enhanceErrorForLLM(error, 'search_contacts'));
  }
}

/**
 * Get detailed contact information (for future use)
 */
export async function getContactDetails(
  contactId: string,
  graphClient: OutlookGraphClient
): Promise<any> {
  try {
    console.log(`[outlook-contacts] Getting contact details for ${contactId}`);

    const result = await graphClient.get(`/me/contacts/${contactId}`);

    const sanitized = sanitizeContactData(result);

    return {
      id: result.id,
      displayName: result.displayName || 'Unknown Contact',
      firstName: result.givenName || '',
      lastName: result.surname || '',
      middleName: result.middleName || '',
      title: result.title || '',
      emails: result.emailAddresses?.map((email: any) => ({
        address: email.address,
        name: email.name || result.displayName
      })) || [],
      phoneNumbers: result.phoneNumbers?.map((phone: any) => ({
        number: phone.number,
        type: phone.type || 'other'
      })) || [],
      company: result.companyName || '',
      jobTitle: result.jobTitle || '',
      department: result.department || '',
      officeLocation: result.officeLocation || '',
      businessAddress: result.businessAddress,
      homeAddress: result.homeAddress,
      personalNotes: result.personalNotes || '',
      birthday: result.birthday,
      createdDateTime: result.createdDateTime,
      lastModifiedDateTime: result.lastModifiedDateTime
    };

  } catch (error) {
    console.error('[outlook-contacts] Get contact details error:', error);
    throw new Error(enhanceErrorForLLM(error, 'get_contact_details'));
  }
}

/**
 * Get contact folders (for future use)
 */
export async function getContactFolders(
  graphClient: OutlookGraphClient
): Promise<any> {
  try {
    console.log('[outlook-contacts] Getting contact folders');

    const result = await graphClient.get('/me/contactFolders', {
      '$select': 'id,displayName,parentFolderId'
    });

    if (!result.value) {
      throw new Error('Unexpected response format from Outlook Contact Folders API');
    }

    const folders = result.value.map((folder: any) => ({
      id: folder.id,
      name: folder.displayName,
      parentId: folder.parentFolderId
    }));

    return {
      success: true,
      folders: folders,
      count: folders.length
    };

  } catch (error) {
    console.error('[outlook-contacts] Get contact folders error:', error);
    throw new Error(enhanceErrorForLLM(error, 'get_contact_folders'));
  }
}
