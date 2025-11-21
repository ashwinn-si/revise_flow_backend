const app = require('./app');
const connectDB = require('./config/db');
const { initializeScheduledJobs, stopScheduledJobs } = require('./services/cronService');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    logger.info('Database connected successfully');

    // Initialize scheduled jobs
    logger.info('Initializing scheduled jobs...');
    initializeScheduledJobs();
    logger.info('Scheduled jobs initialized successfully');

    // Start server
    logger.info('Starting HTTP server...');
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
    logger.info('HTTP server started successfully');

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`\n${signal} received. Shutting down gracefully...`);

      // Stop scheduled jobs first
      stopScheduledJobs();

      server.close(async () => {
        logger.info('HTTP server closed.');

        // Close database connection
        try {
          await require('mongoose').connection.close();
          logger.info('MongoDB connection closed.');
        } catch (err) {
          logger.error('Error closing MongoDB connection:', err);
        } finally {
          process.exit(0);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  startServer();
}

module.exports = { startServer };