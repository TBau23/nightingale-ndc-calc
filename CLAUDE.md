# Claude Instructions for Nightingale Project

## Commit Policy

After each change performed by Claude, commit the changed files. Title the commit with a succinct message explaining what was changed and why.

---

## TypeScript Best Practices

### 1. Type Safety & Strictness

**Always use strict mode**
```typescript
// tsconfig.json should have:
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true,
"strictFunctionTypes": true
```

**Never use `any` - use proper types or `unknown`**
```typescript
// ❌ Bad
function processData(data: any) { }

// ✅ Good
function processData(data: unknown) {
  if (typeof data === 'string') {
    // TypeScript knows data is string here
  }
}

// ✅ Better - use specific types
function processData(data: PrescriptionInput) { }
```

### 2. Type Definitions & Interfaces

**Use `interface` for object shapes, `type` for unions/intersections/utilities**
```typescript
// ✅ Use interface for objects
interface PrescriptionInput {
  drugName: string;
  ndc?: string;
  sig: string;
  daysSupply: number;
}

// ✅ Use type for unions and complex types
type Result<T> = Success<T> | Failure;
type APIResponse = PrescriptionInput & { timestamp: Date };
```

**Define discriminated unions for variants**
```typescript
// ✅ Excellent for error handling
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage enables exhaustive checking
function handleResult(result: Result<NDCPackage>) {
  if (result.success) {
    return result.data; // TypeScript knows data exists
  } else {
    return result.error; // TypeScript knows error exists
  }
}
```

### 3. Null Safety

**Use optional chaining and nullish coalescing**
```typescript
// ✅ Good
const ndc = prescription.ndc ?? 'unknown';
const manufacturer = ndcData?.manufacturer?.name ?? 'N/A';

// Avoid explicit null/undefined checks when possible
if (prescription.ndc) {
  // Use ndc
}
```

**Make optionality explicit**
```typescript
// ✅ Good - clear what's required vs optional
interface NDCPackage {
  ndc: string;           // required
  packageSize: number;   // required
  manufacturer?: string; // explicitly optional
}
```

### 4. Function Signatures

**Always type function parameters and return types**
```typescript
// ❌ Bad - inferred return type
function calculateQuantity(dose: number, frequency: number) {
  return dose * frequency;
}

// ✅ Good - explicit return type
function calculateQuantity(dose: number, frequency: number): number {
  return dose * frequency;
}

// ✅ Best - complex return types
async function parseNDC(ndc: string): Promise<Result<NDCPackage, ParseError>> {
  // implementation
}
```

**Use readonly for immutable parameters**
```typescript
// ✅ Good - prevents accidental mutation
function processPackages(packages: readonly NDCPackage[]): NDCPackage {
  // packages.push(...) // Error: cannot mutate readonly array
  return packages[0];
}
```

### 5. Generics

**Use generics for reusable, type-safe code**
```typescript
// ✅ Good - reusable API wrapper
async function fetchAPI<T>(url: string): Promise<Result<T>> {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return { success: true, data: data as T };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Usage
const result = await fetchAPI<NDCPackage[]>('/api/ndc/search');
```

**Constrain generics when needed**
```typescript
// ✅ Good - generic with constraints
function getId<T extends { id: string }>(item: T): string {
  return item.id;
}
```

### 6. Async/Await & Promises

**Always type async function returns**
```typescript
// ✅ Good
async function fetchRxCUI(drugName: string): Promise<string> {
  // implementation
}

// ✅ Handle errors properly
async function safeFetch<T>(url: string): Promise<Result<T>> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: new Error(response.statusText) };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}
```

### 7. Error Handling

**Create typed error classes**
```typescript
// ✅ Good - custom error types
class NDCNotFoundError extends Error {
  constructor(public ndc: string) {
    super(`NDC ${ndc} not found`);
    this.name = 'NDCNotFoundError';
  }
}

class InvalidSIGError extends Error {
  constructor(public sig: string, public reason: string) {
    super(`Invalid SIG: ${reason}`);
    this.name = 'InvalidSIGError';
  }
}

// Use in functions
function validateNDC(ndc: string): string {
  if (!/^\d{11}$/.test(ndc)) {
    throw new NDCNotFoundError(ndc);
  }
  return ndc;
}
```

### 8. Utility Types

**Leverage TypeScript utility types**
```typescript
// ✅ Partial for optional updates
type PartialUpdate = Partial<PrescriptionInput>;

// ✅ Pick for selecting specific fields
type NDCBasic = Pick<NDCPackage, 'ndc' | 'packageSize'>;

// ✅ Omit for excluding fields
type NDCWithoutManufacturer = Omit<NDCPackage, 'manufacturer'>;

// ✅ Record for key-value maps
type NDCCache = Record<string, NDCPackage>;

// ✅ Required for making all fields required
type CompletePrescription = Required<PrescriptionInput>;
```

