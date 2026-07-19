# 🎨 Frontend Integration Guide

## Quick Start for Frontend Developers

This guide helps you integrate the LegalMind API into your React, Next.js, or any JavaScript/TypeScript frontend.

---

## 📋 API Overview

**Base URL (Production):** `https://legalmind-api.onrender.com` *(update after deployment)*  
**Base URL (Local):** `http://localhost:3000`

### Available Endpoints

| Method | Endpoint | Purpose | Response Time |
|--------|----------|---------|---------------|
| POST | `/api/v1/query` | Ask legal questions | 10-15 seconds |
| GET | `/health` | Check API health | < 1 second |
| GET | `/ready` | Quick readiness check | < 1 second |
| GET | `/` | API information | < 1 second |

---

## 🚀 Quick Integration (Copy-Paste Ready)

### 1. Create API Service File

Create `src/services/legalMindApi.ts` (or `.js` if not using TypeScript):

```typescript
// src/services/legalMindApi.ts

const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.REACT_APP_API_URL || 
  'http://localhost:3000';

// ============ TYPES ============
export interface QueryRequest {
  query: string;                      // Legal question in Arabic (required)
  top_k?: number;                     // Number of sources (1-50, default: 5)
  user_role?: 'lawyer' | 'citizen';   // User type (default: citizen)
}

export interface SourceChunk {
  text: string;                       // Legal text content
  law_name: string;                   // Law name (e.g., "قانون العقوبات")
  article_number?: string;            // Article number (e.g., "313")
  chapter?: string;                   // Chapter/section
  rerank_score?: number;              // Relevance score (0-1)
}

export interface QueryResponse {
  answer: string;                     // Legal answer in Arabic
  source_chunks: SourceChunk[];       // Retrieved legal documents
  category: 'arabic_rag' | 'law_ref' | 'chat';  // Question type
  latency_ms: number;                 // Response time in milliseconds
  confidence_score?: number;          // Answer confidence (0-1)
  llm_provider_used: string | null;   // AI provider used
}

export interface HealthResponse {
  status: 'ok' | 'error';
  database: {
    connected: boolean;
    pingOk: boolean;
  };
}

// ============ API FUNCTIONS ============

/**
 * Query legal question - Main API function
 */
export async function queryLegalQuestion(
  request: QueryRequest,
  options?: {
    timeout?: number;          // Request timeout (default: 35000ms)
    onProgress?: () => void;   // Called every second during request
  }
): Promise<QueryResponse> {
  const controller = new AbortController();
  const timeout = options?.timeout || 35000; // 35 seconds (API has 30s timeout)
  
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // Progress indicator (optional)
  let progressInterval: NodeJS.Timeout | undefined;
  if (options?.onProgress) {
    progressInterval = setInterval(options.onProgress, 1000);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    if (progressInterval) clearInterval(progressInterval);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (progressInterval) clearInterval(progressInterval);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      throw error;
    }
    throw new Error('Unknown error occurred');
  }
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
}

/**
 * Check if API is ready (faster than health check)
 */
export async function checkReady(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/ready`);
  return response.json();
}

/**
 * Get API information
 */
export async function getApiInfo(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/`);
  return response.json();
}
```

---

## 🎯 Usage Examples

### Example 1: Simple React Component

```typescript
// components/LegalQuery.tsx

import { useState } from 'react';
import { queryLegalQuestion, QueryResponse } from '@/services/legalMindApi';

export default function LegalQuery() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await queryLegalQuestion({
        query,
        top_k: 5,
        user_role: 'citizen'
      });
      
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="legal-query">
      <form onSubmit={handleSubmit}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اكتب سؤالك القانوني هنا..."
          rows={4}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? 'جاري البحث...' : 'ابحث'}
        </button>
      </form>

      {error && (
        <div className="error">
          <p>❌ {error}</p>
        </div>
      )}

      {result && (
        <div className="result">
          <h3>الإجابة:</h3>
          <p>{result.answer}</p>
          
          <div className="metadata">
            <span>⏱️ {(result.latency_ms / 1000).toFixed(1)}s</span>
            {result.confidence_score && (
              <span>📊 {(result.confidence_score * 100).toFixed(0)}%</span>
            )}
            <span>📚 {result.source_chunks.length} مصادر</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Example 2: With Progress Indicator

```typescript
// components/LegalQueryWithProgress.tsx

import { useState } from 'react';
import { queryLegalQuestion } from '@/services/legalMindApi';

export default function LegalQueryWithProgress() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [answer, setAnswer] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setProgress(0);

    try {
      const response = await queryLegalQuestion(
        { query, top_k: 5 },
        {
          onProgress: () => {
            setProgress((prev) => Math.min(prev + (100 / 15), 95)); // Estimate 15s
          }
        }
      );
      
      setProgress(100);
      setAnswer(response.answer);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="سؤالك القانوني..."
        />
        <button disabled={loading}>بحث</button>
      </form>

      {loading && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
          <span>{Math.round(progress)}%</span>
        </div>
      )}

      {answer && <div className="answer">{answer}</div>}
    </div>
  );
}
```

### Example 3: React Hook (Reusable)

```typescript
// hooks/useLegalQuery.ts

