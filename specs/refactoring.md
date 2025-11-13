# Refactoring Plan

Concise plan covering the remediation items we agreed to prioritize (contextual error guidance, richer NDC selection context, quantity accuracy for variable dosing, and RxCUI normalization). Items explicitly deprioritized for now (live SIG preview heuristics, automated tests) are called out as out of scope.

## Objectives
- Deliver contextual guidance to users whenever the calculation flow fails, per PRD expectations.
- Feed structured SIG context into package selection so dosage-form mismatches and multi-pack trade-offs are evaluated correctly.
- Support variable dosing patterns (split doses, ranges, PRN maxima) in the quantity calculator.
- Ensure RxCUI normalization happens consistently and is leveraged downstream (API responses, FDA lookups, auditing).

## Workstreams

### 1. Contextual Error Guidance
1. Surface `adviseOnError` from the calculator orchestration layer so we can attach advice objects to error responses.
2. Update `/api/calculate` to include both the raw error metadata and the AI-generated advice (explanation + suggestions). Align Types/DTOs so the UI can render the advice.
3. Add a lightweight UI treatment (reuse `ErrorAlert`) to show the explanation and actionable next steps.

### 2. Richer NDC Selection Inputs
1. Extend `NDCSelectionInput` to accept the structured `ParsedSIG` (dose, route, dose forms, frequency metadata, warnings).
2. Update the selection prompt to describe the intended dosage form/unit and any edge-case instructions (PRN, alternating doses) so the AI can evaluate package suitability.
3. Introduce schema validation on the selector output to ensure any dosage-form mismatch warnings are passed back to the orchestrator.

### 3. Quantity Calculator Enhancements
1. Expand `ParsedSIG` (or derived calculator input) to represent multiple dose blocks (e.g., `{ time: 'morning', dose: 10 }`), dose ranges, and PRN ceilings.
2. Update `calculateTotalQuantity` to iterate over these dose blocks, taking the max in ranges when estimating supply (with documented assumptions).
3. Feed the richer quantity computation back into warning generation (e.g., highlight when assumptions were used or when SIG lacked a max PRN frequency).

### 4. RxCUI Normalization Everywhere
1. Always run `normalizeToRxCUI` first, even if an NDC is supplied, so we can map the drug to a canonical concept.
2. Use the resulting RxCUI (when available) to refine FDA queries (e.g., brand + generic names derived from RxNorm) and to annotate the final response.
3. Persist the RxCUI in the API response/Result object so downstream consumers (frontend, auditing logs) can rely on the canonical identifier.

## Deliverables
- Updated type definitions and orchestrator logic to support the new advice + parsed SIG plumbing.
- Revised AI prompt builders and selector/calculator utilities aligned with the richer inputs.
- UI tweaks to expose error advice (small card or extension of `ErrorAlert`).

## Out of Scope (For Now)
- Live SIG preview parity with the backend parser.
- Automated test harness and coverage expansion (can be tackled after the refactors land).
