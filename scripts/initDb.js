#!/usr/bin/env node

/**
 * Database initialization script for RevisionFlow
 * 
 * Usage:
 *   node scripts/initDb.js                    - Create default admin user
 *   node scripts/initDb.js --clear            - Clear database (requires confirmation)
 *   node scripts/initDb.js --reset            - Reset to default state (clear + create admin)
 *   node scripts/initDb.js --help             - Show this help
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const { createDefaultAdmin, clearDatabase, resetDatabaseToDefault } = require('../src/utils/dbUtils');

// Parse command line arguments
const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);

// Show help
if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
RevisionFlow Database Initialization Script

Usage:
  node scripts/initDb.js                    - Create default admin user
  node scripts/initDb.js --clear            - Clear entire database
  node scripts/initDb.js --reset            - Reset to default state (clear + create admin)
  node scripts/initDb.js --help             - Show this help

Environment Variables Required:
  MONGO_URI                                 - MongoDB connection string

Default Admin User:
  Email: admin@gmail.com
  Password: root
  `);
  process.exit(0);
}

async function main() {
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully\n');

    if (hasFlag('--clear')) {
      // Clear database
      console.log('⚠️  WARNING: You are about to clear the ENTIRE database!');
      console.log('⚠️  This will delete ALL data permanently!');

      // In production, require explicit confirmation
      if (process.env.NODE_ENV === 'production') {
        console.log('❌ Database clearing is not allowed in production environment');
        process.exit(1);
      }

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise((resolve) => {
        rl.question('Type "CLEAR" to confirm: ', (answer) => {
          rl.close();
          resolve(answer === 'CLEAR');
        });
      });

      if (!confirmed) {
        console.log('❌ Operation cancelled');
        process.exit(1);
      }

      console.log('🗑️  Clearing database...');
      const clearResult = await clearDatabase(true);

      if (clearResult.success) {
        console.log(`✅ ${clearResult.message}`);
        console.log(`📊 Details:`, clearResult.details);
      } else {
        console.log(`❌ ${clearResult.message}`);
        if (clearResult.error) console.log(`   Error: ${clearResult.error}`);
      }

    } else if (hasFlag('--reset')) {
      // Reset database
      console.log('⚠️  WARNING: You are about to reset the ENTIRE database!');
      console.log('⚠️  This will delete ALL data and create a default admin user!');

      // In production, require explicit confirmation
      if (process.env.NODE_ENV === 'production') {
        console.log('❌ Database reset is not allowed in production environment');
        process.exit(1);
      }

      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const confirmed = await new Promise((resolve) => {
        rl.question('Type "RESET" to confirm: ', (answer) => {
          rl.close();
          resolve(answer === 'RESET');
        });
      });

      if (!confirmed) {
        console.log('❌ Operation cancelled');
        process.exit(1);
      }

      console.log('🔄 Resetting database...');
      const resetResult = await resetDatabaseToDefault(true);

      if (resetResult.success) {
        console.log(`✅ ${resetResult.message}`);
        console.log('\n📊 Results:');
        console.log(`   Clear: ${resetResult.clearResult.message}`);
        console.log(`   Admin: ${resetResult.adminResult.message}`);
      } else {
        console.log(`❌ ${resetResult.message}`);
        if (resetResult.error) console.log(`   Error: ${resetResult.error}`);
      }

    } else {
      // Default: Create admin user
      console.log('👤 Creating default admin user...');
      const result = await createDefaultAdmin();

      if (result.success) {
        console.log(`✅ ${result.message}`);
        if (result.user) {
          console.log(`   User ID: ${result.user.id}`);
          console.log(`   Email: ${result.user.email}`);
          console.log(`   Verified: ${result.user.isVerified}`);
        }
      } else {
        console.log(`❌ ${result.message}`);
        if (result.error) console.log(`   Error: ${result.error}`);
      }
    }

    console.log('\n🎉 Script completed successfully');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n⚠️  Script interrupted');
  await mongoose.connection.close();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Script terminated');
  await mongoose.connection.close();
  process.exit(1);
});

// Run the script
main();