### 9. Type Guards

**Create type guards for runtime type checking**
```typescript
// ✅ Good - type predicate
function isNDCPackage(value: unknown): value is NDCPackage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ndc' in value &&
    'packageSize' in value &&
    typeof (value as NDCPackage).ndc === 'string' &&
    typeof (value as NDCPackage).packageSize === 'number'
  );
}

// Usage
if (isNDCPackage(data)) {
  // TypeScript knows data is NDCPackage here
  console.log(data.ndc);
}
```

**Use Zod for runtime validation**
```typescript
import { z } from 'zod';

// ✅ Excellent - schema validation with type inference
const PrescriptionInputSchema = z.object({
  drugName: z.string().min(1),
  ndc: z.string().regex(/^\d{11}$/).optional(),
  sig: z.string().min(1),
  daysSupply: z.number().positive()
});

// Infer TypeScript type from schema
type PrescriptionInput = z.infer<typeof PrescriptionInputSchema>;

// Validate at runtime
const result = PrescriptionInputSchema.safeParse(userInput);
if (result.success) {
  // result.data is typed as PrescriptionInput
}
```

### 10. Module Organization

**Use barrel exports for clean imports**
```typescript
// src/lib/types/index.ts
export * from './prescription';
export * from './ndc';
export * from './calculation';

// Now import from single location
import { PrescriptionInput, NDCPackage } from '$lib/types';
```

**Separate types into logical modules**
```
src/lib/types/
  ├── index.ts           # Barrel export
  ├── prescription.ts    # Prescription-related types
  ├── ndc.ts            # NDC-related types
  ├── calculation.ts    # Calculation result types
  └── api.ts            # API request/response types
```

### 11. Const Assertions

**Use `as const` for literal types**
```typescript
// ✅ Good - creates readonly literal types
const DOSAGE_FORMS = ['tablet', 'capsule', 'solution', 'injection'] as const;
type DosageForm = typeof DOSAGE_FORMS[number]; // 'tablet' | 'capsule' | ...

// ✅ Good for configuration objects
const API_ENDPOINTS = {
  rxnorm: 'https://rxnav.nlm.nih.gov/REST',
  fdaNdc: 'https://api.fda.gov/drug/ndc.json'
} as const;
```

### 12. Avoid Type Assertions (Prefer Type Guards)

**Minimize use of type assertions**
```typescript
// ❌ Avoid
const data = apiResponse as NDCPackage;

// ✅ Better - validate and guard
if (isNDCPackage(apiResponse)) {
  const data = apiResponse; // Type is narrowed
}

// ✅ Best - use Zod for validation
const result = NDCPackageSchema.safeParse(apiResponse);
if (result.success) {
  const data = result.data; // Validated and typed
}
```

### 13. Naming Conventions

```typescript
// ✅ Interfaces and Types: PascalCase
interface PrescriptionInput { }
type Result<T> = { };

// ✅ Functions and variables: camelCase
function calculateQuantity() { }
const totalDose = 10;

// ✅ Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const API_TIMEOUT_MS = 5000;

// ✅ Private class members: prefix with _
class Calculator {
  private _cache: Map<string, number>;
}
```

### 14. Documentation

**Use JSDoc for complex types and functions**
```typescript
/**
 * Calculates the total quantity to dispense based on parsed SIG data.
 *
 * @param sig - The parsed SIG containing dose, frequency, and duration
 * @returns The total quantity needed, or throws InvalidSIGError if calculation fails
 * @throws {InvalidSIGError} When SIG data is incomplete or invalid
 *
 * @example
 * ```ts
 * const quantity = calculateTotalQuantity({
 *   dose: 1,
 *   frequency: 2,
 *   duration: 30
 * }); // Returns 60
 * ```
 */
function calculateTotalQuantity(sig: ParsedSIG): number {
  // implementation
}
```

---

## Summary: The TypeScript Golden Rules

1. **Never use `any`** - use `unknown` or proper types
2. **Always type function returns** - explicit is better than implicit
3. **Use discriminated unions** - for variants and error handling
4. **Validate at runtime** - use Zod for external data
5. **Leverage utility types** - `Partial`, `Pick`, `Omit`, `Record`, etc.
6. **Create type guards** - for safe runtime type checking
7. **Use `as const`** - for literal types and readonly data
8. **Handle errors properly** - use `Result<T, E>` pattern
9. **Document complex types** - use JSDoc for clarity
10. **Enable strict mode** - catch errors at compile time
