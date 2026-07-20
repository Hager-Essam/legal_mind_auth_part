# LegalMind Server - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Email (Required for Password Reset)

#### Option A: Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication**
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device type
   - Click "Generate"
   - Copy the 16-character password (remove spaces)

3. **Update .env file**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=abcd efgh ijkl mnop  # Your 16-char app password
   EMAIL_FROM=LegalMind <noreply@legalmind.com>
   CLIENT_URL=http://localhost:3000
   ```

#### Option B: Other Email Providers

**SendGrid:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**Mailgun:**
```env
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-mailgun-username
EMAIL_PASSWORD=your-mailgun-password
```

**Mailtrap (Testing Only):**
```env
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=your-mailtrap-username
EMAIL_PASSWORD=your-mailtrap-password
```

### 3. Configure MongoDB

Make sure MongoDB is running:
```bash
# Windows
mongod

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

Update .env if needed:
```env
MONGODB_URI=mongodb://localhost:27017/legalmind
DB_NAME=legalmind
```

### 4. Start the Server

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will start at: http://localhost:5000

## Testing the Setup

### 1. Check Server Health
```bash
curl http://localhost:5000/health
```

Should return:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2026-07-19T10:00:00.000Z"
}
```

### 2. Access Swagger Documentation
Open in browser: http://localhost:5000/api-docs

### 3. Test Email Configuration

#### Using Postman:
1. Import `postman_collection.json`
2. Register a new user with your email
3. Test forgot password endpoint
4. Check your email inbox

#### Using cURL:
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "your-email@gmail.com",
    "password": "Password123"
  }'

# Request password reset
curl -X POST http://localhost:5000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com"
  }'
```

Check your email - you should receive a password reset email within 1-2 minutes.

## Environment Variables Reference

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/legalmind
DB_NAME=legalmind

# JWT
JWT_SECRET=LegalMindVeryStrongSecretKey123!  # Change in production!
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# CORS - Add your frontend URLs
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Email - CONFIGURE THIS!
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=LegalMind <noreply@legalmind.com>

# Client URL for email links
CLIENT_URL=http://localhost:3000
```

## API Endpoints

All endpoints are documented in Swagger at: http://localhost:5000/api-docs

### Quick Reference:

**Public Endpoints:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

**Protected Endpoints (Require Bearer Token):**
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout-all` - Logout from all devices

**Other:**
- `GET /health` - Health check
- `GET /api-docs` - Swagger documentation

## Troubleshooting

### Email Not Sending

**Gmail - "Less secure app access" error:**
- Solution: Use App Password instead of regular password
- DO NOT enable "Less secure app access" (deprecated by Google)

**Gmail - "Invalid login" error:**
- Make sure 2FA is enabled
- Generate a new App Password
- Remove all spaces from the App Password
- Make sure you're using the App Password, not your regular password

**"Error sending email" in response:**
- Check EMAIL_USER and EMAIL_PASSWORD in .env
- Make sure port 587 is not blocked by firewall
- Try with EMAIL_SECURE=false for port 587
- Check console logs for detailed error

### MongoDB Connection Issues

**"MongoNetworkError":**
```bash
# Make sure MongoDB is running
mongod --version  # Check if installed
mongod            # Start MongoDB manually
```

**"Authentication failed":**
- Check MONGODB_URI in .env
- Make sure DB_NAME matches your database

### Port Already in Use

```bash
# Find process using port 5000 (Windows)
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Find process using port 5000 (macOS/Linux)
lsof -ti:5000
kill -9 <PID>
```

Or change PORT in .env file.

## Email Templates

The system sends three types of emails:

1. **Password Reset Email**
   - Triggered by: `/api/auth/forgot-password`
   - Contains: Reset link valid for 1 hour
   - Template: `src/services/email.service.js` - `sendPasswordResetEmail()`

2. **Password Reset Confirmation**
   - Triggered by: `/api/auth/reset-password` (after successful reset)
   - Contains: Confirmation message
   - Template: `src/services/email.service.js` - `sendPasswordResetConfirmation()`

