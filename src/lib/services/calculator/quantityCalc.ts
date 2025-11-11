/**
 * Quantity calculation utilities
 */

import type { ParsedSIG } from '$lib/types';

/**
 * Convert frequency period to times per day
 *
 * @param value - Frequency value
 * @param period - Time period (hour, day, week)
 * @returns Times per day
 */
function convertToTimesPerDay(value: number, period: 'hour' | 'day' | 'week'): number {
	switch (period) {
		case 'hour':
			// Every X hours = 24/X times per day
			return 24 / value;
		case 'day':
			// X times per day
			return value;
		case 'week':
			// X times per week = X/7 times per day
			return value / 7;
	}
}

/**
 * Calculate total quantity needed based on parsed SIG
 *
 * @param sig - Parsed SIG data
 * @param daysSupply - Number of days supply
 * @returns Total quantity needed (in units specified by sig.unit)
 *
 * @example
 * ```ts
 * const sig = {
 *   dose: 1,
 *   unit: 'tablet',
 *   frequency: { type: 'times_per_day', value: 2 },
 *   ...
 * };
 * const quantity = calculateTotalQuantity(sig, 30); // Returns 60
 * ```
 */
export function calculateTotalQuantity(sig: ParsedSIG, daysSupply: number): number {
	// Use duration from SIG if specified and less than daysSupply
	const effectiveDays = sig.duration && sig.duration < daysSupply ? sig.duration : daysSupply;

	let totalQuantity = 0;

	switch (sig.frequency.type) {
		case 'times_per_day':
			// dose × times_per_day × days
			totalQuantity = sig.dose * sig.frequency.value * effectiveDays;
			break;

		case 'times_per_period':
			// Convert to times per day, then calculate
			const timesPerDay = convertToTimesPerDay(sig.frequency.value, sig.frequency.period);
			totalQuantity = sig.dose * timesPerDay * effectiveDays;
			break;

		case 'specific_times':
			// dose × number of times × days
			totalQuantity = sig.dose * sig.frequency.times.length * effectiveDays;
			break;

		case 'as_needed':
			// Use maxPerDay if specified, otherwise use conservative estimate
			const maxPerDay = sig.frequency.maxPerDay || 4; // Conservative default
			totalQuantity = sig.dose * maxPerDay * effectiveDays;
			break;

		default:
			// Exhaustive check
			const _exhaustive: never = sig.frequency;
			return 0;
	}

	// Round up to nearest whole number
	return Math.ceil(totalQuantity);
}
