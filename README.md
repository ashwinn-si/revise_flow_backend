# RevisionFlow Server

**Backend API for the RevisionFlow spaced revision learning application**

RevisionFlow Server is a Node.js/Express backend that powers the RevisionFlow application, providing authentication, task management, revision scheduling, and email notifications using scientifically-backed spaced repetition principles.

## 🚀 Features

### 🔐 Authentication & Security
- **JWT Authentication**: Access + refresh token rotation system
- **Two-Factor Authentication**: Email-based 2FA with OTP verification
- **Password Security**: Bcrypt hashing with salt rounds
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive request validation middleware
- **CORS Configuration**: Secure cross-origin resource sharing

### 📋 Task Management
- **CRUD Operations**: Full task lifecycle management
- **Revision Scheduling**: Automatic spaced repetition scheduling
- **Custom Intervals**: Configurable revision intervals (default: 3rd & 7th day)
- **Task Archives**: Soft delete with archive functionality
- **Progress Tracking**: Completion statistics and analytics

### 📧 Email Services
- **Daily Reminders**: Automated 6:00 AM local time notifications
- **2FA Codes**: Secure OTP delivery
- **Password Reset**: Secure email-based password recovery
- **Email Verification**: Account activation system
- **Timezone Support**: Localized email scheduling

### 🗄️ Database
- **MongoDB Integration**: Mongoose ODM for data modeling
- **Indexing**: Optimized queries with proper indexing
- **Data Validation**: Schema-level validation
- **Aggregation Pipelines**: Complex data queries for analytics

### 🔄 Background Services
- **Cron Jobs**: Automated daily email reminders
- **Google Calendar**: Optional calendar integration
- **Logging**: Comprehensive application logging
- **Health Checks**: API health monitoring

## 📁 Project Structure

```
server/
├── src/
│   ├── app.js                  # Express app configuration
│   ├── server.js              # Server entry point
│   │
│   ├── config/                # Configuration files
│   │   ├── db.js             # MongoDB connection
│   │   ├── jwt.js            # JWT configuration
│   │   └── mailer.js         # Email service config
│   │
│   ├── controllers/           # Route controllers
│   │   ├── authController.js  # Authentication logic
│   │   ├── tasksController.js # Task management
│   │   ├── calendarController.js # Calendar views
│   │   └── googleController.js # Google integration
│   │
│   ├── middleware/            # Custom middleware
│   │   ├── verifyAccessToken.js # JWT verification
│   │   ├── validateRequest.js   # Input validation
│   │   ├── rateLimiter.js      # Rate limiting
│   │   └── errorHandler.js     # Error handling
│   │
│   ├── models/               # MongoDB models
│   │   ├── User.js          # User schema
│   │   └── Task.js          # Task schema
│   │
│   ├── routes/              # API routes
│   │   ├── auth.js         # Authentication routes
│   │   ├── tasks.js        # Task management routes
│   │   ├── calendar.js     # Calendar view routes
│   │   ├── google.js       # Google integration routes
│   │   └── admin.js        # Admin routes
│   │
│   ├── services/           # Business services
│   │   ├── cronService.js  # Scheduled tasks
│   │   └── emailService.js # Email operations
│   │
│   └── utils/              # Utility functions
│       ├── calendarUtils.js # Date/calendar helpers
│       ├── dbUtils.js      # Database utilities
│       ├── logger.js       # Logging utility
│       └── timezoneUtils.js # Timezone handling
│
├── logs/                   # Application logs
├── scripts/               # Utility scripts
│   ├── initDb.js         # Database initialization
│   └── testCronMail.js   # Email testing
│
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js** 16+ and npm
- **MongoDB** 4.4+ (local or cloud)
- **Gmail account** (for email functionality)
- **Google Cloud Project** (optional, for Calendar integration)

### 1. Clone and Install
```bash
git clone <repository-url>
cd Revise Flow/server
npm install
```

### 2. Environment Configuration
```bash
cp ../.env.example .env
```

Edit `.env` with your configuration:

```env
# Database
MONGO_URI=mongodb://localhost:27017/revisionflow

# JWT Secrets
JWT_SECRET=your-256-bit-secret-key
JWT_REFRESH_SECRET=your-256-bit-refresh-secret

