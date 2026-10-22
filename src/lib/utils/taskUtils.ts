import { TaskFormData } from '@/types/tasks';

export const getSupportedTimezones = (): string[] => {
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Vancouver',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Australia/Sydney',
    'Australia/Melbourne'
  ];

  try {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezones.includes(userTz)) {
      timezones.unshift(userTz);
    }
  } catch (e) {
    // Ignore if browser doesn't support timezone detection
  }

  return timezones;
};

export const formatTimezoneLabel = (tz: string): string => {
  try {
    const now = new Date();
    
    // Get the actual timezone offset in minutes
    const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const offsetMinutes = (localTime.getTime() - utcTime.getTime()) / (1000 * 60);
    const offsetHours = Math.round(offsetMinutes / 60);
    
    // Format the offset correctly
    const sign = offsetHours >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetHours);
    
    return `${tz.replace('_', ' ')} (UTC${sign}${absOffset})`;
  } catch (error) {
    console.error('Error formatting timezone label for', tz, error);
    return tz;
  }
};

export const toUtcIsoForTimezone = (dateStr: string, timeStr: string, tz: string): string => {
  try {
    const localDateTime = new Date(`${dateStr}T${timeStr}`);
    const utcTime = new Date(localDateTime.toLocaleString('en-US', { timeZone: 'UTC' }));
    const targetTime = new Date(localDateTime.toLocaleString('en-US', { timeZone: tz }));
    const offset = utcTime.getTime() - targetTime.getTime();
    const adjustedTime = new Date(localDateTime.getTime() + offset);
    return adjustedTime.toISOString();
  } catch (error) {
    console.error('Error converting timezone:', error);
    return new Date(`${dateStr}T${timeStr}`).toISOString();
  }
};

