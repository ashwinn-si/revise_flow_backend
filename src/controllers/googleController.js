const { google } = require('googleapis');
const User = require('../models/User');
const logger = require('../utils/logger');

// Google OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Google Calendar scopes
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * @desc    Initiate Google Calendar OAuth flow
 * @route   GET /api/google/auth
 * @access  Private
 */
const initiateGoogleAuth = async (req, res) => {
  try {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state: req.user.id, // Pass user ID in state for callback
    });

    res.json({
      success: true,
      authUrl,
      message: 'Google authorization URL generated successfully',
    });
  } catch (error) {
    logger.error('Error initiating Google auth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Google Calendar authorization',
    });
  }
};

/**
 * @desc    Handle Google OAuth callback
 * @route   GET /api/google/callback
 * @access  Private
 */
const handleGoogleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state;

    if (!code || !userId || userId !== req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid authorization code or user state',
      });
    }

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    // Update user with Google Calendar tokens
    await User.findByIdAndUpdate(userId, {
      googleCalendarRefreshToken: tokens.refresh_token,
      googleCalendarAccessToken: tokens.access_token,
      isGoogleCalendarConnected: true,
    });

    res.json({
      success: true,
      message: 'Google Calendar connected successfully',
    });
  } catch (error) {
    logger.error('Error handling Google callback:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to connect Google Calendar',
    });
  }
};

/**
 * @desc    Add event to Google Calendar
 * @route   POST /api/google/calendar/add
 * @access  Private
 */
const addToGoogleCalendar = async (req, res) => {
  try {
    const { taskTitle, revisionDate, description } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.isGoogleCalendarConnected || !user.googleCalendarRefreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Google Calendar not connected. Please connect first.',
      });
    }

    // Set up OAuth2 client with user tokens
    oauth2Client.setCredentials({
      refresh_token: user.googleCalendarRefreshToken,
      access_token: user.googleCalendarAccessToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Create event
    const event = {
      summary: `📝 Revision: ${taskTitle}`,
      description: description || `Revision reminder for task: ${taskTitle}`,
      start: {
        dateTime: new Date(revisionDate).toISOString(),
        timeZone: user.timezone || 'UTC',
      },
      end: {
        dateTime: new Date(new Date(revisionDate).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
        timeZone: user.timezone || 'UTC',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 24 hours before
          { method: 'popup', minutes: 10 }, // 10 minutes before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      success: true,
      message: 'Event added to Google Calendar successfully',
      eventId: response.data.id,
      eventLink: response.data.htmlLink,
    });
  } catch (error) {
    logger.error('Error adding to Google Calendar:', error);

    // Handle specific Google API errors
    if (error.code === 401) {
      return res.status(401).json({
        success: false,
        message: 'Google Calendar authorization expired. Please reconnect.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add event to Google Calendar',
    });
  }
};

/**
 * @desc    Remove Google Calendar access
 * @route   DELETE /api/google/disconnect
 * @access  Private
 */
const removeGoogleCalendarAccess = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.isGoogleCalendarConnected) {
      return res.status(400).json({
        success: false,
        message: 'Google Calendar is not connected',
      });
    }

    // Revoke Google tokens if they exist
    if (user.googleCalendarRefreshToken) {
      try {
        oauth2Client.setCredentials({
          refresh_token: user.googleCalendarRefreshToken,
        });
        await oauth2Client.revokeCredentials();
      } catch (revokeError) {
        logger.warn('Error revoking Google credentials:', revokeError);
        // Continue with disconnection even if revoke fails
      }
    }

    // Remove Google Calendar data from user
    await User.findByIdAndUpdate(req.user.id, {
      $unset: {
        googleCalendarRefreshToken: '',
        googleCalendarAccessToken: '',
      },
      isGoogleCalendarConnected: false,
    });

    res.json({
      success: true,
      message: 'Google Calendar disconnected successfully',
    });
  } catch (error) {
    logger.error('Error disconnecting Google Calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Google Calendar',
    });
  }
};

module.exports = {
  initiateGoogleAuth,
  handleGoogleCallback,
  addToGoogleCalendar,
  removeGoogleCalendarAccess,
};