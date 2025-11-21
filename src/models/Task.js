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

TaskSchema.methods.updateRevisionStatus = function (revisionId, status = 'done') {
  console.log('updateRevisionStatus called with:', { revisionId, status });

  // Convert string ID to ObjectId if needed
  const mongoose = require('mongoose');
  let objectId;
  try {
    objectId = mongoose.Types.ObjectId.isValid(revisionId)
      ? new mongoose.Types.ObjectId(revisionId)
      : revisionId;
  } catch (error) {
    console.error('Invalid revision ID format:', revisionId);
    return false;
  }

  const revision = this.revisions.id(objectId);
  console.log('Found revision for update:', revision ? { id: revision._id.toString(), currentStatus: revision.status } : 'null');

  if (revision) {
    revision.status = status;
    if (status === 'done') {
      revision.completedAt = new Date();
    } else {
      revision.completedAt = undefined;
    }
    console.log('Revision status updated to:', status);
    return true;
  }
  console.error('Revision not found for status update:', revisionId);
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
  console.log('postponeRevision called with revisionId:', revisionId);
  console.log('Available revisions:', this.revisions.map(r => ({ id: r._id.toString(), status: r.status, scheduledDate: r.scheduledDate })));

  // Convert string ID to ObjectId if needed
  const mongoose = require('mongoose');
  let objectId;
  try {
    objectId = mongoose.Types.ObjectId.isValid(revisionId)
      ? new mongoose.Types.ObjectId(revisionId)
      : revisionId;
  } catch (error) {
    console.error('Invalid revision ID format:', revisionId);
    return false;
  }

  const revision = this.revisions.id(objectId);
  console.log('Found revision:', revision ? { id: revision._id.toString(), status: revision.status } : 'null');

  if (!revision) {
    console.error('Revision not found for ID:', revisionId);
    return false;
  }

  // Get tomorrow's date based on the current scheduled date, not today
  // This ensures that postponing a future revision moves it one day forward from its scheduled date
  const currentScheduledDate = new Date(revision.scheduledDate);
  const tomorrow = new Date(currentScheduledDate);
  tomorrow.setUTCDate(currentScheduledDate.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0); // Set to start of day in UTC

  console.log('Current scheduled date:', currentScheduledDate.toISOString());
  console.log('Setting new date (UTC):', tomorrow.toISOString());

  // Update the revision
  revision.scheduledDate = tomorrow;
  revision.status = 'pending'; // Reset to pending so it appears in next day's revisions

  console.log('Revision updated:', {
    id: revision._id.toString(),
    scheduledDate: revision.scheduledDate.toISOString(),
    status: revision.status
  });

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
  console.log('findRevisionsDueOnDate called with:', { userId, date });

  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  console.log('Date boundaries:', {
    targetDate: targetDate.toISOString(),
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString()
  });

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

  console.log('MongoDB aggregation pipeline:', JSON.stringify(pipeline, null, 2));

  return this.aggregate(pipeline).then(results => {
    console.log(`Found ${results.length} revisions for date ${date}`);
    results.forEach((result, index) => {
      console.log(`Revision ${index + 1}:`, {
        taskTitle: result.title,
        revisionId: result.revisionId.toString(),
        scheduledDate: result.revision.scheduledDate.toISOString(),
        status: result.revision.status
      });
    });
    return results;
  });
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