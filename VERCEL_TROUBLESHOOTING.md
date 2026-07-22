# Vercel Deployment Troubleshooting

## Error: "This Serverless Function has crashed" - FIXED ✅

The error you saw was caused by improper serverless function configuration. This has been fixed with the following changes:

### What Was Fixed

1. **Updated `api/index.js`**:
   - Fixed database connection caching
   - Improved error handling
   - Added proper mongoose connection management

2. **Updated `src/app.js`**:
   - Added `path` module for proper file paths
   - Made morgan conditional (disabled in production)
   - Added root route handler
   - Improved static file serving with absolute paths

3. **Updated `vercel.json`**:
   - Added function timeout configuration
   - Removed hardcoded NODE_ENV (use Vercel env vars instead)

## How to Deploy the Fixed Version

### Step 1: Commit and Push Changes

```bash
cd server
git add .
git commit -m "Fix serverless function configuration"
git push origin main
```

### Step 2: Verify Environment Variables in Vercel

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Required variables:**

```env
MONGODB_URI=mongodb+srv://legalmind:YOUR_PASSWORD@cluster0.8dnyana.mongodb.net/legalmind?retryWrites=true&w=majority&appName=Cluster0
DB_NAME=legalmind
JWT_SECRET=LegalMindVeryStrongSecretKey123!
JWT_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
ALLOWED_ORIGINS=*
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=hagergogo2372@gmail.com
EMAIL_PASSWORD=alzz vcis olwt dmvy
EMAIL_FROM=LegalMind <noreply@legalmind.com>
CLIENT_URL=https://your-frontend.vercel.app
```

### Step 3: Redeploy

If using GitHub integration, it will auto-deploy. Otherwise:

```bash
vercel --prod
```

### Step 4: Test the Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/health

# Expected response:
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-...",
  "environment": "production"
}
```

## Common Deployment Errors and Solutions

### Error 1: "bad auth : authentication failed"

**Cause:** MongoDB credentials incorrect or not set in Vercel

**Solution:**
1. Verify `MONGODB_URI` in Vercel environment variables
2. Check username and password are correct
3. Ensure MongoDB Atlas allows 0.0.0.0/0 in Network Access

### Error 2: "Function timeout"

**Cause:** Database connection taking too long

**Solution:**
1. Check MongoDB Atlas is accessible (Network Access → 0.0.0.0/0)
2. Increase timeout in `vercel.json` (already set to 10 seconds)
3. Check function logs for specific errors

### Error 3: "Module not found"

**Cause:** Dependencies not installed or path issues

**Solution:**
1. Ensure `package.json` lists all dependencies
2. Run `npm install` to update `package-lock.json`
3. Commit and push changes

### Error 4: "CORS errors"

**Cause:** Frontend domain not allowed

**Solution:**
Update `ALLOWED_ORIGINS` in Vercel:
```
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-domain.com
```

### Error 5: File upload not working

**Cause:** Vercel serverless functions are stateless

**Solution:**
Implement cloud storage (see below)

## Viewing Logs in Vercel

1. Go to Vercel Dashboard
2. Select your project
3. Click **Deployments**
4. Click on the latest deployment
5. Click **View Function Logs**

Look for:
- Database connection messages
- Error stack traces
- Request logs

## File Upload Solution for Production

Since Vercel doesn't persist files, you need cloud storage:

### Option 1: Cloudinary (Recommended for Images)

```bash
npm install cloudinary multer-storage-cloudinary
```

Update `src/middlewares/upload.middleware.js`:

```javascript
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lawyer-ids',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
  },
});

const upload = multer({ storage });
```

Add to Vercel env vars:
```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Option 2: Vercel Blob Storage

```bash
npm install @vercel/blob
```

See: https://vercel.com/docs/storage/vercel-blob

### Option 3: AWS S3

```bash
npm install @aws-sdk/client-s3 multer-s3
```

## Testing Locally Before Deploying

```bash
# Set NODE_ENV to production
export NODE_ENV=production  # Mac/Linux
set NODE_ENV=production     # Windows

# Start server
npm start

# Test endpoints
curl http://localhost:5001/health
```

## Checklist Before Deployment

- [ ] All dependencies in `package.json`
- [ ] Environment variables set in Vercel
- [ ] MongoDB Atlas Network Access allows 0.0.0.0/0
- [ ] No hardcoded secrets in code
- [ ] All routes tested locally
- [ ] Error handling in place
- [ ] Logs reviewed for errors

## Getting Help

1. **Check Function Logs** in Vercel Dashboard
2. **Test locally** with `NODE_ENV=production`
3. **Verify env vars** are set correctly
4. **Check MongoDB Atlas** connectivity

## Quick Deploy Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls
```

---

Your deployment should now work! Test the `/health` endpoint first, then try registering a user.
