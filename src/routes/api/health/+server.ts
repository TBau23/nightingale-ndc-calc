/**
 * GET /api/health - Health check endpoint
 */

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Health check endpoint
 *
 * @example
 * GET /api/health
 */
export async function GET() {
	return json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		version: '1.0.0',
		services: {
			openai: env.OPENAI_API_KEY ? 'configured' : 'not_configured',
			cache: env.ENABLE_API_CACHE === 'true' ? 'enabled' : 'disabled'
		}
	});
}
