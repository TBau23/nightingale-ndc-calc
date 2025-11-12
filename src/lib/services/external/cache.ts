/**
 * Optional in-memory cache for API responses
 */

import { env } from '$env/dynamic/private';

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
	enabled: env.ENABLE_API_CACHE === 'true',
	ttl: parseInt(env.API_CACHE_TTL_MS || '900000'), // 15 minutes default
	maxSize: 1000
} as const;

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

/**
 * Simple in-memory cache with TTL and LRU eviction
 */
class Cache<T> {
	private cache: Map<string, CacheEntry<T>>;
	private accessOrder: string[];

	constructor(private maxSize: number = CACHE_CONFIG.maxSize) {
		this.cache = new Map();
		this.accessOrder = [];
	}

	/**
	 * Get value from cache
	 *
	 * @param key - Cache key
	 * @returns Cached value or undefined if not found/expired
	 */
	get(key: string): T | undefined {
		if (!CACHE_CONFIG.enabled) {
			return undefined;
		}

		const entry = this.cache.get(key);

		if (!entry) {
			return undefined;
		}

		// Check if expired
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			this.removeFromAccessOrder(key);
			return undefined;
		}

		// Update access order (move to end - most recently used)
		this.updateAccessOrder(key);

		return entry.value;
	}

	/**
	 * Set value in cache
	 *
	 * @param key - Cache key
	 * @param value - Value to cache
	 * @param ttl - Time to live in milliseconds (optional, uses default if not provided)
	 */
	set(key: string, value: T, ttl: number = CACHE_CONFIG.ttl): void {
		if (!CACHE_CONFIG.enabled) {
			return;
		}

		// Evict LRU entry if cache is full
		if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
			this.evictLRU();
		}

		const expiresAt = Date.now() + ttl;
		this.cache.set(key, { value, expiresAt });
		this.updateAccessOrder(key);
	}

	/**
	 * Check if key exists in cache (and is not expired)
	 *
	 * @param key - Cache key
	 * @returns True if key exists and is not expired
	 */
	has(key: string): boolean {
		return this.get(key) !== undefined;
	}

	/**
	 * Clear all cache entries
	 */
	clear(): void {
		this.cache.clear();
		this.accessOrder = [];
	}

	/**
	 * Get cache size
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * Update access order for LRU
	 */
	private updateAccessOrder(key: string): void {
		this.removeFromAccessOrder(key);
		this.accessOrder.push(key);
	}

	/**
	 * Remove key from access order
	 */
	private removeFromAccessOrder(key: string): void {
		const index = this.accessOrder.indexOf(key);
		if (index > -1) {
			this.accessOrder.splice(index, 1);
		}
	}

	/**
	 * Evict least recently used entry
	 */
	private evictLRU(): void {
		if (this.accessOrder.length === 0) {
			return;
		}

		const lruKey = this.accessOrder[0];
		this.cache.delete(lruKey);
		this.accessOrder.shift();
	}
}

/**
 * Global cache instances
 */
const rxnormCache = new Cache<any>();
const fdaCache = new Cache<any>();

/**
 * Get RxNorm cache
 */
export function getRxNormCache() {
	return rxnormCache;
}

/**
 * Get FDA cache
 */
export function getFDACache() {
	return fdaCache;
}

/**
 * Clear all caches
 */
export function clearAllCaches(): void {
	rxnormCache.clear();
	fdaCache.clear();
}

/**
 * Get cache configuration
 */
export function getCacheConfig() {
	return CACHE_CONFIG;
}
