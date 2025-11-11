# Data Models & Types Specification

**Component:** Data Models & Types Layer
**Location:** `/src/lib/types`
**Dependencies:** None (foundation layer)
**Status:** Planning

---

## 1. Overview

The Data Models & Types layer defines all TypeScript interfaces, types, Zod schemas, and error classes used throughout the Nightingale application. This is the foundation layer that every other component depends on, ensuring type safety and runtime validation across the entire stack.

### Goals
- Provide strong type safety for all data structures
- Enable runtime validation with Zod schemas
- Define clear contracts between components
- Create reusable, composable types
- Establish custom error classes for domain-specific errors

### Principles
- Follow TypeScript best practices from CLAUDE.md
- Use interfaces for object shapes, types for unions/utilities
- Define Zod schemas alongside TypeScript types
- Use discriminated unions for variants
- Never use `any` - prefer `unknown` with type guards

---

## 2. Module Structure

```
src/lib/types/
├── index.ts              # Barrel export for all types
├── prescription.ts       # Prescription input and SIG types
├── ndc.ts               # NDC package and drug information types
├── calculation.ts       # Calculation results and package selection
├── api.ts               # API request/response types
├── errors.ts            # Custom error classes
└── common.ts            # Shared utility types (Result, etc.)
```

---

## 3. Core Type Definitions

### 3.1 Common Types (`common.ts`)

#### Result Type (Discriminated Union)
For type-safe error handling across the application.

```typescript
/**
 * Generic result type for operations that can succeed or fail
 * @template T - The success data type
 * @template E - The error type (defaults to Error)
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Helper to create a successful result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper to create a failed result
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}
```

#### API Response Wrapper
```typescript
/**
 * Standard API response wrapper
 */
export interface APIResponse<T> {
  data?: T;
  error?: string;
  timestamp: string;
}
```

---

### 3.2 Prescription Types (`prescription.ts`)

#### Prescription Input
User-provided prescription information.

```typescript
import { z } from 'zod';

/**
 * Prescription input from user
 */
export interface PrescriptionInput {
  /** Drug name (e.g., "Lisinopril", "Metformin") */
  drugName: string;

  /** Optional specific NDC if known */
  ndc?: string;

  /** Prescription instructions (natural language) */
  sig: string;

  /** Days supply for the prescription */
  daysSupply: number;
}

/**
 * Zod schema for PrescriptionInput with validation
 */
export const PrescriptionInputSchema = z.object({
  drugName: z.string()
    .min(1, 'Drug name is required')
    .max(200, 'Drug name too long'),

  ndc: z.string()
    .regex(/^\d{11}$/, 'NDC must be 11 digits')
    .optional(),

  sig: z.string()
    .min(1, 'SIG is required')
    .max(500, 'SIG too long'),

  daysSupply: z.number()
    .positive('Days supply must be positive')
    .int('Days supply must be a whole number')
    .max(365, 'Days supply cannot exceed 365 days')
});

/**
 * Type inferred from schema (should match PrescriptionInput)
 */
export type PrescriptionInputValidated = z.infer<typeof PrescriptionInputSchema>;
```

#### Parsed SIG
Structured data extracted from natural language SIG by AI.

