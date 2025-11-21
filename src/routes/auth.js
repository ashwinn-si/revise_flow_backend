const express = require('express');
const {
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
} = require('../controllers/authController');
const { authValidation } = require('../middleware/validateRequest');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const verifyAccessToken = require('../middleware/verifyAccessToken');

const router = express.Router();

// @route   POST /api/auth/signup
// @desc    Register new user
// @access  Public
router.post('/signup', authLimiter, authValidation.signup, signup);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authLimiter, authValidation.login, login);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP for 2FA
// @access  Public
router.post('/verify-otp', authLimiter, authValidation.verifyOTP, verifyOTP);

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public (requires refresh token cookie)
router.post('/refresh', refresh);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', verifyAccessToken, logout);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', passwordResetLimiter, authValidation.forgotPassword, forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password
// @access  Public
router.post('/reset-password', passwordResetLimiter, authValidation.resetPassword, resetPassword);

// @route   POST /api/auth/verify-reset-token
// @desc    Verify reset token validity
// @access  Public
router.post('/verify-reset-token', authValidation.verifyResetToken, verifyResetToken);

// @route   POST /api/auth/verify-email
// @desc    Verify email address
// @access  Public
router.post('/verify-email', authValidation.verifyEmail, verifyEmail);

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification
// @access  Public
router.post('/resend-verification', authLimiter, authValidation.resendVerification, resendVerificationEmail);

module.exports = router;