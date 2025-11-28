/**
 * Utility functions for Google Calendar integration
 */

/**
 * Generate Google Calendar URL for adding events
 * @param {Object} event - Event details
 * @param {string} event.title - Event title
 * @param {string} [event.description] - Event description
 * @param {Date|string} event.startDate - Event start date
 * @param {Date|string} [event.endDate] - Event end date (defaults to start date + 1 hour)
 * @param {string} [event.location] - Event location
 * @returns {string} Google Calendar URL
 */
const generateGoogleCalendarUrl = (event) => {
  const {
    title,
    description = '',
    startDate,
    endDate,
    location = ''
  } = event;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour

  const formatDateForGoogle = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatDateForGoogle(start)}/${formatDateForGoogle(end)}`,
    details: description,
    location: location,
    sf: true,
    output: 'xml'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/**
 * Generate iCal/ICS content for calendar events
 * @param {Object} event - Event details
 * @returns {string} ICS file content
 */
const generateICSContent = (event) => {
  const {
    title,
    description = '',
    startDate,
    endDate,
    location = ''
  } = event;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000);

  const formatDateForICS = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const now = new Date();
  const uid = `revision-${Date.now()}@ReviseFlow.com`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ReviseFlow//Revision Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatDateForICS(now)}`,
    `DTSTART:${formatDateForICS(start)}`,
    `DTEND:${formatDateForICS(end)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
    location ? `LOCATION:${location}` : '',
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  ].filter(line => line !== '').join('\r\n');
};

/**
 * Create revision-specific calendar event data
 * @param {Object} task - Task object
 * @param {Object} revision - Revision object
 * @returns {Object} Calendar event data
 */
const createRevisionEvent = (task, revision) => {
  const title = `Revision: ${task.title}`;
  const description = [
    `Revision of task: ${task.title}`,
    task.notes ? `\nOriginal notes: ${task.notes}` : '',
    `\nCreated on: ${new Date(task.completedDate).toLocaleDateString()}`,
    '\nThis is a spaced repetition reminder to help strengthen your memory of this topic.',
    '\n---',
    '\nSpaced repetition is a learning technique that involves reviewing material at increasing intervals.',
    'Research shows this method significantly improves long-term retention and recall.'
  ].filter(line => line !== '').join('');

  return {
    title,
    description,
    startDate: revision.scheduledDate,
    endDate: new Date(new Date(revision.scheduledDate).getTime() + 60 * 60 * 1000), // 1 hour
    location: 'ReviseFlow - Spaced Repetition Session'
  };
};

/**
 * Calculate optimal revision intervals based on spaced repetition algorithms
 * @param {Date} completedDate - When the task was originally completed
 * @param {number} [intervals] - Number of revision intervals to generate
 * @returns {Date[]} Array of revision dates
 */
const calculateRevisionDates = (completedDate, intervals = 4) => {
  const baseDate = new Date(completedDate);
  const revisionDates = [];

  // Common spaced repetition intervals (in days)
  const spacingIntervals = [1, 3, 7, 14, 30, 90, 180, 365];

  for (let i = 0; i < Math.min(intervals, spacingIntervals.length); i++) {
    const revisionDate = new Date(baseDate);
    revisionDate.setDate(revisionDate.getDate() + spacingIntervals[i]);
    revisionDates.push(revisionDate);
  }

  return revisionDates;
};

/**
 * Generate email-friendly calendar links
 * @param {Object} event - Event details
 * @returns {Object} Object containing different calendar service URLs
 */
const generateCalendarLinks = (event) => {
  const googleUrl = generateGoogleCalendarUrl(event);
  const icsContent = generateICSContent(event);
  const icsDataUrl = `data:text/calendar;charset=utf8,${encodeURIComponent(icsContent)}`;

  return {
    google: googleUrl,
    ics: icsDataUrl,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(event.description)}&startdt=${new Date(event.startDate).toISOString()}&enddt=${new Date(event.endDate || event.startDate).toISOString()}`,
    yahoo: `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${encodeURIComponent(event.title)}&st=${new Date(event.startDate).toISOString().replace(/[-:]/g, '').split('.')[0]}&dur=0100&desc=${encodeURIComponent(event.description)}`
  };
};

module.exports = {
  generateGoogleCalendarUrl,
  generateICSContent,
  createRevisionEvent,
  calculateRevisionDates,
  generateCalendarLinks
};