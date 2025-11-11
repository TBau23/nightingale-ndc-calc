/**
 * Common types and utilities for the Nightingale application
 */

/**
 * Generic result type for operations that can succeed or fail.
 * Use this for type-safe error handling throughout the application.
 *
 * @template T - The success data type
 * @template E - The error type (defaults to Error)
 *
 * @example
 * ```ts
 * function divide(a: number, b: number): Result<number> {
 *   if (b === 0) {
 *     return err(new Error('Division by zero'));
 *   }
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (result.success) {
 *   console.log(result.data); // 5
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export type Result<T, E = Error> =
	| { success: true; data: T }
	| { success: false; error: E };

/**
 * Helper to create a successful result
 *
 * @param data - The success data
 * @returns A success Result
 */
export function ok<T>(data: T): Result<T, never> {
	return { success: true, data };
}

/**
 * Helper to create a failed result
 *
 * @param error - The error
 * @returns A failure Result
 */
export function err<E>(error: E): Result<never, E> {
	return { success: false, error };
}

/**
 * Standard API response wrapper
 */
export interface APIResponse<T> {
	/** Response data (present on success) */
	data?: T;

	/** Error message (present on failure) */
	error?: string;

	/** ISO timestamp of the response */
	timestamp: string;
}
