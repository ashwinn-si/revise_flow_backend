const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ],
  },

  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 4,
    select: false, // Don't include password in queries by default
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },

  // Store current OTP for verification (hashed)
  otpSecret: {
    type: String,
    select: false,
  },

  otpExpires: {
    type: Date,
    select: false,
  },

  timezone: {
    type: String,
    default: 'Asia/Kolkata', // India Standard Time as default
    validate: {
      validator: function (v) {
        // Common timezone validation including India timezone
        const validTimezones = [
          'UTC',
          'Asia/Kolkata', // India Standard Time
          'America/New_York', // Eastern Time
          'America/Los_Angeles', // Pacific Time
          'America/Chicago', // Central Time
          'America/Denver', // Mountain Time
          'Europe/London', // GMT/BST
          'Europe/Paris', // CET
          'Europe/Berlin', // CET
          'Asia/Tokyo', // Japan Standard Time
          'Asia/Shanghai', // China Standard Time
          'Asia/Dubai', // Gulf Standard Time
          'Australia/Sydney', // Australian Eastern Time
          'Australia/Melbourne', // Australian Eastern Time
          'Asia/Singapore', // Singapore Standard Time
          'Asia/Hong_Kong' // Hong Kong Time
        ];
        return validTimezones.includes(v) || /^[A-Za-z_]+\/[A-Za-z_]+$/.test(v);
      },
      message: 'Please provide a valid timezone (e.g., Asia/Kolkata for India)'
    },
  },

  // Google Calendar integration
  google: {
    accessToken: { type: String, select: false },
    refreshToken: { type: String, select: false },
    calendarId: { type: String },
    connected: { type: Boolean, default: false },
  },

  // For refresh token management (can store multiple for different devices)
  refreshTokens: [{
    token: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    userAgent: String,
    ipAddress: String,
  }],

  // Account verification
  emailVerificationToken: {
    type: String,
    select: false,
  },

  emailVerificationExpires: {
    type: Date,
    select: false,
  },

  lastVerificationEmailSent: {
    type: Date,
    select: false,
  },

  // Password reset
  passwordResetToken: {
    type: String,
    select: false,
  },

  passwordResetExpires: {
    type: Date,
    select: false,
  },

  // Settings
  settings: {
    emailNotifications: {
      type: Boolean,
      default: true,
    },
    dailyReminderTime: {
      type: String,
      default: '06:00', // 24-hour format
    },
  },

  // Metadata
  lastLogin: {
    type: Date,
  },

  loginAttempts: {
    type: Number,
    default: 0,
  },

  lockUntil: {
    type: Date,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt
});

// Indexes for performance
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });

// Virtual for checking if account is locked
UserSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Instance methods
UserSchema.methods.comparePassword = async function (candidatePassword) {
  // Return false if password is not set
  if (!this.passwordHash) {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.passwordHash);
};

UserSchema.methods.generatePasswordHash = async function (password) {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
  this.passwordHash = await bcrypt.hash(password, saltRounds);
};

UserSchema.methods.addRefreshToken = function (token, userAgent, ipAddress) {
  // Remove old tokens (keep only the last 5)
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens = this.refreshTokens.slice(-4);
  }

  this.refreshTokens.push({
    token,
    userAgent,
    ipAddress,
    createdAt: new Date(),
  });
};

UserSchema.methods.removeRefreshToken = function (token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
};

UserSchema.methods.clearAllRefreshTokens = function () {
  this.refreshTokens = [];
};

// Handle login attempts and account locking
UserSchema.methods.incLoginAttempts = function () {
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Check if we've reached max attempts and it's not locked already
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Pre-save middleware
UserSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('passwordHash')) return next();

  // If passwordHash is being set directly (already hashed), don't hash again
  if (this.passwordHash && this.passwordHash.length === 60) return next();

  next();
});

module.exports = mongoose.model('User', UserSchema);