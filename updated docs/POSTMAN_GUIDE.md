# 📮 Postman Collection Guide

## 📦 What's Included

You have 3 files for Postman:

1. **`LegalMind-API.postman_collection.json`** - Complete API collection with all endpoints
2. **`LegalMind-Local.postman_environment.json`** - Environment for local testing (localhost:3000)
3. **`LegalMind-Production.postman_environment.json`** - Environment for deployed API

---

## 🚀 STEP 1: Import Collection into Postman

### Option A: Import via Postman Desktop App

1. **Download Postman**
   - Go to: https://www.postman.com/downloads/
   - Install Postman Desktop App

2. **Open Postman**
   - Click "Import" button (top left)
   - Drag and drop these 3 files:
     - `LegalMind-API.postman_collection.json`
     - `LegalMind-Local.postman_environment.json`
     - `LegalMind-Production.postman_environment.json`
   - Or click "Upload Files" and select them

3. **Verify Import**
   - You should see "LegalMind API" collection in the left sidebar
   - You should see 2 environments in the top-right dropdown:
     - LegalMind - Local
     - LegalMind - Production

### Option B: Import via Postman Web

1. **Go to Postman Web**
   - Visit: https://web.postman.co/
   - Sign in with your account

2. **Import Files**
   - Click "Import" → "Upload Files"
   - Select all 3 JSON files
   - Click "Import"

---

## 🎯 STEP 2: Select Environment

### For Local Testing (Your Machine)
1. Click environment dropdown (top-right)
2. Select: **"LegalMind - Local"**
3. Base URL will be: `http://localhost:3000`

### For Production Testing (After Deployment)
1. Click environment dropdown (top-right)
2. Select: **"LegalMind - Production"**
3. Base URL will be: `https://legalmind-api.onrender.com`
4. **Note:** Update the base URL in the environment if you deploy to a different platform

---

## 🧪 STEP 3: Test the API

### Test 1: Health Check
1. Expand "Health & Status" folder
2. Click "Health Check"
3. Click "Send" button
4. You should get:
```json
{
  "status": "ok",
  "database": {
    "connected": true,
    "pingOk": true
  }
}
```

### Test 2: Legal Query
1. Expand "Legal Queries" folder
2. Click "Query - Criminal Law (Arabic)"
3. Click "Send" button
4. Wait 10-15 seconds
5. You should get a detailed legal answer in Arabic

### Test 3: Try Other Queries
- Query - Labor Law
- Query - Family Law
- Query - Commercial Law
- Query - Civil Law

---

## 📝 STEP 4: Customize Requests

### Modify Query Text
1. Click on any query request
2. Click "Body" tab
3. Edit the JSON:
```json
{
  "query": "ما هي شروط الطلاق؟",  // Your question here
  "top_k": 5,
  "user_role": "citizen"
}
```
4. Click "Send"

### Change Parameters
- **`query`**: Your legal question in Arabic (required)
- **`top_k`**: Number of sources to retrieve (1-50, default: 5)
- **`user_role`**: "lawyer" or "citizen" (default: "citizen")

---

## 🌐 STEP 5: Share Collection with Frontend Team

### Method 1: Export and Send Files (Easiest)

1. **Share the 3 JSON files**
   - Send via email, WhatsApp, or shared drive:
     - `LegalMind-API.postman_collection.json`
     - `LegalMind-Local.postman_environment.json`
     - `LegalMind-Production.postman_environment.json`

2. **Team imports them**
   - They follow STEP 1 above to import

### Method 2: Create Public Link (Better for Teams)

1. **Right-click on "LegalMind API" collection**
2. Click "Share"
3. Click "Get public link"
4. Enable "Public link"
5. Copy the link
6. Share this link with your team

**Example link:**
```
https://www.postman.com/legalmind-team/workspace/legalmind-api/collection/12345
```

### Method 3: Create Team Workspace (Best for Collaboration)

1. **Create Workspace**
   - Click "Workspaces" (top-left)
   - Click "Create Workspace"
   - Name: "LegalMind Team"
   - Select "Team" or "Public"

2. **Move Collection to Workspace**
   - Right-click "LegalMind API" collection
   - Click "Share"
   - Select "LegalMind Team" workspace
   - Click "Share"

3. **Invite Team Members**
   - Click workspace name
   - Click "Invite"
   - Enter team member emails
   - They get instant access

---

## 🔄 STEP 6: Update Collection (When You Make Changes)

### When API Changes

1. **Update requests in Postman**
   - Add new endpoints
   - Modify existing requests
   - Update documentation

2. **Export updated collection**
   - Right-click "LegalMind API" collection
   - Click "Export"
   - Select "Collection v2.1"
   - Save as `LegalMind-API.postman_collection.json`
   - **Replace the old file**

3. **Share with team**
   - Send updated file
   - Or if using public link/workspace, changes sync automatically

### When Production URL Changes

1. **Update Environment**
   - Click environment dropdown
   - Click "LegalMind - Production"
   - Change `base_url` value
   - Example: `https://your-new-url.com`
   - Click "Save"

2. **Export updated environment**
   - Click "..." next to environment name
   - Click "Export"
   - Save as `LegalMind-Production.postman_environment.json`
   - Share with team

---

## 📱 STEP 7: Generate Code for Frontend

