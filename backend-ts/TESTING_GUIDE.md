# 🧪 Testing Guide - LegalMind API

## ✅ Quick Test - Is the Server Running?

Open your browser and visit:
- **http://localhost:3000/** 

You should see a JSON response like:
```json
{
  "name": "LegalMind API TS",
  "environment": "development",
  "version": "0.1.0",
  "routes": ["/health", "/ready", "/api/v1/query"]
}
```

## 🔧 Fixed Issues:

✅ **API Endpoint:** Corrected from `/api/query` to `/api/v1/query`

## 🎯 How to Test:

### Option 1: Use the Test UI (Recommended)

1. Make sure server is running: `npm run dev`
2. Open `test-ui.html` in your browser
3. If you see "Server not running" error:
   - The issue is CORS when opening file directly
   - Use Option 2 below

### Option 2: Test with curl/PowerShell

```powershell
# Test health endpoint
curl http://localhost:3000/health

# Test query endpoint
curl -X POST http://localhost:3000/api/v1/query `
  -H "Content-Type: application/json" `
  -d '{\"query\": \"ما هي عقوبة السرقة؟\", \"top_k\": 5, \"user_role\": \"citizen\"}'
```

### Option 3: Serve the UI with a Simple Server

The problem with opening `test-ui.html` directly is CORS. Let's serve it properly:

**Install a simple server:**
```bash
npm install -g http-server
```

**Serve the UI:**
```bash
http-server . -p 8080 -o test-ui.html
```

Then visit: http://localhost:8080/test-ui.html

### Option 4: Test with Postman or Thunder Client

**Endpoint:** `POST http://localhost:3000/api/v1/query`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "query": "ما هي عقوبة السرقة في القانون المصري؟",
  "top_k": 5,
  "user_role": "citizen"
}
```

## 🐛 Troubleshooting:

### Problem: "Server not running" error in UI

**Cause:** CORS restriction when opening HTML file directly (file:// protocol)

**Solution:** 
1. Use http-server to serve the HTML
2. Or use curl/Postman to test
3. Or build a proper frontend with a dev server

### Problem: CORS error in browser console

**Fix:** Update your `.env` to allow all origins temporarily:
```
LEGALMIND_CORS_ORIGINS=
```

Restart the server after changing `.env`

## ✅ Expected Response Format:

```json
{
  "answer": "عقوبة السرقة في القانون المصري...",
  "source_chunks": [
    {
      "chunk_id": "...",
      "law_name": "...",
      "text": "...",
      ...
    }
  ],
  "llm_provider_used": "dashscope",
  "category": "arabic_rag",
  "latency_ms": 1234
}
```

## 🚀 Quick Command to Test:

Save this as `test-query.json`:
```json
{
  "query": "ما هي حقوق المستأجر؟",
  "top_k": 5,
  "user_role": "citizen"
}
```

Then run:
```bash
curl -X POST http://localhost:3000/api/v1/query -H "Content-Type: application/json" -d @test-query.json
```

---

**Need help?** Check the server logs by looking at the terminal where `npm run dev` is running!