export const generateCronExpression = (unit: string, interval: number, time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  
  switch (unit) {
    case 'minute':
      // For minute intervals, we'll store the time as a comment in the cron expression
      // This allows us to preserve the user's intended start time
      const minuteCron = interval === 1 ? '* * * * *' : `*/${interval} * * * *`;
      // Store time as comment: "*/4 * * * * # time=17:06"
      return `${minuteCron} # time=${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    case 'hour':
      // Every X hours at the specified minute
      return interval === 1 ? `${minutes} * * * *` : `${minutes} */${interval} * * *`;
    case 'day':
      // Every X days at the specified time
      return interval === 1 ? `${minutes} ${hours} * * *` : `${minutes} ${hours} */${interval} * *`;
    case 'week':
      // Weekly on Sunday at the specified time
      return `${minutes} ${hours} * * 0`;
    case 'month':
      // Monthly on the 1st at the specified time
      return `${minutes} ${hours} 1 * *`;
    case 'year':
      // Yearly on Jan 1st at the specified time
      return `${minutes} ${hours} 1 1 *`;
    default:
      return `${minutes} ${hours} * * *`;
  }
};

export const generateOneTimeCronExpression = (date: string, time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  
  // Parse date string more safely to avoid timezone issues
  // Input format: "2025-09-04" -> split and parse manually
  const [year, month, day] = date.split('-').map(Number);
  
  console.log(`Generating one-time cron for date: ${date}, parsed as day: ${day}, month: ${month}`);
  
  // Format: minute hour day month dayOfWeek
  // For one-time: specific minute, hour, day, month, any day of week (*)
  return `${minutes} ${hours} ${day} ${month} *`;
};

export const parseCronForRecurring = (cronExpression: string): { 
  time: string; 
  interval: number; 
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' 
} | null => {
  try {
    // Check for time comment in cron expression: "*/4 * * * * # time=17:06"
    let actualCron = cronExpression.trim();
    let timeFromComment = '00:00';
    
    if (cronExpression.includes(' # time=')) {
      const [cronPart, commentPart] = cronExpression.split(' # time=');
      actualCron = cronPart.trim();
      timeFromComment = commentPart.trim();
    }
    
    const parts = actualCron.split(' ');
    if (parts.length !== 5) return null;

    const [minute, hour, day, month, dayOfWeek] = parts;

    // Parse minute-based intervals: */5 * * * *
    if (minute.startsWith('*/') && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      const interval = parseInt(minute.substring(2));
      // Use time from comment if available, otherwise default
      return { time: timeFromComment, interval, unit: 'minute' };
    }

    // Parse hour-based intervals: 30 */2 * * *
    if (!minute.includes('*') && hour.startsWith('*/') && day === '*' && month === '*' && dayOfWeek === '*') {
      const interval = parseInt(hour.substring(2));
      const time = `${hour === '*' ? '00' : '00'}:${minute.padStart(2, '0')}`;
      return { time, interval, unit: 'hour' };
    }

    // Parse day-based intervals: 30 14 */3 * *
    if (!minute.includes('*') && !hour.includes('*') && day.startsWith('*/') && month === '*' && dayOfWeek === '*') {
      const interval = parseInt(day.substring(2));
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval, unit: 'day' };
    }

    // Parse daily: 30 14 * * *
    if (!minute.includes('*') && !hour.includes('*') && day === '*' && month === '*' && dayOfWeek === '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'day' };
    }

    // Parse weekly: 30 14 * * 0 (Sunday)
    if (!minute.includes('*') && !hour.includes('*') && day === '*' && month === '*' && dayOfWeek !== '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'week' };
    }

    // Parse monthly: 30 14 1 * *
    if (!minute.includes('*') && !hour.includes('*') && day !== '*' && month === '*' && dayOfWeek === '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'month' };
    }

    // Parse yearly: 30 14 1 1 *
    if (!minute.includes('*') && !hour.includes('*') && day !== '*' && month !== '*' && dayOfWeek === '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'year' };
    }

    return null;
  } catch (error) {
    console.error('Error parsing cron expression:', error);
    return null;
  }
};

export const getDefaultTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

export const formatTaskScheduleDisplay = (task: {
  cron_expression?: string;
  max_executions?: number;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  next_run_at?: string; // Use this to infer the intended time for minute intervals
}): string => {
  if (!task.cron_expression) return 'No schedule';

  const timezone = task.timezone || 'UTC';
  const isOneTime = task.max_executions === 1;

  if (isOneTime) {
    // One-time task display
    const startDate = task.start_date ? (() => {
      try {
        // Parse date directly without timezone conversion
        let dateStr = task.start_date;
        
        // Handle ISO string format: "2025-09-04T00:00:00+00:00" -> "2025-09-04"
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        
        // Parse YYYY-MM-DD format directly
        const [year, month, day] = dateStr.split('-').map(Number);
        if (year && month && day) {
          const shortYear = year.toString().slice(-2);
          return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${shortYear}`;
        }
        
        console.error('Invalid start_date format:', task.start_date);
        return 'Invalid Date';
      } catch (error) {
        console.error('Error parsing start_date:', task.start_date, error);
        return 'Invalid Date';
      }
    })() : '';
    
    const parsed = parseCronForRecurring(task.cron_expression);
    const time = parsed?.time || '00:00';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    
    return `One-time on ${startDate} at ${formattedTime}`;
  } else {
    // Recurring task display
    const parsed = parseCronForRecurring(task.cron_expression);
    if (!parsed) return 'Recurring task';

    let timeToDisplay = parsed.time;
    
    // For minute intervals, try to get the time from next_run_at since cron doesn't store it
    if (parsed.unit === 'minute' && timeToDisplay === '00:00' && task.next_run_at) {
      try {
        const nextRunDate = new Date(task.next_run_at);
        const hours = nextRunDate.getHours();
        const minutes = nextRunDate.getMinutes();
        timeToDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } catch (error) {
        console.error('Error parsing next_run_at for time display:', error);
      }
    }

    const [hours, minutes] = timeToDisplay.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;

    const startDate = task.start_date ? (() => {
      try {
        // Parse date directly without timezone conversion
        let dateStr = task.start_date;
        
        // Handle ISO string format: "2025-09-04T00:00:00+00:00" -> "2025-09-04"
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        
        // Parse YYYY-MM-DD format directly
        const [year, month, day] = dateStr.split('-').map(Number);
        if (year && month && day) {
          const shortYear = year.toString().slice(-2);
          return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${shortYear}`;
        }
        
        console.error('Invalid start_date format:', task.start_date);
        return 'Invalid Date';
      } catch (error) {
        console.error('Error parsing start_date:', task.start_date, error);
        return 'Invalid Date';
      }
    })() : '';
    
    const endDate = task.end_date ? (() => {
      try {
        // Parse date directly without timezone conversion
        let dateStr = task.end_date;
        
        // Handle ISO string format: "2025-09-06T00:00:00+00:00" -> "2025-09-06"
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        
        // Parse YYYY-MM-DD format directly
        const [year, month, day] = dateStr.split('-').map(Number);
        if (year && month && day) {
          const shortYear = year.toString().slice(-2);
          return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${shortYear}`;
        }
        
        console.error('Invalid end_date format:', task.end_date);
        return 'Invalid Date';
      } catch (error) {
        console.error('Error parsing end_date:', task.end_date, error);
        return 'Invalid Date';
      }
    })() : '';

    let intervalText = '';
    if (parsed.interval === 1) {
      intervalText = parsed.unit === 'day' ? 'Daily' : 
                    parsed.unit === 'week' ? 'Weekly' :
                    parsed.unit === 'month' ? 'Monthly' :
                    parsed.unit === 'year' ? 'Yearly' :
                    parsed.unit === 'hour' ? 'Hourly' :
                    parsed.unit === 'minute' ? 'Every minute' : 'Recurring';
    } else {
      const unitName = parsed.unit === 'minute' ? 'minute' :
                      parsed.unit === 'hour' ? 'hour' :
                      parsed.unit === 'day' ? 'day' :
                      parsed.unit === 'week' ? 'week' :
                      parsed.unit === 'month' ? 'month' : 'year';
      intervalText = `Every ${parsed.interval} ${unitName}${parsed.interval > 1 ? 's' : ''}`;
    }

    // Show time for all intervals including minutes (since pg_cron can schedule first run at specific time)
    let display = `${intervalText} at ${formattedTime}`;
    if (startDate) display += `, starts ${startDate}`;
    if (endDate) display += `, ends ${endDate}`;
    
    return display;
  }
};

export const createDefaultFormData = (): TaskFormData => ({
  scheduleMode: 'one_time',
  oneTimeDate: '',
  oneTimeTime: '',
  recurringStartDate: '',
  recurringEndDate: '',
  recurringTime: '',
  everyInterval: 1,
  everyUnit: 'day',
  newTaskDescription: '',
  newTaskTitle: '',
  targetConversationId: '',
  selectedTimezone: getDefaultTimezone()
});
