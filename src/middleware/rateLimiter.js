const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';

// Helper to create limiter or bypass
const createLimiter = (options) => {
  if (isDevelopment) {
    return (req, res, next) => next();
  }
  return rateLimit(options);
};

// Stricter rate limiting for auth endpoints
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiting for password reset
const passwordResetLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for email verification
const emailVerificationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 verification requests per hour
  message: 'Too many verification attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
};