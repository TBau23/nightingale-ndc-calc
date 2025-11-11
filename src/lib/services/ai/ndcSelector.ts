/**
 * NDC Selector - AI-powered selection of optimal NDC packages
 */

import { chatCompletion } from './openai.js';
import { buildNDCSelectionPrompt, type NDCSelectionInput } from './prompts.js';
import { WarningSchema, AIServiceError } from '$lib/types';
import type { NDCPackage, Warning, Result } from '$lib/types';
import { ok, err } from '$lib/types';
import { z } from 'zod';

/**
 * Selected package from AI
 */
interface AISelectedPackage {
	ndc: string;
	quantity: number;
	reasoning: string;
}

/**
 * AI selection output schema
 */
const AISelectionOutputSchema = z.object({
	selectedPackages: z.array(
		z.object({
			ndc: z.string(),
			quantity: z.number().positive().int(),
			reasoning: z.string()
		})
	),
	warnings: z.array(WarningSchema),
	overallReasoning: z.string()
});

/**
 * Output from NDC selector
 */
export interface NDCSelectionOutput {
	selectedPackages: Array<{
		package: NDCPackage;
		quantity: number;
		totalUnits: number;
	}>;
	reasoning: string;
	warnings: Warning[];
}

/**
 * Select optimal NDC package(s) from available options
 *
 * @param input - Selection parameters
 * @returns Result with selected packages and reasoning
 *
 * @example
 * ```ts
 * const result = await selectOptimalNDCs({
 *   availableNDCs: [...],
 *   quantityNeeded: 60,
 *   unit: 'tablet',
 *   daysSupply: 30
 * });
 * ```
 */
export async function selectOptimalNDCs(
	input: NDCSelectionInput
): Promise<Result<NDCSelectionOutput, AIServiceError>> {
	// Validate inputs
	if (input.availableNDCs.length === 0) {
		return err(new AIServiceError('NDC Selector', 'No NDC packages available for selection'));
	}

	if (input.quantityNeeded <= 0) {
		return err(new AIServiceError('NDC Selector', 'Quantity needed must be positive'));
	}

	// Build prompt
	const messages = buildNDCSelectionPrompt(input);

	// Call OpenAI with JSON mode
	const aiResult = await chatCompletion<any>(messages, {
		jsonMode: true,
		maxTokens: 1000,
		serviceName: 'NDC Selector'
	});

	if (!aiResult.success) {
		return err(aiResult.error);
	}

	// Validate against schema
	const validation = AISelectionOutputSchema.safeParse(aiResult.data);

	if (!validation.success) {
		const errorDetails = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
		return err(
			new AIServiceError(
				'NDC Selector',
				`AI returned invalid selection structure: ${errorDetails}`
			)
		);
	}

	const aiSelection = validation.data;

	// Map AI selections to full NDC packages
	const selectedPackages = aiSelection.selectedPackages.map((selected: AISelectedPackage) => {
		const ndcPackage = input.availableNDCs.find((ndc) => ndc.ndc === selected.ndc);

		if (!ndcPackage) {
			throw new AIServiceError(
				'NDC Selector',
				`AI selected NDC ${selected.ndc} which is not in available packages`
			);
		}

		return {
			package: ndcPackage,
			quantity: selected.quantity,
			totalUnits: ndcPackage.packageSize * selected.quantity
		};
	});

	// Verify we have at least one package
	if (selectedPackages.length === 0) {
		return err(new AIServiceError('NDC Selector', 'AI did not select any packages'));
	}

	return ok({
		selectedPackages,
		reasoning: aiSelection.overallReasoning,
		warnings: aiSelection.warnings
	});
}
