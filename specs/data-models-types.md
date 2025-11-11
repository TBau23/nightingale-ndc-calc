# Data Models & Types Specification

**Component:** Data Models & Types Layer
**Location:** `/src/lib/types`
**Dependencies:** None (foundation layer)
**Status:** Planning

---

## Overview

Foundation layer defining all TypeScript interfaces, Zod schemas, and error classes. Every other component depends on this.

**Key Principles:**
- Never use `any` - prefer `unknown` with type guards
- Use Zod for runtime validation of external data
- Use `Result<T, E>` discriminated union for error handling
- Follow TypeScript best practices from CLAUDE.md

---

## Module Structure

```
src/lib/types/
├── index.ts           # Barrel export
├── common.ts          # Result type, shared utilities
├── prescription.ts    # PrescriptionInput, ParsedSIG
├── ndc.ts            # NDCPackage, RxNormConcept
├── calculation.ts    # CalculationResult, Warning, SelectedPackage
├── api.ts            # External API types (RxNorm, FDA, OpenAI)
└── errors.ts         # Custom error classes
```

---

## Core Types

### Common (`common.ts`)
- `Result<T, E>` - Discriminated union for success/failure
- `ok()` / `err()` - Helper functions
- `APIResponse<T>` - Standard API wrapper

### Prescription (`prescription.ts`)
- `PrescriptionInput` - User input (drugName, ndc?, sig, daysSupply)
- `PrescriptionInputSchema` - Zod validation
- `ParsedSIG` - AI-parsed structured SIG data
  - `dose`, `unit`, `frequency`, `duration`, `route`, `specialInstructions`
  - `confidence`, `reasoning`, `originalSIG`
- `FrequencyPattern` - Discriminated union for dosing schedules
  - `times_per_day`, `times_per_period`, `specific_times`, `as_needed`
- `MedicationUnit` - Literal union (tablet, capsule, mL, unit, etc.)
- `Route` - Literal union (oral, topical, subcutaneous, etc.)

### NDC (`ndc.ts`)
- `NDCPackage` - FDA package data
  - `ndc`, `packageSize`, `dosageForm`, `strength`, `manufacturer`, `status`
  - `brandName?`, `genericName`, marketing dates
- `NDCPackageSchema` - Zod validation
- `isNDCPackage()` - Type guard
- `DosageForm` - Literal union (TABLET, CAPSULE, SOLUTION, etc.)
- `NDCStatus` - 'active' | 'inactive' | 'discontinued'
- `RxNormConcept` - RxCUI data (rxcui, name, tty?)

### Calculation (`calculation.ts`)
- `CalculationResult` - Complete output
  - `parsedSIG`, `totalQuantityNeeded`, `selectedPackages`
  - `totalUnitsDispensed`, `fillDifference`, `reasoning`, `warnings`
  - `rxcui?`, `availableNDCs?`
- `SelectedPackage` - Chosen package with quantity
- `Warning` - Issues detected
  - `type`, `severity`, `message`, `suggestion?`, `relatedNDC?`
- `WarningType` - inactive_ndc, dosage_form_mismatch, overfill, etc.
- `WarningSeverity` - 'info' | 'warning' | 'error'

### API (`api.ts`)
- `RxNormResponse` - RxNorm API structure
- `FDANDCResponse` - FDA NDC API structure
- `OpenAIMessage`, `OpenAIRequest` - OpenAI API types

### Errors (`errors.ts`)
Custom error classes extending `NightingaleError`:
- `NDCNotFoundError`
- `InactiveNDCError`
- `InvalidSIGError`
- `DrugNormalizationError`
- `ExternalAPIError`
- `AIServiceError`
- `ValidationError`

---

## Implementation Checklist

- [ ] Create directory and 7 module files
- [ ] Implement all interfaces and types
- [ ] Add Zod schemas for validation
- [ ] Implement custom error classes
- [ ] Create barrel export in index.ts
- [ ] Write unit tests for schemas and type guards
- [ ] Update tsconfig.json to strict mode

---

## Dependencies

- `zod` ^3.22.0
- `typescript` ^5.0.0
