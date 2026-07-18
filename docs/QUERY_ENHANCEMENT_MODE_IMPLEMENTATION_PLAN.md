# Query Enhancement Mode Implementation Plan

## Executive Summary

This document outlines the plan to add a **Query Enhancement Mode** feature that allows lawyers to optionally enable query rewriting when exploring unfamiliar legal fields, while maintaining the current passthrough behavior as default.

---

## Problem Statement

### Current Limitation

The system assumes all lawyers are experts in all legal fields:

```typescript
// Current behavior
if (role === "lawyer") {
  return passthrough();  // ❌ No help provided
}
```

### Real-World Scenarios That Need Support

1. **Criminal lawyer** asking about **tax law** → May use vague terminology
2. **Corporate lawyer** asking about **family law** → May lack domain-specific keywords
3. **Junior lawyer** exploring any field → Needs guidance
4. **Lawyer handling client's colloquial question** → Query contains informal Arabic

### Solution

Add three enhancement modes with user control:
- **`off`**: Current behavior (passthrough)
- **`mapping`**: Dictionary only (add law names, no LLM)
- **`full`**: LLM + dictionary (clean colloquial + add law names)

---

## Feature Requirements

### Functional Requirements

1. **FR-1**: Add query enhancement mode as optional parameter
2. **FR-2**: Maintain backward compatibility (default behavior unchanged)
3. **FR-3**: Allow explicit mode selection via API
4. **FR-4**: Provide three distinct modes with clear semantics
5. **FR-5**: Log which mode was used for monitoring
6. **FR-6**: Frontend UI to control mode selection
7. **FR-7**: Persist user preference in browser storage


### Non-Functional Requirements

