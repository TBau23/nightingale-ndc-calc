/**
 * RxNorm API client for drug normalization
 */

import { fetchJSON } from './http.js';
import { getRxNormCache } from './cache.js';
import { DrugNormalizationError, RxNormConceptSchema } from '$lib/types';
import type { Result, RxNormConcept, RxNormResponse } from '$lib/types';
import { ok, err } from '$lib/types';

/**
 * RxNorm API base URL
 */
const RXNORM_BASE_URL = process.env.RXNORM_API_URL || 'https://rxnav.nlm.nih.gov/REST';

/**
 * Normalize drug name to RxCUI
 *
 * @param drugName - Drug name to normalize
 * @returns Result with RxNormConcept or DrugNormalizationError
 *
 * @example
 * ```ts
 * const result = await normalizeToRxCUI("Lisinopril");
 * if (result.success) {
 *   console.log(result.data.rxcui); // "314076"
 * }
 * ```
 */
export async function normalizeToRxCUI(
	drugName: string
): Promise<Result<RxNormConcept, DrugNormalizationError>> {
	// Validate input
	if (!drugName || drugName.trim().length === 0) {
		return err(new DrugNormalizationError(drugName, 'Drug name cannot be empty'));
	}

	const normalizedName = drugName.trim().toLowerCase();

	// Check cache
	const cacheKey = `rxnorm:drug:${normalizedName}`;
	const cached = getRxNormCache().get(cacheKey);
	if (cached) {
		return ok(cached);
	}

	// Try exact match first
	const exactResult = await tryExactMatch(drugName);
	if (exactResult.success) {
		getRxNormCache().set(cacheKey, exactResult.data);
		return exactResult;
	}

	// Try approximate match
	const approxResult = await tryApproximateMatch(drugName);
	if (approxResult.success) {
		getRxNormCache().set(cacheKey, approxResult.data);
		return approxResult;
	}

	return err(new DrugNormalizationError(drugName, 'No matching RxCUI found'));
}

/**
 * Try exact match for drug name
 */
async function tryExactMatch(
	drugName: string
): Promise<Result<RxNormConcept, DrugNormalizationError>> {
	try {
		const url = `${RXNORM_BASE_URL}/rxcui.json?name=${encodeURIComponent(drugName)}`;
		const data = await fetchJSON<RxNormResponse>(url, {}, 'RxNorm API');

		const rxcui = data.idGroup?.rxnormId?.[0];
		if (!rxcui) {
			return err(new DrugNormalizationError(drugName, 'No exact match found'));
		}

		// Get details for the RxCUI
		return await getRxNormDetails(rxcui);
	} catch (error: any) {
		return err(new DrugNormalizationError(drugName, `Exact match failed: ${error.message}`));
	}
}

/**
 * Try approximate match for drug name
 */
async function tryApproximateMatch(
	drugName: string
): Promise<Result<RxNormConcept, DrugNormalizationError>> {
	try {
		const url = `${RXNORM_BASE_URL}/approximateTerm.json?term=${encodeURIComponent(drugName)}&maxEntries=1`;
		const data = await fetchJSON<RxNormResponse>(url, {}, 'RxNorm API');

		const candidate = data.approximateGroup?.candidate?.[0];
		if (!candidate || !candidate.rxcui) {
			return err(new DrugNormalizationError(drugName, 'No approximate match found'));
		}

		const concept: RxNormConcept = {
			rxcui: candidate.rxcui,
			name: candidate.name
		};

		// Validate against schema
		const validation = RxNormConceptSchema.safeParse(concept);
		if (!validation.success) {
			return err(
				new DrugNormalizationError(drugName, 'Invalid RxNorm concept data')
			);
		}

		return ok(validation.data);
	} catch (error: any) {
		return err(new DrugNormalizationError(drugName, `Approximate match failed: ${error.message}`));
	}
}

/**
 * Get detailed information about a specific RxCUI
 *
 * @param rxcui - RxCUI identifier
 * @returns Result with RxNormConcept or DrugNormalizationError
 *
 * @example
 * ```ts
 * const result = await getRxNormDetails("314076");
 * if (result.success) {
 *   console.log(result.data.name); // "lisinopril"
 * }
 * ```
 */
export async function getRxNormDetails(
	rxcui: string
): Promise<Result<RxNormConcept, DrugNormalizationError>> {
	try {
		const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/properties.json`;
		const data = await fetchJSON<any>(url, {}, 'RxNorm API');

		const properties = data.properties;
		if (!properties) {
			return err(new DrugNormalizationError(rxcui, 'No properties found for RxCUI'));
		}

		const concept: RxNormConcept = {
			rxcui: properties.rxcui || rxcui,
			name: properties.name || 'Unknown',
			tty: properties.tty
		};

		// Validate against schema
		const validation = RxNormConceptSchema.safeParse(concept);
		if (!validation.success) {
			return err(
				new DrugNormalizationError(rxcui, 'Invalid RxNorm concept data')
			);
		}

		return ok(validation.data);
	} catch (error: any) {
		return err(new DrugNormalizationError(rxcui, `Failed to get RxNorm details: ${error.message}`));
	}
}
