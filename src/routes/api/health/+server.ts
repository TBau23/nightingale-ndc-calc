/**
 * GET /api/health - Health check endpoint
 */

import { json } from '@sveltejs/kit';

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
			openai: process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
			cache: process.env.ENABLE_API_CACHE === 'true' ? 'enabled' : 'disabled'
		}
	});
}
