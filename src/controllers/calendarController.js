const Task = require('../models/Task');

// @desc    Get calendar data for a specific date
// @route   GET /api/calendar?date=YYYY-MM-DD
// @access  Private
const getCalendarDay = async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required',
      });
    }

    const targetDate = new Date(date);

    // Validate date
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Set date boundaries for the day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get tasks completed on this date
    const completedTasks = await Task.find({
      user: req.user._id,
      completedDate: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
      isArchived: false,
    }).sort({ createdAt: -1 });

    // Get revisions scheduled for this date
    const revisionsScheduled = await Task.findRevisionsDueOnDate(req.user._id, date);

    // Format the revisions data
    const revisionsScheduledForDate = revisionsScheduled.map(item => ({
      id: item.revisionId,
      taskId: item._id,
      title: item.title,
      notes: item.notes,
      originalCompletedDate: item.completedDate,
      scheduledDate: item.revision.scheduledDate,
      status: item.revision.status,
      sentReminder: item.revision.sentReminder,
    }));

    res.json({
      success: true,
      data: {
        date: date,
        completedTasks: completedTasks,
        revisionsScheduledForDate: revisionsScheduledForDate,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get calendar overview for a date range
// @route   GET /api/calendar/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// @access  Private
const getCalendarOverview = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Both startDate and endDate parameters are required',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    // Set time boundaries
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Get tasks completed in date range
    const completedTasks = await Task.aggregate([
      {
        $match: {
          user: req.user._id,
          completedDate: { $gte: start, $lte: end },
          isArchived: false,
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$completedDate'
            }
          },
          count: { $sum: 1 },
          tasks: {
            $push: {
              id: '$_id',
              title: '$title',
              notes: '$notes',
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get revisions scheduled in date range
    const scheduledRevisions = await Task.aggregate([
      {
        $match: {
          user: req.user._id,
          isArchived: false,
        }
      },
      { $unwind: '$revisions' },
      {
        $match: {
          'revisions.scheduledDate': { $gte: start, $lte: end },
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$revisions.scheduledDate'
            }
          },
          count: { $sum: 1 },
          pending: {
            $sum: {
              $cond: [
                { $eq: ['$revisions.status', 'pending'] },
                1,
                0
              ]
            }
          },
          completed: {
            $sum: {
              $cond: [
                { $eq: ['$revisions.status', 'done'] },
                1,
                0
              ]
            }
          },
          revisions: {
            $push: {
              id: '$revisions._id',
              taskId: '$_id',
              title: '$title',
              status: '$revisions.status',
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Merge completed tasks and scheduled revisions
    const calendar = {};

    completedTasks.forEach(day => {
      calendar[day._id] = {
        date: day._id,
        completedTasks: day.tasks,
        completedCount: day.count,
        scheduledRevisions: [],
        revisionsCount: 0,
        pendingRevisions: 0,
        completedRevisions: 0,
      };
    });

    scheduledRevisions.forEach(day => {
      if (!calendar[day._id]) {
        calendar[day._id] = {
          date: day._id,
          completedTasks: [],
          completedCount: 0,
          scheduledRevisions: day.revisions,
          revisionsCount: day.count,
          pendingRevisions: day.pending,
          completedRevisions: day.completed,
        };
      } else {
        calendar[day._id].scheduledRevisions = day.revisions;
        calendar[day._id].revisionsCount = day.count;
        calendar[day._id].pendingRevisions = day.pending;
        calendar[day._id].completedRevisions = day.completed;
      }
    });

    // Convert to array and sort by date
    const calendarData = Object.values(calendar).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    res.json({
      success: true,
      data: {
        startDate,
        endDate,
        calendar: calendarData,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get upcoming revisions for user
// @route   GET /api/calendar/upcoming
// @access  Private
const getUpcomingRevisions = async (req, res, next) => {
  try {
    const { days = 7, limit = 50 } = req.query;

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const upcomingRevisions = await Task.aggregate([
      {
        $match: {
          user: req.user._id,
          isArchived: false,
        }
      },
      { $unwind: '$revisions' },
      {
        $match: {
          'revisions.scheduledDate': {
            $gte: now,
            $lte: futureDate
          },
          'revisions.status': 'pending'
        }
      },
      {
        $project: {
          title: 1,
          notes: 1,
          completedDate: 1,
          revision: '$revisions',
          revisionId: '$revisions._id',
          daysDiff: {
            $divide: [
              { $subtract: ['$revisions.scheduledDate', now] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $sort: { 'revision.scheduledDate': 1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json({
      success: true,
      data: {
        upcoming: upcomingRevisions,
        total: upcomingRevisions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overdue revisions for user
// @route   GET /api/calendar/overdue
// @access  Private
const getOverdueRevisions = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const now = new Date();

    const overdueRevisions = await Task.aggregate([
      {
        $match: {
          user: req.user._id,
          isArchived: false,
        }
      },
      { $unwind: '$revisions' },
      {
        $match: {
          'revisions.scheduledDate': { $lt: now },
          'revisions.status': 'pending'
        }
      },
      {
        $project: {
          title: 1,
          notes: 1,
          completedDate: 1,
          revision: '$revisions',
          revisionId: '$revisions._id',
          daysOverdue: {
            $divide: [
              { $subtract: [now, '$revisions.scheduledDate'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $sort: { 'revision.scheduledDate': 1 }
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    res.json({
      success: true,
      data: {
        overdue: overdueRevisions,
        total: overdueRevisions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCalendarDay,
  getCalendarOverview,
  getUpcomingRevisions,
  getOverdueRevisions,
};