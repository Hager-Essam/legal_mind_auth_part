# Immediate Deployment Fix

## Step 1: Test Basic Serverless Function First

I've created a simple test endpoint at `api/test.js`. After you deploy, test this first:

```
https://your-app.vercel.app/api/test
```

This will tell us if:
- Serverless function works at all
- Environment variables are set
- Basic routing works

## Step 2: Check Environment Variables in Vercel

**Critical:** Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Make sure these are set:

```
MONGODB_URI
JWT_SECRET
NODE_ENV=production
```

After adding/updating variables, you MUST redeploy for them to take effect.

## Step 3: View Function Logs

1. Go to Vercel Dashboard
2. Click your project
3. Click "Deployments"
4. Click latest deployment
5. Click "View Function Logs"
6. Click "Runtime Logs"

Look for error messages. Common errors:

### Error: "Cannot find module"
**Fix:** Missing dependency in package.json or path issue

### Error: "MONGODB_URI is not defined"
**Fix:** Environment variable not set in Vercel

### Error: "bad auth"
**Fix:** MongoDB password wrong or Atlas not allowing connections

## Step 4: Files That Were Updated

1. **api/index.js** - Simplified serverless handler
2. **api/test.js** - NEW: Test endpoint
3. **src/app.js** - Added path module, fixed static files
4. **src/config/swagger.js** - Fixed file paths
5. **vercel.json** - Updated configuration

## Step 5: Deploy Again

```bash
# Commit changes
git add .
git commit -m "Fix serverless configuration"
git push origin main
```

Or:
```bash
vercel --prod
```

## Step 6: Test in Order

1. **Basic test**: `https://your-app.vercel.app/api/test`
   - Should return JSON with success: true

2. **Root**: `https://your-app.vercel.app/`
   - Should return API info

3. **Health**: `https://your-app.vercel.app/health`
   - Should return server status

4. **API Docs**: `https://your-app.vercel.app/api-docs`
   - Should show Swagger UI

5. **Register**: POST to `https://your-app.vercel.app/api/auth/register`

## If Still Not Working

### Check 1: Is vercel.json in the right place?
```
server/
├── api/
│   ├── index.js
│   └── test.js
├── src/
├── vercel.json  ← Must be here
└── package.json
```

### Check 2: Is your MongoDB Atlas accessible?
- Go to MongoDB Atlas → Network Access
- Add IP: 0.0.0.0/0
- Wait 1-2 minutes for it to propagate

### Check 3: Are you deploying the server folder?
In Vercel Dashboard when importing:
- **Root Directory**: Select "server" if your repo has multiple folders
- OR make sure vercel.json is at the root of what you're deploying

## Alternative: Deploy Without Database First

To test if the issue is MongoDB-related, temporarily modify `api/index.js`:

```javascript
// Comment out database connection
// const app = require('../src/app');

module.exports = (req, res) => {
  res.json({ 
    success: true, 
    message: 'Working without DB!' 
  });
};
```

If this works, the issue is with database connection.

## Get the Exact Error

Please share:
1. Screenshot of Runtime Logs from Vercel Dashboard
2. Or copy the error message from the logs

This will help me identify the exact problem!

## Quick Commands

```bash
# See what would be deployed
vercel --prod --debug

# Force redeploy
vercel --prod --force

# View logs
vercel logs your-deployment-url --follow
```
