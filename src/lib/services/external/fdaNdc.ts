/**
 * FDA NDC Directory API client
 */

import { fetchJSON } from './http.js';
import { getFDACache } from './cache.js';
import {
	NDCNotFoundError,
	DrugNotFoundError,
	NDCPackageSchema,
	DOSAGE_FORMS
} from '$lib/types';
import type { Result, NDCPackage, FDANDCResponse, DosageForm, NDCStatus } from '$lib/types';
import { ok, err } from '$lib/types';
import { env } from '$env/dynamic/private';

/**
 * FDA NDC API base URL
 */
const FDA_BASE_URL = env.FDA_NDC_API_URL || 'https://api.fda.gov/drug/ndc.json';
const FDA_API_KEY_VALUE = env.FDA_API_KEY || '';

/**
 * Validate NDC format (supports various formats)
 *
 * @param ndc - NDC to validate
 * @returns True if valid format
 */
export function validateNDCFormat(ndc: string): boolean {
	// Remove dashes
	const cleaned = ndc.replace(/-/g, '');

	// Should be 10 or 11 digits
	if (!/^\d{10,11}$/.test(cleaned)) {
		return false;
	}

	return true;
}

/**
 * Normalize NDC to 11-digit format
 * Handles formats: 5-4-2, 4-4-2, 5-3-2, and variations
 *
 * @param ndc - NDC in various formats
 * @returns Normalized 11-digit NDC
 */
export function normalizeNDC(ndc: string): string {
	// Remove dashes and spaces
	let cleaned = ndc.replace(/[-\s]/g, '');

	// Pad to 11 digits if needed
	if (cleaned.length === 10) {
		// Add leading zero
		cleaned = '0' + cleaned;
	}

	return cleaned;
}

/**
 * Normalize dosage form to enum value
 *
 * @param form - Dosage form from FDA API
 * @returns Normalized DosageForm or null if not recognized
 */
function normalizeDosageForm(form: string): DosageForm | null {
	const normalized = form.toUpperCase().trim();

	// Check if it's a valid dosage form
	if (DOSAGE_FORMS.includes(normalized as DosageForm)) {
		return normalized as DosageForm;
	}

	// Handle common variations
	const mappings: Record<string, DosageForm> = {
		'TABLETS': 'TABLET',
		'CAPSULES': 'CAPSULE',
		'LIQUID': 'SOLUTION',
		'SYRUP': 'SOLUTION',
		'LOTION': 'CREAM',
		'AEROSOL': 'SPRAY',
		'POWDER': 'SUSPENSION'
	};

	return mappings[normalized] || null;
}

/**
 * Determine NDC status from marketing dates
 *
 * @param marketingEndDate - Marketing end date (if any)
 * @returns NDC status
 */
function determineStatus(marketingEndDate?: string): NDCStatus {
	if (marketingEndDate) {
		return 'inactive';
	}
	return 'active';
}

/**
 * Parse package size from description
 * Examples: "100 TABLET in 1 BOTTLE", "30 CAPSULE in 1 BLISTER PACK"
 *
 * @param description - Package description
 * @returns Package size or 0 if cannot parse
 */
function parsePackageSize(description: string): number {
	const match = description.match(/^(\d+)\s+/);
	if (match) {
		return parseInt(match[1], 10);
	}
	return 0;
}

/**
 * Search for NDC packages by drug name
 *
 * @param drugName - Drug name (generic or brand)
 * @param limit - Maximum number of results (default: 100)
 * @returns Result with array of NDCPackage
 *
 * @example
 * ```ts
 * const result = await searchNDCsByDrug("Lisinopril", 10);
 * if (result.success) {
 *   console.log(result.data.length); // Number of packages found
 * }
 * ```
 */
