const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
const { sendDailyRevisionReminder } = require('./emailService');
const { getDayBoundsInTimezone, isTargetHourInTimezone } = require('../utils/timezoneUtils');
const logger = require('../utils/logger');

/**
 * Get today's revisions for a user in their timezone
 */
const getTodaysRevisions = async (userId, timezone = 'Asia/Kolkata') => {
  try {
    // Get day boundaries in user's timezone
    const { startOfDay, endOfDay } = getDayBoundsInTimezone(new Date(), timezone);

    // Find tasks with revisions due today using the correct schema
    const tasksWithRevisions = await Task.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          isArchived: false,
        }
      },
      { $unwind: '$revisions' },
      {
        $match: {
          'revisions.scheduledDate': {
            $gte: startOfDay,
            $lte: endOfDay
          },
          'revisions.status': 'pending'
        }
      },
      {
        $project: {
          title: 1,
          notes: 1,
          completedDate: 1,
          createdAt: 1,
          revision: '$revisions',
          revisionId: '$revisions._id',
        }
      }
    ]);

    // Transform to expected format
    const todaysRevisions = tasksWithRevisions.map((item, index) => {
      // Calculate which revision day this is (1st, 2nd, etc.)
      const completedDate = new Date(item.completedDate);
      const revisionDate = new Date(item.revision.scheduledDate);
      const daysDiff = Math.ceil((revisionDate - completedDate) / (1000 * 60 * 60 * 24));

      // Determine revision day based on common spaced repetition intervals
      let revisionDay = 1;
      if (daysDiff <= 3) revisionDay = 1;
      else if (daysDiff <= 7) revisionDay = 2;
      else if (daysDiff <= 14) revisionDay = 3;
      else if (daysDiff <= 30) revisionDay = 4;
      else revisionDay = 5;

      return {
        taskId: item._id,
        taskTitle: item.title,
        taskDescription: item.notes,
        taskCreatedAt: item.createdAt,
        revisionId: item.revisionId,
        revisionDay: revisionDay,
        scheduledDate: item.revision.scheduledDate,
        isFirstRevision: revisionDay === 1
      };
    });

    return todaysRevisions;
  } catch (error) {
    logger.error(`Error getting today's revisions for user ${userId}:`, error);
    return [];
  }
};

/**
 * Send daily reminders to all users at 6:00 AM in their timezone
 */
const sendDailyReminders = async () => {
  try {
    logger.info('Starting daily reminder job...');

    // Get all users who have email notifications enabled
    const users = await User.find({
      isVerified: true, // Updated from isEmailVerified
      'settings.emailNotifications': true, // Updated path
      // isActive: true // Removed if not needed
    }).select('_id email timezone settings');

    logger.info(`Found ${users.length} users eligible for daily reminders`);

    let remindersSent = 0;
    let errors = 0;

    // Process each user
    for (const user of users) {
      try {
        // Get user's timezone (default to IST)
        const userTimezone = user.timezone || 'Asia/Kolkata';

        // Check if it's 6:00 AM in the user's timezone
        if (!isTargetHourInTimezone(6, userTimezone)) {
          continue;
        }

        // Get today's revisions for this user
        const todaysRevisions = await getTodaysRevisions(user._id, userTimezone);

        if (todaysRevisions.length === 0) {
          logger.info(`No revisions due today for user ${user.email}`);
          continue;
        }

        // Send reminder email
        await sendDailyRevisionReminder(user.email, user.email.split('@')[0], todaysRevisions);
        remindersSent++;

        logger.info(`Daily reminder sent to ${user.email} for ${todaysRevisions.length} revisions in ${userTimezone}`);

        // Small delay to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (userError) {
        logger.error(`Error processing daily reminder for user ${user.email}:`, userError);
        errors++;
      }
    }

    logger.info(`Daily reminder job completed. Sent: ${remindersSent}, Errors: ${errors}`);
  } catch (error) {
    logger.error('Error in daily reminder job:', error);
  }
};

/**
 * Send weekly summary to users (optional feature)
 */
const sendWeeklySummary = async () => {
  try {
    logger.info('Starting weekly summary job...');

    const users = await User.find({
      isEmailVerified: true,
      emailNotifications: true,
      isActive: true
    }).select('_id name email timezone');

    for (const user of users) {
      try {
        // Get user's statistics for the past week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const stats = await Task.aggregate([
          {
            $match: {
              user: user._id,
              createdAt: { $gte: weekAgo }
            }
          },
          {
            $group: {
              _id: null,
              tasksCreated: { $sum: 1 },
              revisionsCompleted: {
                $sum: {
                  $size: {
                    $filter: {
                      input: '$revisions',
                      cond: { $eq: ['$$this.isCompleted', true] }
                    }
                  }
                }
              }
            }
          }
        ]);

        if (stats.length > 0 && (stats[0].tasksCreated > 0 || stats[0].revisionsCompleted > 0)) {
          // Here you could send a weekly summary email
          logger.info(`Weekly summary for ${user.email}: ${stats[0].tasksCreated} tasks, ${stats[0].revisionsCompleted} revisions`);
        }
      } catch (userError) {
        logger.error(`Error processing weekly summary for user ${user.email}:`, userError);
      }
    }
  } catch (error) {
    logger.error('Error in weekly summary job:', error);
  }
};

/**
 * Initialize and start all scheduled jobs
 */
const initializeScheduledJobs = () => {
  // Daily reminder at 6:00 AM IST (India Standard Time)
  // This will run every hour and check if it's 6 AM in each user's timezone
  cron.schedule('0 * * * *', sendDailyReminders, {
    name: 'dailyReminders',
    timezone: 'Asia/Kolkata' // IST timezone as default
  });

  // Weekly summary every Sunday at 8:00 AM IST
  cron.schedule('0 8 * * 0', sendWeeklySummary, {
    name: 'weeklySummary',
    timezone: 'Asia/Kolkata'
  });

  // Clean up expired tokens daily at midnight IST
  cron.schedule('0 0 * * *', async () => {
    try {
      const result = await User.updateMany(
        {
          $or: [
            { 'resetPasswordExpires': { $lt: new Date() } },
            { 'emailVerificationExpires': { $lt: new Date() } }
          ]
        },
        {
          $unset: {
            resetPasswordToken: '',
            resetPasswordExpires: '',
            emailVerificationToken: '',
            emailVerificationExpires: ''
          }
        }
      );
      logger.info(`Cleaned up expired tokens for ${result.modifiedCount} users`);
    } catch (error) {
      logger.error('Error cleaning up expired tokens:', error);
    }
  }, {
    name: 'tokenCleanup',
    timezone: 'Asia/Kolkata'
  });

  logger.info('Scheduled jobs initialized successfully with IST timezone');
};

/**
 * Stop all scheduled jobs
 */
const stopScheduledJobs = () => {
  cron.getTasks().forEach((task, name) => {
    task.stop();
    logger.info(`Stopped scheduled job: ${name}`);
  });
};

module.exports = {
  initializeScheduledJobs,
  stopScheduledJobs,
  sendDailyReminders,
  sendWeeklySummary,
  getTodaysRevisions,
};