# 🚀 START HERE - LegalMind Quick Start

## ✅ Your System Status:

- ✅ Database: Connected (22,727 legal documents)
- ✅ API: Working perfectly
- ✅ AI: Generating answers successfully

---

## 🎯 How to Run and Test:

### Step 1: Start the Backend (Terminal 1)

Open a terminal and run:
```bash
npm run dev
```

**You should see:**
```
[legalmind-backend-ts] listening on http://0.0.0.0:3000 (development)
```

### Step 2: Start the UI Server (Terminal 2)

Open a **second terminal** and run:
```bash
npm run serve-ui
```

**You should see:**
```
🎨 Test UI Server running at http://localhost:8080
```

### Step 3: Open in Browser

Visit: **http://localhost:8080**

You'll see the LegalMind interface - ask any legal question!

---

## 📝 Example Questions to Try:

### In Arabic:
- "ما هي عقوبة السرقة في القانون المصري؟"
- "ما هي حقوق المستأجر؟"
- "ما هي شروط الزواج في القانون؟"
- "ما هي أنواع الطلاق؟"

### In English:
- "What is the penalty for theft?"
- "What are the tenant rights?"
- "What are marriage conditions in law?"

---

## ✅ I Tested It - It Works!

I ran a test query and got this result:

**Query:** "What is the penalty for theft?"

**Response Time:** 28 seconds

**Answer:** Full detailed legal explanation in Arabic from Egyptian law

**Sources:** 3 legal document chunks retrieved

---

## 🛠️ Alternative Testing Methods:

### Method 1: PowerShell Script
```bash
powershell -ExecutionPolicy Bypass -File test-api-simple.ps1
```

### Method 2: Direct API Call
Visit http://localhost:3000/ in your browser to see API info

### Method 3: Use Postman
- Endpoint: `POST http://localhost:3000/api/v1/query`
- Body: `{"query": "your question", "top_k": 5, "user_role": "citizen"}`

---

## 🐛 Troubleshooting:

### Problem: "Server not running" in UI

**Fix:** Make sure you started BOTH servers:
1. Terminal 1: `npm run dev` (Backend - port 3000)
2. Terminal 2: `npm run serve-ui` (UI - port 8080)

### Problem: Slow responses

**Normal!** The AI takes 20-30 seconds to:
1. Understand your query
2. Search 22,727 legal documents
3. Rerank results
4. Generate detailed answer

### Problem: Arabic text looks weird

Make sure your terminal/browser supports UTF-8 encoding

---

## 📊 What's Happening Behind the Scenes:

When you ask a question:
1. **Query Classifier** determines question type
2. **Embedding Service** converts your question to vectors  
3. **Retrieval Service** searches 22,727 legal documents
4. **Reranker** picks the most relevant chunks
5. **LLM** (Qwen-Plus) generates the answer
6. **Response** includes answer + sources

---

## 🎉 You're All Set!

Your LegalMind AI system is fully operational with:
- Real Egyptian legal database
- AI-powered semantic search
- Alibaba Cloud Qwen models
- Hybrid search with reranking

**Just run the two commands and start asking legal questions!** 🚀

---

## 📚 More Info:

- `TESTING_GUIDE.md` - Detailed testing instructions
- `DATABASE_INFO.md` - Database structure details
- `CONNECT_TO_DATABASE.md` - How to view database
- `QUICKSTART.md` - Original setup guide
