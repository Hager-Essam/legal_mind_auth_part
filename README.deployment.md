# LegalMind API - Deployment Ready ✅

## What's Been Set Up

Your Express.js API is now ready for Vercel deployment with the following configuration:

### Files Created

1. **`vercel.json`** - Vercel deployment configuration
2. **`api/index.js`** - Serverless function entry point
3. **`.vercelignore`** - Excludes unnecessary files from deployment
4. **`.env.example`** - Template for environment variables

### Documentation Created

1. **`VERCEL_DEPLOYMENT_GUIDE.md`** - Complete deployment guide
2. **`VERCEL_QUICK_START.md`** - Quick 5-minute deployment steps

## Deployment Methods

### Method 1: Vercel CLI (Fastest)

```bash
# Install CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd server
vercel
```

### Method 2: GitHub + Vercel Dashboard

1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variables
5. Deploy!

## Important: Environment Variables

After deployment, add these in Vercel Dashboard → Settings → Environment Variables:

```env
MONGODB_URI=mongodb+srv://legalmind:YOUR_PASSWORD@cluster0.8dnyana.mongodb.net/legalmind?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=LegalMindVeryStrongSecretKey123!
NODE_ENV=production
EMAIL_USER=hagergogo2372@gmail.com
EMAIL_PASSWORD=alzz vcis olwt dmvy
```

See `.env.example` for complete list.

## Critical: MongoDB Atlas Setup

**Must allow Vercel IPs:**

MongoDB Atlas → Network Access → Add IP Address → **0.0.0.0/0** (Allow from anywhere)

## Testing After Deployment

```bash
# Health check
curl https://your-app.vercel.app/health

# API documentation
open https://your-app.vercel.app/api-docs
```

## File Uploads Note ⚠️

Vercel serverless functions don't persist uploaded files. You'll need to implement cloud storage:

**Recommended Solutions:**
- Cloudinary (easiest for images)
- AWS S3
- Vercel Blob Storage
- DigitalOcean Spaces

Update `src/middlewares/upload.middleware.js` to use cloud storage.

## Local Development

```bash
npm install
npm run dev
```

## Production Deployment

```bash
vercel --prod
```

## Continuous Deployment

Push to main branch for auto-deployment:
```bash
git push origin main
```

## Folder Structure

```
server/
├── api/
│   └── index.js          # Vercel serverless entry point
├── src/
│   ├── app.js            # Express app
│   ├── server.js         # Local development server
│   ├── config/           # Configuration files
│   ├── middlewares/      # Express middlewares
│   └── modules/          # Feature modules
├── public/               # Static files
├── vercel.json           # Vercel config
├── .vercelignore         # Deployment exclusions
└── package.json          # Dependencies
```

## Troubleshooting

### Connection Issues
- Check MongoDB Atlas allows 0.0.0.0/0
- Verify environment variables in Vercel
- Check function logs in Vercel dashboard

### CORS Errors
- Update ALLOWED_ORIGINS in Vercel env vars
- Add your frontend domain

### 404 Errors
- Verify vercel.json routing
- Check api/index.js exists

## Support Resources

- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas: https://cloud.mongodb.com
- Function Logs: Vercel Dashboard → Deployments → View Logs

---

**Ready to deploy! Follow VERCEL_QUICK_START.md for step-by-step instructions.**
