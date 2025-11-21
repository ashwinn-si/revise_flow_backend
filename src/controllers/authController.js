const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { generateTokens, verifyRefreshToken, generateAccessToken } = require('../config/jwt');
const { sendEmail, emailTemplates } = require('../config/mailer');

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      // If user exists and is verified, they can't sign up again
      if (existingUser.isVerified) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists',
        });
      }

      // Check if user is trying to signup too frequently (within last 5 minutes)
      const lastEmailTime = existingUser.lastVerificationEmailSent;
      if (lastEmailTime) {
        const timeSinceLastEmail = Date.now() - lastEmailTime.getTime();
        const minWaitTime = 5 * 60 * 1000; // 5 minutes

        if (timeSinceLastEmail < minWaitTime) {
          const remainingMinutes = Math.ceil((minWaitTime - timeSinceLastEmail) / (60 * 1000));
          return res.status(429).json({
            success: false,
            error: `Please wait ${remainingMinutes} minute(s) before requesting another verification email. Check your inbox (including spam folder) for the previous email.`,
          });
        }
      }

      // If user exists but is not verified, update their password and resend verification email
      await existingUser.generatePasswordHash(password);

      // Generate new email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      existingUser.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
      existingUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      existingUser.lastVerificationEmailSent = new Date();

      await existingUser.save();

      // Send verification email
      try {
        const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
        const emailData = emailTemplates.verification(verificationUrl, email);

        await sendEmail({
          to: email,
          ...emailData,
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Don't fail signup if email fails
      }

      return res.status(201).json({
        success: true,
        message: 'Password updated. Please check your email for verification.',
      });
    }

    // Create new user
    const user = new User({ email });
    await user.generatePasswordHash(password);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    user.lastVerificationEmailSent = new Date();

    await user.save();

    // Send verification email
    try {
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
      const emailData = emailTemplates.verification(verificationUrl, email);

      await sendEmail({
        to: email,
        ...emailData,
      });
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Don't fail signup if email fails
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        error: 'Account temporarily locked due to too many failed login attempts',
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      // Generate and send OTP (simplified implementation)
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

      user.otpSecret = hashedOTP;
      user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save();

      // Send OTP email (in production, use SMS service)
      try {
        await sendEmail({
          to: user.email,
          subject: 'Your RevisionFlow Login Code',
          html: `<p>Your login code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
        });
      } catch (emailError) {
        console.error('OTP email send error:', emailError);
      }

      return res.json({
        success: true,
        requiresTwoFactor: true,
        message: 'Please check your email for the verification code',
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    user.addRefreshToken(refreshToken, userAgent, ipAddress);
    user.lastLogin = new Date();
    await user.save();

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/auth/refresh',
    });

    // Return access token and user data
    res.json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
        timezone: user.timezone,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP for two-factor authentication
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res, next) => {
  try {
    const { otp } = req.body;

    // Hash the provided OTP
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

    // Find user with this OTP
    const user = await User.findOne({
      otpSecret: hashedOTP,
      otpExpires: { $gt: Date.now() },
    }).select('+otpSecret +otpExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired OTP',
      });
    }

    // Clear OTP
    user.otpSecret = undefined;
    user.otpExpires = undefined;
    user.lastLogin = new Date();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    user.addRefreshToken(refreshToken, userAgent, ipAddress);
    await user.save();

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/auth/refresh',
    });

    res.json({
      success: true,
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        twoFactorEnabled: user.twoFactorEnabled,
        timezone: user.timezone,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (requires refresh token cookie)
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token provided',
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (error) {
      // Clear the invalid refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Find user and check if refresh token is valid
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.some(rt => rt.token === refreshToken)) {
      // Clear the invalid refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Remove old refresh token and generate new ones
    user.removeRefreshToken(refreshToken);
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Store new refresh token
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip;
    user.addRefreshToken(newRefreshToken, userAgent, ipAddress);
    await user.save();

    // Set new refresh token as httpOnly cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/api/auth/refresh',
    });

    res.json({
      success: true,
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken && req.user) {
      // Remove refresh token from database
      req.user.removeRefreshToken(refreshToken);
      await req.user.save();
    }

    // Clear refresh token cookie with all options to ensure it's properly cleared
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No user found with that email address',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    try {
      const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
      const emailData = emailTemplates.passwordReset(resetUrl, email);

      await sendEmail({
        to: email,
        ...emailData,
      });

      res.json({
        success: true,
        message: 'Password reset email sent',
      });
    } catch (emailError) {
      console.error('Password reset email error:', emailError);

      // Clear reset token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        error: 'Email could not be sent',
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash token and find user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    // Set new password
    await user.generatePasswordHash(password);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Clear all refresh tokens (force re-login)
    user.clearAllRefreshTokens();

    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify reset token validity
// @route   POST /api/auth/verify-reset-token
// @access  Public
const verifyResetToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    // Hash token and find user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
    }

    res.json({
      success: true,
      message: 'Reset token is valid',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email address
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    // Hash token and find user
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification token',
      });
    }

    // Verify email
    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully! You can now login.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
const resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select('+lastVerificationEmailSent +emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No user found with that email address',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email is already verified',
      });
    }

    // Check rate limiting (5 minutes between emails)
    const lastEmailTime = user.lastVerificationEmailSent;
    if (lastEmailTime) {
      const timeSinceLastEmail = Date.now() - lastEmailTime.getTime();
      const minWaitTime = 5 * 60 * 1000; // 5 minutes

      if (timeSinceLastEmail < minWaitTime) {
        const remainingMinutes = Math.ceil((minWaitTime - timeSinceLastEmail) / (60 * 1000));
        return res.status(429).json({
          success: false,
          error: `Please wait ${remainingMinutes} minute(s) before requesting another verification email.`,
        });
      }
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    user.lastVerificationEmailSent = new Date();

    await user.save();

    // Send verification email
    try {
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;
      const emailData = emailTemplates.verification(verificationUrl, email);

      await sendEmail({
        to: email,
        ...emailData,
      });

      res.json({
        success: true,
        message: 'Verification email sent successfully',
      });
    } catch (emailError) {
      console.error('Verification email send error:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification email',
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  verifyOTP,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  verifyResetToken,
  verifyEmail,
  resendVerificationEmail,
};