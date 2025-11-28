/**
 * Timezone utility functions for the ReviseFlow application
 */

/**
 * List of supported timezones with display names
 */
const SUPPORTED_TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST)', country: 'India', utcOffset: '+05:30' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)', country: 'International', utcOffset: '+00:00' },
  { value: 'America/New_York', label: 'Eastern Time (ET)', country: 'USA', utcOffset: '-05:00/-04:00' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', country: 'USA', utcOffset: '-08:00/-07:00' },
  { value: 'America/Chicago', label: 'Central Time (CT)', country: 'USA', utcOffset: '-06:00/-05:00' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', country: 'USA', utcOffset: '-07:00/-06:00' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)', country: 'UK', utcOffset: '+00:00/+01:00' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)', country: 'France', utcOffset: '+01:00/+02:00' },
  { value: 'Europe/Berlin', label: 'Central European Time (CET)', country: 'Germany', utcOffset: '+01:00/+02:00' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)', country: 'Japan', utcOffset: '+09:00' },
  { value: 'Asia/Shanghai', label: 'China Standard Time (CST)', country: 'China', utcOffset: '+08:00' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST)', country: 'UAE', utcOffset: '+04:00' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)', country: 'Australia', utcOffset: '+10:00/+11:00' },
  { value: 'Australia/Melbourne', label: 'Australian Eastern Time (AET)', country: 'Australia', utcOffset: '+10:00/+11:00' },
  { value: 'Asia/Singapore', label: 'Singapore Standard Time (SST)', country: 'Singapore', utcOffset: '+08:00' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong Time (HKT)', country: 'Hong Kong', utcOffset: '+08:00' }
];

/**
 * Get current time in a specific timezone
 * @param {string} timezone - The timezone identifier (e.g., 'Asia/Kolkata')
 * @returns {Date} Current time in the specified timezone
 */
const getCurrentTimeInTimezone = (timezone = 'Asia/Kolkata') => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Get start and end of day for a specific date in a timezone
 * @param {Date|string} date - The date
 * @param {string} timezone - The timezone identifier
 * @returns {Object} Object with startOfDay and endOfDay
 */
const getDayBoundsInTimezone = (date, timezone = 'Asia/Kolkata') => {
  const targetDate = new Date(date);
  const userDate = new Date(targetDate.toLocaleString('en-US', { timeZone: timezone }));

  const startOfDay = new Date(userDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(userDate);
  endOfDay.setHours(23, 59, 59, 999);

  return { startOfDay, endOfDay };
};

/**
 * Check if it's a specific hour in the user's timezone
 * @param {number} targetHour - The hour to check (0-23)
 * @param {string} timezone - The timezone identifier
 * @returns {boolean} True if it's the target hour in the timezone
 */
const isTargetHourInTimezone = (targetHour, timezone = 'Asia/Kolkata') => {
  const currentTime = getCurrentTimeInTimezone(timezone);
  return currentTime.getHours() === targetHour;
};

/**
 * Convert time from one timezone to another
 * @param {Date} date - The date to convert
 * @param {string} fromTimezone - Source timezone
 * @param {string} toTimezone - Target timezone
 * @returns {Date} Converted date
 */
const convertTimezone = (date, fromTimezone, toTimezone) => {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(utcDate.toLocaleString('en-US', { timeZone: toTimezone }));
};

/**
 * Get timezone info for a given timezone identifier
 * @param {string} timezone - The timezone identifier
 * @returns {Object|null} Timezone information or null if not found
 */
const getTimezoneInfo = (timezone) => {
  return SUPPORTED_TIMEZONES.find(tz => tz.value === timezone) || null;
};

/**
 * Validate if a timezone is supported
 * @param {string} timezone - The timezone identifier to validate
 * @returns {boolean} True if timezone is supported
 */
const isValidTimezone = (timezone) => {
  return SUPPORTED_TIMEZONES.some(tz => tz.value === timezone);
};

/**
 * Get formatted time string for a timezone
 * @param {Date} date - The date to format
 * @param {string} timezone - The timezone identifier
 * @param {Object} options - Formatting options
 * @returns {string} Formatted time string
 */
const formatTimeInTimezone = (date, timezone = 'Asia/Kolkata', options = {}) => {
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  };

  return new Intl.DateTimeFormat('en-US', {
    ...defaultOptions,
    ...options,
    timeZone: timezone
  }).format(date);
};

/**
 * Calculate optimal reminder time in IST for different timezones
 * @param {string} userTimezone - User's timezone
 * @param {number} desiredHour - Desired hour in user's timezone (default 6 AM)
 * @returns {Object} IST time and user time information
 */
const calculateReminderTime = (userTimezone, desiredHour = 6) => {
  // Create a date object for the desired hour in user's timezone
  const today = new Date();
  const userTime = new Date(today.toLocaleString('en-US', { timeZone: userTimezone }));
  userTime.setHours(desiredHour, 0, 0, 0);

  // Convert to IST
  const istTime = new Date(userTime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

  return {
    userTime: {
      timezone: userTimezone,
      hour: userTime.getHours(),
      formatted: formatTimeInTimezone(userTime, userTimezone)
    },
    istTime: {
      timezone: 'Asia/Kolkata',
      hour: istTime.getHours(),
      formatted: formatTimeInTimezone(istTime, 'Asia/Kolkata')
    }
  };
};

module.exports = {
  SUPPORTED_TIMEZONES,
  getCurrentTimeInTimezone,
  getDayBoundsInTimezone,
  isTargetHourInTimezone,
  convertTimezone,
  getTimezoneInfo,
  isValidTimezone,
  formatTimeInTimezone,
  calculateReminderTime
};