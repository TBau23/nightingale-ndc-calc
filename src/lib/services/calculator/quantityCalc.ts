/**
 * Quantity calculation utilities
 */

import type { ParsedSIG } from '$lib/types';

const DEFAULT_PRN_MAX_PER_DAY = 4;

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

	const scheduledQuantity = calculateFromDoseSchedule(sig, effectiveDays);
	if (scheduledQuantity !== null) {
		return Math.ceil(scheduledQuantity);
	}

	const doseToUse = sig.doseRange?.max ?? sig.dose;
	let totalQuantity = 0;

	switch (sig.frequency.type) {
		case 'times_per_day': {
			totalQuantity = doseToUse * sig.frequency.value * effectiveDays;
			break;
		}

		case 'times_per_period': {
			const timesPerDay = convertToTimesPerDay(sig.frequency.value, sig.frequency.period);
			totalQuantity = doseToUse * timesPerDay * effectiveDays;
			break;
		}

		case 'specific_times': {
			totalQuantity = doseToUse * sig.frequency.times.length * effectiveDays;
			break;
		}

		case 'as_needed': {
			const maxPerDay = sig.frequency.maxPerDay || DEFAULT_PRN_MAX_PER_DAY;
			totalQuantity = doseToUse * maxPerDay * effectiveDays;
			break;
		}

		default: {
			const _exhaustive: never = sig.frequency;
			return _exhaustive;
		}
	}

	return Math.ceil(totalQuantity);
}

/**
 * Calculate quantity when detailed dose schedule is provided
 */
function calculateFromDoseSchedule(sig: ParsedSIG, days: number): number | null {
	if (!sig.doseSchedule || sig.doseSchedule.length === 0) {
		return null;
	}

	const dailyTotal = sig.doseSchedule.reduce((sum, entry) => {
		const occurrences = entry.occurrencesPerDay && entry.occurrencesPerDay > 0 ? entry.occurrencesPerDay : 1;
		return sum + entry.dose * occurrences;
	}, 0);

	return dailyTotal * days;
}