```typescript
/**
 * Unit of measurement for medication
 */
export const MEDICATION_UNITS = [
  'tablet',
  'capsule',
  'mL',
  'unit', // for insulin
  'mg',
  'g',
  'patch',
  'spray',
  'puff', // for inhalers
  'drop',
  'suppository',
  'application'
] as const;

export type MedicationUnit = typeof MEDICATION_UNITS[number];

/**
 * Route of administration
 */
export const ROUTES = [
  'oral',
  'topical',
  'subcutaneous',
  'intramuscular',
  'intravenous',
  'rectal',
  'ophthalmic',
  'otic',
  'nasal',
  'transdermal',
  'inhalation'
] as const;

export type Route = typeof ROUTES[number];

/**
 * Frequency pattern types
 */
export type FrequencyPattern =
  | { type: 'times_per_day'; value: number } // e.g., "twice daily" = 2
  | { type: 'times_per_period'; value: number; period: 'hour' | 'day' | 'week' } // e.g., "every 4 hours"
  | { type: 'specific_times'; times: string[] } // e.g., ["morning", "evening"]
  | { type: 'as_needed'; maxPerDay?: number }; // PRN

/**
 * Structured SIG data parsed from natural language
 */
export interface ParsedSIG {
  /** Dose amount per administration */
  dose: number;

  /** Unit of measurement */
  unit: MedicationUnit;

  /** Frequency pattern */
  frequency: FrequencyPattern;

  /** Duration in days (if specified in SIG) */
  duration?: number;

  /** Route of administration */
  route?: Route;

  /** Special instructions (e.g., "with food", "at bedtime") */
  specialInstructions?: string[];

  /** AI confidence score (0-1) */
  confidence: number;

  /** Natural language explanation of the parsing */
  reasoning: string;

  /** Original SIG text for reference */
  originalSIG: string;
}

/**
 * Zod schema for ParsedSIG
 */
export const ParsedSIGSchema = z.object({
  dose: z.number().positive(),
  unit: z.enum(MEDICATION_UNITS),
  frequency: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('times_per_day'),
      value: z.number().positive().int()
    }),
    z.object({
      type: z.literal('times_per_period'),
      value: z.number().positive().int(),
      period: z.enum(['hour', 'day', 'week'])
    }),
    z.object({
      type: z.literal('specific_times'),
      times: z.array(z.string()).min(1)
    }),
    z.object({
      type: z.literal('as_needed'),
      maxPerDay: z.number().positive().int().optional()
    })
  ]),
  duration: z.number().positive().int().optional(),
  route: z.enum(ROUTES).optional(),
  specialInstructions: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  originalSIG: z.string()
});
```

---

### 3.3 NDC Types (`ndc.ts`)

#### NDC Package Information
Detailed information about a specific NDC package.

```typescript
import { z } from 'zod';

/**
 * Dosage form types
 */
export const DOSAGE_FORMS = [
  'TABLET',
  'CAPSULE',
  'SOLUTION',
  'SUSPENSION',
  'INJECTION',
  'CREAM',
  'OINTMENT',
  'GEL',
  'PATCH',
  'INHALER',
  'SPRAY',
  'DROPS',
  'SUPPOSITORY'
] as const;

export type DosageForm = typeof DOSAGE_FORMS[number];

/**
 * NDC status
 */
export type NDCStatus = 'active' | 'inactive' | 'discontinued';

/**
 * NDC Package information from FDA
 */
export interface NDCPackage {
  /** 11-digit NDC (normalized format) */
  ndc: string;

  /** Package size (number of units) */
  packageSize: number;

  /** Dosage form */
  dosageForm: DosageForm;

  /** Strength (e.g., "10mg", "5mg/mL") */
  strength: string;

  /** Manufacturer name */
  manufacturer: string;

  /** Active/Inactive/Discontinued */
  status: NDCStatus;

  /** Brand name (if applicable) */
  brandName?: string;

  /** Generic name */
  genericName: string;

  /** Marketing start date (ISO date string) */
  marketingStartDate?: string;

  /** Marketing end date (ISO date string) - present if inactive */
  marketingEndDate?: string;

  /** Package description (e.g., "100 TABLET in 1 BOTTLE") */
  packageDescription?: string;
}

/**
 * Zod schema for NDC Package
 */
export const NDCPackageSchema = z.object({
  ndc: z.string().regex(/^\d{11}$/),
  packageSize: z.number().positive(),
  dosageForm: z.enum(DOSAGE_FORMS),
  strength: z.string(),
  manufacturer: z.string(),
  status: z.enum(['active', 'inactive', 'discontinued']),
  brandName: z.string().optional(),
  genericName: z.string(),
  marketingStartDate: z.string().optional(),
  marketingEndDate: z.string().optional(),
  packageDescription: z.string().optional()
});

/**
 * Type guard for NDCPackage
 */
export function isNDCPackage(value: unknown): value is NDCPackage {
  return NDCPackageSchema.safeParse(value).success;
}

/**
 * RxCUI (RxNorm Concept Unique Identifier)
 */
export interface RxNormConcept {
  /** RxCUI identifier */
  rxcui: string;

  /** Drug name */
  name: string;

  /** Term type (e.g., "SCD", "SBD", "GPCK") */
  tty?: string;
}

/**
 * Zod schema for RxNorm Concept
 */
export const RxNormConceptSchema = z.object({
  rxcui: z.string(),
  name: z.string(),
  tty: z.string().optional()
});
```

