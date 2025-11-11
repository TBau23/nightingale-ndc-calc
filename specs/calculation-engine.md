# Calculation Engine Specification

**Component:** Calculation Engine
**Location:** `/src/lib/services/calculator`
**Dependencies:** Types, AI Service Layer, API Integration Layer
**Status:** Planning

---

## Overview

The Calculation Engine orchestrates the entire prescription processing flow. It coordinates between AI services, external APIs, and calculation logic to produce a complete `CalculationResult`.

**Core Responsibility:**
Take a `PrescriptionInput` and return a `CalculationResult` with selected packages, quantities, warnings, and AI reasoning.

**Key Principles:**
- Single entry point: `calculatePrescription()`
- Orchestrates all other services
- Returns `Result<CalculationResult, NightingaleError>`
- Handles errors gracefully at each step
- Provides detailed reasoning and warnings

---

## Module Structure

```
src/lib/services/calculator/
├── index.ts              # Barrel export
├── orchestrator.ts       # Main calculation orchestrator
└── quantityCalc.ts       # Quantity calculation utilities
```

---

## Core Flow

### Main Function: `calculatePrescription(input: PrescriptionInput): Promise<Result<CalculationResult, NightingaleError>>`

**Input:** `PrescriptionInput` (drugName, ndc?, sig, daysSupply)

**Output:** `Result<CalculationResult, NightingaleError>`

**Flow:**

```
1. Validate Input
   └─> PrescriptionInputSchema.safeParse()

2. Parse SIG (AI)
   └─> parseSIG(sig, daysSupply)
   └─> Returns: ParsedSIG with dose, unit, frequency, confidence, reasoning

3. Normalize Drug Name (if no NDC provided)
   └─> normalizeToRxCUI(drugName)
   └─> Returns: RxCUI

4. Get Available NDCs
   └─> searchNDCsByDrug(drugName)
   └─> Returns: NDCPackage[]
   └─> Filter: Keep only active NDCs

5. Calculate Total Quantity Needed
   └─> calculateTotalQuantity(parsedSIG, daysSupply)
   └─> Returns: number (total units needed)

6. Select Optimal Packages (AI)
   └─> selectOptimalNDCs({
         availableNDCs,
         quantityNeeded,
         unit,
         daysSupply
       })
   └─> Returns: SelectedPackage[], warnings, reasoning

7. Build CalculationResult
   └─> Combine all data
   └─> Calculate fillDifference (overfill/underfill)
   └─> Add warnings from each step
   └─> Return complete result
```

---

## Components

### 1. Orchestrator (`orchestrator.ts`)

**Purpose:** Main entry point that coordinates the entire flow.

#### Function: `calculatePrescription(input: PrescriptionInput): Promise<Result<CalculationResult, NightingaleError>>`

**Steps:**

1. **Validate Input**
   ```typescript
   const validation = PrescriptionInputSchema.safeParse(input);
   if (!validation.success) {
     return err(new ValidationError(...));
   }
   ```

2. **Parse SIG**
   ```typescript
   const sigResult = await parseSIG(input.sig, input.daysSupply);
   if (!sigResult.success) {
     return err(sigResult.error);
   }
   const parsedSIG = sigResult.data;
   ```

3. **Get RxCUI (optional - for reference)**
   ```typescript
   let rxcui: string | undefined;
   if (!input.ndc) {
     const rxcuiResult = await normalizeToRxCUI(input.drugName);
     if (rxcuiResult.success) {
       rxcui = rxcuiResult.data.rxcui;
     }
     // Don't fail if RxCUI not found - continue with drug name
   }
   ```

4. **Get Available NDCs**
   ```typescript
   const ndcsResult = await searchNDCsByDrug(input.drugName);
   if (!ndcsResult.success) {
     return err(ndcsResult.error);
   }

   // Filter to active only
   const activeNDCs = ndcsResult.data.filter(ndc => ndc.status === 'active');
   if (activeNDCs.length === 0) {
     return err(new NDCNotFoundError(input.drugName));
   }
   ```

5. **Calculate Quantity Needed**
   ```typescript
   const quantityNeeded = calculateTotalQuantity(parsedSIG, input.daysSupply);
   if (quantityNeeded <= 0) {
     return err(new InvalidSIGError(input.sig, 'Cannot calculate quantity'));
   }
   ```

6. **Select Optimal Packages**
   ```typescript
   const selectionResult = await selectOptimalNDCs({
     availableNDCs: activeNDCs,
     quantityNeeded,
     unit: parsedSIG.unit,
     daysSupply: input.daysSupply
   });
   if (!selectionResult.success) {
     return err(selectionResult.error);
   }
   ```

7. **Build Result**
   ```typescript
   const totalUnitsDispensed = selectionResult.data.selectedPackages
     .reduce((sum, pkg) => sum + pkg.totalUnits, 0);

   const fillDifference = totalUnitsDispensed - quantityNeeded;

   const result: CalculationResult = {
     parsedSIG,
     totalQuantityNeeded: quantityNeeded,
     unit: parsedSIG.unit,
     selectedPackages: selectionResult.data.selectedPackages,
     totalUnitsDispensed,
     fillDifference,
     reasoning: selectionResult.data.reasoning,
     warnings: collectWarnings(parsedSIG, selectionResult.data.warnings, fillDifference),
     rxcui,
     availableNDCs: activeNDCs
   };

   return ok(result);
   ```

