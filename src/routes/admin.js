const express = require('express');
const { createDefaultAdmin, clearDatabase, resetDatabaseToDefault } = require('../utils/dbUtils');
const verifyAccessToken = require('../middleware/verifyAccessToken');
const User = require('../models/User');

const router = express.Router();

/**
 * Middleware to check if user is admin
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.email !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to verify admin status'
    });
  }
};

/**
 * Create default admin user
 * POST /api/admin/create-default-admin
 */
router.post('/create-default-admin', async (req, res) => {
  try {
    const result = await createDefaultAdmin();

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * ⚠️ DANGER ZONE: Clear entire database
 * DELETE /api/admin/clear-database
 * Requires admin authentication and explicit confirmation
 */
router.delete('/clear-database', verifyAccessToken, requireAdmin, async (req, res) => {
  try {
    // Check for confirmation in request body
    const { confirmClear } = req.body;

    if (!confirmClear) {
      return res.status(400).json({
        success: false,
        message: 'Database clear operation requires explicit confirmation',
        warning: 'This operation will delete ALL data permanently!',
        instructions: 'Send request with { "confirmClear": true } in the body to proceed'
      });
    }

    const result = await clearDatabase(true);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * ⚠️ DANGER ZONE: Reset database to default state
 * POST /api/admin/reset-database
 * Requires admin authentication and explicit confirmation
 */
router.post('/reset-database', verifyAccessToken, requireAdmin, async (req, res) => {
  try {
    // Check for confirmation in request body
    const { confirmReset } = req.body;

    if (!confirmReset) {
      return res.status(400).json({
        success: false,
        message: 'Database reset operation requires explicit confirmation',
        warning: 'This operation will delete ALL data and create a default admin user!',
        instructions: 'Send request with { "confirmReset": true } in the body to proceed'
      });
    }

    const result = await resetDatabaseToDefault(true);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Get admin status and database info
 * GET /api/admin/status
 */
router.get('/status', verifyAccessToken, requireAdmin, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const collections = await mongoose.connection.db.listCollections().toArray();

    const collectionStats = {};
    for (const collection of collections) {
      try {
        const count = await mongoose.connection.db.collection(collection.name).countDocuments();
        collectionStats[collection.name] = count;
      } catch (error) {
        collectionStats[collection.name] = `Error: ${error.message}`;
      }
    }

    res.status(200).json({
      success: true,
      admin: {
        userId: req.user.id,
        email: req.user.email
      },
      database: {
        name: mongoose.connection.db.databaseName,
        collections: collectionStats,
        totalCollections: collections.length
      },
      server: {
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get admin status',
      message: error.message
    });
  }
});

module.exports = router;