# API Routes Specification

**Component:** API Routes
**Location:** `/src/routes/api`
**Dependencies:** Calculation Engine, Types
**Status:** Planning

---

## Overview

SvelteKit API routes that expose the Calculation Engine to the frontend. Handles HTTP requests, validation, error handling, and response formatting.

**Core Responsibilities:**
- Accept prescription input via HTTP POST
- Validate request body
- Call Calculation Engine
- Format responses (success/error)
- Handle errors with appropriate HTTP status codes
- Provide health check endpoint

**Key Principles:**
- RESTful API design
- Validate all inputs
- Return consistent JSON responses
- Use appropriate HTTP status codes
- Log all requests/errors

---

## Route Structure

```
src/routes/api/
├── calculate/
│   └── +server.ts        # POST /api/calculate - main endpoint
└── health/
    └── +server.ts        # GET /api/health - health check
```

---

## Endpoints

### 1. Calculate Prescription - `POST /api/calculate`

**Purpose:** Process a prescription and return calculation results.

**Request:**
```typescript
{
  "drugName": string,
  "ndc"?: string,         // optional
  "sig": string,
  "daysSupply": number
}
```

**Response (Success - 200):**
```typescript
{
  "success": true,
  "data": {
    "parsedSIG": ParsedSIG,
    "totalQuantityNeeded": number,
    "unit": MedicationUnit,
    "selectedPackages": SelectedPackage[],
    "totalUnitsDispensed": number,
    "fillDifference": number,
    "reasoning": string,
    "warnings": Warning[],
    "rxcui"?: string,
    "availableNDCs"?: NDCPackage[]
  },
  "timestamp": string
}
```

**Response (Error - 4xx/5xx):**
```typescript
{
  "success": false,
  "error": {
    "code": string,
    "message": string,
    "statusCode": number
  },
  "timestamp": string
}
```

**HTTP Status Codes:**
- `200 OK` - Successful calculation
- `400 Bad Request` - Invalid input (ValidationError, InvalidSIGError)
- `404 Not Found` - Drug/NDC not found (NDCNotFoundError, DrugNormalizationError)
- `500 Internal Server Error` - Server error (AIServiceError, ExternalAPIError)
- `503 Service Unavailable` - External API unavailable

**Implementation:**

```typescript
export async function POST({ request }: RequestEvent) {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = PrescriptionInputSchema.safeParse(body);
    if (!validation.success) {
      return json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.errors[0].message,
            statusCode: 400
          },
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Call calculation engine
    const result = await calculatePrescription(validation.data);

    if (!result.success) {
      // Map error to HTTP status
      const statusCode = result.error.statusCode || 500;
      return json(
        {
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
            statusCode
          },
          timestamp: new Date().toISOString()
        },
        { status: statusCode }
      );
    }

    // Success response
    const duration = Date.now() - startTime;
    console.log(`[API] Calculate success in ${duration}ms`);

    return json(
      {
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error: any) {
    // Unexpected error
    console.error('[API] Calculate error:', error);
    return json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          statusCode: 500
        },
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
```

---

### 2. Health Check - `GET /api/health`

**Purpose:** Check if the API is running and ready to accept requests.

**Request:** None (GET request)

**Response (Success - 200):**
```typescript
{
  "status": "healthy",
  "timestamp": string,
  "version": string,
  "services": {
    "openai": "configured" | "not_configured",
    "cache": "enabled" | "disabled"
  }
}
```

**Implementation:**

```typescript
export async function GET() {
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
      cache: process.env.ENABLE_API_CACHE === 'true' ? 'enabled' : 'disabled'
    }
  });
}
```

---

## Error Handling

**Error Mapping:**

| Error Type | HTTP Status | Code |
|------------|-------------|------|
| ValidationError | 400 | VALIDATION_ERROR |
| InvalidSIGError | 400 | INVALID_SIG |
| InactiveNDCError | 400 | NDC_INACTIVE |
| NDCNotFoundError | 404 | NDC_NOT_FOUND |
| DrugNormalizationError | 404 | DRUG_NORMALIZATION_FAILED |
| AIServiceError | 500 | AI_SERVICE_ERROR |
| ExternalAPIError | 503 | EXTERNAL_API_ERROR |

**Consistent Error Format:**
```typescript
{
  success: false,
  error: {
    code: string,      // Machine-readable error code
    message: string,   // Human-readable error message
    statusCode: number // HTTP status code
  },
  timestamp: string
}
```

---

## Logging

**Request Logging:**
```typescript
console.log('[API] POST /api/calculate', {
  drugName: input.drugName,
  daysSupply: input.daysSupply
});
```

**Success Logging:**
```typescript
console.log('[API] Calculate success', {
  drugName: input.drugName,
  duration: `${duration}ms`,
  quantityNeeded: result.totalQuantityNeeded,
  packagesSelected: result.selectedPackages.length
});
```

**Error Logging:**
```typescript
console.error('[API] Calculate error', {
  drugName: input.drugName,
  error: error.code,
  message: error.message
});
```

---

## Security Considerations

**Input Validation:**
- Validate all inputs with Zod schemas
- Sanitize user input (drug names, SIG)
- Limit request body size (max 1MB)
- Rate limiting (optional - via middleware)

**CORS:**
- Configure CORS headers if frontend is on different domain
- In production, restrict to specific origins

**API Keys:**
- No authentication required for demo
- In production, consider API keys or auth tokens

**Secrets:**
- Never expose API keys in responses
- Log safely (don't log sensitive data)

---

## Response Format

**Success Response Structure:**
```typescript
interface APISuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}
```

**Error Response Structure:**
```typescript
interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
  timestamp: string;
}
```

---

## Testing Strategy

### Unit Tests
- Test error handling
- Test input validation
- Mock Calculation Engine

### Integration Tests
- Test full flow with real services
- Test error scenarios
- Test edge cases

### Example Test Cases
```typescript
// Valid request
POST /api/calculate
{
  "drugName": "Lisinopril",
  "sig": "Take 1 tablet by mouth once daily",
  "daysSupply": 30
}
// Expected: 200 OK with CalculationResult

// Invalid input
POST /api/calculate
{
  "drugName": "",
  "sig": "Take 1 tablet",
  "daysSupply": -5
}
// Expected: 400 Bad Request with validation errors

// Drug not found
POST /api/calculate
{
  "drugName": "XYZABC123NotARealDrug",
  "sig": "Take 1 tablet once daily",
  "daysSupply": 30
}
// Expected: 404 Not Found

// Health check
GET /api/health
// Expected: 200 OK with status
```

---

## Implementation Checklist

- [ ] Create API route directory structure
- [ ] Implement POST /api/calculate endpoint
- [ ] Implement GET /api/health endpoint
- [ ] Add request/response logging
- [ ] Map all error types to HTTP status codes
- [ ] Add input validation
- [ ] Test with various inputs (success/error cases)
- [ ] Verify TypeScript compilation
- [ ] Test with frontend (once built)

---

## Dependencies

No additional dependencies needed - uses SvelteKit's built-in API routes.

---

## Success Criteria

✅ POST /api/calculate returns correct CalculationResult
✅ All error types mapped to appropriate HTTP status codes
✅ Consistent JSON response format
✅ Input validation with clear error messages
✅ Health check endpoint works
✅ Logging provides useful debugging information
✅ TypeScript compiles with no errors
✅ Integration tests pass