# Server Configuration
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Email Configuration (Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Google Calendar (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback

# Security
RATE_LIMIT_MAX_REQUESTS=100
COOKIE_SECRET=your-cookie-secret

# Logging
LOG_LEVEL=info
```

### 3. Gmail Setup for Email Services
1. **Enable 2FA** on your Gmail account
2. **Generate App Password**:
   - Go to Google Account Settings → Security → App Passwords
   - Generate password for "Mail"
   - Use this as `SMTP_PASS`

### 4. MongoDB Setup
**Local MongoDB:**
```bash
# macOS with Homebrew
brew services start mongodb-community

# Or manually
mongod --config /usr/local/etc/mongod.conf
```

**MongoDB Atlas (Cloud):**
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/revisionflow
```

### 5. Google Calendar Setup (Optional)
1. **Create Google Cloud Project**
2. **Enable Google Calendar API**
3. **Create OAuth 2.0 Credentials**:
   - Application type: Web application
   - Authorized redirect URI: `http://localhost:5000/api/google/callback`

## 🚀 Running the Application

### Development Mode
```bash
npm run dev
```
Server starts at `http://localhost:5000` with hot reload.

### Production Mode
```bash
npm start
```

### Database Initialization
```bash
node scripts/initDb.js
```

### Test Email Service
```bash
node scripts/testCronMail.js
```

## 📊 API Endpoints

### Authentication
```
POST   /api/auth/register         # User registration
POST   /api/auth/login            # User login
POST   /api/auth/verify-2fa       # Two-factor verification
POST   /api/auth/refresh          # Token refresh
POST   /api/auth/logout           # User logout
POST   /api/auth/forgot-password  # Password reset request
POST   /api/auth/reset-password   # Password reset confirmation
GET    /api/auth/verify-email     # Email verification
```

### Task Management
```
GET    /api/tasks                 # Get user tasks (paginated)
POST   /api/tasks                 # Create new task
GET    /api/tasks/:id             # Get specific task
PUT    /api/tasks/:id             # Update task
DELETE /api/tasks/:id             # Delete task
PATCH  /api/tasks/:id/archive     # Archive/unarchive task
PATCH  /api/tasks/:id/revisions/:revisionId # Complete revision
POST   /api/tasks/:id/reschedule  # Reschedule revision
GET    /api/tasks/stats           # User statistics
```

### Calendar Views
```
GET    /api/calendar?date=YYYY-MM-DD        # Day view
GET    /api/calendar/overview?from=&to=     # Date range
GET    /api/calendar/upcoming               # Upcoming revisions
GET    /api/calendar/overdue                # Overdue revisions
```

### Google Calendar
```
GET    /api/google/auth           # OAuth initiation
GET    /api/google/callback       # OAuth callback
POST   /api/google/calendar/add   # Add calendar event
DELETE /api/google/disconnect     # Disconnect integration
```

### Health & Admin
```
GET    /health                    # Health check
GET    /api/admin/stats          # System statistics (admin only)
```

## 🗄️ Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique, indexed),
  password: String (hashed),
  isEmailVerified: Boolean,
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  refreshTokens: [String] (indexed),
  loginAttempts: Number,
  lockUntil: Date,
  lastLogin: Date,
  timezone: String,
  emailNotifications: Boolean,
  twoFactorCode: String,
  twoFactorExpires: Date,
  isGoogleCalendarConnected: Boolean,
  googleCalendarTokens: Object,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Tasks Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User', indexed),
  title: String,
  description: String,
  isArchived: Boolean (indexed),
  revisions: [{
    _id: ObjectId,
    day: Number,
    scheduledDate: Date (indexed),
    isCompleted: Boolean (indexed),
    completedAt: Date,
    notes: String
  }],
  createdAt: Date (indexed),
  updatedAt: Date
}
```

## 🔧 Scripts

```bash
npm run dev          # Development with hot reload
npm start           # Production server
npm test            # Run tests
npm run lint        # Code linting
npm run init-db     # Initialize database
npm run test-email  # Test email service
```

## ⚙️ Configuration

### Environment Variables
- **Required**: `MONGO_URI`, `JWT_SECRET`, `SMTP_USER`, `SMTP_PASS`
- **Optional**: Google Calendar, rate limiting, logging level
- **Security**: Use strong, unique secrets in production

### Email Configuration
- **Gmail**: App passwords required (not regular password)
- **Custom SMTP**: Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- **Templates**: HTML email templates in `/services/emailService.js`

### Timezone Handling
- **Detection**: Automatic timezone detection from client
- **Storage**: User timezone stored in database
- **Scheduling**: All cron jobs respect user timezones

## 🔍 Logging & Monitoring

### Log Levels
- **Error**: Application errors, authentication failures
- **Warn**: Rate limit hits, validation failures
- **Info**: User actions, system events
- **Debug**: Detailed request/response data

### Log Files
- **Error logs**: `/logs/error.log`
- **Combined logs**: `/logs/combined.log`
- **Console**: Development mode only

### Health Monitoring
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "database": "connected",
  "uptime": 3600.123
}
```

## 🧪 Testing

### Manual API Testing
```bash
# Health check
curl http://localhost:5000/health

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Password123!"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'
```

### Test Email Service
```bash
node scripts/testCronMail.js
```

## 🚀 Deployment

### Production Environment
```env
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/revisionflow
CLIENT_URL=https://your-domain.com
JWT_SECRET=super-strong-production-secret
```

### Deployment Platforms

#### Heroku
```bash
heroku create revisionflow-api
heroku addons:create mongolab:sandbox
heroku config:set NODE_ENV=production
git push heroku main
```

#### Railway/Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy automatically

#### Traditional VPS
```bash
# PM2 for process management
npm install -g pm2
pm2 start src/server.js --name "revisionflow-api"
pm2 startup
pm2 save
```

## 🔒 Security Considerations

### Production Checklist
- [ ] Use strong JWT secrets (256-bit minimum)
- [ ] Enable HTTPS in production
- [ ] Configure proper CORS origins
- [ ] Use environment variables for secrets
- [ ] Enable MongoDB authentication
- [ ] Set up rate limiting
- [ ] Configure proper logging
- [ ] Regular security updates

### Common Security Headers
```javascript
// Already configured in app.js
helmet(), // Security headers
cors(),   // CORS configuration
rateLimit // Rate limiting
```

## 🤝 Contributing

### Development Guidelines
- Follow ESLint configuration
- Write tests for new features
- Update API documentation
- Use conventional commit messages

### Code Structure
- **Controllers**: Handle HTTP requests/responses
- **Services**: Business logic and external integrations
- **Models**: Database schema and validation
- **Middleware**: Request processing and validation
- **Utils**: Shared utility functions

## 📝 License

This project is licensed under the MIT License.

---

**Built with ❤️ for effective spaced repetition learning**

For frontend documentation, see `/client/README.md`