---

### 3.4 Calculation Types (`calculation.ts`)

#### Warning Types
Warnings generated during calculation or NDC selection.

```typescript
import { z } from 'zod';

/**
 * Warning severity levels
 */
export type WarningSeverity = 'info' | 'warning' | 'error';

/**
 * Warning type categories
 */
export const WARNING_TYPES = [
  'inactive_ndc',
  'discontinued_ndc',
  'dosage_form_mismatch',
  'overfill',
  'underfill',
  'missing_package_size',
  'ambiguous_sig',
  'low_confidence_parse'
] as const;

export type WarningType = typeof WARNING_TYPES[number];

/**
 * Warning information
 */
export interface Warning {
  /** Warning type */
  type: WarningType;

  /** Severity level */
  severity: WarningSeverity;

  /** Human-readable message */
  message: string;

  /** Additional context or suggestions */
  suggestion?: string;

  /** Related NDC (if applicable) */
  relatedNDC?: string;
}

/**
 * Zod schema for Warning
 */
export const WarningSchema = z.object({
  type: z.enum(WARNING_TYPES),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  suggestion: z.string().optional(),
  relatedNDC: z.string().optional()
});
```

#### Package Selection
Selected packages with justification.

```typescript
/**
 * Selected package with quantity
 */
export interface SelectedPackage {
  /** The NDC package */
  package: NDCPackage;

  /** Quantity of this package to dispense */
  quantity: number;

  /** Total units from this package (packageSize × quantity) */
  totalUnits: number;
}

/**
 * Zod schema for SelectedPackage
 */
export const SelectedPackageSchema = z.object({
  package: NDCPackageSchema,
  quantity: z.number().positive().int(),
  totalUnits: z.number().positive()
});
```

#### Calculation Result
Complete calculation result with AI reasoning.

```typescript
/**
 * Complete calculation result
 */
export interface CalculationResult {
  /** Parsed SIG data */
  parsedSIG: ParsedSIG;

  /** Total quantity needed (in units) */
  totalQuantityNeeded: number;

  /** Unit of measurement */
  unit: MedicationUnit;

  /** Selected packages to dispense */
  selectedPackages: SelectedPackage[];

  /** Total units being dispensed */
  totalUnitsDispensed: number;

  /** Overfill amount (positive) or underfill (negative) */
  fillDifference: number;

  /** AI reasoning for package selection */
  reasoning: string;

  /** Warnings or issues */
  warnings: Warning[];

  /** RxCUI for the drug */
  rxcui?: string;

  /** All available NDCs considered */
  availableNDCs?: NDCPackage[];
}

/**
 * Zod schema for CalculationResult
 */
export const CalculationResultSchema = z.object({
  parsedSIG: ParsedSIGSchema,
  totalQuantityNeeded: z.number().positive(),
  unit: z.enum(MEDICATION_UNITS),
  selectedPackages: z.array(SelectedPackageSchema).min(1),
  totalUnitsDispensed: z.number().positive(),
  fillDifference: z.number(),
  reasoning: z.string(),
  warnings: z.array(WarningSchema),
  rxcui: z.string().optional(),
  availableNDCs: z.array(NDCPackageSchema).optional()
});
```

