/**
 * HTTP utilities with retry logic and error handling
 */

import { ExternalAPIError } from '$lib/types';
import { env } from '$env/dynamic/private';

/**
 * HTTP configuration
 */
const HTTP_CONFIG = {
	timeout: parseInt(env.API_TIMEOUT_MS || '10000'),
	maxRetries: parseInt(env.API_MAX_RETRIES || '3')
} as const;

/**
 * Sleep for a given duration
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable
 *
 * @param error - The error to check
 * @returns True if the error should be retried
 */
export function isRetryableError(error: any): boolean {
	// Network errors
	if (error?.code === 'ECONNRESET') return true;
	if (error?.code === 'ETIMEDOUT') return true;
	if (error?.code === 'ENOTFOUND') return true;

	// HTTP status codes
	if (error?.status === 429) return true; // Rate limit
	if (error?.status === 503) return true; // Service unavailable
	if (error?.status === 504) return true; // Gateway timeout

	// Fetch errors
	if (error?.name === 'AbortError') return true; // Timeout
	if (error?.name === 'FetchError') return true; // Network error

	return false;
}

/**
 * Fetch with timeout support
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Response
 */
async function fetchWithTimeout(
	url: string,
	options: RequestInit = {},
	timeoutMs: number = HTTP_CONFIG.timeout
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		});
		return response;
	} finally {
		clearTimeout(timeoutId);
	}
}

/**
 * Fetch with retry logic and exponential backoff
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param apiName - API name for error messages
 * @returns Response
 * @throws ExternalAPIError if all retries fail
 */
export async function fetchWithRetry(
	url: string,
	options: RequestInit = {},
	apiName: string = 'External API'
): Promise<Response> {
	let lastError: any;

	for (let attempt = 1; attempt <= HTTP_CONFIG.maxRetries; attempt++) {
		try {
			const response = await fetchWithTimeout(url, options);

			// Check for HTTP errors
			if (!response.ok) {
				const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
				error.status = response.status;

				// Don't retry on 4xx errors (except 429 rate limit)
				if (response.status >= 400 && response.status < 500 && response.status !== 429) {
					throw new ExternalAPIError(apiName, error);
				}

				throw error;
			}

			return response;
		} catch (error: any) {
			lastError = error;

			// If it's already an ExternalAPIError, don't retry
			if (error instanceof ExternalAPIError) {
				throw error;
			}

			// Don't retry on non-retryable errors
			if (!isRetryableError(error)) {
				break;
			}

			// Don't retry on last attempt
			if (attempt === HTTP_CONFIG.maxRetries) {
				break;
			}

			// Exponential backoff: 1s, 2s, 4s
			const backoffMs = Math.pow(2, attempt - 1) * 1000;
			await sleep(backoffMs);
		}
	}

	// All retries failed
	const errorMessage = lastError?.message || 'Unknown error';
	throw new ExternalAPIError(apiName, lastError || new Error(errorMessage));
}

/**
 * Fetch JSON with retry logic
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param apiName - API name for error messages
 * @returns Parsed JSON response
 * @throws ExternalAPIError if request fails or JSON parsing fails
 */
export async function fetchJSON<T>(
	url: string,
	options: RequestInit = {},
	apiName: string = 'External API'
): Promise<T> {
	try {
		const response = await fetchWithRetry(url, options, apiName);
		const data = await response.json();
		return data as T;
	} catch (error: any) {
		if (error instanceof ExternalAPIError) {
			throw error;
		}
		throw new ExternalAPIError(apiName, error);
	}
}

/**
 * Get HTTP configuration (useful for testing)
 */
export function getHTTPConfig() {
	return HTTP_CONFIG;
}
