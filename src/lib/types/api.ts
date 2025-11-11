/**
 * External API request/response types
 */

/**
 * RxNorm API response types
 */
export interface RxNormResponse {
	idGroup?: {
		rxnormId?: string[];
	};
	approximateGroup?: {
		candidate?: Array<{
			rxcui: string;
			name: string;
			score: string;
		}>;
	};
}

/**
 * FDA NDC Directory API response
 */
export interface FDANDCResponse {
	results?: Array<{
		product_ndc: string;
		generic_name: string;
		brand_name?: string;
		dosage_form: string;
		active_ingredients: Array<{
			name: string;
			strength: string;
		}>;
		packaging?: Array<{
			package_ndc: string;
			description: string;
		}>;
		labeler_name: string;
		marketing_start_date?: string;
		marketing_end_date?: string;
		marketing_category?: string;
	}>;
	meta?: {
		disclaimer: string;
		last_updated: string;
	};
}

/**
 * OpenAI API types
 */

/**
 * OpenAI chat message
 */
export interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * OpenAI chat completion request
 */
export interface OpenAIRequest {
	model: string;
	messages: OpenAIMessage[];
	temperature?: number;
	max_tokens?: number;
	response_format?: { type: 'json_object' };
}
