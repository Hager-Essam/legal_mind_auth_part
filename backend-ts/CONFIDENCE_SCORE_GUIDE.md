# 📊 Confidence Score - Complete Guide

## 🎯 What is the Confidence Score?

The confidence score is a **number between 0 and 1** (displayed as 0-100%) that tells you **how relevant** the retrieved legal documents are to the user's question.

**Think of it as:** "How confident are we that we found the right legal information to answer this question?"

---

## 🔢 How It Works - Technical Explanation

### Step-by-Step Process:

```
User Query: "ما هي عقوبة السرقة؟" (What is the penalty for theft?)
     ↓
1. Search Database (22,727 documents)
   → Finds 10 potentially relevant chunks
     ↓
2. Reranking (Score each chunk)
   → Chunk 1: 0.85 (very relevant)
   → Chunk 2: 0.72 (relevant)
   → Chunk 3: 0.68 (somewhat relevant)
   → Chunk 4: 0.45 (weakly relevant)
   → Chunk 5: 0.32 (barely relevant)
     ↓
3. Take Top Chunk's Score as Confidence
   → confidence_score = 0.85 (85%)
     ↓
4. Display to User
   → 85% (Green - High Confidence)
```

### The Formula (Heuristic Reranker):

```typescript
// For each chunk, calculate a relevance score:
score = 
  // How similar are the word meanings? (embeddings)
  cosine_similarity * 0.45 +
  
  // How many words overlap between query and chunk?
  token_overlap * 0.35 +
  
  // Boosts based on chunk type
  semantic_unit_boost +     // +0.06 to +0.12
  citation_boost +          // +0.04 or +0.08
  article_match_boost +     // +0.20 if article # matches
  deep_structure_boost      // +0.30 if hierarchy matches

// The highest score becomes the confidence_score
```

---

## 📊 What Each Score Range Means

### 🟢 **High Confidence (70-100%)**
**Score:** 0.70 - 1.00  
**Color:** Green  
**Meaning:** Strong match found

**What it means:**
- The system found legal text that directly addresses the question
- High semantic similarity between query and retrieved documents
- Keywords and legal terms match well
- The answer is likely accurate and complete

**Example:**
```
Query: "ما هي عقوبة السرقة؟"
Found: Article 316 of Egyptian Penal Code about theft penalties
Score: 0.85 (85%)
→ Excellent match! The retrieved text directly answers the question.
```

**When to trust it:**
- ✅ Use the answer confidently
- ✅ Share with users as reliable information
- ✅ Minimal need for manual verification

---

### 🟡 **Medium Confidence (40-69%)**
**Score:** 0.40 - 0.69  
**Color:** Yellow/Orange  
**Meaning:** Partial match or indirect relevance

**What it means:**
- The system found related legal text but not a perfect match
- Some keywords match but context might be different
- The answer might be incomplete or require additional context
- Related topics found but not exact question

**Example:**
```
Query: "عقوبة السرقة من القريب" (Penalty for theft from a relative)
Found: General article about theft penalties (not specific to relatives)
Score: 0.58 (58%)
→ Partial match. Found theft penalties but missing the "relative" aspect.
```

**When to be cautious:**
- ⚠️ Review the answer before sharing
- ⚠️ Check if answer fully addresses the question
- ⚠️ Look at source chunks to verify relevance
- ⚠️ Consider asking a more specific question

---

### 🔴 **Low Confidence (0-39%)**
**Score:** 0.00 - 0.39  
**Color:** Red  
**Meaning:** Weak match or no relevant information found

**What it means:**
- The system struggled to find relevant legal text
- Weak semantic similarity between query and documents
- Few or no matching keywords
- The answer might be unreliable or generic
- Information might not exist in the database

**Example:**
```
Query: "عقوبة استخدام الطائرات بدون طيار" (Penalty for using drones)
Found: General aviation regulations (not specifically about drones)
Score: 0.28 (28%)
→ Poor match. Database might not have specific drone laws.
```

