# Future Improvements & Known Issues

## Critical Safety Issues 🚨

### 1. Dose Range Calculation Bug
**Status:** Identified but not fixed
**Issue:** When SIG contains "1-2 tablets", system calculates for 1.5 tablets (average) instead of 2 tablets (maximum).

- Expected: `2 × 2/day × 90 days = 360 tablets`
- Actual: `270 tablets` (using 1.5 average)
- **Risk:** Patient runs out of medication if they need maximum dose
- **Warning message is misleading:** Says "used maximum" but actually uses average

**Fix Required:**
- Debug what AI returns for `dose` vs `doseRange` fields
- Ensure `doseRange.max` is used for quantity calculation
- Update AI prompt to clarify: when range exists, `dose` should be minimum
- Add logging: `[Quantity Calc] dose: X doseRange: Y doseToUse: Z`

**Test Cases:**
- "Take 1-2 tablets twice daily" → should calculate for 2 tablets
- "Take 1-2 tablets as needed" → should calculate for max per day
- "10-15 units before meals" → should use 15 units

---

### 2. Strength Extraction Only Matches at End of String
**Status:** Identified but not fixed
**Issue:** Regex pattern only extracts strength if it's at the end: `/\s*(\d+(?:\.\d+)?)\s*(mg|mcg|...)\s*$/i`

**Fails for common formats:**
- ❌ "Metformin 500mg ER"
- ❌ "Metformin 500mg Extended Release"
- ❌ "Aspirin 81mg Enteric Coated"
- ❌ "Lisinopril 10mg tablets"

**Fix Required:**
- Update regex to match strength anywhere in string
- Or match at end OR before common suffixes (ER, XR, SR, CR, etc.)
- Test with real-world drug names

**Suggested regex:**
```javascript
/\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)(?:\s+|$)/i
// OR with suffix handling:
/\s*(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|units?|iu)(?=\s|$|[A-Z])/i
```

---

### 3. Strength Mismatch Fallback is Too Permissive
**Status:** Identified but not fixed
**Issue:** When requested strength (500mg) not found in FDA packages, system logs warning but allows AI to select ANY strength.

**Current behavior:**
1. Search for "Metformin 500mg"
2. No 500mg packages found
3. Log: "No packages found matching strength 500mg, using all available strengths"
4. AI picks 1000mg package
5. Show warning after calculation

**Problem:** User might miss warning and dispense wrong dose.

**Options to consider:**
1. **Fail hard:** Return error, force user to remove strength from search
2. **Require confirmation:** Block calculation, show dialog "No 500mg found, proceed with other strengths?"
3. **Keep current:** Just warn (least safe)

**Decision needed:** Product/UX decision on error handling philosophy

---

## Feature Issues

### 4. Error Advisor Feature - Overhead & Cost
**Status:** Enabled but not evaluated for usefulness
**Location:** `src/routes/api/calculate/+server.ts` lines 61-74

**What it does:**
- On EVERY error, makes extra OpenAI API call
- Generates AI advice for fixing the error
- Example: "Drug not found" → suggests checking spelling

**Concerns:**
- Adds latency to error responses (extra API roundtrip)
- Costs ~$0.01-0.03 per error
- Could fail and add complexity
- Usefulness unclear

**Recommendation:**
- Test with real users to see if advice is helpful
- Consider disabling for performance
- Or cache common errors to avoid repeat API calls

---

### 5. Dose Schedule Feature Untested
**Status:** Added by Codex but not validated
**Location:** `src/lib/services/calculator/quantityCalc.ts` lines 95-107

**What it does:**
- Handles complex regimens: "10 units before meals (3x/day), 15 units at bedtime"
- AI returns `doseSchedule` array with timing and doses
- Overrides normal dose calculation

**Concerns:**
- Interaction with `doseRange` unclear
- If both exist, which takes priority?
- No test cases
- Could have edge cases

**Test cases needed:**
- "10 units before meals, 15 units at bedtime"
- "1 tablet morning, 2 tablets evening"
- SIG with both schedule AND range (edge case)

---

## Technical Improvements

### 6. Complex Strength Formats Not Handled
**Examples:**
- ❌ "Advair 250/50" (two active ingredients) - might extract only "50"
- ❌ "Insulin 100 units/mL" (concentration) - doesn't match pattern
- ❌ "Percocet 5/325" (combination drug) - could extract "325" wrong
- ❌ "Synthroid 0.025mg" (tiny decimals) - should work but untested

**Consider:**
- Support for multi-strength products
- Concentration vs dose distinction
- Better handling of combination drugs

---

### 7. No Automated Testing for Safety-Critical Code
**Issue:** Making regex and calculation changes without tests

**Risk areas with no tests:**
- Strength extraction regex
- Strength normalization
- Dose calculation with ranges
- Dose schedule calculation
- NDC filtering logic

**Recommendation:**
- Add unit tests for `extractBaseDrugName()`
- Add unit tests for `calculateTotalQuantity()`
- Add unit tests for `normalizeStrength()` and `strengthsMatch()`
- Add integration tests for full calculation flow

**Example test cases:**
```javascript
describe('extractBaseDrugName', () => {
  test('extracts from end', () => {
    expect(extractBaseDrugName('Metformin 500mg'))
      .toEqual({ baseName: 'Metformin', strength: '500mg' });
  });

  test('handles ER suffix', () => {
    expect(extractBaseDrugName('Metformin 500mg ER'))
      .toEqual({ baseName: 'Metformin ER', strength: '500mg' });
  });

  test('handles no strength', () => {
    expect(extractBaseDrugName('Lisinopril'))
      .toEqual({ baseName: 'Lisinopril', strength: null });
  });
});
```

