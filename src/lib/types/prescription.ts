/**
 * Prescription-related types and schemas
 */

import { z } from 'zod';

/**
 * Unit of measurement for medication
 */
export const MEDICATION_UNITS = [
	'tablet',
	'capsule',
	'mL',
	'unit', // for insulin
	'mg',
	'g',
	'patch',
	'spray',
	'puff', // for inhalers
	'drop',
	'suppository',
	'application'
] as const;

export type MedicationUnit = (typeof MEDICATION_UNITS)[number];

/**
 * Route of administration
 */
export const ROUTES = [
	'oral',
	'topical',
	'subcutaneous',
	'intramuscular',
	'intravenous',
	'rectal',
	'ophthalmic',
	'otic',
	'nasal',
	'transdermal',
	'inhalation'
] as const;

export type Route = (typeof ROUTES)[number];

/**
 * Frequency pattern types for medication dosing schedules.
 * Uses discriminated union for type-safe frequency handling.
 */
export type FrequencyPattern =
	| { type: 'times_per_day'; value: number }
	| { type: 'times_per_period'; value: number; period: 'hour' | 'day' | 'week' }
	| { type: 'specific_times'; times: string[] }
	| { type: 'as_needed'; maxPerDay?: number };

/**
 * Prescription input from user
 */
export interface PrescriptionInput {
	/** Drug name (e.g., "Lisinopril", "Metformin") */
	drugName: string;

	/** Optional specific NDC if known (11-digit format) */
	ndc?: string;

	/** Prescription instructions (natural language) */
	sig: string;

	/** Days supply for the prescription */
	daysSupply: number;
}

/**
 * Zod schema for PrescriptionInput with validation
 */
export const PrescriptionInputSchema = z.object({
	drugName: z.string().min(1, 'Drug name is required').max(200, 'Drug name too long'),
	ndc: z
		.string()
		.regex(/^\d{11}$/, 'NDC must be 11 digits')
		.optional(),
	sig: z.string().min(1, 'SIG is required').max(500, 'SIG too long'),
	daysSupply: z
		.number()
		.positive('Days supply must be positive')
		.int('Days supply must be a whole number')
		.max(365, 'Days supply cannot exceed 365 days')
});

/**
 * Type inferred from schema (should match PrescriptionInput)
 */
export type PrescriptionInputValidated = z.infer<typeof PrescriptionInputSchema>;

/**
 * Structured SIG data parsed from natural language by AI
 */
export interface ParsedSIG {
	/** Dose amount per administration */
	dose: number;

	/** Unit of measurement */
	unit: MedicationUnit;

	/** Frequency pattern */
	frequency: FrequencyPattern;

	/** Duration in days (if specified in SIG) */
	duration?: number;

	/** Route of administration */
	route?: Route;

	/** Special instructions (e.g., "with food", "at bedtime") */
	specialInstructions?: string[];

	/** AI confidence score (0-1) */
	confidence: number;

	/** Natural language explanation of the parsing */
	reasoning: string;

	/** Original SIG text for reference */
	originalSIG: string;
}

/**
 * Zod schema for FrequencyPattern discriminated union
 */
const FrequencyPatternSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('times_per_day'),
		value: z.number().positive().int()
	}),
	z.object({
		type: z.literal('times_per_period'),
		value: z.number().positive().int(),
		period: z.enum(['hour', 'day', 'week'])
	}),
	z.object({
		type: z.literal('specific_times'),
		times: z.array(z.string()).min(1)
	}),
	z.object({
		type: z.literal('as_needed'),
		maxPerDay: z.number().positive().int().optional()
	})
]);

/**
 * Zod schema for ParsedSIG
 */
export const ParsedSIGSchema = z.object({
	dose: z.number().positive(),
	unit: z.enum(MEDICATION_UNITS),
	frequency: FrequencyPatternSchema,
	duration: z.number().positive().int().optional(),
	route: z.enum(ROUTES).optional(),
	specialInstructions: z.array(z.string()).optional(),
	confidence: z.number().min(0).max(1),
	reasoning: z.string(),
	originalSIG: z.string()
});
