/**
 * POST /api/calculate - Main prescription calculation endpoint
 */

import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { calculatePrescription } from '$lib/services/calculator';
import { adviseOnError } from '$lib/services/ai';
import { PrescriptionInputSchema, type ErrorAdvice } from '$lib/types';

/**
 * Calculate prescription endpoint
 *
 * @example
 * POST /api/calculate
 * {
 *   "drugName": "Lisinopril",
 *   "sig": "Take 1 tablet by mouth once daily",
 *   "daysSupply": 30
 * }
 */
export async function POST({ request }: RequestEvent) {
	const startTime = Date.now();

	try {
		// Parse request body
		const body = await request.json();

		console.log('[API] POST /api/calculate', {
			drugName: body.drugName,
			daysSupply: body.daysSupply
		});

		// Validate input
		const validation = PrescriptionInputSchema.safeParse(body);
		if (!validation.success) {
			const firstError = validation.error.errors[0];
			console.warn('[API] Validation error:', firstError);

			return json(
				{
					success: false,
					error: {
						code: 'VALIDATION_ERROR',
						message: firstError.message,
						statusCode: 400
					},
					timestamp: new Date().toISOString()
				},
				{ status: 400 }
			);
		}

		// Call calculation engine
		const result = await calculatePrescription(validation.data);

		if (!result.success) {
			// Map error to HTTP status
			const statusCode = result.error.statusCode || 500;

			let advice: ErrorAdvice | undefined;
			try {
				const adviceResult = await adviseOnError(result.error, {
					originalInput: validation.data,
					partialData: result.context
				});
				if (adviceResult.success) {
					advice = adviceResult.data;
				} else {
					console.warn('[API] Advice generation failed:', adviceResult.error.message);
				}
			} catch (adviceError) {
				console.warn('[API] Advice generation threw error:', adviceError);
			}

			console.error('[API] Calculate error:', {
				drugName: validation.data.drugName,
				error: result.error.code,
				message: result.error.message
			});

			return json(
				{
					success: false,
					error: {
						code: result.error.code,
						message: result.error.message,
						statusCode,
						advice
					},
					timestamp: new Date().toISOString()
				},
				{ status: statusCode }
			);
		}

		// Success response
		const duration = Date.now() - startTime;
		console.log('[API] Calculate success', {
			drugName: validation.data.drugName,
			duration: `${duration}ms`,
			quantityNeeded: result.data.totalQuantityNeeded,
			packagesSelected: result.data.selectedPackages.length
		});

		return json(
			{
				success: true,
				data: result.data,
				timestamp: new Date().toISOString()
			},
			{ status: 200 }
		);
	} catch (error: any) {
		// Unexpected error
		console.error('[API] Calculate unexpected error:', error);

		return json(
			{
				success: false,
				error: {
					code: 'INTERNAL_ERROR',
					message: 'An unexpected error occurred',
					statusCode: 500
				},
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
}
