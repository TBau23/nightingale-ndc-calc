/**
 * Calculation orchestrator - Main entry point for prescription processing
 */

import { calculateTotalQuantity } from './quantityCalc.js';
import { parseSIG, selectOptimalNDCs } from '$lib/services/ai';
import { normalizeToRxCUI, searchNDCsByDrug, extractBaseDrugName } from '$lib/services/external';
import {
	PrescriptionInputSchema,
	ValidationError,
	NDCNotFoundError,
	InvalidSIGError
} from '$lib/types';
import type {
	PrescriptionInput,
	CalculationResult,
	NightingaleError,
	Warning,
	ParsedSIG,
	CalculationOutcome,
	CalculationContext,
	MedicationUnit,
	NDCPackage
} from '$lib/types';

/**
 * Collect warnings from various sources
 *
 * @param sig - Parsed SIG
 * @param aiWarnings - Warnings from AI NDC selector
 * @param fillDifference - Overfill/underfill amount
 * @param quantityNeeded - Total quantity needed
 * @param unit - Unit of measurement
 * @returns Array of warnings
 */
function collectWarnings(
	sig: ParsedSIG,
	aiWarnings: Warning[],
	fillDifference: number,
	quantityNeeded: number,
	unit: string,
	options?: { doseRangeInferred?: boolean }
): Warning[] {
	const warnings: Warning[] = [];

	// Low confidence SIG parse
	if (sig.confidence < 0.7) {
		warnings.push({
			type: 'low_confidence_parse',
			severity: 'warning',
			message: `Low confidence (${sig.confidence.toFixed(2)}) in SIG parsing: ${sig.reasoning}`,
			suggestion: 'Review parsed SIG for accuracy'
		});
	}

	// Ambiguous SIG (PRN without max)
	if (sig.frequency.type === 'as_needed' && !sig.frequency.maxPerDay) {
		warnings.push({
			type: 'ambiguous_sig',
			severity: 'info',
			message: 'PRN dosing without maximum - used conservative estimate of 4 times per day',
			suggestion: 'Verify quantity with prescriber if needed'
		});
	}

	// Dose range assumption warning
	if (sig.doseRange) {
		const inferredNote = options?.doseRangeInferred
			? ' (range inferred from SIG text)'
			: '';
		warnings.push({
			type: 'dose_range_assumption',
			severity: 'info',
			message: `Prescription specifies a dose range (${sig.doseRange.min}-${sig.doseRange.max} ${sig.unit}); used maximum for quantity${inferredNote}.`,
			suggestion: 'Confirm whether dispensing the maximum dose for the full duration is appropriate'
		});
	}

	// Significant overfill (>10%)
	if (fillDifference > quantityNeeded * 0.1) {
		const percentOverfill = Math.round((fillDifference / quantityNeeded) * 100);
		warnings.push({
			type: 'overfill',
			severity: 'warning',
			message: `Overfill of ${fillDifference} ${unit} (${percentOverfill}% over needed quantity)`,
			suggestion: 'Consider adjusting package selection to reduce waste'
		});
	}

	// Underfill
	if (fillDifference < 0) {
		warnings.push({
			type: 'underfill',
			severity: 'error',
			message: `Underfill of ${Math.abs(fillDifference)} ${unit}`,
			suggestion: 'Additional packages needed to meet prescription requirements'
		});
	}

	// Add AI warnings
	warnings.push(...aiWarnings);

	return warnings;
}

function inferDoseRangeFromText(sigText: string, unit: MedicationUnit): { min: number; max: number } | null {
	const unitPattern = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(
		`(\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d+(?:\\.\\d+)?)\\s*${unitPattern}s?`,
		'i'
	);

	const match = sigText.match(regex);
	if (!match) {
		return null;
	}

	const min = parseFloat(match[1]);
	const max = parseFloat(match[2]);

	if (Number.isNaN(min) || Number.isNaN(max) || max < min) {
		return null;
	}

	return { min, max };
}

