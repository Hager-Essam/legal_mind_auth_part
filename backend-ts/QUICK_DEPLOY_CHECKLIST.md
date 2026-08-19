# ✅ Quick Vercel Deployment Checklist

Follow these steps in order to deploy your backend to Vercel.

## 📦 Step 1: Prepare Locally (5 minutes)

```bash
# 1. Navigate to backend folder
cd backend-ts

# 2. Install Vercel dependency (already done!)
npm install --save-dev @vercel/node

# 3. Test build locally
npm run build

# 4. Check if build succeeded (should see "dist/" folder)
dir dist
```

## 📤 Step 2: Push to GitHub (2 minutes)

```bash
# 1. Check what files changed
git status

# 2. Add all deployment files
git add .

# 3. Commit changes
git commit -m "Add Vercel deployment configuration"

# 4. Push to GitHub
git push
```

## 🌐 Step 3: Deploy on Vercel (10 minutes)

### 3.1 Sign Up & Import Project
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (or login)
3. Click **"Add New Project"**
4. Select your repository from the list
5. Click **"Import"**

### 3.2 Configure Project Settings

**Framework Preset:** Other

**Root Directory:** 
- If backend is in subfolder: `backend-ts`
- If backend is at root: leave empty

**Build Settings:**
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

### 3.3 Add Environment Variables ⚠️ CRITICAL!

Click **"Environment Variables"** tab and copy-paste from your `.env` file:

**REQUIRED Variables:**
```env
LEGALMIND_NODE_ENV=production
LEGALMIND_APP_NAME=legalmind-backend-ts
LEGALMIND_API_HOST=0.0.0.0
LEGALMIND_API_PORT=5001

# MongoDB (COPY FROM YOUR .env)
LEGALMIND_APP_MONGO_URI=mongodb+srv://...
LEGALMIND_APP_MONGO_DB=legalmind_app
LEGALMIND_RAG_MONGO_URI=mongodb+srv://...
LEGALMIND_RAG_MONGO_DB=legalmind_rag

# JWT (COPY FROM YOUR .env)
LEGALMIND_JWT_SECRET=your-secret-here
LEGALMIND_JWT_ACCESS_EXPIRES_IN=15m
LEGALMIND_REFRESH_TOKEN_DAYS=7

# CORS - ADD YOUR VERCEL URL HERE!
LEGALMIND_CORS_ORIGINS=https://legal-mind-front.vercel.app,https://YOUR-BACKEND.vercel.app

# OpenAI (COPY FROM YOUR .env)
LEGALMIND_OPENAI_API_KEY=sk-...
LEGALMIND_LLM_MODEL=gpt-4o-mini
LEGALMIND_EMBEDDING_MODEL=text-embedding-3-large

# Add ALL other variables from your .env file:
# - Qdrant credentials
# - R2 storage credentials
# - SMTP email settings
# - Stripe keys
# - Feature flags
```

**💡 TIP:** Open your `.env` file and copy ALL variables one by one!

### 3.4 Deploy!
1. Click **"Deploy"** button
2. Wait 2-3 minutes ⏳
3. See confetti 🎉 when deployment succeeds!

## 🔗 Step 4: Update CORS (5 minutes)

### 4.1 Get Your Backend URL
After deployment, Vercel gives you a URL like:
```
https://legalmind-backend-ts.vercel.app
```

### 4.2 Update CORS Environment Variable
1. Go to **Project Settings** → **Environment Variables**
2. Find `LEGALMIND_CORS_ORIGINS`
3. Click **"Edit"**
4. Add your Vercel backend URL:
   ```
   https://legal-mind-front.vercel.app,https://YOUR-BACKEND.vercel.app
   ```
5. Click **"Save"**
6. Go back to **Deployments** tab
7. Click **⋯ (three dots)** on latest deployment → **"Redeploy"**

## ✅ Step 5: Test Your API (3 minutes)

### Test Health Endpoint
Open in browser or use curl:
```
https://YOUR-BACKEND.vercel.app/health
```

Should return:
```json
{
  "status": "ok",
  "mongo_status": "connected"
}
```

### Test API Routes
```
https://YOUR-BACKEND.vercel.app/api/v1/auth/login
```

## 🔄 Step 6: Update Frontend (2 minutes)

In your frontend project (`Legal-Mind-front-main`), update the API URL:

**File:** `src/config/env.ts` (or wherever your config is)

```typescript
export const env = {
  apiBaseUrl: 'https://YOUR-BACKEND.vercel.app',
  // ... other config
};
```

Then deploy your frontend to Vercel (same process).

## 🎯 Total Time: ~30 minutes

---

## 🆘 Common Issues

### ❌ "Cannot find module"
- Make sure `npm run build` works locally first
- Check if `dist/` folder exists

### ❌ "MongoDB connection failed"
- Go to MongoDB Atlas → Network Access
- Add IP: `0.0.0.0/0` (allow all)

### ❌ "CORS blocked"
- Check `LEGALMIND_CORS_ORIGINS` includes frontend URL
- Click "Redeploy" after changing environment variables

### ❌ "Function timeout"
- Free tier has 10s timeout
- Upgrade to Pro for 60s timeout
- Or optimize slow endpoints

---

## 🎉 You're Done!

Your backend is now live at:
```
https://your-project.vercel.app
```

Share this URL with your frontend and test the full application! 🚀
