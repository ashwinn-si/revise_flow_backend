const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  initiateGoogleAuth,
  handleGoogleCallback,
  addToGoogleCalendar,
  removeGoogleCalendarAccess
} = require('../controllers/googleController');
const verifyAccessToken = require('../middleware/verifyAccessToken');

const router = express.Router();

// Rate limiting for Google Calendar operations
const googleCalendarLimit = process.env.NODE_ENV === 'development'
  ? (req, res, next) => next()
  : rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Max 10 requests per window per IP
    message: {
      error: 'Too many Google Calendar requests. Please try again in 15 minutes.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

// Apply auth middleware to all routes
router.use(verifyAccessToken);

// @route   GET /api/google/auth
// @desc    Initiate Google Calendar OAuth flow
// @access  Private
router.get('/auth', googleCalendarLimit, initiateGoogleAuth);

// @route   GET /api/google/callback
// @desc    Handle Google OAuth callback
// @access  Private
router.get('/callback', googleCalendarLimit, handleGoogleCallback);

// @route   POST /api/google/calendar/add
// @desc    Add event to Google Calendar
// @access  Private
router.post('/calendar/add', googleCalendarLimit, addToGoogleCalendar);

// @route   DELETE /api/google/disconnect
// @desc    Remove Google Calendar access
// @access  Private
router.delete('/disconnect', googleCalendarLimit, removeGoogleCalendarAccess);

module.exports = router;