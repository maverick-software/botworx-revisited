// Utility functions for parsing and formatting cron expressions

/**
 * Parse a cron expression and return a human-readable description
 * Format: minute hour day month dayOfWeek
 * Example: "9 1 * * *" = "Daily at 1:09 AM"
 */
export function parseCronExpression(cronExpression: string, timezone?: string): string {
  if (!cronExpression) return 'No schedule';

  const parts = cronExpression.trim().split(' ');
  if (parts.length !== 5) return cronExpression; // Return original if invalid format

  const [minute, hour, day, month, dayOfWeek] = parts;

  // Helper function to format time
  const formatTime = (h: string, m: string) => {
    const hourNum = parseInt(h);
    const minuteNum = parseInt(m);
    
    if (isNaN(hourNum) || isNaN(minuteNum)) return `${h}:${m}`;
    
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    const displayMinute = minuteNum.toString().padStart(2, '0');
    
    return `${displayHour}:${displayMinute} ${period}`;
  };

  // Helper function to get timezone abbreviation
  const getTimezoneAbbr = (tz?: string) => {
    if (!tz) return '';
    
    const timezoneMap: Record<string, string> = {
      'America/New_York': 'EST',
      'America/Chicago': 'CST', 
      'America/Denver': 'MST',
      'America/Los_Angeles': 'PST',
      'America/Phoenix': 'MST',
      'UTC': 'UTC',
      'Europe/London': 'GMT',
      'Europe/Paris': 'CET',
      'Asia/Tokyo': 'JST'
    };
    
    return timezoneMap[tz] || tz.split('/')[1] || '';
  };

  const timezoneAbbr = getTimezoneAbbr(timezone);
  const timezoneSuffix = timezoneAbbr ? ` ${timezoneAbbr}` : '';

  // Parse different patterns
  if (day === '*' && month === '*' && dayOfWeek === '*') {
    // Daily
    return `Daily at ${formatTime(hour, minute)}${timezoneSuffix}`;
  }

  if (day === '*' && month === '*' && dayOfWeek !== '*') {
    // Weekly
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayNum = parseInt(dayOfWeek);
    const dayName = dayNames[dayNum] || `Day ${dayOfWeek}`;
    return `Weekly on ${dayName} at ${formatTime(hour, minute)}${timezoneSuffix}`;
  }

  if (day !== '*' && month === '*' && dayOfWeek === '*') {
    // Monthly
    const dayNum = parseInt(day);
    const suffix = getDayOrdinalSuffix(dayNum);
    return `Monthly on the ${dayNum}${suffix} at ${formatTime(hour, minute)}${timezoneSuffix}`;
  }

  if (day !== '*' && month !== '*') {
    // Yearly or specific date
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNum = parseInt(month) - 1;
    const monthName = monthNames[monthNum] || `Month ${month}`;
    const dayNum = parseInt(day);
    return `${monthName} ${dayNum} at ${formatTime(hour, minute)}${timezoneSuffix}`;
  }

  // Complex patterns - return a simplified version
  if (hour !== '*' && minute !== '*') {
    return `At ${formatTime(hour, minute)}${timezoneSuffix}`;
  }

  // Fallback to original expression
  return cronExpression;
}

/**
 * Get ordinal suffix for day numbers (1st, 2nd, 3rd, etc.)
 */
function getDayOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  
  const lastDigit = day % 10;
  switch (lastDigit) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Get current time for UI display
 */
function getCurrentTime(): Date {
  return new Date();
}

/**
 * Get server time from Supabase (more accurate than browser time)
 */
export async function getServerTime(supabase: any): Promise<Date> {
  try {
    const { data, error } = await supabase.rpc('get_current_utc_time');
    if (error) {
      console.warn('Failed to get server time:', error);
      return new Date(); // Fallback to local time
    }
    return new Date(data);
  } catch (error) {
    console.warn('Error fetching server time:', error);
    return new Date(); // Fallback to local time
  }
}

/**
 * Format a next run date into a relative time string
 */
export function formatNextRunTime(nextRunAt: string | Date | null, isOneTime: boolean = false): string {
  if (!nextRunAt) return 'Overdue';
  
  const nextRun = new Date(nextRunAt);
  const now = getCurrentTime();
  const diffMs = nextRun.getTime() - now.getTime();
  
  // For any task (one-time or recurring), if the time has passed, show as overdue
  if (diffMs < 0) {
    return 'Overdue';
  }
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'Starting soon';
  if (diffMinutes < 60) return `In ${diffMinutes}m`;
  if (diffHours < 24) return `In ${diffHours}h ${diffMinutes % 60}m`;
  if (diffDays < 7) return `In ${diffDays}d ${diffHours % 24}h`;
  
  // For longer periods, show the actual date
  return nextRun.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
