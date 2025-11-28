#!/usr/bin/env node

/**
 * Test script for daily reminder emails
 * This script will simulate the cron job and send test emails
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const { sendDailyRevisionReminder } = require('../src/services/emailService');
const { getTodaysRevisions } = require('../src/services/cronService');
const logger = require('../src/utils/logger');

// Sample revision data for testing
const createSampleRevisions = () => {
  const today = new Date();

  return [
    {
      taskId: new mongoose.Types.ObjectId(),
      taskTitle: "JavaScript Fundamentals - Variables and Data Types",
      taskDescription: "Review the basics of JavaScript variables, primitive data types, and type conversion. Focus on understanding the differences between var, let, and const declarations.",
      revisionId: new mongoose.Types.ObjectId(),
      revisionDay: 1,
      scheduledDate: today,
      isFirstRevision: true,
      taskCreatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Created yesterday
    },
    {
      taskId: new mongoose.Types.ObjectId(),
      taskTitle: "React Hooks Deep Dive",
      taskDescription: "Master useState, useEffect, useContext, and custom hooks. Practice building components with proper state management and side effects.",
      revisionId: new mongoose.Types.ObjectId(),
      revisionDay: 3,
      scheduledDate: today,
      isFirstRevision: false,
      taskCreatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Created a week ago
    },
    {
      taskId: new mongoose.Types.ObjectId(),
      taskTitle: "Database Design Principles",
      taskDescription: "Review normalization, indexing strategies, and relationship modeling. Practice designing efficient database schemas for real-world applications.",
      revisionId: new mongoose.Types.ObjectId(),
      revisionDay: 2,
      scheduledDate: today,
      isFirstRevision: false,
      taskCreatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // Created 3 days ago
    },
    {
      taskId: new mongoose.Types.ObjectId(),
      taskTitle: "Algorithm Complexity Analysis",
      taskDescription: "Study Big O notation, time and space complexity. Practice analyzing and optimizing algorithms for better performance.",
      revisionId: new mongoose.Types.ObjectId(),
      revisionDay: 5,
      scheduledDate: today,
      isFirstRevision: false,
      taskCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Created a month ago
    }
  ];
};

/**
 * Test email sending with sample data
 */
const testEmailWithSampleData = async () => {
  console.log('\n[TEST] Testing email with sample revision data...\n');

  const sampleRevisions = createSampleRevisions();
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testName = process.env.TEST_NAME || 'Test User';

  try {
    await sendDailyRevisionReminder(testEmail, testName, sampleRevisions);
    console.log(`[SUCCESS] Test email sent successfully to: ${testEmail}`);
    console.log(`[INFO] Email contained ${sampleRevisions.length} sample revisions`);

    console.log('\n[REVISIONS] Sample revisions sent:');
    sampleRevisions.forEach((revision, index) => {
      console.log(`   ${index + 1}. ${revision.taskTitle} (Revision Day: ${revision.revisionDay})`);
    });

  } catch (error) {
    console.error('[ERROR] Failed to send test email:', error.message);
    process.exit(1);
  }
};

/**
 * Send emails to all eligible users with their real revision data
 */
const sendEmailsToAllUsers = async () => {
  console.log('\n[ALL-USERS] Sending emails to ALL users with real revision data...\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[SUCCESS] Connected to database');

    // Find all verified users with email notifications enabled
    const users = await User.find({
      isVerified: true,
      'settings.emailNotifications': true
    }).select('_id email timezone settings');

    if (users.length === 0) {
      console.log('[WARNING] No eligible users found in database.');
      console.log('[INFO] Users need to be verified and have email notifications enabled.');
      return;
    }

    console.log(`[INFO] Found ${users.length} eligible users for email reminders`);

    let emailsSent = 0;
    let emailsSkipped = 0;
    let emailErrors = 0;

    // Process each user
    for (const user of users) {
      try {
        const userTimezone = user.timezone || 'Asia/Kolkata';
        console.log(`\n[USER] Processing user: ${user.email} (${userTimezone})`);

        // Get today's revisions for this user
        const todaysRevisions = await getTodaysRevisions(user._id, userTimezone);

        if (todaysRevisions.length === 0) {
          console.log(`   [SKIP] No revisions due today - skipping`);
          emailsSkipped++;
          continue;
        }

        console.log(`   [INFO] Found ${todaysRevisions.length} revisions due today:`);
        todaysRevisions.forEach((revision, index) => {
          console.log(`      ${index + 1}. ${revision.taskTitle} (Day ${revision.revisionDay})`);
        });

        // Send email with real data
        const userName = user.email.split('@')[0];
        await sendDailyRevisionReminder(user.email, userName, todaysRevisions);

        console.log(`   [SUCCESS] Email sent successfully!`);
        emailsSent++;

        // Small delay to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (userError) {
        console.error(`   [ERROR] Failed to process user ${user.email}:`, userError.message);
        emailErrors++;
      }
    }

    console.log('\n[SUMMARY] Results:');
    console.log(`   Emails sent: ${emailsSent}`);
    console.log(`   Emails skipped (no revisions): ${emailsSkipped}`);
    console.log(`   Email errors: ${emailErrors}`);
    console.log(`   Total users processed: ${users.length}`);

    if (emailsSent > 0) {
      console.log('\n[SUCCESS] Daily reminder emails sent to all eligible users!');
    } else {
      console.log('\n[WARNING] No emails were sent. This could mean:');
      console.log('   • No users have revisions due today');
      console.log('   • All users have completed their revisions');
      console.log('   • Email service is not configured properly');
    }

  } catch (error) {
    console.error('[ERROR] Failed to send emails to all users:', error.message);
    throw error;
  }
};

