/**
 * External API Services - Barrel export
 * Import external services from this file: import { normalizeToRxCUI, searchNDCsByDrug } from '$lib/services/external'
 */

// RxNorm Service
export { normalizeToRxCUI, getRxNormDetails } from './rxnorm.js';

// FDA NDC Service
export { searchNDCsByDrug, getNDCDetails, validateNDCFormat, normalizeNDC } from './fdaNdc.js';

// Cache utilities
export { getRxNormCache, getFDACache, clearAllCaches, getCacheConfig } from './cache.js';

// HTTP utilities (for advanced usage)
export { fetchWithRetry, fetchJSON, sleep, isRetryableError, getHTTPConfig } from './http.js';
