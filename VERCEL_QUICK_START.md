# Quick Start: Deploy to Vercel in 5 Minutes

## 1. Install Vercel CLI
```bash
npm install -g vercel
```

## 2. Login to Vercel
```bash
vercel login
```

## 3. Deploy
```bash
cd server
vercel
```

Follow prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N**
- Project name? **legalmind-api**
- Directory? **./**
- Override settings? **N**

## 4. Add Environment Variables

After first deployment, go to: https://vercel.com/dashboard

1. Select your project **legalmind-api**
2. Go to **Settings** → **Environment Variables**
3. Copy these variables (replace with your actual values):

```
MONGODB_URI=mongodb+srv://legalmind:bx0s1xTqqvt9R2fB9@cluster0.8dnyana.mongodb.net/legalmind?retryWrites=true&w=majority&appName=Cluster0
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

4. Click **Save** for each variable

## 5. Redeploy
```bash
vercel --prod
```

## 6. Test Your API

Your API URL: `https://legalmind-api.vercel.app` (or custom name)

Test:
```bash
curl https://legalmind-api.vercel.app/health
```

## 7. Update MongoDB Atlas

Go to MongoDB Atlas → **Network Access** → Add IP: **0.0.0.0/0**

---

## Done! 🎉

Your API is live at: `https://your-project.vercel.app`

View logs: https://vercel.com/dashboard → Your Project → Deployments → View Function Logs

## Next Steps

- Update your frontend to use the new API URL
- Set proper CORS origins (replace `*` with your frontend URL)
- Consider implementing cloud storage for file uploads (Cloudinary, AWS S3)

## Redeploy Anytime

```bash
git add .
git commit -m "Update"
git push origin main
```

Or manually:
```bash
vercel --prod
```
