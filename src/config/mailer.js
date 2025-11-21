const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // In development, if SMTP credentials are not properly set, use a fake transporter
  if (process.env.NODE_ENV === 'development' &&
    (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    console.log('⚠️  Email not configured for development. Emails will be logged to console.');
    return {
      sendMail: async (options) => {
        console.log('📧 [MOCK EMAIL]');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Content:', options.html || options.text);
        console.log('---');
        return { messageId: 'mock-' + Date.now() };
      }
    };
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // For development with services like Mailtrap
    ...(process.env.NODE_ENV === 'development' && {
      tls: {
        rejectUnauthorized: false
      }
    })
  });
};

// Send email helper
const sendEmail = async (options) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
};

// Email templates
const emailTemplates = {
  verification: (verificationUrl, email) => ({
    subject: 'Verify Your TaskFlow Account',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 24px; padding: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #8B5CF6; margin-bottom: 10px; font-size: 28px; font-weight: 700;">📝 TaskFlow</h1>
          <h2 style="color: #0F172A; margin: 0; font-weight: 600; font-size: 24px;">Welcome aboard!</h2>
          <p style="color: #64748B; margin: 15px 0 0 0; font-size: 16px;">Let's verify your email to get started</p>
        </div>
        
        <!-- Main Content -->
        <div style="background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 24px; padding: 40px; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 30px;">
            Thank you for joining TaskFlow! To complete your account setup and start organizing your tasks with spaced revision reminders, please verify your email address.
          </p>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 8px 20px rgba(139, 92, 246, 0.3); transition: all 0.3s ease;">
              ✨ Verify Email Address
            </a>
          </div>
          
          <p style="color: #64748B; font-size: 14px; line-height: 1.6; text-align: center; margin-top: 30px;">
            If the button doesn't work, copy and paste this link into your browser: <br>
            <a href="${verificationUrl}" style="color: #8B5CF6; word-break: break-all; font-weight: 500;">${verificationUrl}</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px; background: rgba(255, 255, 255, 0.6); border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <p style="color: #64748B; font-size: 14px; margin: 0 0 10px 0;">
            🎯 Start your spaced revision journey today
          </p>
          <p style="color: #94A3B8; font-size: 12px; margin: 0;">
            If you didn't create an account with TaskFlow, please ignore this email.
          </p>
        </div>
      </div>
    `,
  }),

  passwordReset: (resetUrl, email) => ({
    subject: 'Reset Your TaskFlow Password',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 24px; padding: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #8B5CF6; margin-bottom: 10px; font-size: 28px; font-weight: 700;">🔐 TaskFlow</h1>
          <h2 style="color: #0F172A; margin: 0; font-weight: 600; font-size: 24px;">Password Reset Request</h2>
          <p style="color: #64748B; margin: 15px 0 0 0; font-size: 16px;">Secure your account with a new password</p>
        </div>
        
        <!-- Main Content -->
        <div style="background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 24px; padding: 40px; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
          <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 20px;">
            We received a request to reset your password for your TaskFlow account. Click the button below to create a new secure password.
          </p>
          
          <div style="background: linear-gradient(135deg, #FEF3C7, #FDE68A); border: 1px solid #F59E0B; border-radius: 12px; padding: 16px; margin: 25px 0;">
            <p style="color: #92400E; font-size: 14px; margin: 0; font-weight: 500;">
              ⏰ This link will expire in 1 hour for security reasons
            </p>
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #EF4444, #DC2626); color: white; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 8px 20px rgba(239, 68, 68, 0.3); transition: all 0.3s ease;">
              🔑 Reset Password
            </a>
          </div>
          
          <p style="color: #64748B; font-size: 14px; line-height: 1.6; text-align: center; margin-top: 30px;">
            If the button doesn't work, copy and paste this link into your browser: <br>
            <a href="${resetUrl}" style="color: #EF4444; word-break: break-all; font-weight: 500;">${resetUrl}</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 20px; background: rgba(255, 255, 255, 0.6); border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <p style="color: #64748B; font-size: 14px; margin: 0 0 10px 0;">
            🛡️ Your account security is our priority
          </p>
          <p style="color: #94A3B8; font-size: 12px; margin: 0;">
            If you didn't request a password reset, please ignore this email or contact support if you're concerned.
          </p>
        </div>
      </div>
    `,
  }),

  dailyRevisions: (user, revisions, date) => ({
    subject: `🎯 ${revisions.length} revision${revisions.length > 1 ? 's' : ''} due today - TaskFlow`,
    html: `
      <div style="max-width: 650px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 40px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 24px; padding: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #8B5CF6; margin-bottom: 10px; font-size: 28px; font-weight: 700;">📝 TaskFlow</h1>
          <h2 style="color: #0F172A; margin: 0; font-weight: 600; font-size: 24px;">Good morning, ${user}!</h2>
          <p style="color: #64748B; margin: 15px 0 0 0; font-size: 16px;">Time for your spaced repetition session 🧠</p>
        </div>
        
        <!-- Stats Card -->
        <div style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; padding: 25px; border-radius: 20px; margin-bottom: 30px; text-align: center; box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);">
          <h3 style="margin: 0; font-size: 32px; font-weight: 700;">${revisions.length}</h3>
          <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">Revision${revisions.length > 1 ? 's' : ''} Due Today</p>
        </div>
        
        <!-- Main Content -->
        <div style="background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(10px); border: 1px solid rgba(203, 213, 225, 0.5); border-radius: 24px; padding: 30px; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <p style="color: #475569; margin: 0; font-size: 16px; line-height: 1.6;">
              Research shows that reviewing material at spaced intervals significantly improves long-term retention. Here are your tasks for today:
            </p>
          </div>
          
          <div style="margin-bottom: 30px;">
            ${revisions.map(revision => `
              <div style="background: white; border: 2px solid #E2E8F0; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                  <h3 style="color: #8B5CF6; margin: 0; font-size: 18px; font-weight: 600; flex: 1;">${revision.title}</h3>
                  <span style="background: ${revision.isFirstRevision ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #F59E0B, #D97706)'}; color: white; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; margin-left: 12px;">
                    ${revision.isFirstRevision ? '✨ First' : `📅 Day ${revision.revisionDay}`} Revision
                  </span>
                </div>
                
                <p style="color: #64748B; margin: 0 0 12px 0; font-size: 14px;">
                  📅 Originally completed: ${new Date(revision.taskCreatedAt).toLocaleDateString()}
                </p>
                
                ${revision.taskDescription ? `
                  <p style="color: #475569; margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; padding: 12px; background: #F8FAFC; border-radius: 8px; border-left: 4px solid #8B5CF6;">
                    ${revision.taskDescription}
                  </p>
                ` : ''}
                
                <div style="text-align: center; margin-top: 15px;">
                  <a href="${process.env.CLIENT_URL}/signin?redirect=/day/${date}" 
                     style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 10px 20px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block; margin-right: 10px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">
                    ✅ Mark as Done
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
          
          <!-- Action Buttons -->
          <div style="text-align: center; border-top: 2px solid #E2E8F0; padding-top: 25px;">
            <a href="${process.env.CLIENT_URL}" 
               style="background: linear-gradient(135deg, #8B5CF6, #7C3AED); color: white; padding: 16px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; margin-right: 15px; box-shadow: 0 6px 20px rgba(139, 92, 246, 0.3);">
              🚀 Open TaskFlow
            </a>
            <a href="${process.env.CLIENT_URL}/settings" 
               style="background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 16px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);">
              ⚙️ Settings
            </a>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="text-align: center; padding: 25px; background: rgba(255, 255, 255, 0.6); border-radius: 16px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
          <h4 style="color: #475569; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">🎯 Why Spaced Repetition Works</h4>
          <p style="color: #64748B; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
            Spaced repetition leverages the psychological spacing effect, where information is more easily recalled 
            if learning sessions are spaced out over time rather than massed together.
          </p>
          <div style="border-top: 1px solid #E2E8F0; padding-top: 15px; margin-top: 20px;">
            <p style="color: #94A3B8; margin: 0; font-size: 12px;">
              📧 You're receiving this because you have daily reminders enabled. 
              <a href="${process.env.CLIENT_URL}/settings" style="color: #8B5CF6; font-weight: 500;">Manage preferences</a>
            </p>
          </div>
        </div>
      </div>
    `,
  }),
};

module.exports = {
  sendEmail,
  emailTemplates,
  createTransporter,
};