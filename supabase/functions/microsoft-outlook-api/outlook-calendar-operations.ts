/**
 * Microsoft Outlook Calendar Operations
 * Handles calendar event creation, reading, and management via Microsoft Graph API
 * Follows existing Gmail integration patterns with Graph API specifics
 */

import { OutlookGraphClient } from './outlook-graph-client.ts';
import { formatDateTime, validateEmailAddress, enhanceErrorForLLM } from './outlook-utils.ts';

export interface CalendarEventCreateParams {
  subject: string;
  start: string;
  end: string;
  body?: string;
  location?: string;
  attendees?: string[];
  isAllDay?: boolean;
  timeZone?: string;
  reminderMinutes?: number;
  categories?: string[];
}

export interface CalendarEventListParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
  calendarId?: string;
}

/**
 * Main handler for calendar operations
 */
export async function handleCalendarOperation(
  action: string,
  params: any,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log(`[outlook-calendar] Handling action: ${action}`);

    switch (action) {
      case 'create_calendar_event':
        return await createCalendarEvent(params, graphClient, context);
      
      case 'get_calendar_events':
        return await getCalendarEvents(params, graphClient, context);
      
      default:
        throw new Error(`Question: I don't recognize the calendar action "${action}". Available actions are: create_calendar_event, get_calendar_events.`);
    }
  } catch (error) {
    console.error(`[outlook-calendar] Error in ${action}:`, error);
    throw error;
  }
}

/**
 * Create calendar event via Microsoft Graph API
 */
async function createCalendarEvent(
  params: CalendarEventCreateParams,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log('[outlook-calendar] Creating calendar event');

    // Validate required parameters
    if (!params.subject) {
      throw new Error('Question: What should be the title of this calendar event? Please provide an event subject.');
    }

    if (!params.start) {
      throw new Error('Question: When should this event start? Please provide a start date and time.');
    }

    if (!params.end) {
      throw new Error('Question: When should this event end? Please provide an end date and time.');
    }

    // Default timezone to UTC if not specified
    const timeZone = params.timeZone || 'UTC';

    // Format start and end times
    let startTime, endTime;
    try {
      startTime = formatDateTime(params.start, timeZone);
      endTime = formatDateTime(params.end, timeZone);
    } catch (error) {
      throw error; // formatDateTime already provides LLM-friendly error messages
    }

    // Validate that end time is after start time
    if (new Date(startTime.dateTime) >= new Date(endTime.dateTime)) {
      throw new Error('Question: The event end time must be after the start time. Please provide a valid time range.');
    }

    // Build event object for Microsoft Graph API
    const event: any = {
      subject: params.subject,
      start: startTime,
      end: endTime,
      isAllDay: params.isAllDay || false
    };

    // Add event body/description if provided
    if (params.body) {
      event.body = {
        contentType: 'Text',
        content: params.body
      };
    }

    // Add location if provided
    if (params.location) {
      event.location = {
        displayName: params.location
      };
    }

    // Add attendees if provided
    if (params.attendees && params.attendees.length > 0) {
      const validAttendees = [];
      
      for (const attendeeEmail of params.attendees) {
        const email = attendeeEmail.trim();
        if (!validateEmailAddress(email)) {
          throw new Error(`Question: The attendee email address "${email}" appears invalid. Please provide valid email addresses for all attendees.`);
        }
        
        validAttendees.push({
          emailAddress: {
            address: email,
            name: email.split('@')[0] // Use part before @ as display name
          },
          type: 'required'
        });
      }
      
      event.attendees = validAttendees;
      event.responseRequested = true;
    }

    // Add reminder if specified
    if (params.reminderMinutes !== undefined) {
      event.isReminderOn = params.reminderMinutes > 0;
      if (params.reminderMinutes > 0) {
        event.reminderMinutesBeforeStart = params.reminderMinutes;
      }
    } else {
      // Default reminder: 15 minutes
      event.isReminderOn = true;
      event.reminderMinutesBeforeStart = 15;
    }

    // Add categories if provided
    if (params.categories && params.categories.length > 0) {
      event.categories = params.categories;
    }

    // Set default properties
    event.importance = 'normal';
    event.sensitivity = 'normal';
    event.showAs = 'busy';

    // Create event via Microsoft Graph API
    const endpoint = params.calendarId ? `/me/calendars/${params.calendarId}/events` : '/me/events';
    const result = await graphClient.post(endpoint, event);

    console.log('[outlook-calendar] Event created successfully');

    return {
      success: true,
      message: `Calendar event "${params.subject}" created successfully`,
      eventId: result.id,
      subject: result.subject,
      start: result.start,
      end: result.end,
      location: result.location?.displayName,
      attendees: result.attendees?.length || 0,
      webLink: result.webLink
    };

  } catch (error) {
    console.error('[outlook-calendar] Create event error:', error);
    
    // Handle specific calendar errors
    if (error.message && error.message.includes('ConflictingEvent')) {
      throw new Error('Question: This time slot conflicts with another event in your calendar. Would you like me to suggest alternative times or create the event anyway?');
    }
    
    throw new Error(enhanceErrorForLLM(error, 'create_calendar_event'));
  }
}