3. **Welcome Email** (Optional - not currently used)
   - Can be added to registration flow
   - Template: `src/services/email.service.js` - `sendWelcomeEmail()`

To customize email templates, edit: `src/services/email.service.js`

## Production Deployment

### Environment Variables

Update these for production:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/legalmind
JWT_SECRET=<generate-strong-secret>  # Use: openssl rand -base64 32
EMAIL_SECURE=true  # If using port 465
ALLOWED_ORIGINS=https://your-frontend-domain.com
CLIENT_URL=https://your-frontend-domain.com
```

### Security Checklist

- [ ] Change JWT_SECRET to a strong random string
- [ ] Update ALLOWED_ORIGINS with actual frontend domain
- [ ] Set NODE_ENV=production
- [ ] Use environment-specific email service (SendGrid, Mailgun)
- [ ] Enable HTTPS (EMAIL_SECURE=true for port 465)
- [ ] Set up MongoDB authentication
- [ ] Implement rate limiting (see API_DOCUMENTATION.md)
- [ ] Set up monitoring and logging
- [ ] Never commit .env file

### Generate Strong JWT Secret

```bash
# Method 1: OpenSSL
openssl rand -base64 32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Frontend Integration

### Password Reset Flow

**Step 1: Request Reset**
```javascript
const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: userEmail })
});
```

**Step 2: User receives email with link**
```
http://localhost:3000/reset-password?token=abc123def456...
```

**Step 3: Create reset password page**
```javascript
// In your React/Vue component
const searchParams = new URLSearchParams(window.location.search);
const token = searchParams.get('token');

// Submit new password
const response = await fetch('http://localhost:5000/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    token: token,
    password: newPassword
  })
});

const data = await response.json();
// User is automatically logged in, save the access token
localStorage.setItem('accessToken', data.data.accessToken);
```

## Development Tips

### Testing Email Locally

Use **Mailtrap** for testing without sending real emails:
1. Sign up at https://mailtrap.io
2. Get SMTP credentials
3. Update .env with Mailtrap credentials
4. All emails will be caught in Mailtrap inbox

### Hot Reload

Using nodemon for auto-restart on file changes:
```bash
npm run dev
```

### View MongoDB Data

```bash
# Connect to MongoDB
mongosh

# Switch to database
use legalmind

# View users
db.users.find().pretty()

# View refresh tokens
db.refreshtokens.find().pretty()
```

## Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── db.js              # MongoDB connection
│   │   ├── env.js             # Environment variables
│   │   └── swagger.js         # Swagger configuration
│   ├── middlewares/
│   │   ├── error-handler.middleware.js
│   │   └── validation.middleware.js
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   ├── auth.routes.js       # ⭐ Swagger docs here
│   │   │   ├── auth.validator.js
│   │   │   └── auth.middleware.js
│   │   ├── user/
│   │   │   ├── user.model.js        # User schema + password reset fields
│   │   │   └── user.repository.js
│   │   └── refresh-token/
│   ├── services/
│   │   └── email.service.js         # ⭐ Email templates
│   ├── shared/
│   │   ├── constants/
│   │   ├── errors/
│   │   └── helpers/
│   ├── app.js                        # Express app + Swagger UI
│   └── server.js                     # Entry point
├── .env                              # ⭐ Configure email here
├── .gitignore
├── package.json
├── postman_collection.json           # Postman tests
├── API_DOCUMENTATION.md              # Detailed API docs
└── SETUP_GUIDE.md                    # This file
```

## Next Steps

1. ✅ Configure email in .env
2. ✅ Start the server
3. ✅ Test with Swagger UI
4. ✅ Import Postman collection
5. ✅ Test forgot/reset password flow
6. 📤 Share API_DOCUMENTATION.md with frontend team
7. 🔗 Integrate with your frontend

## Support

- **Swagger Documentation:** http://localhost:5000/api-docs
- **API Documentation:** See API_DOCUMENTATION.md
- **Postman Collection:** Import postman_collection.json

---

**Last Updated:** July 19, 2026