---

### 8. Cache May Contain Wrong Results
**Issue:** If old calculations cached wrong strengths, users might see stale bad data

**Recommendation:**
- Clear cache after strength matching fix deployed
- Consider cache versioning
- Add cache invalidation endpoint

**Commands:**
```javascript
// In browser console or API endpoint:
import { clearAllCaches } from '$lib/services/external';
clearAllCaches();
```

---

### 9. UI Warning Prominence
**Issue:** Strength mismatch warning has severity "error" but might not be visually prominent enough

**Current behavior:**
- Warning appears in list with other warnings
- All warnings styled similarly
- User might miss critical error

**Recommendation:**
- Error-level warnings should have distinct styling (red background?)
- Consider blocking calculation from proceeding with strength mismatch
- Add confirmation dialog: "Wrong strength selected, continue anyway?"
- Make NDC table row red when strength doesn't match

---

### 10. Dose Range Inference Feature
**Location:** `src/lib/services/calculator/orchestrator.ts` lines 116-147
**Status:** Added by Codex but unclear if needed

**What it does:**
- If AI doesn't detect dose range, regex tries to extract from SIG text
- Example: "Take 1-2 tablets" → infers `{min: 1, max: 2}`

**Questions:**
- Is this needed if AI is good at parsing?
- Could it conflict with AI output?
- Does it handle edge cases correctly?

**Test:** Compare results with/without inference feature

---

## Nice-to-Have Improvements

### 11. Better Multi-Ingredient Handling
Currently rejects drugs with "and", "with", "/" in name. This filters out combination drugs but might be too aggressive.

**Examples rejected:**
- "Lisinopril and Hydrochlorothiazide" ✓ (correct to reject)
- "Tylenol with Codeine" ✓ (correct to reject)
- "5/325 Percocet" ✓ (correct to reject)
- "AM/PM Vitamin Pack" ✗ (false positive?)

**Consider:** More sophisticated combination drug detection

---

### 12. Strength Synonym Support
Some strengths have multiple valid representations:

- "100mcg" vs "0.1mg" (need conversion)
- "1g" vs "1000mg" (need conversion)
- "100 units/mL" vs "100 units per mL"

**Consider:** Normalization with unit conversion

---

### 13. FDA Data Quality Issues
From earlier testing (Insulin Glargine):

- NDCs with "UNFINISHED" status returned
- Dosage form mismatches (Suspension vs Powder)
- Unknown manufacturers
- Wrong strength formats

**Consider:**
- Filter out UNFINISHED status
- Validate FDA data quality before showing to user
- Warn about data quality issues

---

### 14. Performance Monitoring
**Add logging/metrics for:**
- API response times (OpenAI, FDA, RxNorm)
- Cache hit rates
- Error frequencies
- Strength mismatch frequencies

**Helps identify:**
- Slow API calls
- Common errors
- Cache effectiveness

---

## Immediate Next Steps

**Before deployment:**
1. ✅ Fix dose range calculation (highest priority - safety issue)
2. ✅ Fix strength extraction regex for "ER" suffixes
3. ✅ Test Metformin 500mg with console logging
4. ⚠️ Decide: Disable error advisor or keep it?
5. ⚠️ Decide: Strength mismatch - fail hard or warn?

**After deployment:**
1. Add automated tests for strength matching
2. Test dose schedule feature thoroughly
3. Clear cache to remove old wrong results
4. Monitor for strength mismatch warnings in production
5. Add visual prominence to error-level warnings

---

## Questions for Product/Design

1. **Strength mismatch:** Fail hard or allow with warning?
2. **Error advisor:** Keep or disable? Cost vs benefit?
3. **Dose ranges:** Always use maximum, or let pharmacist decide?
4. **Multi-ingredient drugs:** Should we support them or keep filtering?
5. **FDA data quality:** Show warnings or filter out bad data?

---

## Files Modified by Codex (Review Needed)

**Already reviewed:**
- ✅ `src/lib/types/prescription.ts` - Added doseRange, doseSchedule (schema fixed)
- ✅ `src/lib/services/calculator/quantityCalc.ts` - Added dose schedule support
- ✅ `src/lib/services/calculator/orchestrator.ts` - Added strength matching, dose range inference
- ✅ `src/lib/services/ai/prompts.ts` - Added dose range/schedule to prompts
- ✅ `src/lib/services/ai/ndcSelector.ts` - Added dosage form mismatch detection

**Need review:**
- ⚠️ `src/lib/components/ErrorAlert.svelte` - Added error advice display
- ⚠️ `src/lib/services/ai/errorAdvisor.ts` - New error advisor feature
- ⚠️ `src/routes/api/calculate/+server.ts` - Added error advisor integration
- ⚠️ `src/routes/+page.svelte` - Type changes for error advice
- ⚠️ `src/lib/types/calculation.ts` - Added CalculationContext, CalculationOutcome
- ⚠️ `src/lib/types/common.ts` - Added ErrorAdvice interface

**See:** `git status` and `git diff` for full changelist

---

## References

- Conversation where these issues were identified: [this session]
- FDA NDC format documentation: https://www.fda.gov/drugs/drug-approvals-and-databases/national-drug-code-directory
- Pharmacy best practices for dose ranges: [TODO: add reference]
