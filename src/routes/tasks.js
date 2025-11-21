const express = require('express');
const {
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
} = require('../controllers/tasksController');
const { taskValidation } = require('../middleware/validateRequest');
const verifyAccessToken = require('../middleware/verifyAccessToken');

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyAccessToken);

// @route   GET /api/tasks/stats
// @desc    Get task statistics
// @access  Private
router.get('/stats', getTaskStats);

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private
router.post('/', taskValidation.create, createTask);

// @route   GET /api/tasks
// @desc    Get all tasks for user
// @access  Private
router.get('/', getTasks);

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', getTask);

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', taskValidation.update, updateTask);

// @route   PATCH /api/tasks/:id/schedule
// @desc    Update task revision schedule
// @access  Private
router.patch('/:id/schedule', taskValidation.updateSchedule, updateTaskSchedule);

// @route   PATCH /api/tasks/:id/revisions/:revisionId/complete
// @desc    Mark revision as complete
// @access  Private
router.patch('/:id/revisions/:revisionId/complete', markRevisionComplete);

// @route   PATCH /api/tasks/:id/revisions/:revisionId/reschedule
// @desc    Reschedule revision
// @access  Private
router.patch('/:id/revisions/:revisionId/reschedule', rescheduleRevision);

// @route   PATCH /api/tasks/:id/archive
// @desc    Archive/Unarchive task
// @access  Private
router.patch('/:id/archive', archiveTask);

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private
router.delete('/:id', deleteTask);

module.exports = router;