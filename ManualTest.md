Manual Scenarios

SIG Parse Failure With Advice
Input: drugName="Test Drug", sig="asdf", daysSupply=30. Expect AI parser to fail, /api/calculate to return error.advice describing why parsing failed plus suggestions; UI should render the explanation beneath the red alert.

Drug Not Found → Advice + RxCUI Fallback
Input: drugName="Foobarxyz", sig="Take 1 tablet daily", daysSupply=30. Since RxNorm lookup fails, advice should recommend verifying spelling/alternatives. Confirm calculator still tries the original name and logs context.

Variable Dose Range Handling
Input: drugName="Acetaminophen", sig="Take 1-2 tablets every 4 hours as needed for pain", daysSupply=5. Validate that total quantity uses the max dose (should be ~60 tablets), warning list includes dose_range_assumption and ambiguous_sig because PRN max defaulted to 4/day.

Detailed Dose Schedule (Insulin)
Input: drugName="Insulin Glargine", sig="Inject 10 units before meals and 15 units at bedtime", daysSupply=30. Ensure quantity calculator sums schedule (10×3 + 15×1 = 45 units/day → 1350 units) and selection prompt references timing. Observe any warnings about vial counts/overfill.

Dosage Form Mismatch Warning
Pick a SIG requiring tablets (e.g., drugName="Lisinopril", sig="Take 1 tablet by mouth daily", daysSupply=30) but temporarily inject an FDA package that is a capsule (mock via logging or adjust data). Confirm the selector returns dosage_form_mismatch warning referencing the offending NDC.

Inactive/No Active NDCs Path
Use a discontinued drug or temporarily filter active list to empty. Expect NDC_NOT_FOUND error plus advice suggesting alternative manufacturers and auditing steps; UI should show explanation/suggestions.

RxCUI Normalization Success
Input a brand name (drugName="Prinivil", sig="Take 1 tablet daily", daysSupply=30). Verify RxNorm resolves to lisinopril RxCUI, FDA search still finds active packages, and response includes rxcui for auditing.