# API Integration Layer Specification

**Component:** API Integration Layer
**Location:** `/src/lib/services/external`
**Dependencies:** Types
**Status:** Planning

---

## Overview

Wraps external APIs (RxNorm, FDA NDC Directory) with error handling, retry logic, and optional caching. Transforms raw API responses into our typed structures.

**Core Responsibilities:**
- Normalize drug names to RxCUI via RxNorm API
- Fetch NDC package data via FDA NDC Directory API
- Handle rate limits, timeouts, and errors
- Cache responses to minimize API calls
- Transform external formats to internal types

**Key Principles:**
- All functions return `Result<T, ExternalAPIError>`
- Retry transient failures with exponential backoff
- Validate responses with Zod schemas
- Log all API calls for debugging
- Respect rate limits

---

## Module Structure

```
src/lib/services/external/
├── index.ts           # Barrel export
├── rxnorm.ts          # RxNorm API client
├── fdaNdc.ts          # FDA NDC Directory API client
├── cache.ts           # Optional in-memory cache
└── http.ts            # Shared HTTP utilities (retry, timeout)
```

---

## Components

### 1. HTTP Utilities (`http.ts`)

**Purpose:** Shared utilities for HTTP requests with retry and timeout logic.

**Key Functions:**
- `fetchWithRetry(url, options)` - Fetch with exponential backoff
- `isRetryableError(error)` - Determine if error should be retried
- `sleep(ms)` - Async sleep helper

**Configuration:**
- Max retries: 3
- Timeout: 10s per request
- Backoff: 1s, 2s, 4s

**Retryable Errors:**
- Network errors (ECONNRESET, ETIMEDOUT)
- HTTP 429 (rate limit)
- HTTP 503 (service unavailable)
- HTTP 504 (gateway timeout)

---

### 2. RxNorm Service (`rxnorm.ts`)

**Purpose:** Drug normalization using RxNorm API.

**Base URL:** `https://rxnav.nlm.nih.gov/REST`

#### Function: `normalizeToRxCUI(drugName: string): Promise<Result<RxNormConcept, ExternalAPIError>>`

**Endpoint:** `/rxcui.json?name={drugName}`

**Flow:**
1. Try exact match first
2. If no match, try approximate match (`/approximateTerm.json`)
3. Return best match with RxCUI

**Response Transformation:**
- Extract RxCUI from nested response structure
- Map to `RxNormConcept` type
- Include name and term type (tty)

**Error Cases:**
- No results found → `DrugNormalizationError`
- API failure → `ExternalAPIError`
- Invalid response → `ExternalAPIError`

**Example Response:**
```json
{
  "idGroup": {
    "rxnormId": ["314076"]
  }
}
```

#### Function: `getRxNormDetails(rxcui: string): Promise<Result<RxNormConcept, ExternalAPIError>>`

**Endpoint:** `/rxcui/{rxcui}/properties.json`

**Purpose:** Get detailed information about a specific RxCUI.

---

### 3. FDA NDC Service (`fdaNdc.ts`)

**Purpose:** Fetch NDC package data from FDA NDC Directory.

**Base URL:** `https://api.fda.gov/drug/ndc.json`

**API Key:** Not required (public API), but can use for higher rate limits

#### Function: `searchNDCsByDrug(drugName: string, limit?: number): Promise<Result<NDCPackage[], ExternalAPIError>>`

**Endpoint:** `/drug/ndc.json?search=generic_name:{drugName}+brand_name:{drugName}&limit={limit}`

**Query Parameters:**
- `search` - Search by generic or brand name
- `limit` - Max results (default: 100)

**Response Transformation:**
- Parse `results[]` array
- Extract package NDCs from nested `packaging[]`
- Normalize NDC to 11-digit format (5-4-2)
- Map to `NDCPackage[]` type
- Filter out invalid/incomplete data

**Fields Mapped:**
```
product_ndc → ndc (normalized to 11 digits)
packaging[].package_ndc → package NDCs
packaging[].description → parse packageSize
dosage_form → dosageForm (normalized to enum)
active_ingredients[0].strength → strength
labeler_name → manufacturer
brand_name → brandName
generic_name → genericName
marketing_start_date → marketingStartDate
marketing_end_date → marketingEndDate (determines status)
```

**Status Determination:**
- If `marketing_end_date` exists → 'inactive'
- Else → 'active'

#### Function: `getNDCDetails(ndc: string): Promise<Result<NDCPackage, ExternalAPIError>>`

**Endpoint:** `/drug/ndc.json?search=package_ndc:{ndc}`

**Purpose:** Get detailed information about a specific NDC.

**NDC Normalization:**
- Input formats: 5-4-2, 4-4-2, 5-3-2
- Output format: 11 digits (no dashes)
- Example: "0069-2587-41" → "00069258741"

