const mongoose = require('mongoose');

// Sub-schema for revisions
const RevisionSchema = new mongoose.Schema({
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required'],
    index: true,
  },

  status: {
    type: String,
    enum: {
      values: ['pending', 'done', 'skipped', 'postponed'],
      message: 'Status must be pending, done, skipped, or postponed'
    },
    default: 'pending',
  },

  sentReminder: {
    type: Boolean,
    default: false,
  },

  completedAt: {
    type: Date,
  },

  // Metadata for the revision
  meta: {
    remindersSent: {
      type: Number,
      default: 0,
    },
    lastReminderSent: {
      type: Date,
    },
  },
}, {
  timestamps: true,
});

// Main Task schema
const TaskSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true,
  },

  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters'],
  },

  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },

  // The date when the task was originally completed
  completedDate: {
    type: Date,
    required: [true, 'Completed date is required'],
    index: true,
  },

  // Array of revision schedules
  revisions: {
    type: [RevisionSchema],
    validate: {
      validator: function (revisions) {
        // Ensure revision dates are after completion date
        return revisions.every(revision =>
          new Date(revision.scheduledDate) >= new Date(this.completedDate)
        );
      },
      message: 'Revision dates must be after completion date'
    },
  },

  // Task categorization (optional, for future features)
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],

  // Priority level (optional, for future features)
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },

  // Archive status
  isArchived: {
    type: Boolean,
    default: false,
  },

  // Google Calendar integration
  googleCalendar: {
    eventId: String,
    synced: { type: Boolean, default: false },
    lastSyncAt: Date,
  },
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
TaskSchema.index({ user: 1, completedDate: 1 });
TaskSchema.index({ user: 1, 'revisions.scheduledDate': 1 });
TaskSchema.index({ user: 1, isArchived: 1, completedDate: -1 });

// Ensure virtuals are included in JSON
TaskSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    ret.id = ret._id;
    delete ret._id;
  }
});

// Virtual fields
TaskSchema.virtual('totalRevisions').get(function () {
  return this.revisions.length;
});

TaskSchema.virtual('completedRevisions').get(function () {
  return this.revisions.filter(r => r.status === 'done').length;
});

TaskSchema.virtual('pendingRevisions').get(function () {
  return this.revisions.filter(r => r.status === 'pending');
});

TaskSchema.virtual('upcomingRevisions').get(function () {
  const now = new Date();
  return this.revisions.filter(r =>
    r.status === 'pending' && new Date(r.scheduledDate) >= now
  );
});

TaskSchema.virtual('overdueRevisions').get(function () {
  const now = new Date();
  return this.revisions.filter(r =>
    r.status === 'pending' && new Date(r.scheduledDate) < now
  );
});

// Instance methods
TaskSchema.methods.addDefaultRevisions = function () {
  const completedDate = new Date(this.completedDate);

  // Default: 3rd and 7th day after completion
  const revision1 = new Date(completedDate);
  revision1.setDate(revision1.getDate() + 3);

  const revision2 = new Date(completedDate);
  revision2.setDate(revision2.getDate() + 7);

  this.revisions = [
    { scheduledDate: revision1 },
    { scheduledDate: revision2 }
  ];
};

TaskSchema.methods.updateRevisionStatus = function (revisionId, status) {
  // Convert string ID to ObjectId if needed
  const mongoose = require('mongoose');
  let objectId;
  try {
    objectId = mongoose.Types.ObjectId.isValid(revisionId)
      ? new mongoose.Types.ObjectId(revisionId)
      : revisionId;
  } catch (error) {
    return false;
  }

  const revision = this.revisions.id(objectId);

  if (revision) {
    revision.status = status;
    if (status === 'done') {
      revision.completedAt = new Date();
    } else {
      revision.completedAt = undefined;
    }
    return true;
  }
  return false;
};

TaskSchema.methods.markRevisionComplete = function (revisionId) {
  return this.updateRevisionStatus(revisionId, 'done');
};

TaskSchema.methods.rescheduleRevision = function (revisionId, newDate) {
  const revision = this.revisions.id(revisionId);
  if (revision) {
    revision.scheduledDate = newDate;
    revision.status = 'pending'; // Reset status if rescheduled
    return true;
  }
  return false;
};

TaskSchema.methods.postponeRevision = function (revisionId) {
  // Convert string ID to ObjectId if needed
  const mongoose = require('mongoose');
  let objectId;
  try {
    objectId = mongoose.Types.ObjectId.isValid(revisionId)
      ? new mongoose.Types.ObjectId(revisionId)
      : revisionId;
  } catch (error) {
    return false;
  }

  const revision = this.revisions.id(objectId);

  if (!revision) {
    return false;
  }

  // Get tomorrow's date based on the current scheduled date, not today
  // This ensures that postponing a future revision moves it one day forward from its scheduled date
  const currentScheduledDate = new Date(revision.scheduledDate);
  const tomorrow = new Date(currentScheduledDate);
  tomorrow.setUTCDate(currentScheduledDate.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0); // Set to start of day in UTC

  // Update the revision
  revision.scheduledDate = tomorrow;
  revision.status = 'pending'; // Reset to pending so it appears in next day's revisions

  return { success: true, newDate: tomorrow, nextInterval: 1 };
}; TaskSchema.methods.getRevisionsDue = function (date) {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  return this.revisions.filter(revision => {
    const revisionDate = new Date(revision.scheduledDate);
    return revisionDate >= startOfDay &&
      revisionDate <= endOfDay &&
      revision.status === 'pending';
  });
};

// Static methods
TaskSchema.statics.findByDateRange = function (userId, startDate, endDate) {
  return this.find({
    user: userId,
    completedDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
    isArchived: false,
  });
};

TaskSchema.statics.findRevisionsDueOnDate = function (userId, date) {
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const pipeline = [
    { $match: { user: new mongoose.Types.ObjectId(userId), isArchived: false } },
    { $unwind: '$revisions' },
    {
      $match: {
        'revisions.scheduledDate': { $gte: startOfDay, $lte: endOfDay },
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
      }
    }
  ];

  return this.aggregate(pipeline);
};

// Pre-save middleware
TaskSchema.pre('save', function (next) {
  // Add default revisions if none are provided and this is a new task
  if (this.isNew && (!this.revisions || this.revisions.length === 0)) {
    this.addDefaultRevisions();
  }

  next();
});

// Pre-remove middleware (for cleanup)
TaskSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
  // Could add cleanup logic here (e.g., remove from Google Calendar)
  next();
});

module.exports = mongoose.model('Task', TaskSchema);