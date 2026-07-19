# LegalMind Backend - Quick Start Guide

## ✅ Setup Complete!

Your environment is configured and ready to run.

## 🚀 How to Run

### 1. Start the Backend Server

Open a terminal in this directory and run:

```bash
npm run dev
```

The server will start on `http://localhost:3000`

### 2. Open the Test UI

Simply open the `test-ui.html` file in your web browser:
- Double-click the file, or
- Right-click → Open with → Your browser

### 3. Test the Application

1. The UI will automatically check if the server is running
2. Enter a legal query in Arabic or English (e.g., "ما هي عقوبة السرقة؟")
3. Click "Search" to get AI-powered legal answers

## 📝 API Endpoint

**POST** `http://localhost:3000/api/query`

**Request Body:**
```json
{
  "query": "ما هي عقوبة السرقة في القانون المصري؟",
  "top_k": 5,
  "user_role": "citizen",
  "law_category": "جنائي"
}
```

**Response:**
```json
{
  "answer": "...",
  "source_chunks": [...],
  "llm_provider_used": "dashscope",
  "category": "arabic_rag",
  "latency_ms": 1234
}
```

## 🔧 Configuration

All settings are in `.env` file:
- ✅ MongoDB Atlas connection configured
- ✅ DashScope API key configured
- ✅ CORS enabled for localhost:5173
- ✅ Hybrid search enabled
- ✅ Query rewriting enabled
- ✅ LLM reranking enabled

## 🛠️ Available Scripts

- `npm run dev` - Start development server with auto-reload
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run typecheck` - Check TypeScript types

## 📊 Health Check

Visit `http://localhost:3000/health` to check if the server is running.

## 🎨 Test UI Features

- ✅ Beautiful bilingual interface (Arabic/English)
- ✅ Real-time server status check
- ✅ Configurable query parameters
- ✅ Visual display of results and sources
- ✅ Loading indicators
- ✅ Error handling

## 🐛 Troubleshooting

**Server won't start?**
- Check if MongoDB connection is working
- Verify API keys are correct in `.env`
- Make sure port 3000 is not in use

**UI shows "Server not running"?**
- Make sure you ran `npm run dev` first
- Check console for error messages

**Getting 400 errors?**
- Ensure query is at least 3 characters
- Check that top_k is between 1 and 50

## 📚 Project Structure

```
backend-ts/
├── src/
│   ├── app/          # Express app setup
│   ├── config/       # Environment configuration
│   ├── controllers/  # Request handlers
│   ├── routes/       # API routes
│   ├── services/     # Business logic
│   ├── models/       # MongoDB models
│   ├── schemas/      # Zod validation schemas
│   └── index.ts      # Entry point
├── test-ui.html      # Simple test interface
├── .env              # Your configuration
└── package.json      # Dependencies
```

---

**Happy Testing! 🎉**
