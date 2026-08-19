# 🚀 LegalMind Backend - Vercel Deployment

## 📁 Files Created for Deployment

Your project now has everything needed for Vercel deployment:

```
backend-ts/
├── api/
│   └── index.ts              ✨ NEW - Vercel serverless entry point
├── src/                      ✅ Your existing code
├── vercel.json               ✨ NEW - Vercel configuration
├── .vercelignore            ✨ NEW - Files to exclude
├── .env.vercel              ✨ NEW - Environment variables template
├── DEPLOYMENT_GUIDE.md      ✨ NEW - Detailed deployment guide
├── QUICK_DEPLOY_CHECKLIST.md ✨ NEW - Step-by-step checklist
└── package.json             ✅ Updated with @vercel/node
```

## 🎯 Quick Start

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Sign up at [vercel.com](https://vercel.com)** with your GitHub account

2. **Click "Add New Project"** and import your repository

3. **Configure settings:**
   - Root Directory: `backend-ts` (if backend is in subfolder)
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Add environment variables** from `.env.vercel` template

5. **Click Deploy!** 🚀

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd backend-ts
vercel

# Deploy to production
vercel --prod
```

## 📖 Documentation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **QUICK_DEPLOY_CHECKLIST.md** | Step-by-step checklist with exact commands | First-time deployment |
| **DEPLOYMENT_GUIDE.md** | Comprehensive guide with troubleshooting | Reference and debugging |
| **.env.vercel** | Template for environment variables | Setting up Vercel env vars |

## 🔧 What Changed in Your Code?

### 1. New Entry Point: `api/index.ts`

This is a Vercel serverless function that wraps your Express app:

```typescript
// Your Express app runs in serverless mode
import { createApp } from "../src/app/create-app";
export default async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
```

### 2. Vercel Configuration: `vercel.json`

```json
{
  "version": 2,
  "builds": [{ "src": "api/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.ts" }]
}
```

This tells Vercel:
- Build the TypeScript serverless function
- Route ALL requests to it

### 3. Package.json Updates

Added:
- `@vercel/node` dependency for serverless functions
- `engines` field to specify Node.js version

## 🌍 Architecture: Serverless vs Traditional

### Traditional Server (Local Development)
```
[Client] → [Express Server on Port 5001] → [MongoDB/APIs]
          (Always running, stateful)
```

### Vercel Serverless (Production)
```
[Client] → [Vercel Edge Network] → [Serverless Function] → [MongoDB/APIs]
          (Auto-scales, stateless, cold starts)
```

**Benefits:**
- ✅ Auto-scaling (handles traffic spikes)
- ✅ Global CDN (faster worldwide)
- ✅ Zero DevOps (no server management)
- ✅ Pay-per-use (free for small apps)

**Trade-offs:**
- ⏱️ Cold starts (first request after idle ~1-2s)
- ⏳ 10s timeout on free tier (upgrade for 60s)
- 🔌 No WebSockets (use SSE or polling)

## 🔐 Security Checklist

Before deploying:

- [ ] All secrets in environment variables (not in code)
- [ ] `.env` is in `.gitignore` ✅
- [ ] CORS configured with specific origins (not `*`)
- [ ] MongoDB network access allows Vercel IPs (`0.0.0.0/0`)
- [ ] JWT secret is strong (>32 random characters)
- [ ] Production API keys (not test keys)
- [ ] Rate limiting enabled ✅ (already in your code)

## 📊 Deployment Checklist

### Before First Deploy
- [ ] Test `npm run build` locally
- [ ] Push code to GitHub
- [ ] Have MongoDB Atlas credentials ready
- [ ] Have all API keys ready (OpenAI, Qdrant, R2, SMTP, Stripe)

### During Deploy
- [ ] Import project on Vercel
- [ ] Set root directory (if needed)
- [ ] Add ALL environment variables
- [ ] Deploy and wait for build

### After Deploy
- [ ] Test `/health` endpoint
- [ ] Update CORS with Vercel URL
- [ ] Redeploy after CORS update
- [ ] Test authentication endpoints
- [ ] Update frontend API URL
- [ ] Deploy frontend

## 🆘 Common Issues

### ❌ Build Failed
**Symptoms:** Red cross on Vercel deployment
**Solution:** Run `npm run build` locally, fix TypeScript errors

### ❌ MongoDB Connection Timeout
**Symptoms:** 500 error, "MongoTimeoutError" in logs
**Solution:** 
1. Go to MongoDB Atlas → Network Access
2. Add IP: `0.0.0.0/0` (allow all)
3. Redeploy on Vercel

### ❌ CORS Blocked
**Symptoms:** Browser console shows "CORS policy" error
**Solution:**
1. Add your frontend URL to `LEGALMIND_CORS_ORIGINS`
2. Redeploy (environment changes require redeploy)

### ❌ Function Timeout
**Symptoms:** Request takes >10s and fails
**Solution:**
- Optimize slow database queries
- Add indexes to MongoDB collections
- Upgrade to Vercel Pro ($20/month for 60s timeout)

### ❌ Environment Variable Not Working
**Symptoms:** App can't find config values
**Solution:**
1. Check spelling matches exactly (case-sensitive!)
2. Click "Redeploy" after changing env vars
3. Check Vercel logs for missing variable errors

## 🎓 Understanding Vercel Deployments

### Every Push = New Deployment
When you push to GitHub, Vercel automatically:
1. Detects the push (GitHub webhook)
2. Pulls latest code
3. Runs `npm install`
4. Runs `npm run build`
5. Deploys to unique URL
6. Updates production URL if it's main branch

### Preview vs Production
- **Preview:** Every branch/PR gets a unique URL (for testing)
- **Production:** Only `main` branch goes to your main URL

### Rollback Anytime
1. Go to Deployments tab
2. Find a previous deployment
3. Click ⋯ → "Promote to Production"

## 📈 Monitoring Your Backend

### View Logs
1. Vercel Dashboard → Your Project
2. Click on a deployment
3. View "Function Logs" tab
4. See all `console.log()` output

### Check Performance
- **Requests:** Deployments → "View Function Logs"
- **Errors:** Real-time error tracking
- **Usage:** Analytics → Bandwidth & Function duration

### Set Up Alerts
Vercel Pro feature - get notified of:
- Deployment failures
- Error spikes
- Usage limits

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ Health endpoint returns `{ status: "ok", mongo_status: "connected" }`
2. ✅ Login endpoint accepts credentials and returns JWT
3. ✅ Frontend can communicate with backend (CORS working)
4. ✅ No errors in Vercel function logs
5. ✅ MongoDB shows active connections

## 🚀 Next Steps After Deployment

1. **Custom Domain** (Optional)
   - Buy domain (e.g., `api.legalmind.com`)
   - Add in Vercel → Settings → Domains
   - Update frontend API URL

2. **Monitoring & Logging**
   - Set up [Sentry](https://sentry.io) for error tracking
   - Use [LogTail](https://logtail.com) for log aggregation
   - Enable Vercel Analytics

3. **Performance Optimization**
   - Add Redis for caching (Upstash works with Vercel)
   - Optimize MongoDB queries
   - Enable compression middleware

4. **CI/CD Enhancements**
   - Add GitHub Actions for tests
   - Set up staging environment
   - Configure preview deployments

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Express.js on Vercel Guide](https://vercel.com/guides/using-express-with-vercel)
- [Vercel CLI Reference](https://vercel.com/docs/cli)
- [MongoDB Atlas Setup](https://docs.atlas.mongodb.com)
- [Environment Variables Best Practices](https://vercel.com/docs/concepts/projects/environment-variables)

## 💡 Pro Tips

1. **Use Vercel CLI for local testing:**
   ```bash
   vercel dev
   ```
   This simulates the Vercel environment locally!

2. **Preview deployments for testing:**
   Every branch gets its own URL - perfect for feature testing

3. **Keep sensitive logs private:**
   Don't log full user data or API keys

4. **Monitor cold starts:**
   If performance matters, consider Vercel Pro or keep-alive pings

5. **Database connection pooling:**
   Your MongoDB connection is already optimized with connection reuse

---

## 🤝 Need Help?

- **Check Logs:** Vercel Dashboard → Function Logs
- **Check MongoDB:** Atlas Dashboard → Metrics
- **Read Guides:** See `DEPLOYMENT_GUIDE.md` for detailed troubleshooting
- **Ask for Help:** Share Vercel deployment URL and error logs

---

**Ready to deploy? Start with `QUICK_DEPLOY_CHECKLIST.md`!** 🚀