import { useState } from 'react';
import { queryLegalQuestion, QueryResponse } from '@/services/legalMindApi';

export function useLegalQuery() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResponse | null>(null);

  const query = async (question: string, topK: number = 5) => {
    setLoading(true);
    setError(null);

    try {
      const response = await queryLegalQuestion({
        query: question,
        top_k: topK,
        user_role: 'citizen'
      });
      
      setResult(response);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { query, loading, error, result, reset };
}

// Usage in component:
// const { query, loading, error, result } = useLegalQuery();
// await query("ما عقوبة السرقة؟");
```

### Example 4: Next.js Server Action

```typescript
// app/actions/legalQuery.ts
'use server';

export async function submitLegalQuery(formData: FormData) {
  const query = formData.get('query') as string;
  
  const response = await fetch('https://legalmind-api.onrender.com/api/v1/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      top_k: 5,
      user_role: 'citizen'
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to query');
  }

  return response.json();
}
```

---

## 🎨 Confidence Score Display

Use color coding to show answer quality:

```typescript
// components/ConfidenceIndicator.tsx

interface Props {
  score?: number;  // 0 to 1
}

export function ConfidenceIndicator({ score }: Props) {
  if (!score) return null;

  const percentage = Math.round(score * 100);
  
  const getColor = () => {
    if (percentage >= 70) return '#22c55e'; // Green - High confidence
    if (percentage >= 40) return '#eab308'; // Yellow - Medium confidence
    return '#ef4444'; // Red - Low confidence
  };

  const getLabel = () => {
    if (percentage >= 70) return 'دقة عالية';
    if (percentage >= 40) return 'دقة متوسطة';
    return 'دقة منخفضة';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div 
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: getColor()
        }}
      />
      <span>{getLabel()} ({percentage}%)</span>
    </div>
  );
}
```

---

## ⚠️ Important Notes

### 1. Response Time
- **Expected:** 10-15 seconds
- **First request after idle:** 30-60 seconds (cold start on free hosting)
- **Action:** Always show loading indicator

### 2. Rate Limiting
- **Limit:** 20 requests per minute per IP
- **Error:** 429 Too Many Requests
- **Action:** Show "Please wait" message, retry after 1 minute

### 3. CORS Configuration
- Already configured on backend
- No special setup needed on frontend
- If issues arise, contact backend team

### 4. Error Handling
Always handle these errors:
- Network errors (server down)
- Timeout errors (> 30 seconds)
- Rate limit errors (429)
- Validation errors (400)

---

## 📦 Environment Variables

Add to your `.env.local` or `.env`:

```bash
# Next.js
NEXT_PUBLIC_API_URL=https://legalmind-api.onrender.com

# Create React App
REACT_APP_API_URL=https://legalmind-api.onrender.com

# Vite
VITE_API_URL=https://legalmind-api.onrender.com
```

---

## 🧪 Testing

### Test API Connection

```typescript
// Test in browser console or component
import { checkHealth } from '@/services/legalMindApi';

async function testConnection() {
  try {
    const health = await checkHealth();
    console.log('API Status:', health.status);
    console.log('Database:', health.database);
  } catch (error) {
    console.error('API Connection Failed:', error);
  }
}

testConnection();
```

---

## 📞 Support

**Backend Team Contact:**
- Backend running issues → Check `START_HERE.md`
- Deployment help → Check `DEPLOYMENT_GUIDE.md`
- API testing → Check `POSTMAN_GUIDE.md`

**Quick Help:**
1. Test API health: `GET /health`
2. Check Postman collection for examples
3. Review error messages in browser console
4. Verify environment variables are set

---

## ✅ Integration Checklist

- [ ] Copy `legalMindApi.ts` to your project
- [ ] Add environment variable (API URL)
- [ ] Test health check endpoint
- [ ] Implement loading state
- [ ] Add error handling
- [ ] Test with sample query
- [ ] Add confidence score display
- [ ] Implement rate limit handling
- [ ] Add timeout handling
- [ ] Style components to match design

---

**Ready to integrate!** Start with the simple example and expand from there. 🚀
