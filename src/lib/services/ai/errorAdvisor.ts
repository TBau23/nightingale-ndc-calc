/**
 * Error Advisor - Provides contextual guidance when errors occur
 */

import { chatCompletion } from './openai.js';
import { buildErrorAdvicePrompt, type ErrorAdviceInput } from './prompts.js';
import { AIServiceError, type NightingaleError, type ErrorAdvice, type Result } from '$lib/types';
import { ok, err } from '$lib/types';
import { z } from 'zod';

/**
 * Advice output schema
 */
const AdviceSchema = z.object({
	explanation: z.string(),
	suggestions: z.array(z.string()),
	alternatives: z.any().optional()
});

/**
 * Advice output
 */
/**
 * Backwards-compatible alias (deprecated)
 * @deprecated use ErrorAdvice from $lib/types instead
 */
export type Advice = ErrorAdvice;

/**
 * Get helpful advice for an error that occurred
 *
 * @param error - The error that occurred
 * @param context - Additional context about the error
 * @returns Result with advice
 *
 * @example
 * ```ts
 * const result = await adviseOnError(
 *   new NDCNotFoundError("12345678901"),
 *   {
 *     originalInput: prescriptionInput,
 *     partialData: { parsedSIG: ... }
 *   }
 * );
 * if (result.success) {
 *   console.log(result.data.explanation);
 *   console.log(result.data.suggestions);
 * }
 * ```
 */
export async function adviseOnError(
	error: NightingaleError,
	context: Omit<ErrorAdviceInput, 'errorType' | 'errorMessage'>
): Promise<Result<ErrorAdvice, AIServiceError>> {
	// Build error input
	const errorInput: ErrorAdviceInput = {
		errorType: error.code,
		errorMessage: error.message,
		originalInput: context.originalInput,
		partialData: context.partialData
	};

	// Build prompt
	const messages = buildErrorAdvicePrompt(errorInput);

	// Call OpenAI with JSON mode
	const aiResult = await chatCompletion<any>(messages, {
		jsonMode: true,
		maxTokens: 800,
		serviceName: 'Error Advisor'
	});

	if (!aiResult.success) {
		return err(aiResult.error);
	}

	// Validate against schema
	const validation = AdviceSchema.safeParse(aiResult.data);

	if (!validation.success) {
		const errorDetails = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
		return err(
			new AIServiceError(
				'Error Advisor',
				`AI returned invalid advice structure: ${errorDetails}`
			)
		);
	}

	return ok(validation.data);
}