1. **NFR-1**: No performance degradation for default behavior
2. **NFR-2**: "mapping" mode must complete in <5ms
3. **NFR-3**: "full" mode timeout remains 8 seconds
4. **NFR-4**: Backward compatible API (existing clients don't break)
5. **NFR-5**: Clear Arabic UI labels that lawyers understand

---

## Architecture Changes

### Type System Changes

```typescript
// File: backend-ts/src/types/query.types.ts

// NEW: Enhancement mode enum
export type QueryEnhancementMode = 
  | "off"          // No rewriting (current lawyer default)
  | "mapping"      // Dictionary only (fast, no LLM)
  | "full";        // LLM + mapping (current citizen default)

// MODIFIED: Add mode to result
export type RewriteResult = {
  originalQuery: string;
  rewrittenQuery: string;
  usedMapping: boolean;
  usedLlm: boolean;
  mappingMatch: string | null;
  mode: QueryEnhancementMode;  // ← NEW: Track which mode was used
};
```

### Service Layer Changes

```typescript
// File: backend-ts/src/services/query-rewrite.service.ts

// MODIFIED: Add optional enhancementMode parameter
async rewrite(
  query: string, 
  userRole?: "lawyer" | "citizen",
  enhancementMode?: QueryEnhancementMode  // ← NEW parameter
): Promise<RewriteResult>
```

### API Layer Changes

```typescript
// File: backend-ts/src/routes/api/query.ts

// MODIFIED: Add optional enhancement_mode field
const queryRequestSchema = z.object({
  query: z.string(),
  user_role: z.enum(["lawyer", "citizen"]).optional(),
  enhancement_mode: z.enum(["off", "mapping", "full"]).optional(),  // ← NEW
});
```


---

## Backend Implementation Plan

### Phase 1: Type Definitions (5 minutes)

**File**: `backend-ts/src/types/query.types.ts`

**Changes**:
1. Add `QueryEnhancementMode` type
2. Update `RewriteResult` to include `mode` field

**Code**:
```typescript
export type QueryEnhancementMode = "off" | "mapping" | "full";

export type RewriteResult = {
  originalQuery: string;
  rewrittenQuery: string;
  usedMapping: boolean;
  usedLlm: boolean;
  mappingMatch: string | null;
  mode: QueryEnhancementMode;  // NEW
};
```

**Testing**:
- Verify type exports correctly
- Check no TypeScript errors in dependent files

---

### Phase 2: Service Logic Update (30 minutes)

**File**: `backend-ts/src/services/query-rewrite.service.ts`

**Changes**:

#### Step 2.1: Update Method Signature
```typescript
async rewrite(
  query: string, 
  userRole?: "lawyer" | "citizen",
  enhancementMode?: QueryEnhancementMode
): Promise<RewriteResult>
```

#### Step 2.2: Add Mode Resolution Logic
```typescript
// Determine effective mode
let effectiveMode: QueryEnhancementMode;

if (enhancementMode !== undefined) {
  // Explicit mode always wins
  effectiveMode = enhancementMode;
} else {
  // Default based on role
  effectiveMode = userRole === "lawyer" ? "off" : "full";
}

// System-wide disable overrides everything
if (!env.enableQueryRewrite) {
  effectiveMode = "off";
}
```


#### Step 2.3: Implement Mode-Based Execution
```typescript
switch (effectiveMode) {
  case "off":
    return {
      originalQuery: query,
      rewrittenQuery: query,
      usedMapping: false,
      usedLlm: false,
      mappingMatch: null,
      mode: "off"
    };

  case "mapping":
    const mappingResult = this.mappingOnly(query);
    return { ...mappingResult, mode: "mapping" };

  case "full":
    // Existing LLM + mapping logic
    try {
      const llmResult = await this.rewriteWithLlm(query);
      
      if (!isArabicClean(llmResult)) {
        const fallback = this.mappingOnly(query);
        return { ...fallback, mode: "mapping" };
      }

      const normalizedLlm = normalizeArabicQuery(llmResult);
      const mappingCheck = rewriteWithMapping(normalizedLlm);

      if (mappingCheck.matched && mappingCheck.appendedLaw) {
        return {
          originalQuery: query,
          rewrittenQuery: `${llmResult} ${mappingCheck.appendedLaw}`,
          usedMapping: true,
          usedLlm: true,
          mappingMatch: mappingCheck.matchedTerm,
          mode: "full"
        };
      }

      return {
        originalQuery: query,
        rewrittenQuery: llmResult,
        usedMapping: mappingCheck.matched,
        usedLlm: true,
        mappingMatch: mappingCheck.matchedTerm,
        mode: "full"
      };
    } catch (error) {
      const fallback = this.mappingOnly(query);
      return { ...fallback, mode: "mapping" };
    }
}
```

#### Step 2.4: Update mappingOnly() Helper
```typescript
private mappingOnly(query: string): Omit<RewriteResult, "mode"> {
  const normalized = normalizeArabicQuery(query);
  const mappingResult = rewriteWithMapping(normalized);
  
  if (mappingResult.matched) {
    return {
      originalQuery: query,
      rewrittenQuery: mappingResult.rewritten,
      usedMapping: true,
      usedLlm: false,
      mappingMatch: mappingResult.matchedTerm,
    };
  }
  
  return {
    originalQuery: query,
    rewrittenQuery: normalized,
    usedMapping: false,
    usedLlm: false,
    mappingMatch: null,
  };
}
```


**Testing**:
- Unit test each mode independently
- Test mode precedence (explicit > role > system default)
- Test fallback behavior (full → mapping on error)
- Verify backward compatibility (undefined mode uses role defaults)

---

### Phase 3: API Route Update (15 minutes)

**File**: `backend-ts/src/routes/api/query.ts`

**Changes**:

#### Step 3.1: Update Request Schema
```typescript
const queryRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  user_role: z.enum(["lawyer", "citizen"]).optional().default("citizen"),
  enhancement_mode: z.enum(["off", "mapping", "full"]).optional(),  // NEW
});

type QueryRequest = z.infer<typeof queryRequestSchema>;
```

#### Step 3.2: Pass Mode to Service
```typescript
// In route handler
const { query, user_role, enhancement_mode } = validatedRequest;

const rewriteResult = await queryRewriteService.rewrite(
  query,
  user_role,
  enhancement_mode  // NEW: pass through
);
```

#### Step 3.3: Include Mode in Response (Optional)
```typescript
// Consider adding to response for debugging
return {
  answer,
  source_chunks,
  rewrite_info: {
    original_query: rewriteResult.originalQuery,
    rewritten_query: rewriteResult.rewrittenQuery,
    mode_used: rewriteResult.mode,  // NEW: inform frontend
    used_mapping: rewriteResult.usedMapping,
    used_llm: rewriteResult.usedLlm,
  },
  latency_ms,
};
```

**Testing**:
- Test API with `enhancement_mode` present
- Test API with `enhancement_mode` absent (backward compat)
- Test invalid mode values (should be rejected by Zod)
- Verify response includes mode information


---

## Frontend Implementation Plan

### Phase 4: Frontend Types (5 minutes)

**File**: `frontend/src/types/api.types.ts` (or equivalent)

**Changes**:
```typescript
export type QueryEnhancementMode = "off" | "mapping" | "full";

export interface QueryRequest {
  query: string;
  user_role?: "lawyer" | "citizen";
  enhancement_mode?: QueryEnhancementMode;  // NEW
}

export interface QueryResponse {
  answer: string;
  source_chunks: SourceChunk[];
  rewrite_info?: {
    original_query: string;
    rewritten_query: string;
    mode_used: QueryEnhancementMode;  // NEW
    used_mapping: boolean;
    used_llm: boolean;
  };
  latency_ms: number;
}
```

---

### Phase 5: State Management (10 minutes)

**File**: `frontend/src/store/queryStore.ts` (or context/hooks)

**Changes**:
```typescript
// Add to store/state
interface QueryState {
  userRole: "lawyer" | "citizen";
  enhancementMode: QueryEnhancementMode;  // NEW
  // ... other state
}

// Add actions
const setEnhancementMode = (mode: QueryEnhancementMode) => {
  setState({ enhancementMode: mode });
  localStorage.setItem("enhancementMode", mode);  // Persist
};

// Initialize from localStorage
const initEnhancementMode = () => {
  const saved = localStorage.getItem("enhancementMode");
  if (saved && ["off", "mapping", "full"].includes(saved)) {
    return saved as QueryEnhancementMode;
  }
  return "off";  // Default for lawyers
};
```


---

### Phase 6: UI Components (45 minutes)

**File**: `frontend/src/components/QuerySettings.tsx` (new component)

**Purpose**: Settings panel that appears when user selects "lawyer" role

**Design**: Radio button group with three options

**Component Structure**:
```tsx
import React from 'react';

interface QuerySettingsProps {
  userRole: "lawyer" | "citizen";
  enhancementMode: QueryEnhancementMode;
  onModeChange: (mode: QueryEnhancementMode) => void;
}

export const QuerySettings: React.FC<QuerySettingsProps> = ({
  userRole,
  enhancementMode,
  onModeChange,
}) => {
  // Only show for lawyers
  if (userRole !== "lawyer") return null;

  return (
    <div className="query-settings">
      <h3>⚙️ خيارات البحث المتقدمة</h3>
      
      <div className="radio-group">
        <label className="radio-option">
          <input
            type="radio"
            name="enhancement-mode"
            value="off"
            checked={enhancementMode === "off"}
            onChange={(e) => onModeChange("off")}
          />
          <div className="option-content">
            <strong>إيقاف التحسين</strong>
            <span className="description">
              استخدم استعلامي كما هو (للمحامين المتمكنين)
            </span>
          </div>
        </label>

        <label className="radio-option">
          <input
            type="radio"
            name="enhancement-mode"
            value="mapping"
            checked={enhancementMode === "mapping"}
            onChange={(e) => onModeChange("mapping")}
          />
          <div className="option-content">
            <strong>⚡ إضافة القوانين فقط</strong>
            <span className="description">
              للبحث في مجال قانوني جديد (سريع، مجاني)
            </span>
            <span className="example">
              مثال: "إجراءات الطعن الضريبي" → + قانون الضرائب رقم 91
            </span>
          </div>
        </label>

        <label className="radio-option">
          <input
            type="radio"
            name="enhancement-mode"
            value="full"
            checked={enhancementMode === "full"}
            onChange={(e) => onModeChange("full")}
          />
          <div className="option-content">
            <strong>✨ تحسين كامل</strong>
            <span className="description">
              للاستفسارات العامية أو غير الواضحة (يستغرق 2-3 ثوانٍ)
            </span>
            <span className="example">
              مثال: "عايز اعرف عن الطلاق" → "ما هي إجراءات الطلاق؟"
            </span>
          </div>
        </label>
      </div>
    </div>
  );
};
```


**Styling** (`frontend/src/components/QuerySettings.css`):
```css
.query-settings {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.query-settings h3 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #495057;
  font-size: 16px;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option {
  display: flex;
  align-items: flex-start;
  padding: 12px;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover {
  background: #fff;
  border-color: #0d6efd;
}

.radio-option input[type="radio"] {
  margin-top: 4px;
  margin-left: 12px;
  cursor: pointer;
}

.radio-option input[type="radio"]:checked + .option-content {
  color: #0d6efd;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-content strong {
  font-size: 15px;
  color: #212529;
}

.option-content .description {
  font-size: 13px;
  color: #6c757d;
}

.option-content .example {
  font-size: 12px;
  color: #868e96;
  font-style: italic;
  margin-top: 4px;
}
```

---

### Phase 7: Integration into Main Query Page (20 minutes)

**File**: `frontend/src/pages/QueryPage.tsx` (or equivalent)

**Changes**:

#### Step 7.1: Import and Add State
```tsx
import { QuerySettings } from '../components/QuerySettings';
import { useState, useEffect } from 'react';

const [userRole, setUserRole] = useState<"lawyer" | "citizen">("citizen");
const [enhancementMode, setEnhancementMode] = useState<QueryEnhancementMode>("off");

// Initialize from localStorage on mount
useEffect(() => {
  const savedMode = localStorage.getItem("enhancementMode");
  if (savedMode && ["off", "mapping", "full"].includes(savedMode)) {
    setEnhancementMode(savedMode as QueryEnhancementMode);
  }
}, []);

// Save to localStorage when changed
const handleModeChange = (mode: QueryEnhancementMode) => {
  setEnhancementMode(mode);
  localStorage.setItem("enhancementMode", mode);
};
```


#### Step 7.2: Add Settings Component to UI
```tsx
return (
  <div className="query-page">
    {/* Role selector */}
    <div className="role-selector">
      <label>
        <input
          type="radio"
          value="citizen"
          checked={userRole === "citizen"}
          onChange={() => setUserRole("citizen")}
        />
        مواطن
      </label>
      <label>
        <input
          type="radio"
          value="lawyer"
          checked={userRole === "lawyer"}
          onChange={() => setUserRole("lawyer")}
        />
        محامي
      </label>
    </div>

    {/* NEW: Show settings panel for lawyers */}
    <QuerySettings
      userRole={userRole}
      enhancementMode={enhancementMode}
      onModeChange={handleModeChange}
    />

    {/* Query input and submit button */}
    <textarea
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="اكتب استفسارك القانوني هنا..."
    />
    
    <button onClick={handleSubmit}>
      بحث
    </button>
  </div>
);
```

#### Step 7.3: Update API Call
```tsx
const handleSubmit = async () => {
  setLoading(true);
  
  try {
    const response = await fetch("/api/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        user_role: userRole,
        enhancement_mode: enhancementMode,  // NEW: send mode
      }),
    });

    const data = await response.json();
    
    // Display answer
    setAnswer(data.answer);
    
    // Optional: Show rewrite info for debugging
    if (data.rewrite_info) {
      console.log("Original:", data.rewrite_info.original_query);
      console.log("Rewritten:", data.rewrite_info.rewritten_query);
      console.log("Mode used:", data.rewrite_info.mode_used);
    }
  } catch (error) {
    console.error("Query failed:", error);
  } finally {
    setLoading(false);
  }
};
```


---

### Phase 8: Optional - Show Rewrite Info to User (15 minutes)

**Purpose**: Let user see how their query was enhanced (transparency + education)

**Component**: `RewriteInfo.tsx`

```tsx
interface RewriteInfoProps {
  rewriteInfo?: {
    original_query: string;
    rewritten_query: string;
    mode_used: QueryEnhancementMode;
    used_mapping: boolean;
    used_llm: boolean;
  };
}

export const RewriteInfo: React.FC<RewriteInfoProps> = ({ rewriteInfo }) => {
  if (!rewriteInfo) return null;
  if (rewriteInfo.original_query === rewriteInfo.rewritten_query) return null;

  const getModeLabel = (mode: QueryEnhancementMode) => {
    switch (mode) {
      case "off": return "بدون تحسين";
      case "mapping": return "إضافة قوانين";
      case "full": return "تحسين كامل";
    }
  };

  return (
    <div className="rewrite-info">
      <div className="info-header">
        <span className="icon">🔄</span>
        <span>تم تحسين استعلامك ({getModeLabel(rewriteInfo.mode_used)})</span>
      </div>
      
      <div className="query-comparison">
        <div className="original">
          <strong>الاستعلام الأصلي:</strong>
          <p>{rewriteInfo.original_query}</p>
        </div>
        <div className="arrow">→</div>
        <div className="rewritten">
          <strong>بعد التحسين:</strong>
          <p>{rewriteInfo.rewritten_query}</p>
        </div>
      </div>
      
      {rewriteInfo.used_llm && (
        <div className="enhancement-note">
          ✨ تمت إعادة صياغة الاستعلام لتحسين نتائج البحث
        </div>
      )}
      
      {rewriteInfo.used_mapping && !rewriteInfo.used_llm && (
        <div className="enhancement-note">
          ⚡ تم إضافة أسماء القوانين ذات الصلة
        </div>
      )}
    </div>
  );
};
```

**Styling**:
```css
.rewrite-info {
  background: #e7f3ff;
  border-left: 4px solid #0d6efd;
  padding: 12px 16px;
  margin-bottom: 16px;
  border-radius: 4px;
}

.info-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #0d6efd;
  margin-bottom: 12px;
}

.query-comparison {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 14px;
}

.query-comparison .original,
.query-comparison .rewritten {
  flex: 1;
  background: white;
  padding: 8px;
  border-radius: 4px;
}

.query-comparison .arrow {
  font-size: 20px;
  color: #6c757d;
}

.enhancement-note {
  margin-top: 8px;
  font-size: 13px;
  color: #495057;
  font-style: italic;
}
```


---

## Testing Plan

### Backend Unit Tests

**File**: `backend-ts/src/services/query-rewrite.service.test.ts`

```typescript
describe("QueryRewriteService - Enhancement Modes", () => {
  let service: QueryRewriteService;

  beforeEach(() => {
    service = new QueryRewriteService(mockProviderConfig);
  });

  describe("Mode: off", () => {
    it("should passthrough query unchanged", async () => {
      const result = await service.rewrite("test query", "lawyer", "off");
      expect(result.rewrittenQuery).toBe("test query");
      expect(result.mode).toBe("off");
      expect(result.usedLlm).toBe(false);
      expect(result.usedMapping).toBe(false);
    });

    it("should use off mode by default for lawyers", async () => {
      const result = await service.rewrite("test", "lawyer");
      expect(result.mode).toBe("off");
    });
  });

  describe("Mode: mapping", () => {
    it("should add law names without LLM", async () => {
      const result = await service.rewrite("حقوق العمال", "lawyer", "mapping");
      expect(result.rewrittenQuery).toContain("قانون العمل");
      expect(result.mode).toBe("mapping");
      expect(result.usedMapping).toBe(true);
      expect(result.usedLlm).toBe(false);
    });

    it("should complete in <5ms", async () => {
      const start = Date.now();
      await service.rewrite("الطلاق", "lawyer", "mapping");
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(5);
    });
  });

  describe("Mode: full", () => {
    it("should use LLM + mapping for citizens", async () => {
      mockLlm.mockResolvedValue("ما هي حقوق العامل؟");
      
      const result = await service.rewrite("عايز اعرف عن شغلي", "citizen");
      expect(result.mode).toBe("full");
      expect(result.usedLlm).toBe(true);
      expect(result.rewrittenQuery).toContain("قانون العمل");
    });

    it("should fallback to mapping on LLM failure", async () => {
      mockLlm.mockRejectedValue(new Error("Timeout"));
      
      const result = await service.rewrite("الطلاق", "citizen");
      expect(result.mode).toBe("mapping");
      expect(result.usedLlm).toBe(false);
      expect(result.usedMapping).toBe(true);
    });
  });

  describe("Mode precedence", () => {
    it("should respect explicit mode over role default", async () => {
      // Citizen default is "full", but we override to "mapping"
      const result = await service.rewrite("test", "citizen", "mapping");
      expect(result.mode).toBe("mapping");
      expect(result.usedLlm).toBe(false);
    });

    it("should override lawyer default when mode specified", async () => {
      // Lawyer default is "off", but we override to "full"
      mockLlm.mockResolvedValue("improved query");
      
      const result = await service.rewrite("test", "lawyer", "full");
      expect(result.mode).toBe("full");
      expect(result.usedLlm).toBe(true);
    });
  });
});
```


### API Integration Tests

**File**: `backend-ts/tests/api/query.integration.test.ts`

```typescript
describe("Query API - Enhancement Mode", () => {
  it("should accept enhancement_mode parameter", async () => {
    const response = await request(app)
      .post("/api/v1/query")
      .send({
        query: "الطلاق",
        user_role: "lawyer",
        enhancement_mode: "mapping"
      });

    expect(response.status).toBe(200);
    expect(response.body.rewrite_info.mode_used).toBe("mapping");
  });

  it("should reject invalid enhancement_mode", async () => {
    const response = await request(app)
      .post("/api/v1/query")
      .send({
        query: "test",
        enhancement_mode: "invalid"
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("enhancement_mode");
  });

  it("should work without enhancement_mode (backward compat)", async () => {
    const response = await request(app)
      .post("/api/v1/query")
      .send({
        query: "test query",
        user_role: "lawyer"
      });

    expect(response.status).toBe(200);
    expect(response.body.rewrite_info.mode_used).toBe("off");
  });
});
```

---

### Frontend Component Tests

**File**: `frontend/src/components/QuerySettings.test.tsx`

```typescript
describe("QuerySettings Component", () => {
  it("should not render for citizens", () => {
    const { container } = render(
      <QuerySettings
        userRole="citizen"
        enhancementMode="off"
        onModeChange={jest.fn()}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it("should render three options for lawyers", () => {
    const { getByLabelText } = render(
      <QuerySettings
        userRole="lawyer"
        enhancementMode="off"
        onModeChange={jest.fn()}
      />
    );
    
    expect(getByLabelText(/إيقاف التحسين/)).toBeInTheDocument();
    expect(getByLabelText(/إضافة القوانين فقط/)).toBeInTheDocument();
    expect(getByLabelText(/تحسين كامل/)).toBeInTheDocument();
  });

  it("should call onModeChange when selection changes", () => {
    const handleChange = jest.fn();
    const { getByLabelText } = render(
      <QuerySettings
        userRole="lawyer"
        enhancementMode="off"
        onModeChange={handleChange}
      />
    );
    
    fireEvent.click(getByLabelText(/إضافة القوانين فقط/));
    expect(handleChange).toHaveBeenCalledWith("mapping");
  });

  it("should persist selection to localStorage", () => {
    const { getByLabelText } = render(
      <QuerySettings
        userRole="lawyer"
        enhancementMode="off"
        onModeChange={(mode) => localStorage.setItem("enhancementMode", mode)}
      />
    );
    
    fireEvent.click(getByLabelText(/تحسين كامل/));
    expect(localStorage.getItem("enhancementMode")).toBe("full");
  });
});
```


---

## Deployment Plan

### Phase 9: Database Migrations (if needed)

**Status**: ❌ Not needed - This is a stateless feature

---

### Phase 10: Environment Configuration

**File**: `backend-ts/.env.example`

**Add documentation**:
```bash
# Query Rewrite Configuration
ENABLE_QUERY_REWRITE=true          # Master switch
ENABLE_LLM_REWRITE=true            # Allow "full" mode
DEFAULT_USER_ROLE=citizen          # Default when not specified

# Note: Lawyers can now optionally enable "mapping" or "full" mode
# via the enhancement_mode parameter
```

---

### Phase 11: Documentation Updates

#### Update API Documentation

**File**: `backend-ts/API.md` or OpenAPI spec

**Add**:
```markdown
### Query Enhancement Mode

The `enhancement_mode` parameter allows lawyers to optionally enable query rewriting:

- **`off`**: No rewriting (default for lawyers)
- **`mapping`**: Add related law names using dictionary (fast, free)
- **`full`**: Full rewriting with LLM + dictionary (2-3s latency)

**Example Request**:
```json
{
  "query": "إجراءات الطعن الضريبي",
  "user_role": "lawyer",
  "enhancement_mode": "mapping"
}
```

**Response includes**:
```json
{
  "rewrite_info": {
    "mode_used": "mapping",
    "original_query": "إجراءات الطعن الضريبي",
    "rewritten_query": "إجراءات الطعن الضريبي قانون الضرائب على الدخل رقم 91 لسنة 2005"
  }
}
```
```


#### Update User Guide

**File**: `frontend/docs/USER_GUIDE.md`

**Add section**:
```markdown
## خيارات البحث المتقدمة للمحامين

### ما هو وضع تحسين الاستعلام؟

عند اختيار "محامي"، يمكنك التحكم في كيفية معالجة استعلامك:

#### إيقاف التحسين (الوضع الافتراضي)
- **متى تستخدمه**: عندما تكون متمكناً من المجال القانوني
- **ما يحدث**: يُرسل استعلامك كما هو بدون تعديل
- **مثال**: "شروط المادة 336 من قانون العقوبات" → لا تغيير

#### إضافة القوانين فقط (سريع)
- **متى تستخدمه**: عند البحث في مجال قانوني جديد
- **ما يحدث**: يضيف أسماء القوانين ذات الصلة تلقائياً
- **مثال**: "إجراءات الطعن الضريبي" → "إجراءات الطعن الضريبي + قانون الضرائب رقم 91"
- **السرعة**: فوري (<1 ملي ثانية)

#### تحسين كامل (للاستفسارات العامية)
- **متى تستخدمه**: عند معالجة استفسارات العملاء العامية
- **ما يحدث**: يعيد صياغة الاستعلام بلغة قانونية دقيقة ويضيف القوانين
- **مثال**: "عايز اعرف عن الطلاق" → "ما هي إجراءات الطلاق؟ + قانون الاحوال الشخصية"
- **السرعة**: 2-3 ثوانٍ

### كيفية اختيار الوضع المناسب؟

| سيناريو | الوضع المناسب |
|---------|---------------|
| أنا متخصص في هذا المجال | إيقاف التحسين |
| أبحث في مجال قانوني جديد | إضافة القوانين |
| استفسار عميل بلغة عامية | تحسين كامل |
| استعلام غير واضح | تحسين كامل |
```

---

### Phase 12: Monitoring & Analytics

**Add logging**:
```typescript
// In query-rewrite.service.ts
console.log(
  `[QueryRewrite] mode=${effectiveMode}, ` +
  `role=${userRole}, ` +
  `explicitMode=${enhancementMode !== undefined}, ` +
  `usedLlm=${result.usedLlm}, ` +
  `usedMapping=${result.usedMapping}`
);
```

**Track metrics**:
- Percentage of lawyers using each mode
- Mode distribution over time
- Performance impact of each mode
- Fallback rate (full → mapping due to errors)

**Dashboard queries** (if using analytics):
```sql
-- Mode usage by role
SELECT 
  user_role,
  enhancement_mode,
  COUNT(*) as query_count,
  AVG(latency_ms) as avg_latency
FROM query_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_role, enhancement_mode;

-- Lawyer mode preferences
SELECT 
  enhancement_mode,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM query_logs
WHERE user_role = 'lawyer'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY enhancement_mode;
```


---

## Rollout Strategy

### Phase 1: Internal Testing (Week 1)
- Deploy to staging environment
- Test all three modes manually
- Verify backward compatibility
- Check performance metrics

### Phase 2: Beta Release (Week 2)
- Enable for 10% of lawyer users (feature flag)
- Monitor error rates and user feedback
- Track mode selection preferences
- Fix any bugs discovered

### Phase 3: Full Release (Week 3)
- Roll out to all users
- Announce feature in user documentation
- Monitor adoption rate
- Collect user feedback

---

## Success Metrics

### Quantitative Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Lawyer adoption rate | >30% | % of lawyers using mapping/full |
| Mode selection accuracy | >80% | User satisfaction surveys |
| Mapping mode performance | <5ms | Average latency logs |
| Full mode fallback rate | <5% | Error logs |
| API error rate | <0.1% | HTTP 4xx/5xx responses |

### Qualitative Metrics

- User feedback on UI clarity
- Lawyer satisfaction with new options
- Reduction in "no results" complaints from lawyers exploring new fields

---

## Risk Assessment & Mitigation

### Risk 1: Performance Degradation
**Probability**: Low  
**Impact**: Medium  
**Mitigation**: 
- Mode resolution is O(1) constant time
- No additional DB queries
- Mapping mode is <5ms by design

### Risk 2: User Confusion
**Probability**: Medium  
**Impact**: Medium  
**Mitigation**:
- Clear Arabic labels with examples
- Default behavior unchanged (opt-in)
- Documentation and tooltips

### Risk 3: LLM Cost Increase
**Probability**: Low  
**Impact**: Low  
**Mitigation**:
- Most lawyers will use "mapping" (free) not "full"
- Cost per query is ~$0.000005 (negligible)
- Can disable via `ENABLE_LLM_REWRITE=false`

### Risk 4: API Breaking Changes
**Probability**: None  
**Impact**: Critical  
**Mitigation**:
- `enhancement_mode` is optional
- Existing clients continue working
- Backward compatible by design


---

## Implementation Timeline

### Total Estimated Time: **3-4 hours**

| Phase | Task | Time | Owner |
|-------|------|------|-------|
| 1 | Backend types | 5 min | Backend dev |
| 2 | Service logic | 30 min | Backend dev |
| 3 | API route update | 15 min | Backend dev |
| 4 | Backend testing | 30 min | Backend dev |
| 5 | Frontend types | 5 min | Frontend dev |
| 6 | State management | 10 min | Frontend dev |
| 7 | UI component | 45 min | Frontend dev |
| 8 | Integration | 20 min | Frontend dev |
| 9 | Optional UI (rewrite info) | 15 min | Frontend dev |
| 10 | Frontend testing | 20 min | Frontend dev |
| 11 | Documentation | 20 min | Tech writer |
| 12 | Code review | 30 min | Team lead |
| **Total** | | **3h 45min** | |

### Suggested Sprint Plan

**Day 1 (Morning)**:
- Backend implementation (phases 1-3)
- Backend unit tests

**Day 1 (Afternoon)**:
- Frontend implementation (phases 4-7)
- Frontend component tests

**Day 2 (Morning)**:
- Integration testing
- Bug fixes

**Day 2 (Afternoon)**:
- Documentation
- Code review
- Deployment to staging

---

## Code Review Checklist

### Backend
- [ ] Types are exported correctly
- [ ] Mode precedence logic is correct
- [ ] Backward compatibility maintained
- [ ] Error handling for all modes
- [ ] Fallback behavior works (full → mapping)
- [ ] Logging includes mode information
- [ ] Unit tests cover all modes
- [ ] API schema validates mode values

### Frontend
- [ ] Component only renders for lawyers
- [ ] Mode selection persists to localStorage
- [ ] API call includes enhancement_mode
- [ ] Clear Arabic labels
- [ ] Responsive design (mobile friendly)
- [ ] Accessibility (keyboard navigation)
- [ ] Component tests pass
- [ ] No console errors

### Documentation
- [ ] API docs updated
- [ ] User guide includes new feature
- [ ] Code comments added
- [ ] README updated (if needed)


---

## Future Enhancements

### Phase 2 Features (Future)

#### 1. Auto-Detection Mode
Automatically choose mode based on query characteristics:

```typescript
function autoDetectMode(query: string, userRole: string): QueryEnhancementMode {
  if (userRole === "citizen") return "full";
  
  // For lawyers, analyze query
  const hasColloquial = /عايز|عاوز|ازاي|ايه/.test(query);
  const hasArticleRef = /المادة\s*\d+/.test(query);
  const hasLawName = /قانون|لائحة|مرسوم/.test(query);
  
  if (hasArticleRef || hasLawName) return "off";
  if (hasColloquial) return "full";
  return "mapping";
}
```

**Benefit**: Users don't need to think about which mode to use

#### 2. Smart Suggestions
Show recommendations based on query analysis:

```tsx
{query.includes("عايز") && enhancementMode === "off" && (
  <div className="suggestion">
    💡 نصيحة: قد يساعد "التحسين الكامل" في تحسين نتائج هذا الاستعلام
    <button onClick={() => setMode("full")}>تطبيق</button>
  </div>
)}
```

#### 3. A/B Testing Framework
Test which mode produces better results:

```typescript
// Randomly assign users to control/test groups
const assignGroup = () => {
  const userId = localStorage.getItem("userId");
  const group = hashUserId(userId) % 2 === 0 ? "control" : "test";
  
  if (group === "test") {
    setDefaultMode("mapping");  // Test enabling mapping by default
  }
};
```

#### 4. Query History Analysis
Show user their mode usage stats:

```tsx
<div className="usage-stats">
  <h4>إحصائيات الاستخدام (آخر 30 يوم)</h4>
  <ul>
    <li>إيقاف: {stats.off} استعلام</li>
    <li>سريع: {stats.mapping} استعلام</li>
    <li>كامل: {stats.full} استعلام</li>
  </ul>
</div>
```

---

## Appendix

### A. Mode Comparison Table

| Feature | Off | Mapping | Full |
|---------|-----|---------|------|
| **Speed** | Instant | <5ms | 2-3s |
| **Cost** | Free | Free | ~$0.000005 |
| **Cleans colloquial** | ❌ | ❌ | ✅ |
| **Adds law names** | ❌ | ✅ | ✅ |
| **Changes query** | ❌ | Minor | Major |
| **Best for** | Experts | Exploring | Colloquial |

### B. Example Query Transformations

#### Mode: Off
```
Input:  "شروط المادة 336 من قانون العقوبات"
Output: "شروط المادة 336 من قانون العقوبات"  ← unchanged
```

#### Mode: Mapping
```
Input:  "إجراءات الطعن الضريبي"
Output: "إجراءات الطعن الضريبي قانون الضرائب على الدخل رقم 91 لسنة 2005"
```

#### Mode: Full
```
Input:  "عايز اعرف عن الطلاق"
Output: "ما هي إجراءات الطلاق وشروطه؟ قانون الاحوال الشخصية"
```

### C. Arabic UI Text Reference

| English | Arabic | Notes |
|---------|--------|-------|
| Query Enhancement Mode | وضع تحسين الاستعلام | Main heading |
| Turn off enhancement | إيقاف التحسين | Mode: off |
| Add laws only | إضافة القوانين فقط | Mode: mapping |
| Full enhancement | تحسين كامل | Mode: full |
| Fast, free | سريع، مجاني | Mapping benefit |
| Takes 2-3 seconds | يستغرق 2-3 ثوانٍ | Full mode note |
| Advanced search options | خيارات البحث المتقدمة | Settings panel |
| For exploring new fields | للبحث في مجال جديد | Use case |
| For colloquial queries | للاستفسارات العامية | Use case |
| Use query as-is | استخدم استعلامي كما هو | Off mode desc |

---

## Conclusion

This implementation plan provides a comprehensive, user-friendly solution for lawyers who need assistance when exploring unfamiliar legal fields, while maintaining the current expert-friendly passthrough behavior as the default.

**Key Benefits**:
- ✅ **Non-disruptive**: Default behavior unchanged
- ✅ **Cost-effective**: "mapping" mode has no LLM cost
- ✅ **Fast**: Mapping completes in <5ms
- ✅ **Flexible**: Three clear options for different needs
- ✅ **Transparent**: Users see how their query was enhanced
- ✅ **Persistent**: Preferences saved across sessions

**Estimated Impact**:
- 30-40% of lawyers will enable "mapping" mode
- 5-10% will use "full" mode for client queries
- Improved search results in cross-domain queries
- Minimal performance or cost impact

---

**Document Version**: 1.0  
**Author**: AI Assistant  
**Date**: 2026-07-12  
**Status**: Ready for Implementation
