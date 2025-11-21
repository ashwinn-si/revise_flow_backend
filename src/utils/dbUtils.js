const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');

/**
 * Creates a default admin user if it doesn't exist
 * Admin user: email = "admin", password = "root"
 * 
 * @returns {Promise<Object>} The created or existing admin user
 */
const createDefaultAdmin = async () => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@gmail.com' }).select('+passwordHash');

    if (existingAdmin) {
      console.log('Default admin user already exists');
      return {
        success: true,
        message: 'Admin user already exists',
        user: {
          id: existingAdmin._id,
          email: existingAdmin.email,
          isVerified: existingAdmin.isVerified
        }
      };
    }

    // Create new admin user
    const adminUser = new User({
      email: 'admin@gmail.com',
      isVerified: true, // Set as verified by default
      timezone: 'UTC',
      settings: {
        emailNotifications: true,
        dailyReminderTime: '06:00'
      }
    });

    // Set password using the model method
    await adminUser.generatePasswordHash('root');

    // Save the user
    const savedUser = await adminUser.save();

    console.log('Default admin user created successfully');
    return {
      success: true,
      message: 'Admin user created successfully',
      user: {
        id: savedUser._id,
        email: savedUser.email,
        isVerified: savedUser.isVerified
      }
    };

  } catch (error) {
    console.error('Error creating default admin user:', error);
    return {
      success: false,
      message: 'Failed to create admin user',
      error: error.message
    };
  }
};

/**
 * ⚠️  WARNING: This function clears the entire database!
 * This will delete ALL users, tasks, and other data permanently.
 * Use with extreme caution and only in development/testing environments.
 * 
 * @param {boolean} confirmClear - Must be true to proceed with clearing
 * @returns {Promise<Object>} Result of the clear operation
 */
const clearDatabase = async (confirmClear = false) => {
  // Safety check to prevent accidental database clearing
  if (!confirmClear) {
    return {
      success: false,
      message: 'Database clear operation requires explicit confirmation. Pass confirmClear: true to proceed.',
      warning: 'This operation will delete ALL data permanently!'
    };
  }

  // Additional safety check for production environment
  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      message: 'Database clearing is not allowed in production environment',
      error: 'Operation blocked for safety'
    };
  }

  try {
    // Get all collection names
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);

    console.log('Collections found:', collectionNames);

    // Clear all collections
    const clearResults = {};

    for (const collectionName of collectionNames) {
      try {
        const result = await mongoose.connection.db.collection(collectionName).deleteMany({});
        clearResults[collectionName] = {
          deletedCount: result.deletedCount,
          success: true
        };
        console.log(`Cleared ${result.deletedCount} documents from ${collectionName}`);
      } catch (error) {
        clearResults[collectionName] = {
          success: false,
          error: error.message
        };
        console.error(`Error clearing ${collectionName}:`, error.message);
      }
    }

    // Calculate total deleted documents
    const totalDeleted = Object.values(clearResults)
      .reduce((sum, result) => sum + (result.deletedCount || 0), 0);

    console.log(`Database cleared successfully. Total documents deleted: ${totalDeleted}`);

    return {
      success: true,
      message: `Database cleared successfully. Deleted ${totalDeleted} documents.`,
      details: clearResults,
      totalDeleted
    };

  } catch (error) {
    console.error('Error clearing database:', error);
    return {
      success: false,
      message: 'Failed to clear database',
      error: error.message
    };
  }
};

/**
 * Utility function to reset database to default state
 * Clears all data and creates default admin user
 * 
 * @param {boolean} confirmReset - Must be true to proceed
 * @returns {Promise<Object>} Result of the reset operation
 */
const resetDatabaseToDefault = async (confirmReset = false) => {
  if (!confirmReset) {
    return {
      success: false,
      message: 'Database reset operation requires explicit confirmation. Pass confirmReset: true to proceed.',
      warning: 'This operation will delete ALL data and create a default admin user!'
    };
  }

  try {
    console.log('Starting database reset...');

    // Clear the database
    const clearResult = await clearDatabase(true);
    if (!clearResult.success) {
      return clearResult;
    }

    // Create default admin user
    const adminResult = await createDefaultAdmin();
    if (!adminResult.success) {
      return {
        success: false,
        message: 'Database cleared but failed to create admin user',
        clearResult,
        adminResult
      };
    }

    return {
      success: true,
      message: 'Database reset to default state successfully',
      clearResult,
      adminResult
    };

  } catch (error) {
    console.error('Error resetting database:', error);
    return {
      success: false,
      message: 'Failed to reset database',
      error: error.message
    };
  }
};

module.exports = {
  createDefaultAdmin,
  clearDatabase,
  resetDatabaseToDefault
};