/**
 * SIG (Signa) Parser - Parses natural language prescription instructions
 */

import { chatCompletion } from './openai.js';
import { buildSIGPrompt } from './prompts.js';
import { ParsedSIGSchema, AIServiceError } from '$lib/types';
import type { ParsedSIG, Result } from '$lib/types';
import { ok, err } from '$lib/types';

/**
 * Parse natural language SIG into structured data
 *
 * @param sig - Natural language prescription instruction
 * @param daysSupply - Number of days the prescription should last
 * @returns Result with ParsedSIG or AIServiceError
 *
 * @example
 * ```ts
 * const result = await parseSIG("Take 1 tablet by mouth twice daily", 30);
 * if (result.success) {
 *   console.log(result.data.dose); // 1
 *   console.log(result.data.frequency); // { type: 'times_per_day', value: 2 }
 * }
 * ```
 */
export async function parseSIG(sig: string, daysSupply: number): Promise<Result<ParsedSIG, AIServiceError>> {
	// Validate inputs
	if (!sig || sig.trim().length === 0) {
		return err(new AIServiceError('SIG Parser', 'SIG cannot be empty'));
	}

	if (daysSupply <= 0 || daysSupply > 365) {
		return err(new AIServiceError('SIG Parser', 'Days supply must be between 1 and 365'));
	}

	// Build prompt
	const messages = buildSIGPrompt(sig, daysSupply);

	// Call OpenAI with JSON mode
	const aiResult = await chatCompletion<any>(messages, {
		jsonMode: true,
		maxTokens: 1500,
		serviceName: 'SIG Parser'
	});

	if (!aiResult.success) {
		return err(aiResult.error);
	}

	// Add originalSIG to the response
	const parsedData = {
		...aiResult.data,
		originalSIG: sig
	};

	// Validate against schema
	const validation = ParsedSIGSchema.safeParse(parsedData);

	if (!validation.success) {
		const errorDetails = validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
		return err(
			new AIServiceError(
				'SIG Parser',
				`AI returned invalid ParsedSIG structure: ${errorDetails}`
			)
		);
	}

	const parsedSIG = validation.data;

	// Warn if confidence is low
	if (parsedSIG.confidence < 0.6) {
		console.warn(
			`[SIG Parser] Low confidence (${parsedSIG.confidence}) for SIG: "${sig}". Reasoning: ${parsedSIG.reasoning}`
		);
	}

	return ok(parsedSIG);
}