#### Function: `validateNDCFormat(ndc: string): boolean`

**Purpose:** Validate NDC format before API calls.

---

### 4. Cache (`cache.ts`)

**Purpose:** Optional in-memory cache to reduce API calls during development/testing.

**Implementation:**
- Simple Map-based cache
- TTL: 15 minutes (900s)
- Max size: 1000 entries
- LRU eviction when full

**Key Functions:**
- `get(key: string): T | undefined`
- `set(key: string, value: T, ttl?: number): void`
- `has(key: string): boolean`
- `clear(): void`

**Cache Keys:**
- RxNorm: `rxnorm:drug:{drugName}`
- FDA NDC: `fda:ndc:{ndc}`, `fda:drug:{drugName}`

**Configuration:**
- Enable via env var: `ENABLE_API_CACHE=true`
- Configurable TTL: `API_CACHE_TTL_MS=900000`

---

## Error Handling

All functions return `Result<T, ExternalAPIError>`:

```typescript
// Success
return ok(ndcPackages);

// Failure
return err(new ExternalAPIError('RxNorm API', originalError));
```

**Error Scenarios:**
- Network failure → retry 3 times, then return error
- Rate limit (429) → retry with backoff
- Not found (404) → return specific error (DrugNormalizationError, NDCNotFoundError)
- Invalid response → return ExternalAPIError with details
- Timeout → retry, then return error

---

## Configuration

**Environment Variables:**
```bash
# API Endpoints
RXNORM_API_URL=https://rxnav.nlm.nih.gov/REST
FDA_NDC_API_URL=https://api.fda.gov/drug/ndc.json

# Optional FDA API Key (for higher rate limits)
FDA_API_KEY=

# HTTP Configuration
API_TIMEOUT_MS=10000
API_MAX_RETRIES=3

# Cache Configuration
ENABLE_API_CACHE=true
API_CACHE_TTL_MS=900000
```

**Constants:**
```typescript
const API_CONFIG = {
  timeout: parseInt(process.env.API_TIMEOUT_MS || '10000'),
  maxRetries: parseInt(process.env.API_MAX_RETRIES || '3'),
  cacheEnabled: process.env.ENABLE_API_CACHE === 'true',
  cacheTTL: parseInt(process.env.API_CACHE_TTL_MS || '900000')
} as const;
```

---

## Response Validation

Use Zod schemas to validate API responses:

```typescript
// Validate FDA response
const validation = FDANDCResponseSchema.safeParse(data);
if (!validation.success) {
  return err(new ExternalAPIError('FDA NDC', 'Invalid response format'));
}
```

**Key Validations:**
- Required fields present
- NDC format valid
- Dosage form matches enum
- Package size is positive number

---

## Rate Limiting

**RxNorm API:**
- No published rate limit
- No API key required
- Respectful delays between requests

**FDA NDC API:**
- 240 requests per minute (without API key)
- 1000 requests per minute (with API key)
- Returns 429 status when limit exceeded
- Retry with exponential backoff

---

## Testing Strategy

### Unit Tests
- Mock API responses
- Test error handling paths
- Test retry logic
- Test NDC normalization
- Test response transformation

### Integration Tests
- Real API calls (with rate limiting)
- Test common drug names
- Test edge cases (inactive NDCs, missing data)
- Verify response structure matches types

### Test Cases
**RxNorm:**
- "Lisinopril" → should return RxCUI
- "Tylenol" → should handle brand name
- "XYZABC123" → should return error (not found)

**FDA NDC:**
- Search "Lisinopril" → should return multiple NDC packages
- Get NDC "00069258741" → should return package details
- Invalid NDC → should return error

---

## Implementation Checklist

- [ ] Create directory structure (`src/lib/services/external/`)
- [ ] Implement HTTP utilities with retry logic
- [ ] Implement RxNorm service (normalize, get details)
- [ ] Implement FDA NDC service (search, get details, validate format)
- [ ] Implement optional cache layer
- [ ] Create barrel export in index.ts
- [ ] Add API configuration to .env.example
- [ ] Write unit tests for all functions
- [ ] Write integration tests with real APIs
- [ ] Verify TypeScript compilation
- [ ] Test with common drug names

---

## Dependencies

```json
{
  "zod": "^3.22.0"
}
```

**Note:** Uses native `fetch` (Node 18+, available in SvelteKit)

---

## Success Criteria

✅ Successfully normalize common drug names to RxCUI
✅ Fetch NDC packages from FDA for common drugs
✅ Handle errors gracefully with retry logic
✅ All functions return Result types
✅ Response validation with Zod schemas
✅ Cache reduces redundant API calls
✅ TypeScript compiles with no errors
✅ Integration tests pass with real APIs
