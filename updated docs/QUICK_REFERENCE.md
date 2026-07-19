# 🚀 LegalMind Quick Reference

## ✅ Current System Status

**Performance:** ~10-18 seconds per query  
**Configuration:** Speed-optimized  
**Safety:** Production-ready with timeouts & rate limiting  
**Monitoring:** Full request logging enabled

---

## 📊 What's Running

### Backend Server (Port 3000)
```bash
npm run dev
```

**Features:**
- ✅ 30-second timeout protection
- ✅ Rate limiting (20 requests/minute)
- ✅ Request logging (morgan)
- ✅ Confidence scores
- ✅ Fast health checks

### UI Server (Port 8080)
```bash
npm run serve-ui
```

**Access:** http://localhost:8080

---

## 🔧 Configuration (.env)

### Speed Optimizations
```env
LEGALMIND_LLM_MODEL=qwen-turbo              # Fast model
LEGALMIND_ENABLE_QUERY_REWRITE=false        # Skip rewrite (saves 2-3s)
LEGALMIND_ENABLE_LLM_RERANK=false           # Heuristic rerank (saves 3-5s)
LEGALMIND_RETRIEVAL_TOP_K=10                # Fewer chunks (faster)
LEGALMIND_RERANK_TOP_K=5                    # Top 5 results
```

### Safety Features (Auto-enabled)
- Generation timeout: 30 seconds
- Health check: Instant ping (no reconnect)
- Rate limiting: 20 requests/minute/IP
- CORS: All origins allowed (dev only)

---

## 📈 Response Format

```json
{
  "answer": "الحكم القانوني...",
  "source_chunks": [...],
  "llm_provider_used": "modelstudio",
  "category": "arabic_rag",
  "latency_ms": 12055,
  "confidence_score": 0.78  // ← NEW!
}
```

### Confidence Score Interpretation
- **>0.7 (70%):** High confidence - strong evidence
- **0.4-0.7 (40-70%):** Medium confidence - reasonable evidence
- **<0.4 (<40%):** Low confidence - weak evidence

---

## 🧪 Testing Commands

### Test API Health
```bash
powershell -Command "Invoke-RestMethod http://localhost:3000/health"
```

### Test Query (PowerShell)
```bash
powershell -ExecutionPolicy Bypass -File test-api-simple.ps1
```

### View Database
```bash
npm run view-db
```

---

## 📝 Server Logs

**Format:**
```
[2026-07-18T13:41:25.263Z] POST /api/v1/query 200 18640.549 ms - 15492
│                          │    │               │   │              │
│                          │    │               │   │              └─ Response size (bytes)
│                          │    │               │   └─ Latency (milliseconds)
│                          │    │               └─ Status code
│                          │    └─ Endpoint
│                          └─ Method
└─ Timestamp (ISO 8601)
```

---

## ⚡ Performance Breakdown

Typical query (~10-18 seconds):

1. **Embedding** (~1-2s): Convert query to vector
2. **Retrieval** (~1s): Search 22,727 chunks
3. **Reranking** (~0.1s): Heuristic scoring (fast!)
4. **Generation** (~8-15s): LLM answer creation

**Total:** 10-18 seconds

---

## 🛡️ Rate Limiting

**Limit:** 20 requests per IP per minute

**Response when exceeded:**
```json
{
  "error": "TooManyRequests",
  "message": "Please wait before sending more queries. Rate limit: 20 requests per minute."
}
```

**HTTP Status:** 429

---

## 🔍 API Endpoints

### POST /api/v1/query
**Body:**
```json
{
  "query": "ما هي عقوبة السرقة؟",
  "top_k": 5,
  "user_role": "citizen",
  "law_category": "جنائي"  // optional
}
```

### GET /health
**Response:**
```json
{
  "status": "ok",
  "service": "LegalMind API TS",
  "environment": "development"
}
```

### GET /ready
**Response:**
```json
{
  "status": "ok",
  "checks": {
    "mongo": true,
    "provider": true
  }
}
```

### GET /
**Response:** API information and available routes

---

## 🎯 Demo Tips

### 1. Show Request Logging
Keep the terminal visible during demo to show real-time logs

### 2. Demonstrate Confidence Scores
- Ask a clear question → High confidence (green)
- Ask an ambiguous question → Lower confidence (yellow/red)

### 3. Show Rate Limiting
Explain that the system protects against abuse

### 4. Highlight Speed
Mention the optimizations: "Reduced from 28s to 10-18s"

### 5. Show Source Citations
Each answer includes legal references with article numbers

---

## 📚 Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Run production build
npm run view-db          # View database contents
npm run serve-ui         # Serve test UI
npm run typecheck        # Check TypeScript types
```

---

## 🔄 Quick Restart

If you need to restart everything:

```bash
# Terminal 1 (Backend)
Ctrl+C
npm run dev

# Terminal 2 (UI)
Ctrl+C
npm run serve-ui
```

---

## 📊 System Metrics

**Database:** 22,727 legal documents  
**Collections:** 2 (legal_chunks, clause_library)  
**Vector Dimensions:** 1024  
**Embedding Model:** text-embedding-v4  
**LLM Model:** qwen-turbo (fast)  
**Reranking:** Heuristic (instant)

---

## ✅ Pre-Demo Checklist

- [ ] Backend server running (`npm run dev`)
- [ ] UI server running (`npm run serve-ui`)
- [ ] Database connection verified (green status in UI)
- [ ] Test query successful
- [ ] Confidence scores displaying
- [ ] Request logs visible in terminal
- [ ] MongoDB Atlas accessible (for showing data)

---

## 🆘 Troubleshooting

### Server won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000
```

### MongoDB connection fails
- Check internet connection
- Verify credentials in `.env`
- Test connection: `npm run view-db`

### Slow responses
- Normal: 10-18 seconds for complex queries
- Check server logs for errors
- Verify DashScope API key is valid

### Rate limit hit
- Wait 60 seconds
- Or restart server (resets counter)

---

**Good luck with your graduation demo! 🎓✨**
