const { body, validationResult } = require('express-validator');

// Validation middleware to check for errors
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
    });
  }

  next();
};

// Auth validation rules
const authValidation = {
  signup: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 4 })
      .withMessage('Password must be at least 4 characters'),
    checkValidation,
  ],

  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    checkValidation,
  ],

  forgotPassword: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    checkValidation,
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 4 })
      .withMessage('Password must be at least 4 characters'),
    checkValidation,
  ],

  verifyResetToken: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    checkValidation,
  ],

  verifyOTP: [
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits')
      .isNumeric()
      .withMessage('OTP must contain only numbers'),
    checkValidation,
  ],

  verifyEmail: [
    body('token')
      .notEmpty()
      .withMessage('Verification token is required'),
    checkValidation,
  ],

  resendVerification: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    checkValidation,
  ],
};

// Task validation rules
const taskValidation = {
  create: [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Task title must be between 1 and 200 characters'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes must not exceed 1000 characters'),
    body('completedDate')
      .isISO8601()
      .toDate()
      .withMessage('Please provide a valid completion date'),
    body('revisions')
      .optional()
      .isArray()
      .withMessage('Revisions must be an array of dates'),
    body('revisions.*')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Each revision date must be a valid ISO date'),
    checkValidation,
  ],

  update: [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Task title must be between 1 and 200 characters'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Notes must not exceed 1000 characters'),
    body('completedDate')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Please provide a valid completion date'),
    body('revisions')
      .optional()
      .isArray()
      .withMessage('Revisions must be an array of dates'),
    body('revisions.*')
      .optional()
      .custom((value) => {
        // Handle both string dates and objects with scheduledDate
        if (typeof value === 'string') {
          return new Date(value).toString() !== 'Invalid Date';
        }
        if (typeof value === 'object' && value.scheduledDate) {
          return new Date(value.scheduledDate).toString() !== 'Invalid Date';
        }
        return false;
      })
      .withMessage('Each revision must be a valid date or object with scheduledDate'),
    checkValidation,
  ],

  updateSchedule: [
    body('revisions')
      .isArray()
      .withMessage('Revisions must be an array'),
    body('revisions.*.scheduledDate')
      .isISO8601()
      .toDate()
      .withMessage('Each revision date must be a valid ISO date'),
    body('revisions.*.status')
      .optional()
      .isIn(['pending', 'done', 'skipped'])
      .withMessage('Status must be pending, done, or skipped'),
    checkValidation,
  ],
};

// Calendar validation rules
const calendarValidation = {
  getDay: [
    body('date')
      .optional()
      .isISO8601()
      .toDate()
      .withMessage('Date must be a valid ISO date'),
    checkValidation,
  ],
};

module.exports = {
  checkValidation,
  authValidation,
  taskValidation,
  calendarValidation,
};