/**
 * Get calendar events from user's calendar
 */
async function getCalendarEvents(
  params: CalendarEventListParams,
  graphClient: OutlookGraphClient,
  context: { agentId: string; userId: string }
): Promise<any> {
  try {
    console.log('[outlook-calendar] Getting calendar events');

    // Build query parameters
    const queryParams: Record<string, any> = {
      '$top': Math.min(params.limit || 50, 999), // Microsoft Graph limit
      '$select': 'id,subject,start,end,location,attendees,organizer,isAllDay,showAs,webLink',
      '$orderby': 'start/dateTime asc'
    };

    // Add date range filter if provided
    const filters = [];
    
    if (params.startDate) {
      try {
        const startDateTime = formatDateTime(params.startDate);
        filters.push(`start/dateTime ge '${startDateTime.dateTime}'`);
      } catch (error) {
        throw new Error('Question: The start date format is invalid. Please provide a date like "September 15, 2025" or "2025-09-15".');
      }
    }

    if (params.endDate) {
      try {
        const endDateTime = formatDateTime(params.endDate);
        filters.push(`end/dateTime le '${endDateTime.dateTime}'`);
      } catch (error) {
        throw new Error('Question: The end date format is invalid. Please provide a date like "September 30, 2025" or "2025-09-30".');
      }
    }

    if (filters.length > 0) {
      queryParams['$filter'] = filters.join(' and ');
    }

    // Get events from specified calendar or default calendar
    const endpoint = params.calendarId ? `/me/calendars/${params.calendarId}/events` : '/me/events';
    const result = await graphClient.get(endpoint, queryParams);

    if (!result.value) {
      throw new Error('Unexpected response format from Outlook Calendar API');
    }

    // Format events for agent consumption
    const events = result.value.map((event: any) => ({
      id: event.id,
      subject: event.subject || '(No Subject)',
      start: {
        dateTime: event.start?.dateTime,
        timeZone: event.start?.timeZone
      },
      end: {
        dateTime: event.end?.dateTime,
        timeZone: event.end?.timeZone
      },
      location: event.location?.displayName || null,
      isAllDay: event.isAllDay || false,
      attendees: event.attendees?.map((attendee: any) => ({
        email: attendee.emailAddress?.address,
        name: attendee.emailAddress?.name,
        response: attendee.status?.response || 'none'
      })) || [],
      organizer: {
        email: event.organizer?.emailAddress?.address,
        name: event.organizer?.emailAddress?.name
      },
      status: event.showAs || 'busy',
      webLink: event.webLink
    }));

    console.log(`[outlook-calendar] Retrieved ${events.length} calendar events`);

    return {
      success: true,
      events: events,
      count: events.length,
      hasMore: result['@odata.nextLink'] ? true : false,
      dateRange: {
        start: params.startDate,
        end: params.endDate
      },
      calendarId: params.calendarId || 'default'
    };

  } catch (error) {
    console.error('[outlook-calendar] Get events error:', error);
    throw new Error(enhanceErrorForLLM(error, 'get_calendar_events'));
  }
}

/**
 * Update calendar event (for future use)
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEventCreateParams>,
  graphClient: OutlookGraphClient
): Promise<any> {
  try {
    console.log(`[outlook-calendar] Updating event ${eventId}`);

    const updateData: any = {};

    if (updates.subject) updateData.subject = updates.subject;
    if (updates.body) {
      updateData.body = {
        contentType: 'Text',
        content: updates.body
      };
    }
    if (updates.location) {
      updateData.location = {
        displayName: updates.location
      };
    }

    if (updates.start) {
      updateData.start = formatDateTime(updates.start, updates.timeZone || 'UTC');
    }
    if (updates.end) {
      updateData.end = formatDateTime(updates.end, updates.timeZone || 'UTC');
    }

    const result = await graphClient.patch(`/me/events/${eventId}`, updateData);

    return {
      success: true,
      message: 'Event updated successfully',
      eventId: result.id,
      subject: result.subject
    };

  } catch (error) {
    console.error('[outlook-calendar] Update event error:', error);
    throw new Error(enhanceErrorForLLM(error, 'update_calendar_event'));
  }
}

/**
 * Delete calendar event (for future use)
 */
export async function deleteCalendarEvent(
  eventId: string,
  graphClient: OutlookGraphClient
): Promise<any> {
  try {
    console.log(`[outlook-calendar] Deleting event ${eventId}`);

    await graphClient.delete(`/me/events/${eventId}`);

    return {
      success: true,
      message: 'Event deleted successfully',
      eventId: eventId
    };

  } catch (error) {
    console.error('[outlook-calendar] Delete event error:', error);
    throw new Error(enhanceErrorForLLM(error, 'delete_calendar_event'));
  }
}