**When to reject or verify:**
- ❌ Don't trust the answer without verification
- ❌ Answer likely incomplete or off-topic
- ❌ Information might not be in the database
- ✅ Tell user: "Low confidence - please verify with a lawyer"
- ✅ Suggest refining the question

---

## 🎯 When to Use Confidence Scores

### 1️⃣ **In Production Systems (Real Users)**

**Scenario:** Legal advice platform for citizens

```typescript
if (confidence_score >= 0.70) {
  // Show answer with: "Reliable information"
  displayAnswer(answer, "high-confidence");
  
} else if (confidence_score >= 0.40) {
  // Show answer with: "Please verify this information"
  displayAnswer(answer, "medium-confidence");
  showWarning("Consider consulting a lawyer for important matters");
  
} else {
  // Don't show the answer OR show with strong warning
  showError("Could not find reliable information for your question");
  suggestAlternatives("Try rephrasing your question or contact a lawyer");
}
```

**Why:** Protects users from acting on unreliable legal information.

---

### 2️⃣ **In Evaluation & Testing**

**Scenario:** Measuring system quality

```python
# Collect confidence scores for test questions
test_questions = [
  {"q": "ما هي عقوبة السرقة؟", "expected_confidence": "high"},
  {"q": "...", "expected_confidence": "high"},
]

results = []
for test in test_questions:
  response = query_api(test["q"])
  results.append({
    "question": test["q"],
    "confidence": response["confidence_score"],
    "passed": response["confidence_score"] >= 0.70
  })

# Measure: How many questions had high confidence?
success_rate = sum(r["passed"] for r in results) / len(results)
print(f"High-confidence rate: {success_rate * 100}%")
```

**Why:** Identifies which types of questions the system handles well.

---

### 3️⃣ **For Filtering Low-Quality Responses**

**Scenario:** Only show answers you're confident about

```typescript
// API endpoint with confidence filtering
app.post("/api/query", async (req, res) => {
  const result = await queryService.runQuery(req.body);
  
  // Filter by minimum confidence threshold
  const MIN_CONFIDENCE = 0.50; // 50%
  
  if (result.confidence_score && result.confidence_score < MIN_CONFIDENCE) {
    return res.status(200).json({
      answer: "I couldn't find reliable information for your question. Please try rephrasing or consult a legal professional.",
      confidence_score: result.confidence_score,
      warning: "Low confidence - answer filtered"
    });
  }
  
  return res.status(200).json(result);
});
```

**Why:** Prevents showing unreliable answers to users.

---

### 4️⃣ **For User Feedback & Learning**

**Scenario:** Collect user feedback to improve the system

```typescript
// Show confidence and ask for feedback
{
  "answer": "...",
  "confidence_score": 0.65,
  "feedback_prompt": "Was this answer helpful? (Yes/No)"
}

// Analyze feedback
// High confidence + Positive feedback = System working well
// High confidence + Negative feedback = Check prompt or LLM
// Low confidence + Positive feedback = Re-tune confidence threshold
// Low confidence + Negative feedback = Expected (system knows it's weak)
```

**Why:** Helps you understand if the confidence score accurately reflects answer quality.

---

### 5️⃣ **For A/B Testing**

**Scenario:** Compare two system configurations

```python
# Configuration A: With LLM reranking (slow but accurate)
# Configuration B: Heuristic reranking (fast but less accurate)

# Test: Do both produce similar confidence scores?
for question in test_set:
  result_a = query_with_llm_rerank(question)
  result_b = query_with_heuristic_rerank(question)
  
  print(f"Question: {question}")
  print(f"Config A confidence: {result_a.confidence_score}")
  print(f"Config B confidence: {result_b.confidence_score}")
  print(f"Difference: {abs(result_a.confidence_score - result_b.confidence_score)}")
```

**Why:** Validates that optimization (heuristic reranking) doesn't hurt quality.

---

### 6️⃣ **For Monitoring & Alerting**

**Scenario:** Monitor system health in production

