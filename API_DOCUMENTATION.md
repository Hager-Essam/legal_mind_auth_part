# LegalMind API Documentation

## Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Swagger Documentation](#swagger-documentation)
- [Email Setup](#email-setup)
- [API Endpoints](#api-endpoints)
  - [Register](#1-register)
  - [Login](#2-login)
  - [Refresh Token](#3-refresh-token)
  - [Logout](#4-logout)
  - [Logout All](#5-logout-all)
  - [Get Current User](#6-get-current-user)
  - [Forgot Password](#7-forgot-password)
  - [Reset Password](#8-reset-password)
- [Error Responses](#error-responses)
- [Testing with Postman](#testing-with-postman)

## Overview

The LegalMind API provides authentication and user management functionality. It uses JWT tokens for authentication and supports password reset via email.

## Base URL

**Development:** `http://localhost:5000`
**Production:** `https://api.legalmind.com`

## Authentication

The API uses two types of tokens:

1. **Access Token (JWT)**: Short-lived token for API requests
   - Include in request header: `Authorization: Bearer <access_token>`
   - Expires in 1 day (configurable)

2. **Refresh Token**: Long-lived token stored in httpOnly cookie
   - Automatically sent with requests
   - Expires in 7 days (configurable)

## Swagger Documentation

Interactive API documentation is available at:

**Local:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

The Swagger UI provides:
- Complete API reference
- Request/response examples
- Try-it-out functionality
- Schema definitions

## Email Setup

### Gmail Configuration

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the generated 16-character password
3. **Update .env file**:
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-character-app-password
   ```

### Other Email Providers

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

**Outlook/Office365:**
```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

## API Endpoints

### 1. Register

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "Password123",
  "phone": "+1234567890",
  "role": "user"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "user",
      "isActive": true,
      "isEmailVerified": false,
      "createdAt": "2026-07-19T10:00:00.000Z",
      "updatedAt": "2026-07-19T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Validation Rules:**
- `firstName`: 2-50 characters, required
- `lastName`: 2-50 characters, required
- `email`: Valid email format, required, unique
- `password`: Minimum 8 characters, must contain uppercase, lowercase, and number
- `phone`: Optional
- `role`: Optional, must be "user" or "lawyer" (default: "user")

---

### 2. Login

Authenticate a user and receive tokens.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "password": "Password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "user",
      "isActive": true,
      "lastLogin": "2026-07-19T10:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account is deactivated

---

### 3. Refresh Token

Get a new access token using refresh token.

**Endpoint:** `POST /api/auth/refresh-token`

**Request Body (optional if cookie is present):**
```json
{
  "refreshToken": "abc123def456..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note:** Refresh token can be sent either in request body or automatically via httpOnly cookie.

---

### 4. Logout

Revoke the current refresh token.

**Endpoint:** `POST /api/auth/logout`

**Request Body (optional if cookie is present):**
```json
{
  "refreshToken": "abc123def456..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 5. Logout All

Revoke all refresh tokens for the user (logout from all devices).

**Endpoint:** `POST /api/auth/logout-all`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out from all devices"
}
```

---

### 6. Get Current User

Get the authenticated user's profile.

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "role": "user",
      "isActive": true,
      "lastLogin": "2026-07-19T10:00:00.000Z"
    }
  }
}
```

---

### 7. Forgot Password

Request a password reset email.

**Endpoint:** `POST /api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "john.doe@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

**Email Content:**
The user will receive an email with:
- A password reset link valid for 1 hour
- Security notice about the request
- Instructions to ignore if they didn't request the reset

**Security Notes:**
- Always returns success message (doesn't reveal if email exists)
- Token expires in 1 hour
- Token is hashed in database
- Only one active reset token per user

---

### 8. Reset Password

Reset password using the token from email.

**Endpoint:** `POST /api/auth/reset-password`

**Request Body:**
```json
{
  "token": "a1b2c3d4e5f6...",
  "password": "NewPassword123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password has been reset successfully",
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Features:**
- Automatically logs the user in after reset
- Sends a confirmation email
- Clears the reset token
- Password must meet validation requirements

**Error Responses:**
- `400 Bad Request`: Invalid or expired token
- `400 Bad Request`: Password validation failed

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "statusCode": 400,
    "details": []
  }
}
```

**Common Status Codes:**
- `400 Bad Request`: Validation error or invalid input
- `401 Unauthorized`: Authentication required or invalid credentials
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource already exists (e.g., email in use)
- `500 Internal Server Error`: Server error

---

## Testing with Postman

A Postman collection is available at: `server/postman_collection.json`

**Import Steps:**
1. Open Postman
2. Click "Import"
3. Select `postman_collection.json`
4. Update environment variables if needed

**Environment Variables:**
```json
{
  "base_url": "http://localhost:5000",
  "access_token": "",
  "refresh_token": ""
}
```

**Testing Workflow:**

1. **Register a new user**
   - Run the Register request
   - Access token is automatically saved

2. **Login**
   - Run the Login request
   - Tokens are saved automatically

3. **Test protected routes**
   - Run "Get Current User" (uses saved access token)
   - Run "Logout All" to test multi-device logout

4. **Test password reset**
   - Run "Forgot Password" with your email
   - Check your email for reset token
   - Copy token from email URL: `?token=<this-part>`
   - Run "Reset Password" with the token

---

## Rate Limiting (Recommended for Production)

For production, implement rate limiting:

```bash
npm install express-rate-limit
```

Example configuration:
```javascript
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests, please try again later.'
});

// Apply to sensitive routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
```

---

## Security Best Practices

1. **Never commit .env file** - Added to .gitignore
2. **Use strong JWT secrets** - Generate using: `openssl rand -base64 32`
3. **Enable HTTPS in production** - Set `EMAIL_SECURE=true`
4. **Use environment-specific configs** - Different values for dev/prod
5. **Implement rate limiting** - Prevent brute force attacks
6. **Rotate refresh tokens** - Implemented automatically
7. **Validate all inputs** - Joi validation on all endpoints
8. **Hash reset tokens** - Tokens are hashed before storage
9. **Short token expiry** - Reset tokens expire in 1 hour

---

## Frontend Integration Example

### Register/Login
```javascript
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123'
  })
});

const data = await response.json();
localStorage.setItem('accessToken', data.data.accessToken);
```

### Protected Requests
```javascript
const response = await fetch('http://localhost:5000/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
  },
  credentials: 'include',
});
```

### Password Reset Flow
```javascript
// Step 1: Request reset
await fetch('http://localhost:5000/api/auth/forgot-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// Step 2: User receives email and clicks link
// Your frontend should parse the token from URL: ?token=abc123

// Step 3: Submit new password
const response = await fetch('http://localhost:5000/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    token: tokenFromUrl,
    password: 'NewPassword123'
  })
});

const data = await response.json();
localStorage.setItem('accessToken', data.data.accessToken);
```

---

## Support

For issues or questions:
- Email: support@legalmind.com
- Documentation: [Swagger UI](http://localhost:5000/api-docs)

---

**Last Updated:** July 19, 2026
**API Version:** 1.0.0