export async function searchNDCsByDrug(
	drugName: string,
	limit: number = 100
): Promise<Result<NDCPackage[], DrugNotFoundError>> {
	// Validate input
	if (!drugName || drugName.trim().length === 0) {
		return err(new DrugNotFoundError(''));
	}

	const normalizedName = drugName.trim().toLowerCase();

	// Check cache
	const cacheKey = `fda:drug:${normalizedName}:${limit}`;
	const cached = getFDACache().get(cacheKey);
	if (cached) {
		return ok(cached);
	}

	try {
		// Search by both generic and brand name
		const searchQuery = `(generic_name:"${drugName}" OR brand_name:"${drugName}")`;
		const encodedQuery = encodeURIComponent(searchQuery);
		const apiKey = FDA_API_KEY_VALUE ? `&api_key=${FDA_API_KEY_VALUE}` : '';
		const url = `${FDA_BASE_URL}?search=${encodedQuery}&limit=${limit}${apiKey}`;

		console.log('[FDA NDC] Searching for drug:', drugName);
		console.log('[FDA NDC] Query URL:', url);

		const data = await fetchJSON<FDANDCResponse>(url, {}, 'FDA NDC API');

		if (!data.results || data.results.length === 0) {
			console.log('[FDA NDC] No results found for:', drugName);
			return err(new DrugNotFoundError(drugName));
		}

		console.log('[FDA NDC] Found', data.results.length, 'results for:', drugName);

		// Transform results to NDCPackage[]
		const packages: NDCPackage[] = [];

		for (const result of data.results) {
			// Skip if no packaging info
			if (!result.packaging || result.packaging.length === 0) {
				continue;
			}

			const dosageForm = normalizeDosageForm(result.dosage_form);
			if (!dosageForm) {
				continue; // Skip unrecognized dosage forms
			}

			const strength = result.active_ingredients?.[0]?.strength || 'Unknown';
			const status = determineStatus(result.marketing_end_date);

			// Process each package
			for (const pkg of result.packaging) {
				const packageSize = parsePackageSize(pkg.description);
				if (packageSize === 0) {
					continue; // Skip if we can't parse package size
				}

				const ndcPackage: NDCPackage = {
					ndc: normalizeNDC(pkg.package_ndc),
					packageSize,
					dosageForm,
					strength,
					manufacturer: result.labeler_name,
					status,
					brandName: result.brand_name,
					genericName: result.generic_name,
					marketingStartDate: result.marketing_start_date,
					marketingEndDate: result.marketing_end_date,
					packageDescription: pkg.description
				};

				// Validate against schema
				const validation = NDCPackageSchema.safeParse(ndcPackage);
				if (validation.success) {
					packages.push(validation.data);
				}
			}
		}

		if (packages.length === 0) {
			console.log('[FDA NDC] No valid packages found after filtering for:', drugName);
			return err(new DrugNotFoundError(drugName));
		}

		// Cache the results
		getFDACache().set(cacheKey, packages);

		return ok(packages);
	} catch (error: any) {
		console.error('[FDA NDC] Error searching for drug:', drugName, error);
		return err(new DrugNotFoundError(drugName));
	}
}

/**
 * Get detailed information about a specific NDC
 *
 * @param ndc - NDC to look up (in any format)
 * @returns Result with NDCPackage or NDCNotFoundError
 *
 * @example
 * ```ts
 * const result = await getNDCDetails("00069-2587-41");
 * if (result.success) {
 *   console.log(result.data.genericName);
 * }
 * ```
 */
export async function getNDCDetails(ndc: string): Promise<Result<NDCPackage, NDCNotFoundError>> {
	// Validate format
	if (!validateNDCFormat(ndc)) {
		return err(new NDCNotFoundError(ndc));
	}

	const normalizedNDC = normalizeNDC(ndc);

	// Check cache
	const cacheKey = `fda:ndc:${normalizedNDC}`;
	const cached = getFDACache().get(cacheKey);
	if (cached) {
		return ok(cached);
	}

	try {
		const searchQuery = `package_ndc:"${ndc}"`;
		const encodedQuery = encodeURIComponent(searchQuery);
		const apiKey = FDA_API_KEY_VALUE ? `&api_key=${FDA_API_KEY_VALUE}` : '';
		const url = `${FDA_BASE_URL}?search=${encodedQuery}${apiKey}`;

		console.log('[FDA NDC] Getting details for NDC:', ndc);
		console.log('[FDA NDC] Query URL:', url);

		const data = await fetchJSON<FDANDCResponse>(url, {}, 'FDA NDC API');

		if (!data.results || data.results.length === 0) {
			console.log('[FDA NDC] No results found for NDC:', ndc);
			return err(new NDCNotFoundError(ndc));
		}

		console.log('[FDA NDC] Found details for NDC:', ndc);

		const result = data.results[0];

		// Find the specific package
		const pkg = result.packaging?.find(p => normalizeNDC(p.package_ndc) === normalizedNDC);
		if (!pkg) {
			return err(new NDCNotFoundError(ndc));
		}

		const dosageForm = normalizeDosageForm(result.dosage_form);
		if (!dosageForm) {
			return err(new NDCNotFoundError(ndc));
		}

		const packageSize = parsePackageSize(pkg.description);
		if (packageSize === 0) {
			return err(new NDCNotFoundError(ndc));
		}

		const strength = result.active_ingredients?.[0]?.strength || 'Unknown';
		const status = determineStatus(result.marketing_end_date);

		const ndcPackage: NDCPackage = {
			ndc: normalizedNDC,
			packageSize,
			dosageForm,
			strength,
			manufacturer: result.labeler_name,
			status,
			brandName: result.brand_name,
			genericName: result.generic_name,
			marketingStartDate: result.marketing_start_date,
			marketingEndDate: result.marketing_end_date,
			packageDescription: pkg.description
		};

		// Validate against schema
		const validation = NDCPackageSchema.safeParse(ndcPackage);
		if (!validation.success) {
			return err(new NDCNotFoundError(ndc));
		}

		// Cache the result
		getFDACache().set(cacheKey, validation.data);

		return ok(validation.data);
	} catch (error: any) {
		return err(new NDCNotFoundError(ndc));
	}
}
