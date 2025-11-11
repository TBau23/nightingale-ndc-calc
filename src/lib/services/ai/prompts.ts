/**
 * Prompt templates and system messages for AI services
 */

import type { NDCPackage, PrescriptionInput } from '$lib/types';

/**
 * System prompts for different AI services
 */
export const SYSTEM_PROMPTS = {
	sigParser: `You are an expert pharmacist specializing in parsing prescription SIG (Signa) instructions.

Your task is to extract structured data from natural language prescription instructions.

Output a JSON object with the following structure:
{
  "dose": number (amount per administration),
  "unit": string (one of: tablet, capsule, mL, unit, mg, g, patch, spray, puff, drop, suppository, application),
  "frequency": object (see frequency patterns below),
  "duration": number | undefined (days, if specified),
  "route": string | undefined (oral, topical, subcutaneous, intramuscular, intravenous, rectal, ophthalmic, otic, nasal, transdermal, inhalation),
  "specialInstructions": string[] | undefined (e.g., ["with food", "at bedtime"]),
  "confidence": number (0-1, your confidence in this parsing),
  "reasoning": string (explain your parsing decisions)
}

Frequency patterns (discriminated union by "type"):
1. {"type": "times_per_day", "value": number} - e.g., "twice daily" = value: 2
2. {"type": "times_per_period", "value": number, "period": "hour"|"day"|"week"} - e.g., "every 4 hours"
3. {"type": "specific_times", "times": string[]} - e.g., ["morning", "evening"]
4. {"type": "as_needed", "maxPerDay": number | undefined} - for PRN instructions

Handle ambiguity with lower confidence scores. If critical information is missing or unclear, use your best judgment but flag it in the reasoning.`,

	ndcSelector: `You are an expert pharmacist selecting optimal medication packages from available NDC options.

Your task is to select the best package(s) to fulfill a prescription while minimizing waste and following pharmacy best practices.

Selection criteria (in priority order):
1. Only use ACTIVE NDCs (filter out inactive/discontinued)
2. Match dosage form to prescription (prefer matching form)
3. Minimize waste (closest to needed quantity without underfilling)
4. Fewest packages (prefer larger packages over many small ones)
5. Standard sizes (prefer 30, 60, 90 day supplies when possible)

Output a JSON object:
{
  "selectedPackages": [
    {
      "ndc": string (11-digit NDC),
      "quantity": number (how many of this package),
      "reasoning": string (why this package)
    }
  ],
  "warnings": [
    {
      "type": string (inactive_ndc, dosage_form_mismatch, overfill, underfill, etc.),
      "severity": "info" | "warning" | "error",
      "message": string,
      "suggestion": string | undefined
    }
  ],
  "overallReasoning": string (explain your selection strategy)
}

If significant overfill (>10%), create a warning. Prefer combinations that minimize waste.`,

	errorAdvisor: `You are a helpful pharmacy assistant explaining errors and suggesting solutions to pharmacists.

Your task is to provide clear, actionable guidance when something goes wrong during prescription processing.

Output a JSON object:
{
  "explanation": string (what went wrong in plain language),
  "suggestions": string[] (specific actionable next steps),
  "alternatives": any | undefined (alternative options if available)
}

Be professional, concise, and helpful. Focus on solutions, not blame.`
};

/**
 * Few-shot examples for SIG parsing
 */
const SIG_EXAMPLES = [
	{
		input: 'Take 1 tablet by mouth twice daily',
		output: {
			dose: 1,
			unit: 'tablet',
			frequency: { type: 'times_per_day', value: 2 },
			route: 'oral',
			confidence: 1.0,
			reasoning: 'Clear instruction: 1 tablet, twice per day, oral route'
		}
	},
	{
		input: 'Inject 10 units subcutaneously before meals and 15 units at bedtime',
		output: {
			dose: 10,
			unit: 'unit',
			frequency: { type: 'specific_times', times: ['before meals', 'at bedtime'] },
			route: 'subcutaneous',
			specialInstructions: ['variable dosing: 10 before meals, 15 at bedtime'],
			confidence: 0.9,
			reasoning:
				'Complex insulin regimen with variable dosing. Using lower dose (10) as primary, noted variation in specialInstructions'
		}
	},
	{
		input: 'Take 1-2 tablets every 4-6 hours as needed for pain',
		output: {
			dose: 1,
			unit: 'tablet',
			frequency: { type: 'as_needed', maxPerDay: 6 },
			specialInstructions: ['for pain', 'variable dose 1-2 tablets', 'every 4-6 hours'],
			confidence: 0.7,
			reasoning:
				'PRN with variable dosing and timing. Used minimum dose (1 tablet) and estimated max 6 times per day (every 4 hours)'
		}
	}
];

/**
 * Build SIG parsing prompt
 */
export function buildSIGPrompt(
	sig: string,
	daysSupply: number
): Array<{ role: 'system' | 'user'; content: string }> {
	return [
		{
			role: 'system',
			content: SYSTEM_PROMPTS.sigParser
		},
		{
			role: 'user',
			content: `Parse this SIG instruction:

SIG: "${sig}"
Days Supply: ${daysSupply}

If duration is not specified in the SIG, you may infer it from days supply if reasonable.

Return the structured JSON output.`
		}
	];
}

/**
 * Input for NDC selection
 */
export interface NDCSelectionInput {
	availableNDCs: NDCPackage[];
	quantityNeeded: number;
	unit: string;
	daysSupply: number;
	prescriptionContext?: string;
}

/**
 * Build NDC selection prompt
 */
export function buildNDCSelectionPrompt(
	input: NDCSelectionInput
): Array<{ role: 'system' | 'user'; content: string }> {
	const ndcSummary = input.availableNDCs
		.map(
			(ndc) =>
				`- NDC: ${ndc.ndc}, Size: ${ndc.packageSize} ${input.unit}, Form: ${ndc.dosageForm}, Status: ${ndc.status}, Mfr: ${ndc.manufacturer}`
		)
		.join('\n');

	return [
		{
			role: 'system',
			content: SYSTEM_PROMPTS.ndcSelector
		},
		{
			role: 'user',
			content: `Select optimal package(s) for this prescription:

Quantity Needed: ${input.quantityNeeded} ${input.unit}
Days Supply: ${input.daysSupply}
${input.prescriptionContext ? `Context: ${input.prescriptionContext}` : ''}

Available NDC Packages:
${ndcSummary}

Return the JSON output with selected packages, warnings, and reasoning.`
		}
	];
}

/**
 * Input for error advice
 */
export interface ErrorAdviceInput {
	errorType: string;
	errorMessage: string;
	originalInput: PrescriptionInput;
	partialData?: any;
}

/**
 * Build error advice prompt
 */
export function buildErrorAdvicePrompt(
	input: ErrorAdviceInput
): Array<{ role: 'system' | 'user'; content: string }> {
	return [
		{
			role: 'system',
			content: SYSTEM_PROMPTS.errorAdvisor
		},
		{
			role: 'user',
			content: `An error occurred while processing this prescription:

Error Type: ${input.errorType}
Error Message: ${input.errorMessage}

Original Input:
- Drug: ${input.originalInput.drugName}
${input.originalInput.ndc ? `- NDC: ${input.originalInput.ndc}` : ''}
- SIG: ${input.originalInput.sig}
- Days Supply: ${input.originalInput.daysSupply}

${input.partialData ? `Partial Data Collected:\n${JSON.stringify(input.partialData, null, 2)}` : ''}

Provide helpful guidance as JSON with explanation, suggestions, and alternatives.`
		}
	];
}
