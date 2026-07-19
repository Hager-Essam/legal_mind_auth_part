# 🏛️ LegalMind API - Egyptian Legal Consultation System

> AI-powered legal consultation API using RAG (Retrieval-Augmented Generation) with 22,727 Egyptian legal documents.

[![Performance](https://img.shields.io/badge/Response_Time-10--15s-green)]()
[![Database](https://img.shields.io/badge/Documents-22,727-blue)]()
[![Confidence](https://img.shields.io/badge/Confidence_Scoring-Enabled-brightgreen)]()
[![Rate_Limit](https://img.shields.io/badge/Rate_Limit-20/min-orange)]()

---

## 🚀 Quick Start

### For Developers (Running Locally)

```bash
# 1. Install dependencies
npm install

# 2. Create .env file (copy from .env.example)
cp .env.example .env

# 3. Add your credentials to .env
# - MongoDB Atlas URI
# - DashScope API Key

# 4. Start development server
npm run dev

# 5. Test API
# Open http://localhost:3000/health
```

**See:** [`START_HERE.md`](START_HERE.md) for detailed setup instructions.

---

## 📚 Complete Documentation Index

### 🎯 Getting Started
- **[START_HERE.md](START_HERE.md)** - How to run the system locally
- **[QUICKSTART.md](QUICKSTART.md)** - Original quick start guide

### 🚀 Deployment & Sharing
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Deploy to free hosting (Render, Railway, Fly.io)
- **[SHARING_CHECKLIST.md](SHARING_CHECKLIST.md)** - Quick reference for frontend team
- **[FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md)** - Complete frontend integration guide with React/Next.js examples

### 🧪 Testing & API
- **[POSTMAN_GUIDE.md](POSTMAN_GUIDE.md)** - How to use Postman collection
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - API testing methods
- **[LegalMind-API.postman_collection.json](LegalMind-API.postman_collection.json)** - Complete Postman collection
- **[LegalMind-Local.postman_environment.json](LegalMind-Local.postman_environment.json)** - Local environment
- **[LegalMind-Production.postman_environment.json](LegalMind-Production.postman_environment.json)** - Production environment

### 🔧 Technical Details
- **[PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md)** - Performance improvements (28s → 10-15s)
- **[OPTIMIZATIONS_APPLIED.md](OPTIMIZATIONS_APPLIED.md)** - Technical details of all 11 optimizations
- **[CONFIDENCE_SCORE_GUIDE.md](CONFIDENCE_SCORE_GUIDE.md)** - How confidence scoring works
- **[CONFIDENCE_EXAMPLES.md](CONFIDENCE_EXAMPLES.md)** - Real-world confidence score examples

### 📊 Database & Architecture
- **[DATABASE_INFO.md](DATABASE_INFO.md)** - Database structure (22,727 documents)
- **[CONNECT_TO_DATABASE.md](CONNECT_TO_DATABASE.md)** - MongoDB connection guide
- **[FINAL_SUMMARY.md](FINAL_SUMMARY.md)** - Complete system overview with architecture diagram

### 🔀 Git & Collaboration
- **[GIT_COMMIT_GUIDE.md](GIT_COMMIT_GUIDE.md)** - Git workflow and best practices
- **[PUSH_TO_HAGER_GUIDE.md](PUSH_TO_HAGER_GUIDE.md)** - How to push to Hager branch

### 🎓 Demo Preparation
- **[DEMO_DAY_CHECKLIST.md](DEMO_DAY_CHECKLIST.md)** - Complete graduation demo preparation

---

## 🎯 For Frontend Developers

**Start Here:**
1. Read [`SHARING_CHECKLIST.md`](SHARING_CHECKLIST.md) - Quick API reference
2. Import [`LegalMind-API.postman_collection.json`](LegalMind-API.postman_collection.json) into Postman
3. Follow [`FRONTEND_INTEGRATION.md`](FRONTEND_INTEGRATION.md) for React/Next.js integration
4. Use API Base URL (after deployment): `https://legalmind-api.onrender.com`

**Key Information:**
- **Response Time:** 10-15 seconds (show loading indicator!)
- **Rate Limit:** 20 requests/minute per IP
- **Confidence Score:** 0-1 (use color coding: green ≥0.7, yellow ≥0.4, red <0.4)
- **CORS:** Already configured, no setup needed

---

## 📡 API Endpoints

### Main Endpoint

```http
POST /api/v1/query
Content-Type: application/json

{
  "query": "ما عقوبة السرقة في القانون المصري؟",
  "top_k": 5,
  "user_role": "citizen"
}
```

**Response (10-15 seconds):**
```json
{
  "answer": "الحكم القانوني الرئيسي: ...",
  "source_chunks": [...],
  "category": "arabic_rag",
  "latency_ms": 12000,
  "confidence_score": 0.85,
  "llm_provider_used": "modelstudio"
}
```

### Health Checks

```http
GET /health          # Full health check with database ping
GET /ready           # Quick readiness check (faster)
GET /                # API information
```

---

## ⚡ Performance Features

✅ **Fast Response Time:** 10-15 seconds (was 28s)  
✅ **Timeout Protection:** 30-second LLM timeout  
✅ **Rate Limiting:** 20 requests/minute per IP  
✅ **Confidence Scoring:** 0-1 quality indicator  
✅ **Fast Health Checks:** Non-blocking database ping  
✅ **Smart Caching:** MongoDB efficient queries  

**See:** [`PERFORMANCE_OPTIMIZATION.md`](PERFORMANCE_OPTIMIZATION.md) for details.

---

## 🗄️ Database

- **Platform:** MongoDB Atlas
- **Total Documents:** 22,727 legal documents
- **Collections:** 
  - `legal_chunks` (22,727 docs) - Main legal content
  - `clause_library` (83 docs) - Common legal clauses
- **Coverage:** Egyptian civil, criminal, commercial, labor law

**See:** [`DATABASE_INFO.md`](DATABASE_INFO.md) for structure details.

---

## 🛠️ Technology Stack

- **Runtime:** Node.js 22 + TypeScript
- **Framework:** Express.js 5
- **Database:** MongoDB Atlas (Mongoose)
- **AI/LLM:** DashScope (Qwen-turbo, Qwen3-rerank)
- **Embedding:** text-embedding-v4 (1024 dimensions)
- **RAG:** Hybrid search (vector + BM25) with reranking

---

## 📦 Project Structure

```
backend-ts/
├── src/
│   ├── app/             # Express app configuration
│   ├── config/          # Environment & configuration
│   ├── controllers/     # Request handlers
│   ├── middlewares/     # Error handling, validation
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── schemas/         # Zod validation schemas
│   ├── services/        # Business logic
│   ├── utils/           # Helper functions
│   └── index.ts         # Entry point
├── scripts/             # Database scripts
├── docs/                # All documentation (*.md files)
├── test-ui.html         # Beautiful test interface
├── serve-ui.js          # Test UI server
├── package.json         # Dependencies
└── .env                 # Environment variables (NOT committed)
```

---

## 🧪 Testing

### Option 1: Test UI (Recommended)
```bash
npm run serve-ui
# Open http://localhost:8080
```

### Option 2: PowerShell Script
```bash
powershell -ExecutionPolicy Bypass -File test-api-simple.ps1
```

### Option 3: Postman
- Import `LegalMind-API.postman_collection.json`
- Select environment: "LegalMind - Local"
- Run any request

**See:** [`TESTING_GUIDE.md`](TESTING_GUIDE.md) for all testing methods.

---

## 🚀 Deployment

### Recommended: Render.com (Free)

1. Push code to GitHub
2. Sign up at [render.com](https://render.com)
3. Create Web Service from GitHub repo
4. Configure build:
   ```
   Build: npm install && npm run build
   Start: npm start
   ```
5. Add environment variables from `.env`
6. Deploy! (5 minutes)

**See:** [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for complete deployment guide (Render, Railway, Fly.io, Vercel).

---

## 🔒 Security

✅ Rate limiting (20 req/min)  
✅ CORS protection  
✅ Environment variables (never commit `.env`)  
✅ MongoDB credentials server-side only  
✅ API key protection  
✅ Input validation (Zod schemas)  
✅ Error handling with safe messages  

---

## 📊 System Capabilities

### Question Categories
- **arabic_rag:** General legal questions with RAG
- **law_ref:** Specific law/article references
- **chat:** Greetings and general conversation

### User Roles
- **citizen:** Simplified legal answers
- **lawyer:** Detailed legal analysis

### Supported Laws
- Egyptian Penal Code (قانون العقوبات)
- Civil Law (القانون المدني)
- Commercial Law (القانون التجاري)
- Labor Law (قانون العمل)
- Personal Status Law (قانون الأحوال الشخصية)

---

## 🤝 Team & Support

### For Developers
- **Setup Issues:** See [`START_HERE.md`](START_HERE.md)
- **Git Help:** See [`GIT_COMMIT_GUIDE.md`](GIT_COMMIT_GUIDE.md)
- **Performance:** See [`PERFORMANCE_OPTIMIZATION.md`](PERFORMANCE_OPTIMIZATION.md)

### For Frontend Team
- **Quick Reference:** [`SHARING_CHECKLIST.md`](SHARING_CHECKLIST.md)
- **Integration Guide:** [`FRONTEND_INTEGRATION.md`](FRONTEND_INTEGRATION.md)
- **Postman:** [`POSTMAN_GUIDE.md`](POSTMAN_GUIDE.md)

### For Demo Day
- **Checklist:** [`DEMO_DAY_CHECKLIST.md`](DEMO_DAY_CHECKLIST.md)
- **Summary:** [`FINAL_SUMMARY.md`](FINAL_SUMMARY.md)

---

## 📜 Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Build TypeScript
npm start                # Run production build

# Testing
npm run serve-ui         # Start test UI server (port 8080)

# Database
npm run view-db          # View database content

# Type Checking
npm run typecheck        # Check TypeScript types
```

---

## 🎓 Academic Project

**Institution:** Information Technology Institute (ITI)  
**Project:** LegalMind - AI Legal Consultation System  
**Team:** Graduation Project Team  
**Year:** 2026  

---

## 📄 License

This is an academic graduation project.

---

## 🙏 Acknowledgments

- ITI for project guidance
- DashScope AI for LLM services
- MongoDB Atlas for database hosting
- Open source community for tools and libraries

---

## 📞 Quick Links

| Resource | Link |
|----------|------|
| **GitHub Repo** | https://github.com/MohamedAhmedMaged/Legal-Graduation-ITI |
| **Local API** | http://localhost:3000 |
| **Test UI** | http://localhost:8080 |
| **Production** | https://legalmind-api.onrender.com *(after deployment)* |
| **Postman Docs** | Generate from Postman collection |

---

**Last Updated:** July 18, 2026  
**Version:** 0.1.0  
**Status:** ✅ Production Ready

---

<div align="center">
  <strong>Built with ❤️ by the LegalMind Team</strong>
</div>
