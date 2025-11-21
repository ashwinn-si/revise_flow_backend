# Database Utility Functions

This document explains the database utility functions created for the RevisionFlow application.

## Overview

The database utilities provide functions for:
- Creating a default admin user
- Clearing the entire database ⚠️
- Resetting the database to default state

## Files Created

- `src/utils/dbUtils.js` - Core database utility functions
- `src/routes/admin.js` - API endpoints for admin operations
- `scripts/initDb.js` - Command-line script for database initialization

## Default Admin User

The default admin user has the following credentials:
- **Email**: `admin`
- **Password**: `root`
- **Verified**: `true` (email verification bypassed)
- **Timezone**: `UTC`

## Usage

### 1. Command Line Scripts

```bash
# Create default admin user
npm run db:init

# Clear entire database (requires confirmation)
npm run db:clear

# Reset database to default state (clear + create admin)
npm run db:reset

# Show help
node scripts/initDb.js --help
```

### 2. API Endpoints

#### Create Default Admin User
```http
POST /api/admin/create-default-admin
```

**Response:**
```json
{
  "success": true,
  "message": "Admin user created successfully",
  "user": {
    "id": "...",
    "email": "admin",
    "isVerified": true
  }
}
```

#### Clear Database ⚠️ (Admin Only)
```http
DELETE /api/admin/clear-database
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "confirmClear": true
}
```

#### Reset Database ⚠️ (Admin Only)
```http
POST /api/admin/reset-database
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "confirmReset": true
}
```

#### Get Admin Status
```http
GET /api/admin/status
Authorization: Bearer <admin_jwt_token>
```

### 3. Direct Function Usage

```javascript
const { createDefaultAdmin, clearDatabase, resetDatabaseToDefault } = require('./src/utils/dbUtils');

// Create admin user
const adminResult = await createDefaultAdmin();

// Clear database (requires explicit confirmation)
const clearResult = await clearDatabase(true);

// Reset to default state
const resetResult = await resetDatabaseToDefault(true);
```

## Safety Features

### Protection Against Accidental Data Loss

1. **Confirmation Required**: All destructive operations require explicit confirmation
2. **Production Protection**: Clear/reset operations are blocked in production environment
3. **Admin Authentication**: API endpoints require admin authentication
4. **Detailed Logging**: All operations are logged with detailed information
5. **Error Handling**: Comprehensive error handling and reporting

### Clear Database Function Safety

The `clearDatabase` function includes multiple safety checks:

```javascript
/**
 * ⚠️  WARNING: This function clears the entire database!
 * This will delete ALL users, tasks, and other data permanently.
 * Use with extreme caution and only in development/testing environments.
 * 
 * @param {boolean} confirmClear - Must be true to proceed with clearing
 * @returns {Promise<Object>} Result of the clear operation
 */
```

- Requires `confirmClear: true` parameter
- Blocks operation in production environment
- Provides detailed feedback on what was deleted
- Graceful error handling for each collection

## Database Collections Cleared

When clearing the database, all collections are affected:
- `users` - All user accounts and authentication data
- `tasks` - All tasks and revision data
- Any other collections that may exist

## Environment Variables

Make sure these environment variables are set:

```env
MONGO_URI=mongodb://localhost:27017/revisionflow
NODE_ENV=development  # 'production' blocks clear/reset operations
```

## Error Handling

All functions return a standardized response format:

```json
{
  "success": boolean,
  "message": "Human-readable message",
  "error": "Error details (if any)",
  "details": "Additional information (varies by operation)"
}
```

## Examples

### Initial Setup
```bash
# After cloning the project and setting up .env
npm run db:init
```

### Development Reset
```bash
# Reset database for testing
npm run db:reset
```

### API Usage (after logging in as admin)
```javascript
// First, login to get admin JWT token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin',
    password: 'root'
  })
});

const { accessToken } = await loginResponse.json();

// Then use admin endpoints
const statusResponse = await fetch('/api/admin/status', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

const status = await statusResponse.json();
console.log('Database status:', status);
```

## Security Notes

1. **Change Default Password**: In production, immediately change the admin password
2. **Restrict Admin Access**: Consider adding IP restrictions for admin endpoints
3. **Monitor Admin Actions**: Log all admin operations for security auditing
4. **Regular Backups**: Always backup your database before using clear/reset functions

## Troubleshooting

### Common Issues

1. **"Admin access required"** - Ensure you're logged in as the admin user
2. **"Database clear operation requires explicit confirmation"** - Include confirmation in request body
3. **"Not allowed in production"** - Change NODE_ENV or use development environment
4. **Connection errors** - Verify MONGO_URI is correct and database is running

### Debug Information

Check the admin status endpoint for database information:
```http
GET /api/admin/status
```

This will show:
- Current admin user info
- Database name and collection counts
- Server environment details