---

### 3.5 API Types (`api.ts`)

#### External API Request/Response Types

```typescript
/**
 * RxNorm API response types
 */
export interface RxNormResponse {
  idGroup?: {
    rxnormId?: string[];
  };
  approximateGroup?: {
    candidate?: Array<{
      rxcui: string;
      name: string;
      score: string;
    }>;
  };
}

/**
 * FDA NDC Directory API response
 */
export interface FDANDCResponse {
  results?: Array<{
    product_ndc: string;
    generic_name: string;
    brand_name?: string;
    dosage_form: string;
    active_ingredients: Array<{
      name: string;
      strength: string;
    }>;
    packaging?: Array<{
      package_ndc: string;
      description: string;
    }>;
    labeler_name: string;
    marketing_start_date?: string;
    marketing_end_date?: string;
    marketing_category?: string;
  }>;
  meta?: {
    disclaimer: string;
    last_updated: string;
  };
}

/**
 * OpenAI API types (simplified)
 */
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}
```

---

### 3.6 Error Types (`errors.ts`)

#### Custom Error Classes

```typescript
/**
 * Base error class for Nightingale errors
 */
export class NightingaleError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error when NDC is not found or invalid
 */
export class NDCNotFoundError extends NightingaleError {
  constructor(public readonly ndc: string) {
    super(
      `NDC ${ndc} not found or is invalid`,
      'NDC_NOT_FOUND',
      404
    );
  }
}

/**
 * Error when NDC is inactive or discontinued
 */
export class InactiveNDCError extends NightingaleError {
  constructor(
    public readonly ndc: string,
    public readonly endDate?: string
  ) {
    super(
      `NDC ${ndc} is inactive${endDate ? ` (ended ${endDate})` : ''}`,
      'NDC_INACTIVE',
      400
    );
  }
}

/**
 * Error when SIG cannot be parsed
 */
export class InvalidSIGError extends NightingaleError {
  constructor(
    public readonly sig: string,
    public readonly reason: string
  ) {
    super(
      `Invalid SIG: ${reason}`,
      'INVALID_SIG',
      400
    );
  }
}

/**
 * Error when drug cannot be normalized to RxCUI
 */
export class DrugNormalizationError extends NightingaleError {
  constructor(
    public readonly drugName: string,
    public readonly reason: string
  ) {
    super(
      `Cannot normalize drug "${drugName}": ${reason}`,
      'DRUG_NORMALIZATION_FAILED',
      404
    );
  }
}

/**
 * Error when external API fails
 */
export class ExternalAPIError extends NightingaleError {
  constructor(
    public readonly apiName: string,
    public readonly originalError: Error
  ) {
    super(
      `External API error (${apiName}): ${originalError.message}`,
      'EXTERNAL_API_ERROR',
      503
    );
  }
}

/**
 * Error when AI service fails
 */
export class AIServiceError extends NightingaleError {
  constructor(
    public readonly service: string,
    public readonly reason: string
  ) {
    super(
      `AI service error (${service}): ${reason}`,
      'AI_SERVICE_ERROR',
      500
    );
  }
}

/**
 * Error when validation fails
 */
export class ValidationError extends NightingaleError {
  constructor(
    public readonly field: string,
    public readonly reason: string
  ) {
    super(
      `Validation error for ${field}: ${reason}`,
      'VALIDATION_ERROR',
      400
    );
  }
}
```

---

## 4. Barrel Export (`index.ts`)

```typescript
// Common types
export * from './common';

// Prescription types
export * from './prescription';

// NDC types
export * from './ndc';

// Calculation types
export * from './calculation';

// API types
export * from './api';

// Error types
export * from './errors';
```

---

## 5. Usage Examples

