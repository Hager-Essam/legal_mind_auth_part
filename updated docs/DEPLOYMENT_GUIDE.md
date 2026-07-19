# 🚀 Deployment Guide - Free Hosting Options

## Overview
This guide shows you how to deploy your LegalMind backend API for **FREE** so your frontend team can access it.

---

## ✅ OPTION 1: Render.com (RECOMMENDED)

**Why Render?**
- ✅ Free tier with 750 hours/month
- ✅ Easy deployment from GitHub
- ✅ Automatic HTTPS
- ✅ Environment variables support
- ✅ Logs and monitoring
- ⚠️ Spins down after 15 min inactivity (cold start ~30s)

### Steps:

1. **Push your code to GitHub** (use `push-final.bat`)

2. **Sign up at Render.com**
   - Go to: https://render.com
   - Sign up with your GitHub account

3. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `Legal-Graduation-ITI`
   - Select branch: `Hager`

4. **Configure Build Settings**
   ```
   Name: legalmind-api
   Region: Frankfurt (EU) or Singapore (Asia)
   Branch: Hager
   Root Directory: backend-ts
   Runtime: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

5. **Add Environment Variables**
   Click "Advanced" → "Add Environment Variable" and add ALL from your `.env`:
   ```
   LEGALMIND_DASHSCOPE_API_KEYS=sk-ws-H...
   LEGALMIND_MONGODB_URI=mongodb://muhmmadmaged107_db_user:B3u2...
   LEGALMIND_MONGODB_DB=legalmind
   LEGALMIND_CORS_ORIGINS=*
   LEGALMIND_LLM_MODEL=qwen-turbo
   LEGALMIND_ENABLE_QUERY_REWRITE=false
   LEGALMIND_ENABLE_LLM_RERANK=false
   LEGALMIND_ENABLE_HYBRID_SEARCH=true
   LEGALMIND_RETRIEVAL_TOP_K=10
   LEGALMIND_RERANK_TOP_K=5
   LEGALMIND_DASHSCOPE_BASE_URL=https://ws-6fn8dhfcuhm9xy3l.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1
   ```

6. **Deploy!**
   - Click "Create Web Service"
   - Wait 3-5 minutes for deployment
   - Your API will be live at: `https://legalmind-api.onrender.com`

7. **Share with Frontend Team**
   ```
   API Base URL: https://legalmind-api.onrender.com
   Query Endpoint: POST https://legalmind-api.onrender.com/api/v1/query
   Health Check: GET https://legalmind-api.onrender.com/health
   ```

---

## ✅ OPTION 2: Railway.app