Postman can generate code in any language for your frontend team!

### Generate JavaScript/TypeScript Code

1. **Open any request** (e.g., "Query - Criminal Law")
2. Click **"Code"** button (right side, under Send button)
3. Select language:
   - **JavaScript - Fetch** (for React, Next.js, vanilla JS)
   - **JavaScript - Axios** (if using Axios)
   - **TypeScript - Fetch**
4. Copy the generated code

**Example Generated Code:**
```javascript
// JavaScript Fetch
const response = await fetch('{{base_url}}/api/v1/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "ما عقوبة السرقة في القانون المصري؟",
    top_k: 5,
    user_role: "citizen"
  })
});

const data = await response.json();
console.log(data);
```

5. **Share this code** with frontend team
6. They can integrate it directly into their app

---

## 📚 STEP 8: Documentation for Frontend Team

### Share API Documentation

Postman can generate beautiful documentation automatically!

1. **Generate Documentation**
   - Right-click "LegalMind API" collection
   - Click "View documentation"
   - Click "Publish"
   - Select "Public" or "Team"
   - Click "Publish"

2. **Share Documentation URL**
   - Copy the generated URL
   - Example: `https://documenter.getpostman.com/view/12345/legalmind-api`
   - Send to frontend team

3. **What they'll see:**
   - All endpoints with descriptions
   - Request/response examples
   - Code snippets in multiple languages
   - Try-it-yourself interface

---

## 🎨 Frontend Integration Example

### React/Next.js Example

Create a service file for your frontend:

```typescript
// services/legalMindApi.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface QueryRequest {
  query: string;
  top_k?: number;
  user_role?: 'lawyer' | 'citizen';
}

export interface QueryResponse {
  answer: string;
  source_chunks: Array<{
    text: string;
    law_name: string;
    article_number?: string;
    rerank_score?: number;
  }>;
  category: 'arabic_rag' | 'law_ref' | 'chat';
  latency_ms: number;
  confidence_score?: number;
  llm_provider_used: string | null;
}

export async function queryLegalQuestion(
  request: QueryRequest
): Promise<QueryResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to query API');
  }

  return response.json();
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}
```

### Usage in Component

```typescript
// components/LegalQueryForm.tsx

import { useState } from 'react';
import { queryLegalQuestion } from '@/services/legalMindApi';

export default function LegalQueryForm() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await queryLegalQuestion({
        query,
        top_k: 5,
        user_role: 'citizen'
      });
      
      setAnswer(result.answer);
      console.log('Confidence:', result.confidence_score);
      console.log('Sources:', result.source_chunks.length);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="اكتب سؤالك القانوني..."
        rows={4}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'جاري البحث...' : 'ابحث'}
      </button>
      {answer && (
        <div className="answer">
          <p>{answer}</p>
        </div>
      )}
    </form>
  );
}
```

---

## 🔧 Common Issues & Solutions

### Issue 1: CORS Error
**Error:** `Access-Control-Allow-Origin`

**Solution:**
- Make sure your production API has correct CORS settings
- In `.env`, set: `LEGALMIND_CORS_ORIGINS=https://your-frontend-domain.com`
- For testing, you can use: `LEGALMIND_CORS_ORIGINS=*`

### Issue 2: Rate Limit Error
**Error:** `429 Too Many Requests`

**Solution:**
- API allows 20 requests per minute
- Wait 1 minute before trying again
- In production, implement request queueing on frontend

### Issue 3: Timeout
**Error:** Request takes too long

**Solution:**
- Normal response time: 10-15 seconds
- First request after idle: 30-60 seconds (cold start on free hosting)
- Implement loading indicators in frontend

### Issue 4: Cannot Connect
**Error:** `Failed to fetch` or `Network Error`

**Solution:**
- Verify API is running: Check `/health` endpoint
- Check if URL is correct in environment
- For local: Make sure backend is running (`npm run dev`)
- For production: Verify deployment is active

---

## 📤 Quick Checklist: Share with Frontend Team

Send them these 5 things:

- [ ] 1. **Postman Collection** - `LegalMind-API.postman_collection.json`
- [ ] 2. **Production Environment** - `LegalMind-Production.postman_environment.json`
- [ ] 3. **API Base URL** - Your deployed URL (e.g., `https://legalmind-api.onrender.com`)
- [ ] 4. **This Guide** - `POSTMAN_GUIDE.md`
- [ ] 5. **Code Examples** - Generated from Postman (Step 7)

---

## 🎓 Resources

- **Postman Learning**: https://learning.postman.com/
- **API Documentation**: Generate from Postman (Step 8)
- **Frontend Integration**: See examples above
- **Support**: Contact backend team if issues arise

---

## 🚀 Next Steps

1. ✅ Import collection into Postman (Step 1)
2. ✅ Test locally with "LegalMind - Local" environment
3. ✅ Deploy to Render/Railway/Fly.io (see `DEPLOYMENT_GUIDE.md`)
4. ✅ Update "LegalMind - Production" environment with deployed URL
5. ✅ Test production deployment
6. ✅ Share collection with frontend team (Step 5)
7. ✅ Generate code examples for frontend (Step 7)
8. ✅ Publish API documentation (Step 8)

---

**Need Help?** Contact the backend team or check the troubleshooting section above! 🤝
