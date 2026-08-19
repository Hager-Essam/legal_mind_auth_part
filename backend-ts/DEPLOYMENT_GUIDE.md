# 🚀 Vercel Deployment Guide for LegalMind Backend

This guide will help you deploy your Express.js TypeScript backend to Vercel.

## 📋 Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com) (free tier works!)
3. **MongoDB Atlas** - You're already using this (connection string in `.env`)
4. **All API Keys** - OpenAI, Qdrant, R2, SMTP, Stripe, etc.

## 🔧 Step 1: Prepare Your Repository

### 1.1 Install Vercel Dev Dependency
```bash
npm install --save-dev @vercel/node
```

### 1.2 Build Your Project Locally (Test)
```bash
npm run build
```
This should create a `dist/` folder with compiled JavaScript.

### 1.3 Commit the Configuration Files
Make sure these new files are committed:
- `vercel.json` - Vercel configuration
- `api/index.ts` - Serverless function entry point
- `.vercelignore` - Files to exclude from deployment

```bash
git add .
git commit -m "Add Vercel deployment configuration"
git push
```

## 🌐 Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard (Recommended for First Time)

1. **Go to** [vercel.com/dashboard](https://vercel.com/dashboard)
2. **Click** "Add New Project"
3. **Import** your GitHub repository (authorize Vercel if needed)
4. **Configure Project:**
   - **Framework Preset:** Other
   - **Root Directory:** `backend-ts` (if your backend is in a subfolder)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

5. **Add Environment Variables** (CRITICAL! ⚠️)
   Click "Environment Variables" and add ALL variables from your `.env` file:

   ```
   LEGALMIND_NODE_ENV=production
   LEGALMIND_APP_NAME=legalmind-backend-ts
   LEGALMIND_API_HOST=0.0.0.0
   LEGALMIND_API_PORT=5001
   
   # MongoDB
   LEGALMIND_APP_MONGO_URI=mongodb+srv://...
   LEGALMIND_APP_MONGO_DB=legalmind_app
   LEGALMIND_RAG_MONGO_URI=mongodb+srv://...
   LEGALMIND_RAG_MONGO_DB=legalmind_rag
   
   # JWT
   LEGALMIND_JWT_SECRET=your-super-secret-key
   LEGALMIND_JWT_ACCESS_EXPIRES_IN=15m
   LEGALMIND_REFRESH_TOKEN_DAYS=7
   
   # CORS (ADD YOUR VERCEL DOMAIN HERE!)
   LEGALMIND_CORS_ORIGINS=https://legal-mind-front.vercel.app,https://your-backend.vercel.app
   
   # OpenAI
   LEGALMIND_OPENAI_API_KEY=sk-...
   LEGALMIND_LLM_MODEL=gpt-4o-mini
   LEGALMIND_EMBEDDING_MODEL=text-embedding-3-large
   
   # Qdrant
   LEGALMIND_QDRANT_URL=https://...
   LEGALMIND_QDRANT_API_KEY=...
   
   # R2 Storage (Cloudflare)
   LEGALMIND_R2_ENDPOINT=https://...
   LEGALMIND_R2_ACCOUNT_ID=...
   LEGALMIND_R2_ACCESS_KEY_ID=...
   LEGALMIND_R2_SECRET_ACCESS_KEY=...
   LEGALMIND_R2_AVATARS_BUCKET=legalmind-avatars
   LEGALMIND_R2_BLOG_IMAGES_BUCKET=legalmind-blog-images
   LEGALMIND_R2_PUBLIC_URL=https://...
   
   # SMTP (Email)
   LEGALMIND_SMTP_HOST=smtp.gmail.com
   LEGALMIND_SMTP_PORT=587
   LEGALMIND_SMTP_USER=...
   LEGALMIND_SMTP_PASS=...
   LEGALMIND_SMTP_FROM_NAME=LegalMind
   LEGALMIND_SMTP_FROM_EMAIL=...
   
   # Stripe
   LEGALMIND_STRIPE_SECRET_KEY=sk_...
   LEGALMIND_STRIPE_WEBHOOK_SECRET=whsec_...
   LEGALMIND_STRIPE_PRICE_ID_BASIC=price_...
   LEGALMIND_STRIPE_PRICE_ID_STANDARD=price_...
   LEGALMIND_STRIPE_PRICE_ID_PREMIUM=price_...
   
   # Feature Flags
   LEGALMIND_ENABLE_HYBRID_SEARCH=true
   LEGALMIND_ENABLE_AUTHORITY_HINTS=true
   LEGALMIND_ENABLE_LLM_RERANK=false
   ```

6. **Click "Deploy"** and wait 2-3 minutes ⏳

### Option B: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
cd backend-ts
vercel

# Follow prompts, then deploy to production
vercel --prod
```

## 🔗 Step 3: Update Frontend CORS & API URL

### 3.1 Get Your Vercel Backend URL
After deployment, you'll get a URL like:
```
https://legalmind-backend-ts.vercel.app
```

### 3.2 Update Backend CORS Origins
Go to Vercel Dashboard → Your Project → Settings → Environment Variables

**Edit** `LEGALMIND_CORS_ORIGINS` to include your frontend:
```
https://legal-mind-front.vercel.app,https://legalmind-backend-ts.vercel.app
```

**Redeploy** after changing environment variables (Vercel button or push new commit).

### 3.3 Update Frontend API Base URL
In your frontend project (`Legal-Mind-front-main/src/config/env.ts`):

```typescript
export const env = {
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://legalmind-backend-ts.vercel.app'
    : 'http://localhost:5001',
  // ...
};
```

## ✅ Step 4: Test Your Deployment

### 4.1 Test Health Endpoint
```bash
curl https://your-backend.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.45,
  "mongo_status": "connected"
}
```

### 4.2 Test Authentication
Use Postman or curl:

```bash
# Register
curl -X POST https://your-backend.vercel.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "SecurePass123!",
    "officeName": "Test Office",
    "teamSize": "solo"
  }'