**Why Railway?**
- ✅ $5 free credit/month
- ✅ No cold starts
- ✅ Fast deployment
- ✅ Better performance than Render
- ⚠️ Requires credit card (but won't charge)

### Steps:

1. **Sign up at Railway.app**
   - Go to: https://railway.app
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select: `Legal-Graduation-ITI`

3. **Configure Service**
   - Root Directory: `backend-ts`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Add Environment Variables**
   - Click "Variables" tab
   - Add all from your `.env` file (same as Render above)

5. **Generate Domain**
   - Click "Settings" → "Generate Domain"
   - Your API will be at: `https://legalmind-api.up.railway.app`

---

## ✅ OPTION 3: Fly.io

**Why Fly.io?**
- ✅ Free tier: 3 small VMs
- ✅ Global CDN
- ✅ No cold starts
- ✅ Best performance

### Steps:

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login and Launch**
   ```bash
   cd backend-ts
   fly auth signup
   fly launch
   ```

3. **Configure**
   - App name: `legalmind-api`
   - Region: Frankfurt (EU) or Singapore
   - Don't deploy yet: `N`

4. **Set Secrets (Environment Variables)**
   ```bash
   fly secrets set LEGALMIND_DASHSCOPE_API_KEYS="sk-ws-H..."
   fly secrets set LEGALMIND_MONGODB_URI="mongodb://..."
   fly secrets set LEGALMIND_MONGODB_DB="legalmind"
   fly secrets set LEGALMIND_CORS_ORIGINS="*"
   fly secrets set LEGALMIND_LLM_MODEL="qwen-turbo"
   fly secrets set LEGALMIND_ENABLE_QUERY_REWRITE="false"
   fly secrets set LEGALMIND_ENABLE_LLM_RERANK="false"
   ```

5. **Deploy**
   ```bash
   fly deploy
   ```

6. **Your API URL**
   ```
   https://legalmind-api.fly.dev
   ```

---

## ✅ OPTION 4: Vercel (Serverless)

**Why Vercel?**
- ✅ Completely free
- ✅ No cold start issues
- ✅ Global CDN
- ⚠️ 10-second function timeout (may be too short for LLM)

### Steps:

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Create `vercel.json` in backend-ts folder**
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "dist/index.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "dist/index.js"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

3. **Deploy**
   ```bash
   cd backend-ts
   npm run build
   vercel
   ```

4. **Add Environment Variables**
   ```bash
   vercel env add LEGALMIND_DASHSCOPE_API_KEYS
   vercel env add LEGALMIND_MONGODB_URI
   # ... add all others
   ```

---

## 📊 COMPARISON TABLE

| Platform | Free Tier | Cold Start | Performance | Ease of Use | Best For |
|----------|-----------|------------|-------------|-------------|----------|
| **Render** | 750h/mo | ~30s | Good | ⭐⭐⭐⭐⭐ | Graduation Projects |
| **Railway** | $5/mo | None | Excellent | ⭐⭐⭐⭐ | Production |
| **Fly.io** | 3 VMs | None | Excellent | ⭐⭐⭐ | Best Performance |
| **Vercel** | Unlimited | None | Good | ⭐⭐⭐⭐ | Simple APIs |

---

## 🎯 RECOMMENDED FOR YOUR PROJECT

**For Graduation Demo: Use Render.com**

Why?
- Easiest to setup (5 minutes)
- Free forever
- Your frontend team gets a URL immediately
- No credit card needed
- Perfect for demos and testing

**Deployment URL Format:**
```
https://legalmind-api.onrender.com
```

---

## 🔒 SECURITY TIPS

1. **CORS Configuration**
   - For testing: `LEGALMIND_CORS_ORIGINS=*`
   - For production: `LEGALMIND_CORS_ORIGINS=https://your-frontend-domain.com`

2. **Rate Limiting**
   - Already configured: 20 requests/minute
   - Protects your API from abuse

3. **Environment Variables**
   - NEVER commit `.env` to GitHub
   - Always use platform's environment variable feature
   - MongoDB credentials are safe when using env vars

4. **API Key Protection**
   - Your DashScope API key is server-side only
   - Frontend never sees it
   - Rate limiting prevents abuse

---

## 📱 SHARE WITH FRONTEND TEAM

Once deployed, create this document for your frontend team:

```markdown
# LegalMind API Documentation

**Base URL:** https://legalmind-api.onrender.com

## Endpoints

### 1. Query Legal Question
**POST** `/api/v1/query`

Request:
{
  "query": "ما عقوبة السرقة؟",
  "top_k": 5,
  "user_role": "citizen"
}

Response:
{
  "answer": "الحكم القانوني...",
  "source_chunks": [...],
  "category": "arabic_rag",
  "latency_ms": 12000,
  "confidence_score": 0.85,
  "llm_provider_used": "modelstudio"
}

### 2. Health Check
**GET** `/health`

Response:
{
  "status": "ok",
  "database": { "connected": true, "pingOk": true }
}

## Rate Limits
- 20 requests per minute per IP
- Response time: 10-15 seconds
- Timeout: 30 seconds
```

---

## 🚨 TROUBLESHOOTING

### Cold Start Issue (Render)
- First request after 15min idle takes ~30s
- Keep-alive solution: Use UptimeRobot.com (free) to ping your API every 5 minutes

### Deployment Fails
- Check logs in platform dashboard
- Verify all environment variables are set
- Ensure MongoDB URI is accessible from deployment platform

### CORS Errors
- Add your frontend domain to `LEGALMIND_CORS_ORIGINS`
- For testing, use `*` (allow all origins)

---

## 📞 NEED HELP?

1. Check platform logs (all platforms have log viewers)
2. Test locally first: `npm run dev`
3. Verify environment variables are identical to local `.env`
4. Check MongoDB Atlas allows connections from `0.0.0.0/0` (all IPs)

---

**Next Step:** Follow Option 1 (Render.com) and deploy in 5 minutes! 🚀
