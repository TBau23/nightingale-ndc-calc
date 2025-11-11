/**
 * NDC and drug information types
 */

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

export type DosageForm = (typeof DOSAGE_FORMS)[number];

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
 *
 * @param value - Value to check
 * @returns True if value is a valid NDCPackage
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
