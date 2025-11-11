# AI Service Layer Specification

**Component:** AI Service Layer
**Location:** `/src/lib/services/ai`
**Dependencies:** Types, OpenAI API
**Status:** Planning

---

## Overview

The AI Service Layer handles all LLM interactions using OpenAI's API. This is the intelligence layer that parses natural language SIG instructions, selects optimal NDC packages, and provides human-readable reasoning.

**Core Responsibilities:**
- Parse natural language SIG into structured data
- Select optimal NDC packages from available options
- Provide contextual error guidance and suggestions
- Generate human-readable explanations for all decisions

**Key Principles:**
- All AI calls return `Result<T, AIServiceError>`
- Always include reasoning/explanation in outputs
- Use structured JSON output mode for reliability
- Implement retry logic with exponential backoff
- Log all prompts and responses for debugging

---

## Module Structure

```
src/lib/services/ai/
├── index.ts           # Barrel export
├── sigParser.ts       # SIG parsing with OpenAI
├── ndcSelector.ts     # AI-powered NDC selection
├── errorAdvisor.ts    # Contextual error guidance
├── prompts.ts         # System prompts and templates
└── openai.ts          # OpenAI client wrapper
```

---

## Components

### 1. OpenAI Client (`openai.ts`)

**Purpose:** Centralized OpenAI API client with error handling and retry logic.

**Key Functions:**
- `createClient()` - Initialize OpenAI client with API key
- `chatCompletion<T>(messages, schema?)` - Generic completion with optional JSON schema
- `retryWithBackoff()` - Retry failed requests with exponential backoff

**Configuration:**
- Model: `gpt-4o` (or configurable via env)
- Temperature: `0.1` (low for consistency)
- Max tokens: `1500` for SIG parsing, `1000` for selection
- Timeout: `30s` with 3 retries

**Error Handling:**
- Catch rate limits → retry with backoff
- Catch invalid API key → throw AIServiceError immediately
- Catch timeout → retry up to 3 times
- Catch JSON parse errors → return error with raw response

---

### 2. SIG Parser (`sigParser.ts`)

**Purpose:** Parse natural language prescription instructions into structured `ParsedSIG`.

#### Function: `parseSIG(sig: string, daysSupply: number): Promise<Result<ParsedSIG, AIServiceError>>`

**Input:**
- `sig` - Natural language instruction (e.g., "Take 1 tablet by mouth twice daily")
- `daysSupply` - Number of days (used to infer duration if not in SIG)

**Output:**
- `Result<ParsedSIG, AIServiceError>`
- Includes: dose, unit, frequency, duration, route, confidence, reasoning

**Prompt Strategy:**
```
System: Expert pharmacist parsing prescription SIG instructions
Task: Extract structured data from natural language
Output: JSON matching ParsedSIG schema
Include: confidence score (0-1) and reasoning for parsing decisions
Handle: Ambiguity (flag with lower confidence), missing info, complex schedules
```

**Edge Cases to Handle:**
- Variable dosing ("1-2 tablets", "10-15 units")
- PRN/"as needed" instructions
- Complex schedules ("2 in morning, 1 at bedtime")
- Time-based ("every 4-6 hours")
- Missing duration (infer from daysSupply if reasonable)
- Ambiguous units (assume from context or request clarification)

**Examples to Include in Prompt:**
- "Take 1 tablet by mouth twice daily" → dose: 1, frequency: times_per_day(2)
- "Inject 10 units before meals and 15 at bedtime" → complex specific_times pattern
- "Take 1-2 tablets every 4-6 hours as needed" → as_needed with range

**Validation:**
- Validate output against `ParsedSIGSchema`
- If confidence < 0.6, include warning
- If critical fields missing, return error

---

### 3. NDC Selector (`ndcSelector.ts`)

**Purpose:** Select optimal NDC package(s) from available options using AI reasoning.

#### Function: `selectOptimalNDCs(options: SelectionInput): Promise<Result<SelectionOutput, AIServiceError>>`

**Input (SelectionInput):**
```typescript
{
  availableNDCs: NDCPackage[];      // All valid NDCs from FDA
  quantityNeeded: number;            // Total units needed
  unit: MedicationUnit;              // Expected unit type
  parsedSIG: ParsedSIG;             // Context about prescription
  daysSupply: number;                // Days supply
}
```

**Output (SelectionOutput):**
```typescript
{
  selectedPackages: SelectedPackage[];  // Chosen packages with quantities
  reasoning: string;                     // Natural language explanation
  warnings: Warning[];                   // Any issues detected
}
```

**Prompt Strategy:**
```
System: Expert pharmacist selecting optimal medication packages
Context: Provide all available NDCs with package sizes, quantity needed
Task: Select package(s) that best fulfill prescription
Optimize for: Minimal waste, fewest packages, avoid inactive NDCs
Output: JSON with selected packages, quantities, and reasoning
```

**Selection Criteria (in priority order):**
1. **Only active NDCs** - filter out inactive/discontinued
2. **Matching dosage form** - prefer matching SIG's implied form
3. **Minimize waste** - closest to needed quantity without underfilling
4. **Fewest packages** - prefer larger packages over many small ones
5. **Common package sizes** - prefer standard sizes (30, 60, 90 day supplies)

