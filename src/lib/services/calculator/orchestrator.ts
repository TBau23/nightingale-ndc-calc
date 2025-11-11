/**
 * Calculation orchestrator - Main entry point for prescription processing
 */

import { calculateTotalQuantity } from './quantityCalc.js';
import { parseSIG, selectOptimalNDCs } from '$lib/services/ai';
import { normalizeToRxCUI, searchNDCsByDrug } from '$lib/services/external';
import {
	PrescriptionInputSchema,
	ValidationError,
	NDCNotFoundError,
	InvalidSIGError
} from '$lib/types';
import type {
	PrescriptionInput,
	CalculationResult,
	Result,
	NightingaleError,
	Warning,
	ParsedSIG
} from '$lib/types';
import { ok, err } from '$lib/types';

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
	unit: string
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
): Promise<Result<CalculationResult, NightingaleError>> {
	// Step 1: Validate Input
	const validation = PrescriptionInputSchema.safeParse(input);
	if (!validation.success) {
		const firstError = validation.error.errors[0];
		return err(new ValidationError(firstError.path.join('.'), firstError.message));
	}

	const validInput = validation.data;

	// Step 2: Parse SIG (AI)
	const sigResult = await parseSIG(validInput.sig, validInput.daysSupply);
	if (!sigResult.success) {
		return err(sigResult.error);
	}
	const parsedSIG = sigResult.data;

	// Step 3: Normalize Drug Name to RxCUI (optional - for reference)
	let rxcui: string | undefined;
	if (!validInput.ndc) {
		const rxcuiResult = await normalizeToRxCUI(validInput.drugName);
		if (rxcuiResult.success) {
			rxcui = rxcuiResult.data.rxcui;
		}
		// Don't fail if RxCUI not found - continue with drug name
	}

	// Step 4: Get Available NDCs
	const ndcsResult = await searchNDCsByDrug(validInput.drugName);
	if (!ndcsResult.success) {
		return err(ndcsResult.error);
	}

	// Filter to active only
	const activeNDCs = ndcsResult.data.filter((ndc) => ndc.status === 'active');
	if (activeNDCs.length === 0) {
		return err(new NDCNotFoundError(`No active NDCs found for ${validInput.drugName}`));
	}

	// Step 5: Calculate Total Quantity Needed
	const quantityNeeded = calculateTotalQuantity(parsedSIG, validInput.daysSupply);
	if (quantityNeeded <= 0) {
		return err(
			new InvalidSIGError(
				validInput.sig,
				'Cannot calculate quantity from parsed SIG - result is zero or negative'
			)
		);
	}

	// Step 6: Select Optimal Packages (AI)
	const selectionResult = await selectOptimalNDCs({
		availableNDCs: activeNDCs,
		quantityNeeded,
		unit: parsedSIG.unit,
		daysSupply: validInput.daysSupply,
		prescriptionContext: `${validInput.drugName} - ${validInput.sig}`
	});

	if (!selectionResult.success) {
		return err(selectionResult.error);
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
		parsedSIG.unit
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
		availableNDCs: activeNDCs
	};

	return ok(result);
}