# Login (after email verification)
curl -X POST https://your-backend.vercel.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

## 🔍 Step 5: Monitor & Debug

### View Logs
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Click "Function Logs" to see console.log output
4. Check for errors in the Runtime Logs

### Common Issues & Solutions

#### ❌ Error: "Cannot find module"
**Solution:** Make sure `npm run build` runs successfully locally first.

#### ❌ Error: "MongoDB connection timeout"
**Solution:** 
1. Check your MongoDB Atlas network access (add `0.0.0.0/0` to allow all)
2. Verify `LEGALMIND_APP_MONGO_URI` environment variable is set correctly

#### ❌ Error: "CORS policy blocked"
**Solution:** 
1. Check `LEGALMIND_CORS_ORIGINS` includes your frontend domain
2. Make sure you redeployed after adding the environment variable

#### ❌ Error: "Function timeout"
**Solution:** 
- Vercel free tier has 10s timeout for serverless functions
- Upgrade to Pro ($20/month) for 60s timeout
- Or optimize your slow queries/endpoints

#### ❌ Error: "Module not found: @vercel/node"
**Solution:**
```bash
npm install --save-dev @vercel/node
git add package.json package-lock.json
git commit -m "Add @vercel/node dependency"
git push
```

## 🎯 Step 6: Custom Domain (Optional)

1. **Buy a domain** (e.g., from Namecheap, GoDaddy, or use Vercel Domains)
2. **Add domain in Vercel:**
   - Go to Project Settings → Domains
   - Enter your domain (e.g., `api.legalmind.com`)
   - Follow DNS configuration instructions
3. **Update CORS** to include your custom domain
4. **Update frontend** API URL to use custom domain

## 📊 Vercel Limits (Free Tier)

| Resource | Limit |
|----------|-------|
| **Bandwidth** | 100 GB/month |
| **Serverless Function Execution** | 100 GB-hours |
| **Function Duration** | 10 seconds |
| **Function Memory** | 1024 MB |
| **Deployments** | Unlimited |

For production, consider upgrading to Pro ($20/month):
- 1 TB bandwidth
- 1000 GB-hours execution
- 60-second function duration
- Priority support

## 🔐 Security Checklist

- ✅ All sensitive data in environment variables (NOT in code)
- ✅ `.env` is in `.gitignore`
- ✅ CORS configured with specific origins (not `*`)
- ✅ MongoDB network access configured
- ✅ JWT secret is strong (>32 characters, random)
- ✅ HTTPS enabled by default on Vercel ✨
- ✅ Rate limiting configured (already in your code)

## 🚨 Important Notes

1. **MongoDB Connections:** Vercel serverless functions are stateless. Each request may create a new connection. The code handles this with connection reuse.

2. **No WebSockets:** Vercel doesn't support WebSockets. If you need real-time features, consider:
   - Server-Sent Events (SSE)
   - Polling
   - External service (Pusher, Ably)

3. **File Uploads:** Your R2 storage handles this (good choice!)

4. **Cold Starts:** First request after inactivity may be slow (1-2s). Subsequent requests are fast.

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Deploying Express.js to Vercel](https://vercel.com/guides/using-express-with-vercel)
- [Environment Variables on Vercel](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel CLI Reference](https://vercel.com/docs/cli)

## 🎉 Success!

Once deployed, your backend will be live at:
```
https://your-project-name.vercel.app
```

Update your frontend to use this URL and you're done! 🚀

---

**Need Help?** Check Vercel logs or ask me for debugging assistance!