function enhanceParsedSIG(parsedSIG: ParsedSIG, originalSIG: string): {
	sig: ParsedSIG;
	doseRangeInferred: boolean;
} {
	let updatedSIG = parsedSIG;
	let doseRangeInferred = false;

	if (!parsedSIG.doseRange) {
		const inferredRange = inferDoseRangeFromText(originalSIG, parsedSIG.unit);
		if (inferredRange) {
			updatedSIG = {
				...updatedSIG,
				doseRange: inferredRange
			};
			doseRangeInferred = true;
		}
	}

	return { sig: updatedSIG, doseRangeInferred };
}

function normalizeDrugNameForMatch(name: string): string {
	return name
		.toLowerCase()
		.replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|units?|iu)\b/g, '')
		.replace(/[^a-z\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const MULTI_INGREDIENT_PATTERN = /\b(and|with)\b|\/|,/i;

/**
 * Normalize strength for comparison (handles "500mg" vs "500 mg" vs "500MG")
 */
function normalizeStrength(strength: string): string {
	return strength
		.toLowerCase()
		.replace(/\s+/g, '') // Remove spaces
		.replace(/(\d+(?:\.\d+)?)(mg|mcg|g|ml|units?|iu)/i, '$1$2'); // Normalize format
}

/**
 * Check if two strengths match (with normalization)
 */
function strengthsMatch(requestedStrength: string, packageStrength: string): boolean {
	const normalized1 = normalizeStrength(requestedStrength);
	const normalized2 = normalizeStrength(packageStrength);
	return normalized1 === normalized2;
}

/**
 * Filter NDCs by matching strength
 */
function filterNDCsByStrength(ndcs: NDCPackage[], requestedStrength: string): NDCPackage[] {
	return ndcs.filter((pkg) => {
		if (!pkg.strength) return false;
		return strengthsMatch(requestedStrength, pkg.strength);
	});
}

function filterNDCsByDrugName(ndcs: NDCPackage[], normalizedDrugName: string): NDCPackage[] {
	if (!normalizedDrugName) {
		return ndcs;
	}

	return ndcs.filter((pkg) => {
		const genericName = pkg.genericName ? normalizeDrugNameForMatch(pkg.genericName) : '';
		const brandName = pkg.brandName ? normalizeDrugNameForMatch(pkg.brandName) : '';
		const isMultiIngredient = pkg.genericName ? MULTI_INGREDIENT_PATTERN.test(pkg.genericName) : false;

		if (genericName && genericName.includes(normalizedDrugName)) {
			return !isMultiIngredient;
		}

		if (brandName && brandName.includes(normalizedDrugName)) {
			return true;
		}

		return false;
	});
}

/**
 * Calculate prescription - main orchestration function
 *
 * @param input - Prescription input
 * @returns Result with complete CalculationResult or error
 *
 * @example
 * ```ts
 * const result = await calculatePrescription({
 *   drugName: "Lisinopril",
 *   sig: "Take 1 tablet by mouth once daily",
 *   daysSupply: 30
 * });
 *
 * if (result.success) {
 *   console.log(result.data.selectedPackages);
 *   console.log(result.data.reasoning);
 * }
 * ```
 */
export async function calculatePrescription(
	input: PrescriptionInput
): Promise<CalculationOutcome> {
	// Step 1: Validate Input
	const validation = PrescriptionInputSchema.safeParse(input);
	if (!validation.success) {
		const firstError = validation.error.errors[0];
		return {
			success: false,
			error: new ValidationError(firstError.path.join('.'), firstError.message)
		};
	}

	const validInput = validation.data;
	const context: CalculationContext = {};

	const failure = (error: NightingaleError): CalculationOutcome => ({
		success: false,
		error,
		context: Object.keys(context).length > 0 ? context : undefined
	});

	// Extract strength from drug name (e.g., "Metformin 500mg" → "500mg")
	const { baseName: extractedBaseName, strength: requestedStrength } = extractBaseDrugName(validInput.drugName);

	// Step 2: Parse SIG (AI)
	const sigResult = await parseSIG(validInput.sig, validInput.daysSupply);
	if (!sigResult.success) {
		return { success: false, error: sigResult.error };
	}
	const { sig: parsedSIG, doseRangeInferred } = enhanceParsedSIG(sigResult.data, validInput.sig);
	context.parsedSIG = parsedSIG;
	if (doseRangeInferred) {
		context.doseRangeInferred = true;
	}

	// Step 3: Normalize Drug Name to RxCUI (optional - for reference)
	let rxcui: string | undefined;
	let drugNameForSearch = validInput.drugName;
	const rxcuiResult = await normalizeToRxCUI(validInput.drugName);
	if (rxcuiResult.success) {
		rxcui = rxcuiResult.data.rxcui;
		context.rxcui = rxcui;
		drugNameForSearch = rxcuiResult.data.name || validInput.drugName;
	}
	// Don't fail if RxCUI not found - continue with original drug name

	// Step 4: Get Available NDCs
	let ndcsResult = await searchNDCsByDrug(drugNameForSearch);
	if (!ndcsResult.success && drugNameForSearch !== validInput.drugName) {
		ndcsResult = await searchNDCsByDrug(validInput.drugName);
	}

	if (!ndcsResult.success) {
		return failure(ndcsResult.error);
	}

	// Filter to active only
	const activeNDCs = ndcsResult.data.filter((ndc) => ndc.status === 'active');
	if (activeNDCs.length === 0) {
		return failure(new NDCNotFoundError(`No active NDCs found for ${validInput.drugName}`));
	}

	const requestedDrugNameForMatch = normalizeDrugNameForMatch(
		rxcuiResult.success ? rxcuiResult.data.name : validInput.drugName
	);

	const ingredientMatchedNDCs = filterNDCsByDrugName(activeNDCs, requestedDrugNameForMatch);
	const candidateNDCs = ingredientMatchedNDCs.length > 0 ? ingredientMatchedNDCs : activeNDCs;

	// Step 5: Calculate Total Quantity Needed
	const quantityNeeded = calculateTotalQuantity(parsedSIG, validInput.daysSupply);
	context.quantityNeeded = quantityNeeded;

	if (quantityNeeded <= 0) {
		return failure(
			new InvalidSIGError(
				validInput.sig,
				'Cannot calculate quantity from parsed SIG - result is zero or negative'
			)
		);
	}

	// Step 6: Select Optimal Packages (AI)
	const selectionResult = await selectOptimalNDCs({
		availableNDCs: candidateNDCs,
		quantityNeeded,
		unit: parsedSIG.unit,
		daysSupply: validInput.daysSupply,
		parsedSIG,
		prescriptionContext: `${validInput.drugName} - ${validInput.sig}`
	});

	if (!selectionResult.success) {
		return failure(selectionResult.error);
	}

	// Step 7: Build Complete Result
	const totalUnitsDispensed = selectionResult.data.selectedPackages.reduce(
		(sum, pkg) => sum + pkg.totalUnits,
		0
	);

	const fillDifference = totalUnitsDispensed - quantityNeeded;

	const warnings = collectWarnings(
		parsedSIG,
		selectionResult.data.warnings,
		fillDifference,
		quantityNeeded,
		parsedSIG.unit,
		{ doseRangeInferred }
	);

	const result: CalculationResult = {
		parsedSIG,
		totalQuantityNeeded: quantityNeeded,
		unit: parsedSIG.unit,
		selectedPackages: selectionResult.data.selectedPackages,
		totalUnitsDispensed,
		fillDifference,
		reasoning: selectionResult.data.reasoning,
		warnings,
			rxcui,
			availableNDCs: candidateNDCs
		};

	return {
		success: true,
		data: result
	};
}