**Error Handling:**
- Each step returns `Result<T, E>`
- On error, return immediately with appropriate error type
- Collect warnings from each step (don't fail on warnings)
- If AI services fail, provide fallback guidance

---

### 2. Quantity Calculator (`quantityCalc.ts`)

**Purpose:** Calculate total quantity needed based on ParsedSIG.

#### Function: `calculateTotalQuantity(sig: ParsedSIG, daysSupply: number): number`

**Logic by Frequency Type:**

```typescript
switch (sig.frequency.type) {
  case 'times_per_day':
    // dose × times_per_day × days
    return sig.dose * sig.frequency.value * daysSupply;

  case 'times_per_period':
    // Convert to times per day, then calculate
    const timesPerDay = convertToTimesPerDay(sig.frequency.value, sig.frequency.period);
    return sig.dose * timesPerDay * daysSupply;

  case 'specific_times':
    // dose × number of times × days
    return sig.dose * sig.frequency.times.length * daysSupply;

  case 'as_needed':
    // Use maxPerDay if specified, otherwise estimate conservatively
    const maxPerDay = sig.frequency.maxPerDay || 4; // Conservative default
    return sig.dose * maxPerDay * daysSupply;
}
```

**Helper Function:** `convertToTimesPerDay(value: number, period: string): number`

```typescript
switch (period) {
  case 'hour':
    return 24 / value; // e.g., every 4 hours = 6 times/day
  case 'day':
    return value; // e.g., 2 times/day
  case 'week':
    return value / 7; // e.g., 7 times/week = 1 time/day
}
```

**Edge Cases:**
- If duration specified in SIG, use min(sig.duration, daysSupply)
- Round up to nearest whole number
- Return 0 if calculation fails

---

### 3. Warning Collection

**Function:** `collectWarnings(sig: ParsedSIG, aiWarnings: Warning[], fillDifference: number): Warning[]`

**Warning Sources:**

1. **Low Confidence SIG Parse**
   ```typescript
   if (sig.confidence < 0.7) {
     warnings.push({
       type: 'low_confidence_parse',
       severity: 'warning',
       message: `Low confidence (${sig.confidence}) in SIG parsing: ${sig.reasoning}`,
       suggestion: 'Review parsed SIG for accuracy'
     });
   }
   ```

2. **Ambiguous SIG**
   ```typescript
   if (sig.frequency.type === 'as_needed' && !sig.frequency.maxPerDay) {
     warnings.push({
       type: 'ambiguous_sig',
       severity: 'info',
       message: 'PRN dosing without maximum - used conservative estimate',
       suggestion: 'Verify quantity with prescriber if needed'
     });
   }
   ```

3. **Significant Overfill**
   ```typescript
   if (fillDifference > quantityNeeded * 0.1) {
     warnings.push({
       type: 'overfill',
       severity: 'warning',
       message: `Overfill of ${fillDifference} ${unit} (${Math.round(fillDifference/quantityNeeded*100)}%)`,
       suggestion: 'Consider adjusting package selection to reduce waste'
     });
   }
   ```

4. **Underfill**
   ```typescript
   if (fillDifference < 0) {
     warnings.push({
       type: 'underfill',
       severity: 'error',
       message: `Underfill of ${Math.abs(fillDifference)} ${unit}`,
       suggestion: 'Additional packages needed'
     });
   }
   ```

5. **AI Warnings**
   - Pass through all warnings from `selectOptimalNDCs()`

---

## Error Handling

**Error Types:**
- `ValidationError` - Invalid input
- `InvalidSIGError` - Cannot parse SIG
- `DrugNormalizationError` - Cannot find RxCUI
- `NDCNotFoundError` - No NDCs available
- `AIServiceError` - AI service failure
- `ExternalAPIError` - External API failure

**Strategy:**
- Fail fast on critical errors (invalid input, no NDCs)
- Continue on non-critical errors (RxCUI not found)
- Collect warnings instead of failing when possible
- Provide clear error messages with context

---

## Testing Strategy

### Unit Tests
- Test `calculateTotalQuantity()` with all frequency types
- Test warning collection logic
- Mock all external dependencies

### Integration Tests
- Full flow with real services (AI + APIs)
- Test common prescriptions (Lisinopril, Metformin, etc.)
- Test edge cases (PRN, complex schedules, inactive NDCs)

### Test Cases
```typescript
// Simple case
{
  drugName: "Lisinopril",
  sig: "Take 1 tablet by mouth once daily",
  daysSupply: 30
}
// Expected: 30 tablets, single package

// Complex case
{
  drugName: "Insulin",
  sig: "Inject 10 units before meals and 15 units at bedtime",
  daysSupply: 30
}
// Expected: ~1500 units, multiple vials

// PRN case
{
  drugName: "Acetaminophen",
  sig: "Take 1-2 tablets every 4-6 hours as needed for pain",
  daysSupply: 5
}
// Expected: Conservative estimate with warnings
```

---

## Implementation Checklist

- [ ] Create directory structure (`src/lib/services/calculator/`)
- [ ] Implement `quantityCalc.ts` with calculation logic
- [ ] Implement `orchestrator.ts` with main flow
- [ ] Implement warning collection
- [ ] Create barrel export in index.ts
- [ ] Write unit tests for quantity calculations
- [ ] Write integration tests for full flow
- [ ] Verify TypeScript compilation
- [ ] Test with sample prescriptions

---

## Dependencies

No additional dependencies needed - uses existing types and services.

---

## Success Criteria

✅ Successfully process common prescriptions end-to-end
✅ Calculate correct quantities for all frequency types
✅ Select optimal packages with minimal waste
✅ Generate helpful warnings for edge cases
✅ Handle errors gracefully with clear messages
✅ All functions return Result types
✅ TypeScript compiles with no errors
✅ Integration tests pass with real services