### Example 1: Type-Safe Error Handling
```typescript
import { Result, ok, err, NDCPackage, NDCNotFoundError } from '$lib/types';

async function fetchNDC(ndc: string): Promise<Result<NDCPackage, NDCNotFoundError>> {
  try {
    const response = await fetch(`/api/ndc/${ndc}`);
    if (!response.ok) {
      return err(new NDCNotFoundError(ndc));
    }
    const data = await response.json();
    return ok(data);
  } catch (error) {
    return err(new NDCNotFoundError(ndc));
  }
}

// Usage with exhaustive checking
const result = await fetchNDC('12345678901');
if (result.success) {
  console.log(result.data.packageSize); // TypeScript knows data exists
} else {
  console.error(result.error.message); // TypeScript knows error exists
}
```

### Example 2: Runtime Validation with Zod
```typescript
import { PrescriptionInputSchema, ValidationError } from '$lib/types';

function validatePrescription(input: unknown) {
  const result = PrescriptionInputSchema.safeParse(input);

  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new ValidationError(
      firstError.path.join('.'),
      firstError.message
    );
  }

  return result.data; // Fully typed and validated
}
```

### Example 3: Working with Discriminated Unions
```typescript
import { ParsedSIG } from '$lib/types';

function calculateDailyDose(sig: ParsedSIG): number {
  switch (sig.frequency.type) {
    case 'times_per_day':
      return sig.dose * sig.frequency.value;

    case 'times_per_period':
      if (sig.frequency.period === 'day') {
        return sig.dose * sig.frequency.value;
      }
      // Handle other periods
      return 0;

    case 'specific_times':
      return sig.dose * sig.frequency.times.length;

    case 'as_needed':
      return sig.frequency.maxPerDay
        ? sig.dose * sig.frequency.maxPerDay
        : 0;

    default:
      // TypeScript enforces exhaustive checking
      const _exhaustive: never = sig.frequency;
      return _exhaustive;
  }
}
```

---

## 6. Testing Strategy

### Unit Tests Required
1. **Type Guards**: Test `isNDCPackage` with various inputs
2. **Error Classes**: Verify error messages and codes
3. **Zod Schemas**: Test validation with valid/invalid data
4. **Helper Functions**: Test `ok()` and `err()` functions

### Test File Structure
```
tests/unit/types/
├── common.test.ts
├── prescription.test.ts
├── ndc.test.ts
├── calculation.test.ts
└── errors.test.ts
```

---

## 7. Future Enhancements

### Phase 2 Additions
- **Cost Information**: Add pricing data to NDCPackage
- **Insurance Types**: Define insurance plan types
- **Patient Information**: Patient profile types (if needed)
- **Audit Log**: Types for tracking changes

### Phase 3 Additions
- **Batch Processing**: Types for bulk prescription processing
- **Analytics**: Types for usage metrics and reporting

---

## 8. Dependencies

```json
{
  "zod": "^3.22.0",
  "typescript": "^5.0.0"
}
```

---

## 9. Implementation Checklist

- [ ] Create directory structure (`src/lib/types/`)
- [ ] Implement `common.ts` with Result type
- [ ] Implement `prescription.ts` with input and SIG types
- [ ] Implement `ndc.ts` with package types
- [ ] Implement `calculation.ts` with result types
- [ ] Implement `api.ts` with external API types
- [ ] Implement `errors.ts` with custom error classes
- [ ] Create barrel export in `index.ts`
- [ ] Write unit tests for all schemas and type guards
- [ ] Update `tsconfig.json` to enable strict mode
- [ ] Document all types with JSDoc comments

---

## 10. Success Criteria

✅ All types are strongly typed (no `any`)
✅ Zod schemas exist for all external data
✅ Custom error classes cover all domain errors
✅ Type guards work correctly for runtime checks
✅ Barrel export provides clean import path
✅ All types have JSDoc documentation
✅ Unit tests achieve 100% coverage
✅ TypeScript compiles with no errors in strict mode
