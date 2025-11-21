const express = require('express');
const {
  getCalendarDay,
  getCalendarOverview,
  getUpcomingRevisions,
  getOverdueRevisions,
} = require('../controllers/calendarController');
const verifyAccessToken = require('../middleware/verifyAccessToken');

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyAccessToken);

// @route   GET /api/calendar
// @desc    Get calendar data for a specific date
// @access  Private
router.get('/', getCalendarDay);

// @route   GET /api/calendar/overview
// @desc    Get calendar overview for date range
// @access  Private
router.get('/overview', getCalendarOverview);

// @route   GET /api/calendar/upcoming
// @desc    Get upcoming revisions
// @access  Private
router.get('/upcoming', getUpcomingRevisions);

// @route   GET /api/calendar/overdue
// @desc    Get overdue revisions
// @access  Private
router.get('/overdue', getOverdueRevisions);

module.exports = router;