/**
 * OpenAI client wrapper with retry logic and error handling
 */

import OpenAI from 'openai';
import { AIServiceError } from '$lib/types';
import type { Result } from '$lib/types';
import { ok, err } from '$lib/types';

/**
 * AI configuration settings
 */
const AI_CONFIG = {
	model: process.env.OPENAI_MODEL || 'gpt-4o',
	temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
	maxTokens: {
		sigParser: parseInt(process.env.OPENAI_MAX_TOKENS || '1500'),
		ndcSelector: 1000,
		errorAdvisor: 800
	},
	timeout: parseInt(process.env.OPENAI_TIMEOUT_MS || '30000'),
	maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3')
} as const;

/**
 * Initialize OpenAI client
 */
let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
	if (!openaiClient) {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new AIServiceError('OpenAI Client', 'OPENAI_API_KEY environment variable is not set');
		}
		openaiClient = new OpenAI({
			apiKey,
			timeout: AI_CONFIG.timeout,
			maxRetries: AI_CONFIG.maxRetries
		});
	}
	return openaiClient;
}

/**
 * Sleep for exponential backoff
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if error is retryable
 */
function isRetryableError(error: any): boolean {
	// Retry on rate limits and network errors
	if (error?.status === 429) return true; // Rate limit
	if (error?.status === 503) return true; // Service unavailable
	if (error?.code === 'ECONNRESET') return true; // Network error
	if (error?.code === 'ETIMEDOUT') return true; // Timeout
	return false;
}

/**
 * Generic chat completion with optional JSON mode
 *
 * @param messages - Array of chat messages
 * @param options - Optional configuration
 * @returns Result with parsed response
 */
export async function chatCompletion<T>(
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
	options?: {
		jsonMode?: boolean;
		maxTokens?: number;
		temperature?: number;
		serviceName?: string;
	}
): Promise<Result<T, AIServiceError>> {
	const client = getClient();
	const serviceName = options?.serviceName || 'OpenAI';
	let lastError: any;

	for (let attempt = 1; attempt <= AI_CONFIG.maxRetries; attempt++) {
		try {
			const response = await client.chat.completions.create({
				model: AI_CONFIG.model,
				messages,
				temperature: options?.temperature ?? AI_CONFIG.temperature,
				max_tokens: options?.maxTokens ?? AI_CONFIG.maxTokens.sigParser,
				...(options?.jsonMode && { response_format: { type: 'json_object' } })
			});

			const content = response.choices[0]?.message?.content;
			if (!content) {
				return err(new AIServiceError(serviceName, 'Empty response from OpenAI'));
			}

			// Parse JSON if in JSON mode
			if (options?.jsonMode) {
				try {
					const parsed = JSON.parse(content) as T;
					return ok(parsed);
				} catch (parseError) {
					return err(
						new AIServiceError(
							serviceName,
							`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
						)
					);
				}
			}

			// Return raw content as string
			return ok(content as T);
		} catch (error: any) {
			lastError = error;

			// Don't retry on non-retryable errors
			if (!isRetryableError(error)) {
				break;
			}

			// Don't retry on last attempt
			if (attempt === AI_CONFIG.maxRetries) {
				break;
			}

			// Exponential backoff: 1s, 2s, 4s
			const backoffMs = Math.pow(2, attempt - 1) * 1000;
			await sleep(backoffMs);
		}
	}

	// All retries failed
	const errorMessage =
		lastError?.message || lastError?.error?.message || 'Unknown OpenAI error';
	return err(new AIServiceError(serviceName, `OpenAI request failed: ${errorMessage}`));
}

/**
 * Get AI configuration (useful for testing/debugging)
 */
export function getAIConfig() {
	return AI_CONFIG;
}
