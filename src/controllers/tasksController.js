const Task = require('../models/Task');

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res, next) => {
  try {
    const { title, notes, completedDate, revisions } = req.body;

    const task = new Task({
      user: req.user._id,
      title,
      notes,
      completedDate: new Date(completedDate),
    });

    // If custom revisions are provided, use them instead of defaults
    if (revisions && Array.isArray(revisions)) {
      task.revisions = revisions.map(date => ({
        scheduledDate: new Date(date),
        status: 'pending',
      }));
    }
    // Otherwise, default revisions will be added by pre-save middleware

    const savedTask = await task.save();

    res.status(201).json({
      success: true,
      data: savedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all tasks for user
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      archived = false,
      startDate,
      endDate,
      sortBy = '-completedDate'
    } = req.query;

    const query = {
      user: req.user._id,
      isArchived: archived === 'true',
    };

    // Date range filtering
    if (startDate || endDate) {
      query.completedDate = {};
      if (startDate) query.completedDate.$gte = new Date(startDate);
      if (endDate) query.completedDate.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(query)
      .sort(sortBy)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'email');

    const total = await Task.countDocuments(query);

    res.json({
      success: true,
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res, next) => {
  try {
    const { title, notes, tags, priority, completedDate, revisions } = req.body;

    console.log('Update task request:', {
      taskId: req.params.id,
      body: req.body,
      userId: req.user._id
    });

    // Validate ObjectId format
    if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid task ID format',
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Update allowed fields
    if (title !== undefined) task.title = title;
    if (notes !== undefined) task.notes = notes;
    if (tags !== undefined) task.tags = tags;
    if (priority !== undefined) task.priority = priority;
    if (completedDate !== undefined) task.completedDate = new Date(completedDate);

    // Update revisions if provided
    if (revisions && Array.isArray(revisions)) {
      // If revisions are strings (dates), convert to objects
      // If they are objects, use as is (assuming they have scheduledDate)
      task.revisions = revisions.map(rev => {
        if (typeof rev === 'string') {
          return {
            scheduledDate: new Date(rev),
            status: 'pending',
          };
        }
        return {
          ...rev,
          scheduledDate: new Date(rev.scheduledDate),
        };
      });
    }

    console.log('Task before save:', {
      title: task.title,
      completedDate: task.completedDate,
      revisionsCount: task.revisions.length,
      revisions: task.revisions.map(r => ({ scheduledDate: r.scheduledDate, status: r.status }))
    });

    const updatedTask = await task.save();

    console.log('Task saved successfully:', updatedTask._id);

    res.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    console.error('Error updating task:', error);
    next(error);
  }
};

// @desc    Update task revision schedule
// @route   PATCH /api/tasks/:id/schedule
// @access  Private
const updateTaskSchedule = async (req, res, next) => {
  try {
    const { revisions } = req.body;

    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Update revisions
    task.revisions = revisions.map(revision => ({
      ...revision,
      scheduledDate: new Date(revision.scheduledDate),
    }));

    const updatedTask = await task.save();

    res.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark revision as complete or update status
// @route   PATCH /api/tasks/:id/revisions/:revisionId/complete
// @access  Private
const markRevisionComplete = async (req, res, next) => {
  try {
    const { status } = req.body;
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    // Handle postpone action differently - move to next date
    if (status === 'postponed') {
      console.log('Postponing revision:', req.params.revisionId, 'for task:', req.params.id);

      const result = task.postponeRevision(req.params.revisionId);

      if (!result || !result.success) {
        console.error('Postpone failed for revision:', req.params.revisionId);
        return res.status(404).json({
          success: false,
          error: 'Revision not found or postpone failed',
        });
      }

      console.log('Postpone successful, saving task...');

      try {
        await task.save();
        console.log('Task saved successfully after postpone');
      } catch (saveError) {
        console.error('Error saving task after postpone:', saveError);
        return res.status(500).json({
          success: false,
          error: 'Failed to save postponed revision',
        });
      }

      return res.json({
        success: true,
        message: `Revision postponed to tomorrow (${result.newDate.toLocaleDateString()}) and will appear in pending revisions`,
        data: {
          task,
          postponeInfo: {
            newDate: result.newDate,
            nextInterval: result.nextInterval,
            newStatus: 'pending' // Indicate the final status
          }
        },
      });
    }

    // Handle regular status updates (done, skipped, etc.)
    const success = task.updateRevisionStatus(req.params.revisionId, status || 'done');

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Revision not found',
      });
    }

    await task.save();

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reschedule revision
// @route   PATCH /api/tasks/:id/revisions/:revisionId/reschedule
// @access  Private
const rescheduleRevision = async (req, res, next) => {
  try {
    const { newDate } = req.body;

    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    const success = task.rescheduleRevision(req.params.revisionId, new Date(newDate));

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Revision not found',
      });
    }

    await task.save();

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Archive/Unarchive task
// @route   PATCH /api/tasks/:id/archive
// @access  Private
const archiveTask = async (req, res, next) => {
  try {
    const { archived = true } = req.body;

    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user._id,
      },
      { isArchived: archived },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      });
    }

    await task.deleteOne();

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get task statistics
// @route   GET /api/tasks/stats
// @access  Private
const getTaskStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    const matchQuery = {
      user: userId,
      isArchived: false,
    };

    if (startDate || endDate) {
      matchQuery.completedDate = {};
      if (startDate) matchQuery.completedDate.$gte = new Date(startDate);
      if (endDate) matchQuery.completedDate.$lte = new Date(endDate);
    }

    const stats = await Task.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalTasks: { $sum: 1 },
          totalRevisions: { $sum: { $size: '$revisions' } },
          completedRevisions: {
            $sum: {
              $size: {
                $filter: {
                  input: '$revisions',
                  cond: { $eq: ['$$this.status', 'done'] }
                }
              }
            }
          },
          pendingRevisions: {
            $sum: {
              $size: {
                $filter: {
                  input: '$revisions',
                  cond: { $eq: ['$$this.status', 'pending'] }
                }
              }
            }
          },
        }
      }
    ]);

    const result = stats[0] || {
      totalTasks: 0,
      totalRevisions: 0,
      completedRevisions: 0,
      pendingRevisions: 0,
    };

    // Calculate completion rate
    result.completionRate = result.totalRevisions > 0
      ? Math.round((result.completedRevisions / result.totalRevisions) * 100)
      : 0;

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getTasks,
  getTask,
  updateTask,
  updateTaskSchedule,
  markRevisionComplete,
  rescheduleRevision,
  archiveTask,
  deleteTask,
  getTaskStats,
};