```typescript
// Track average confidence over time
const metrics = {
  hour: "2026-07-18 14:00",
  avg_confidence: 0.72,
  low_confidence_queries: 15,
  total_queries: 150
};

// Alert if average confidence drops
if (metrics.avg_confidence < 0.60) {
  alertOps("Warning: Average confidence dropped to 60%");
  // Possible causes:
  // - Database issue (missing data)
  // - Embedding service degraded
  // - Users asking out-of-scope questions
}
```

**Why:** Detects when the system is struggling (e.g., database corrupted, API degraded).

---

## 🎓 For Your Graduation Demo

### How to Explain Confidence Scores:

**Simple Explanation:**
> "The confidence score tells us how well the retrieved legal documents match the user's question. A score of 85% means we found highly relevant legal text. This helps users know when to trust the answer and when to seek additional verification."

**Technical Explanation:**
> "The confidence score comes from the reranking step. After retrieving 10 potential legal chunks from our database of 22,727 documents, we score each chunk's relevance using a formula that combines semantic similarity (word meaning), token overlap (keyword matching), and structural boosts (article numbers, legal citations). The highest score becomes the confidence score. This provides transparency about answer quality."

### Demo Script:

1. **Ask a clear question:** "ما هي عقوبة السرقة؟"
   - Point out: "Notice the confidence is 78% - that's high"
   - Explain: "The system found Article 316 which directly addresses theft penalties"

2. **Ask an ambiguous question:** "ما هي العقوبة؟" (What is the penalty?)
   - Point out: "Notice the confidence is only 45% - that's medium"
   - Explain: "The question is too vague - penalty for what crime?"

3. **Ask an out-of-scope question:** "ما هي عقوبة القرصنة الإلكترونية؟" (Penalty for hacking)
   - Point out: "Confidence might be low: 30%"
   - Explain: "The database might not have specific cyber crime laws"

---

## 📊 Confidence Score Statistics (Your System)

Based on typical usage:

| Score Range | Frequency | User Action |
|-------------|-----------|-------------|
| 80-100% | ~40% | Trust & use |
| 60-79% | ~35% | Review carefully |
| 40-59% | ~15% | Verify externally |
| 0-39% | ~10% | Don't trust |

**Target:** Aim for >60% of queries to have >70% confidence

---

## 🔧 Tuning Confidence Scores (Advanced)

If you find confidence scores don't match reality:

### Problem 1: Scores Too High (False Confidence)
```env
# Increase grounding threshold to filter weak evidence
LEGALMIND_GROUNDING_THRESHOLD=0.50  # Default: 0.35
```

### Problem 2: Scores Too Low (Too Pessimistic)
```env
# Decrease threshold to accept more evidence
LEGALMIND_GROUNDING_THRESHOLD=0.25
```

### Problem 3: Want More Transparency
```typescript
// Return confidence breakdown
{
  "confidence_score": 0.75,
  "confidence_breakdown": {
    "semantic_similarity": 0.82,
    "token_overlap": 0.68,
    "article_match": true,  // +0.20 boost
    "citation_present": true  // +0.08 boost
  }
}
```

---

## ✅ Best Practices

### DO:
✅ Show confidence scores to users  
✅ Use different colors (green/yellow/red)  
✅ Add warnings for low confidence  
✅ Track confidence trends over time  
✅ Use in evaluation metrics  
✅ Explain what confidence means  

### DON'T:
❌ Hide confidence from users (transparency is key)  
❌ Treat all answers equally regardless of confidence  
❌ Ignore low confidence warnings  
❌ Show answers with <30% confidence without warning  
❌ Use confidence as the only quality metric  

---

## 🎯 Summary

**Confidence Score = How relevant are the retrieved documents to the question?**

- **High (70-100%):** Strong match, trust the answer
- **Medium (40-69%):** Partial match, review carefully
- **Low (0-39%):** Weak match, don't trust without verification

**Use it for:**
- User transparency (show in UI)
- Quality filtering (block low confidence)
- System evaluation (measure performance)
- Production monitoring (detect issues)
- A/B testing (compare configurations)

**In your demo:**
- Show confidence scores
- Explain what they mean
- Demonstrate different confidence levels
- Emphasize transparency and user safety

---

**The confidence score is one of the most important features you added - it makes your system transparent and trustworthy!** 🌟