/**
 * Test email sending with one user's real data (for testing)
 */
const testEmailWithOneUser = async () => {
  console.log('\n[ONE-USER] Testing email with ONE user real data...\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[SUCCESS] Connected to database');

    // Find a verified user with email notifications enabled
    const testUser = await User.findOne({
      isVerified: true,
      'settings.emailNotifications': true
    }).select('_id email timezone settings');

    if (!testUser) {
      console.log('[WARNING] No eligible users found. Creating sample scenario with sample data instead...');
      await testEmailWithSampleData();
      return;
    }

    console.log(`[INFO] Found test user: ${testUser.email}`);

    // Get today's revisions for this user
    const todaysRevisions = await getTodaysRevisions(testUser._id, testUser.timezone);

    if (todaysRevisions.length === 0) {
      console.log('[WARNING] No revisions due today for this user. Using sample data instead...');
      await testEmailWithSampleData();
      return;
    }

    // Send email with real data
    const userName = testUser.email.split('@')[0];
    await sendDailyRevisionReminder(testUser.email, userName, todaysRevisions);

    console.log(`[SUCCESS] Email sent successfully to: ${testUser.email}`);
    console.log(`[INFO] Email contained ${todaysRevisions.length} real revisions`);
    console.log(`[INFO] User timezone: ${testUser.timezone || 'Asia/Kolkata'}`);

    console.log('\n[REVISIONS] Real revisions sent:');
    todaysRevisions.forEach((revision, index) => {
      console.log(`   ${index + 1}. ${revision.taskTitle} (Revision Day: ${revision.revisionDay})`);
    });

  } catch (error) {
    console.error('[ERROR] Failed to test with real data:', error.message);
    console.log('\n[FALLBACK] Falling back to sample data...');
    await testEmailWithSampleData();
  }
};

/**
 * Display email configuration
 */
const displayEmailConfig = () => {
  console.log('[CONFIG] Email Configuration:');
  console.log(`   SMTP Host: ${process.env.SMTP_HOST || 'Not configured'}`);
  console.log(`   SMTP Port: ${process.env.SMTP_PORT || 'Not configured'}`);
  console.log(`   SMTP User: ${process.env.SMTP_USER || 'Not configured'}`);
  console.log(`   From Email: ${process.env.FROM_EMAIL || 'Not configured'}`);
  console.log(`   From Name: ${process.env.FROM_NAME || 'Not configured'}`);
  console.log(`   Client URL: ${process.env.CLIENT_URL || 'Not configured'}`);

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n[WARNING] Some SMTP settings are missing. Emails might not be sent.');
    console.log('   Check your .env file for SMTP configuration.');
  }
  console.log('');
};

/**
 * Main execution function
 */
const main = async () => {
  console.log('[START] ReviseFlow - Daily Reminder Email Test\n');

  // Display configuration
  displayEmailConfig();

  const args = process.argv.slice(2);
  const useAllUsers = args.includes('--all') || args.includes('-a');
  const useSampleData = args.includes('--sample') || args.includes('-s');
  const useOneUser = args.includes('--one') || args.includes('-1');

  if (useSampleData) {
    await testEmailWithSampleData();
  } else if (useAllUsers) {
    await sendEmailsToAllUsers();
  } else if (useOneUser) {
    await testEmailWithOneUser();
  } else {
    // Default: send to all users
    console.log('[INFO] Sending emails to ALL users with real revision data...');
    await sendEmailsToAllUsers();
  }

  // Close database connection
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
    console.log('\n[SUCCESS] Database connection closed');
  }

  console.log('\n[COMPLETE] Email test completed!');
  console.log('\n[USAGE] Usage options:');
  console.log('   npm run cron:mail           - Send to ALL users (default)');
  console.log('   npm run cron:mail --all     - Send to ALL users');
  console.log('   npm run cron:mail --one     - Send to ONE test user');
  console.log('   npm run cron:mail --sample  - Use sample data');
  console.log('\n[NOTE] Check email inboxes (and spam folders) for the test emails.');
};

// Handle errors and cleanup
process.on('unhandledRejection', (error) => {
  console.error('[ERROR] Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('\n\n[INTERRUPT] Received interrupt signal, cleaning up...');
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }
  process.exit(0);
});

// Run the test
main().catch((error) => {
  console.error('[ERROR] Script failed:', error);
  process.exit(1);
});