================================================================
           LEGALMIND API - QUICK REFERENCE
================================================================

📡 API BASE URL (Production)
https://legalmind-api.onrender.com
(Update this after deployment)

📡 API BASE URL (Local Testing)
http://localhost:3000

================================================================
                    MAIN ENDPOINT
================================================================

POST /api/v1/query
Content-Type: application/json

Request Body:
{
  "query": "ما عقوبة السرقة؟",
  "top_k": 5,
  "user_role": "citizen"
}

Response (10-15 seconds):
{
  "answer": "الحكم القانوني الرئيسي: ...",
  "source_chunks": [...],
  "category": "arabic_rag",
  "latency_ms": 12000,
  "confidence_score": 0.85,
  "llm_provider_used": "modelstudio"
}

================================================================
                 OTHER ENDPOINTS
================================================================

GET /health
→ Check API and database status

GET /ready  
→ Quick readiness check (faster)

GET /
→ API information and available routes

================================================================
                 IMPORTANT NOTES
================================================================

⏱️ Response Time
   • Normal: 10-15 seconds
   • First request after idle: 30-60 seconds (cold start)
   • Always show loading indicator!

🚦 Rate Limiting
   • 20 requests per minute per IP address
   • Error 429 = Wait 1 minute before retrying

📊 Confidence Score
   • Range: 0 to 1 (0% to 100%)
   • Green (≥70%): High confidence
   • Yellow (40-69%): Medium confidence  
   • Red (<40%): Low confidence

🌐 CORS
   • Already configured
   • All origins allowed for testing
   • No special setup needed

================================================================
                 REQUEST PARAMETERS
================================================================

query (required)
   • Legal question in Arabic
   • Min length: 3 characters
   • Max length: 2000 characters
   • Example: "ما هي شروط الزواج؟"

top_k (optional)
   • Number of sources to retrieve
   • Range: 1-50
   • Default: 5
   • Recommended: 5-10

user_role (optional)
   • Values: "lawyer" or "citizen"
   • Default: "citizen"
   • Affects answer complexity

================================================================
                 RESPONSE FIELDS
================================================================

answer (string)
   • Legal answer in Arabic
   • Includes citations: [المصدر: قانون X - المادة Y]

source_chunks (array)
   • Legal documents used for answer
   • Each has: text, law_name, article_number, rerank_score

category (string)
   • "arabic_rag": Normal legal question
   • "law_ref": Specific law reference
   • "chat": Greeting or thanks

latency_ms (number)
   • Response time in milliseconds
   • Typical: 10000-15000 (10-15 seconds)

confidence_score (number, optional)
   • Answer confidence: 0-1
   • Based on top source relevance
   • Only present for arabic_rag category

llm_provider_used (string | null)
   • AI provider: "modelstudio"
   • null if no LLM used

================================================================
                 ERROR RESPONSES
================================================================

400 Bad Request
   • Missing or invalid parameters
   • Check query field

429 Too Many Requests
   • Rate limit exceeded
   • Wait 60 seconds

500 Internal Server Error
   • Server issue
   • Try again or contact backend team

================================================================
                 TESTING WITH POSTMAN
================================================================

1. Import: LegalMind-API.postman_collection.json
2. Import: LegalMind-Production.postman_environment.json
3. Select "LegalMind - Production" environment
4. Try "Query - Criminal Law" request
5. See POSTMAN_GUIDE.md for details

================================================================
                 FRONTEND INTEGRATION
================================================================

See FRONTEND_INTEGRATION.md for:
   • Complete TypeScript service code
   • React hooks and components
   • Error handling examples
   • Progress indicators
   • Confidence score display

Quick Example (TypeScript):

const response = await fetch('API_BASE_URL/api/v1/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "ما عقوبة السرقة؟",
    top_k: 5,
    user_role: "citizen"
  })
});

const data = await response.json();
console.log(data.answer);

================================================================
                 SUPPORT & HELP
================================================================

📄 Documentation: See FRONTEND_INTEGRATION.md
🧪 Testing: See POSTMAN_GUIDE.md  
🚀 Deployment: See DEPLOYMENT_GUIDE.md
📮 Postman Collection: Import and test
💬 Questions: Contact backend team

================================================================
                 QUICK HEALTH CHECK
================================================================

Test if API is running:

curl https://legalmind-api.onrender.com/health

Expected Response:
{
  "status": "ok",
  "database": {
    "connected": true,
    "pingOk": true
  }
}

================================================================
                 DATABASE INFO
================================================================

• Total Documents: 22,727 legal documents
• Database: MongoDB Atlas
• Collections: legal_chunks, clause_library
• Laws Covered: Egyptian civil, criminal, commercial, labor law

================================================================

Last Updated: July 18, 2026
Backend Team: LegalMind Graduation Project
GitHub: https://github.com/MohamedAhmedMaged/Legal-Graduation-ITI

================================================================
