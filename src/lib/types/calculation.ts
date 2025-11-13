/**
 * Calculation result types
 */

import { z } from 'zod';
import { MEDICATION_UNITS, type MedicationUnit } from './prescription.js';
import { NDCPackageSchema, type NDCPackage } from './ndc.js';
import { ParsedSIGSchema, type ParsedSIG } from './prescription.js';
import type { NightingaleError } from './errors.js';

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
	'low_confidence_parse',
	'dose_range_assumption'
] as const;

export type WarningType = (typeof WARNING_TYPES)[number];

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

/**
 * Partial data collected during calculation (useful for error advice)
 */
export interface CalculationContext {
	parsedSIG?: ParsedSIG;
	rxcui?: string;
	quantityNeeded?: number;
	doseRangeInferred?: boolean;
}

/**
 * Calculation outcome including optional context on failure
 */
export type CalculationOutcome =
	| {
			success: true;
			data: CalculationResult;
			context?: undefined;
	  }
	| {
			success: false;
			error: NightingaleError;
			context?: CalculationContext;
	  };