**Multi-Pack Logic:**
- Try single package first
- If no good match, combine 2 packages
- Prefer combinations that minimize waste
- Flag significant overfill (>10%) as warning

**Warnings to Generate:**
- Inactive NDC detected
- Dosage form mismatch (e.g., capsule vs tablet)
- Overfill > 10%
- Only underfill options available
- Missing package size data

---

### 4. Error Advisor (`errorAdvisor.ts`)

**Purpose:** Provide contextual, helpful guidance when errors occur.

#### Function: `adviseOnError(error: NightingaleError, context: ErrorContext): Promise<Result<Advice, AIServiceError>>`

**Input (ErrorContext):**
```typescript
{
  originalInput: PrescriptionInput;
  errorType: string;                // Error code
  errorMessage: string;
  partialData?: any;                // Any data collected before error
}
```

**Output (Advice):**
```typescript
{
  explanation: string;              // What went wrong in plain language
  suggestions: string[];            // Actionable next steps
  alternatives?: any;               // Alternative options if available
}
```

**Use Cases:**
- **NDC not found** → suggest checking spelling, provide similar drug names
- **Inactive NDC** → suggest active alternatives from same manufacturer
- **SIG parse failure** → highlight ambiguous parts, suggest clearer wording
- **No matching packages** → explain why, suggest alternative quantities

**Prompt Strategy:**
```
System: Helpful pharmacy assistant explaining errors to pharmacists
Context: Provide error details and what user was trying to do
Task: Explain problem clearly and suggest specific solutions
Tone: Professional, helpful, concise
```

---

### 5. Prompts (`prompts.ts`)

**Purpose:** Centralized prompt templates and system messages.

**Structure:**
```typescript
export const SYSTEM_PROMPTS = {
  sigParser: "...",
  ndcSelector: "...",
  errorAdvisor: "..."
};

export const EXAMPLES = {
  sigParsing: [...],
  ndcSelection: [...]
};

export function buildSIGPrompt(sig: string, daysSupply: number): OpenAIMessage[];
export function buildSelectionPrompt(input: SelectionInput): OpenAIMessage[];
export function buildErrorPrompt(context: ErrorContext): OpenAIMessage[];
```

**Prompt Engineering Best Practices:**
- Use few-shot examples (3-5 per task)
- Request JSON output with specific schema
- Ask for reasoning/explanation
- Provide domain context (pharmacy terminology)
- Include edge cases in examples

---

## Error Handling

All AI functions return `Result<T, AIServiceError>`:

```typescript
// Success case
return ok(parsedSIG);

// Failure cases
return err(new AIServiceError('SIG Parser', 'OpenAI rate limit exceeded'));
return err(new AIServiceError('NDC Selector', 'Invalid JSON response from LLM'));
```

**Specific Error Scenarios:**
- OpenAI API key missing/invalid → immediate error
- Rate limit hit → retry with backoff (3 attempts)
- Timeout → retry with backoff
- Invalid JSON → log raw response, return error
- Schema validation failure → return error with details

---

## Configuration

**Environment Variables:**
```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o              # Default model
OPENAI_TEMPERATURE=0.1            # Low for consistency
OPENAI_MAX_TOKENS=1500
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_RETRIES=3
```

**Constants:**
```typescript
const AI_CONFIG = {
  model: process.env.OPENAI_MODEL || 'gpt-4o',
  temperature: 0.1,
  maxTokens: {
    sigParser: 1500,
    ndcSelector: 1000,
    errorAdvisor: 800
  },
  timeout: 30000,
  retries: 3
} as const;
```

---

## Testing Strategy

### Unit Tests
- Mock OpenAI responses
- Test prompt building functions
- Validate schema parsing
- Test error handling paths

### Integration Tests
- Real OpenAI API calls (using test key)
- Test common SIG patterns (20+ examples)
- Test edge cases (ambiguous, complex, invalid)
- Verify JSON schema compliance

### Test Cases for SIG Parser
- Simple: "Take 1 tablet twice daily"
- Complex: "Take 2 tablets in morning and 1 at bedtime"
- Insulin: "Inject 10 units before meals and 15 units at bedtime"
- PRN: "Take 1-2 tablets every 4-6 hours as needed for pain"
- Ambiguous: "Take as directed" (should flag low confidence)

---

## Implementation Checklist

- [ ] Set up OpenAI client with retry logic
- [ ] Implement SIG parser with prompt and schema
- [ ] Implement NDC selector with optimization logic
- [ ] Implement error advisor
- [ ] Create prompt templates and examples
- [ ] Add comprehensive error handling
- [ ] Write unit tests for all functions
- [ ] Write integration tests with real API
- [ ] Add logging for prompt/response debugging
- [ ] Document AI limitations and edge cases

---

## Dependencies

```json
{
  "openai": "^4.0.0",
  "zod": "^3.22.0"
}
```

---

## Success Criteria

✅ SIG parser handles 90%+ of common patterns correctly
✅ Confidence scores accurately reflect parsing certainty
✅ NDC selection minimizes waste and follows optimization rules
✅ All functions return Result types with proper error handling
✅ Reasoning is clear and helpful to pharmacists
✅ Retry logic handles transient OpenAI failures
✅ Average response time < 2 seconds per AI call
✅ All outputs validate against defined schemas
