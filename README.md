# Legal Mind Server - MongoDB

A robust authentication system built with Node.js, Express, and MongoDB following clean architecture principles.

## 📁 Project Structure

```
src/
├── config/               # Configuration files
│   ├── db.js            # MongoDB connection
│   └── env.js           # Environment variables
├── middlewares/         # Express middlewares
│   ├── error-handler.middleware.js
│   └── validation.middleware.js
├── modules/             # Feature modules
│   ├── auth/           # Authentication module
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   ├── auth.routes.js
│   │   ├── auth.validator.js
│   │   └── auth.middleware.js
│   ├── user/           # User module
│   │   ├── user.model.js
│   │   └── user.repository.js
│   └── refresh-token/  # Refresh token module
│       ├── refresh-token.model.js
│       └── refresh-token.repository.js
├── shared/             # Shared utilities
│   ├── constants/      # Constants
│   │   ├── http-status.js
│   │   └── error-messages.js
│   ├── errors/         # Custom errors
│   │   └── app.error.js
│   └── helpers/        # Helper functions
│       └── response.helper.js
├── app.js              # Express app setup
└── server.js           # Server entry point
```

## 🚀 Features

- ✅ User Registration with validation
- ✅ User Login with JWT authentication
- ✅ Refresh Token mechanism
- ✅ Logout (single device)
- ✅ Logout All devices
- ✅ Protected routes with authentication
- ✅ Role-based authorization
- ✅ Password hashing with bcrypt
- ✅ Input validation with Joi
- ✅ Error handling middleware
- ✅ Standard API response format
- ✅ MongoDB with Mongoose

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB
- **ODM:** Mongoose
- **Authentication:** JWT (jsonwebtoken)
- **Validation:** Joi
- **Password Hashing:** bcrypt
- **Environment:** dotenv

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

## ⚙️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env` file and update values as needed
   - Default MongoDB URI: `mongodb://localhost:27017/legalmind`

3. **Start MongoDB:**
   ```bash
   # Make sure MongoDB is running
   mongod
   ```

4. **Run the server:**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📡 API Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "Password123",
  "phone": "+1234567890",
  "role": "user"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user",
      "isActive": true,
      "isEmailVerified": false,
      "createdAt": "...",
      "updatedAt": "..."
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "Password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Logout
```http
POST /api/auth/logout
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

#### Logout All Devices
```http
POST /api/auth/logout-all
Authorization: Bearer <access-token>
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access-token>
```

### Protected Route Example

To access protected routes, include the JWT token in the Authorization header:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔒 Security Features

- Passwords are hashed using bcrypt (10 salt rounds)
- JWT tokens for stateless authentication
- Refresh tokens stored in MongoDB
- HttpOnly cookies for refresh tokens
- Token expiration handling
- Role-based access control
- Input validation and sanitization
- SQL injection protection (MongoDB)

## 📝 Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

## 🎭 User Roles

- `user` - Regular user (default)
- `lawyer` - Lawyer with additional permissions
- `admin` - Administrator with full access

## 📄 API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Email already exists"
    }
  ]
}
```

## 🔧 Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/legalmind
DB_NAME=legalmind

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

## 🐛 Error Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `500` - Internal Server Error

## 📚 Architecture Principles

This project follows clean architecture:

- **Controller:** Handles HTTP requests/responses
- **Service:** Contains business logic
- **Repository:** Handles database operations
- **Model:** Defines data structure
- **Validator:** Validates input data
- **Middleware:** Handles cross-cutting concerns

## 🧪 Testing

```bash
npm test
```

## 📦 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

ISC
