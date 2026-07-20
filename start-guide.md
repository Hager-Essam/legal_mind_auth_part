# 🚀 Quick Start Guide

## Step 1: Run Diagnostic

```bash
cd server
npm run diagnose
```

This will check if everything is configured correctly.

## Step 2: Start MongoDB

**Windows:**
```bash
mongod
```

Keep this terminal open.

## Step 3: Start Server

Open a new terminal:
```bash
cd server
npm run dev
```

You should see:
```
✅ Server running in development mode on port 5000
🔗 Health check: http://localhost:5000/health
📚 Swagger docs: http://localhost:5000/api-docs
🌐 API endpoints: http://localhost:5000/api

Available routes:
  POST /api/auth/register
  POST /api/auth/login
  POST /api/auth/forgot-password
  POST /api/auth/reset-password
  GET  /api/auth/me
```

## Step 4: Test It!

### Option A: Open Swagger UI

Open in browser: http://localhost:5000/api-docs

Try the `/api/auth/register` endpoint!

### Option B: Use cURL

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"fullName\":\"Test User\",\"email\":\"test@example.com\",\"password\":\"Test123456\",\"officeName\":\"Test Office\",\"teamSize\":\"small\"}"
```

## Access from Phone/Another Device

### Find Your IP

```bash
ipconfig
```

Look for "IPv4 Address" (e.g., 192.168.1.100)

### Open on Other Device

```
http://192.168.1.100:5000/api-docs
```

Replace `192.168.1.100` with YOUR IP!

## Problems?

See: `TROUBLESHOOTING.md`

Or run: `npm run diagnose`
