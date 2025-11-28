const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { createRevisionEvent, generateCalendarLinks } = require('../utils/calendarUtils');

/**
 * Generate Google Calendar URL for adding events
 * @param {Object} event - Event details
 * @returns {string} Google Calendar URL
 */
const generateGoogleCalendarUrl = (event) => {
  const {
    title,
    description = '',
    startDate,
    endDate = startDate,
    location = ''
  } = event;

  const formatDateForGoogle = (date) => {
    return new Date(date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatDateForGoogle(startDate)}/${formatDateForGoogle(endDate)}`,
    details: description,
    location: location,
    sf: true,
    output: 'xml'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// Create reusable transporter
let transporter;

const initializeTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      ciphers: 'SSLv3',
    },
  });

  return transporter;
};

/**
 * Send email verification
 */
const sendVerificationEmail = async (email, verificationToken, name) => {
  try {
    const transporter = initializeTransporter();

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
      from: `"ReviseFlow" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Verify Your Email Address - ReviseFlow',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #6366f1; margin-bottom: 10px;">📝 ReviseFlow</h1>
            <h2 style="color: #374151; margin-top: 0;">Welcome aboard, ${name}!</h2>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
              Thanks for signing up for ReviseFlow! To get started with spaced revision reminders, 
              please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; 
                        border-radius: 6px; font-weight: 600; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:
              <br><a href="${verificationUrl}" style="color: #6366f1;">${verificationUrl}</a>
            </p>
          </div>
          
          <div style="text-align: center; font-size: 14px; color: #6b7280;">
            <p>This link will expire in 24 hours for security reasons.</p>
            <p>If you didn't create this account, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Verification email sent to ${email}`);
  } catch (error) {
    logger.error('Error sending verification email:', error);
    throw new Error('Failed to send verification email');
  }
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken, name) => {
  try {
    const transporter = initializeTransporter();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    const mailOptions = {
      from: `"ReviseFlow" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Password Reset Request - ReviseFlow',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #6366f1; margin-bottom: 10px;">📝 ReviseFlow</h1>
            <h2 style="color: #374151; margin-top: 0;">Password Reset Request</h2>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
              Hi ${name},
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
              We received a request to reset your ReviseFlow password. 
              Click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; 
                        border-radius: 6px; font-weight: 600; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              If the button doesn't work, copy and paste this link into your browser:
              <br><a href="${resetUrl}" style="color: #dc2626;">${resetUrl}</a>
            </p>
          </div>
          
          <div style="text-align: center; font-size: 14px; color: #6b7280;">
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send daily revision reminders with Google Calendar integration
 */
const sendDailyRevisionReminder = async (email, name, revisions) => {
  try {
    const transporter = initializeTransporter();

    // Create HTML for revision list without individual calendar buttons
    const revisionListHTML = revisions.map(revision => {
      return `
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 12px;">
            <h3 style="color: #6366f1; margin: 0; font-size: 18px; flex: 1;">${revision.taskTitle}</h3>
            <span style="background: ${revision.isFirstRevision ? '#10b981' : '#f59e0b'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
              ${revision.isFirstRevision ? 'First' : `Day ${revision.revisionDay}`} Revision
            </span>
          </div>
          
          <p style="color: #6b7280; margin: 0 0 12px 0; font-size: 14px;">
            📅 Originally completed: ${new Date(revision.taskCreatedAt).toLocaleDateString()}
          </p>
          
          <p style="color: #374151; margin: 0 0 15px 0; font-size: 14px; line-height: 1.5;">
            ${revision.taskDescription || 'No description provided'}
          </p>
        </div>
      `;
    }).join('');

    // Create a single combined event for all revisions
    // Generate task titles list for calendar title
    const taskTitlesList = revisions.map(rev => `• ${rev.taskTitle}`).join('\n');
    const combinedEventTitle = `Daily Revision Session\n${taskTitlesList}`;
    const combinedDescription = `Revision tasks:\n\n${revisions.map((rev, index) =>
      `${index + 1}. ${rev.taskTitle} (${rev.isFirstRevision ? 'First' : `Day ${rev.revisionDay}`} Revision)\n   - ${rev.taskDescription || 'No description provided'}\n   - Originally completed: ${new Date(rev.taskCreatedAt).toLocaleDateString()}\n`
    ).join('\n')}`;

    // Create event data for the combined revision session
    const today = new Date();
    const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0); // 6:00 PM
    const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0); // 8:00 PM

    const combinedEventData = {
      title: combinedEventTitle,
      description: combinedDescription,
      startDate: startTime,
      endDate: endTime,
      location: ''
    };

    // Generate calendar links for the combined event
    const combinedCalendarLinks = generateCalendarLinks(combinedEventData);

    const mailOptions = {
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: `🎯 ${revisions.length} revision${revisions.length > 1 ? 's' : ''} due today - ReviseFlow`,
      html: `
        <div style="max-width: 650px; margin: 0 auto; padding: 20px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 40px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #6366f1; margin-bottom: 10px; font-size: 28px;">📝 ReviseFlow</h1>
            <h2 style="color: #374151; margin: 0; font-weight: 600;">Good morning, ${name}!</h2>
            <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 16px;">Time for your spaced repetition session 🧠</p>
          </div>
          
          <!-- Main Content -->
          <div style="background: #f9fafb; padding: 30px; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 24px; font-weight: 700;">${revisions.length}</h3>
                <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Revision${revisions.length > 1 ? 's' : ''} Due Today</p>
              </div>
              <p style="color: #374151; margin: 0; font-size: 16px; line-height: 1.6;">
                Research shows that reviewing material at spaced intervals significantly improves long-term retention. 
                Each revision below can be added directly to your Google Calendar! 📅
              </p>
            </div>
            
            <div style="margin-bottom: 30px;">
              ${revisionListHTML}
            </div>
            
            <!-- Combined Calendar Add Button -->
            <div style="text-align: center; background: white; border: 2px solid #6366f1; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
              <h4 style="color: #6366f1; margin: 0 0 15px 0; font-size: 18px;">📅 Add All Tasks to Calendar</h4>
              <p style="color: #6b7280; margin: 0 0 20px 0; font-size: 14px;">
                Block 8:00 AM - 12:00 PM for your revision session with all tasks included
              </p>
              <div style="display: inline-block;">
                <a href="${combinedCalendarLinks.google}" 
                   target="_blank"
                   style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px; margin-right: 10px;">
                  📅 Google Calendar
                </a>
                <a href="${combinedCalendarLinks.outlook}" 
                   target="_blank"
                   style="background: #0078d4; color: white; padding: 12px 24px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px; margin-right: 10px;">
                  📅 Outlook
                </a>
                <a href="${combinedCalendarLinks.ics}" 
                   target="_blank"
                   style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; 
                          border-radius: 8px; font-weight: 600; display: inline-block; font-size: 15px;">
                  📅 Download ICS
                </a>
              </div>
            </div>
            
            <div style="text-align: center; border-top: 1px solid #e5e7eb; padding-top: 25px;">
              <a href="${process.env.CLIENT_URL}" 
                 style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; margin-right: 15px;">
                🚀 Open ReviseFlow
              </a>
              <a href="${process.env.CLIENT_URL}/settings" 
                 style="background: #10b981; color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                ⚙️ Settings
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; padding: 20px; background: white; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h4 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">🎯 Why Spaced Repetition Works</h4>
            <p style="color: #6b7280; margin: 0 0 15px 0; font-size: 14px; line-height: 1.6;">
              Spaced repetition leverages the psychological spacing effect, where information is more easily recalled 
              if learning sessions are spaced out over time rather than massed together.
            </p>
            <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 20px;">
              <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                📧 You're receiving this because you have daily reminders enabled. 
                <a href="${process.env.CLIENT_URL}/settings" style="color: #6366f1;">Manage preferences</a>
              </p>
            </div>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Enhanced daily revision reminder sent to ${email} for ${revisions.length} revisions`);
  } catch (error) {
    logger.error('Error sending daily revision reminder:', error);
    throw new Error('Failed to send daily revision reminder');
  }
};

/**
 * Send two-factor authentication code
 */
const sendTwoFactorCode = async (email, code, name) => {
  try {
    const transporter = initializeTransporter();

    const mailOptions = {
      from: `"ReviseFlow" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'Your Two-Factor Authentication Code - ReviseFlow',
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="color: #6366f1; margin-bottom: 10px;">📝 ReviseFlow</h1>
            <h2 style="color: #374151; margin-top: 0;">Two-Factor Authentication</h2>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
              Hi ${name},
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 30px;">
              Here's your two-factor authentication code:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: #6366f1; color: white; padding: 20px; font-size: 32px; 
                          font-weight: bold; border-radius: 8px; letter-spacing: 8px; display: inline-block;">
                ${code}
              </div>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; text-align: center;">
              This code will expire in 10 minutes for security reasons.
            </p>
          </div>
          
          <div style="text-align: center; font-size: 14px; color: #6b7280;">
            <p>If you didn't request this code, please contact support immediately.</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Two-factor authentication code sent to ${email}`);
  } catch (error) {
    logger.error('Error sending two-factor code:', error);
    throw new Error('Failed to send two-factor authentication code');
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendDailyRevisionReminder,
  sendTwoFactorCode,
  generateGoogleCalendarUrl,
};