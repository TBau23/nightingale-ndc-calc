/**
 * Custom error classes for domain-specific errors
 */

/**
 * Base error class for Nightingale errors
 */
export class NightingaleError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode: number = 500
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Error when NDC is not found or invalid
 */
export class NDCNotFoundError extends NightingaleError {
	constructor(public readonly ndc: string) {
		super(`NDC ${ndc} not found or is invalid`, 'NDC_NOT_FOUND', 404);
	}
}

/**
 * Error when NDC is inactive or discontinued
 */
export class InactiveNDCError extends NightingaleError {
	constructor(
		public readonly ndc: string,
		public readonly endDate?: string
	) {
		super(`NDC ${ndc} is inactive${endDate ? ` (ended ${endDate})` : ''}`, 'NDC_INACTIVE', 400);
	}
}

/**
 * Error when SIG cannot be parsed
 */
export class InvalidSIGError extends NightingaleError {
	constructor(
		public readonly sig: string,
		public readonly reason: string
	) {
		super(`Invalid SIG: ${reason}`, 'INVALID_SIG', 400);
	}
}

/**
 * Error when drug cannot be normalized to RxCUI
 */
export class DrugNormalizationError extends NightingaleError {
	constructor(
		public readonly drugName: string,
		public readonly reason: string
	) {
		super(`Cannot normalize drug "${drugName}": ${reason}`, 'DRUG_NORMALIZATION_FAILED', 404);
	}
}

/**
 * Error when external API fails
 */
export class ExternalAPIError extends NightingaleError {
	constructor(
		public readonly apiName: string,
		public readonly originalError: Error
	) {
		super(`External API error (${apiName}): ${originalError.message}`, 'EXTERNAL_API_ERROR', 503);
	}
}

/**
 * Error when AI service fails
 */
export class AIServiceError extends NightingaleError {
	constructor(
		public readonly service: string,
		public readonly reason: string
	) {
		super(`AI service error (${service}): ${reason}`, 'AI_SERVICE_ERROR', 500);
	}
}

/**
 * Error when validation fails
 */
export class ValidationError extends NightingaleError {
	constructor(
		public readonly field: string,
		public readonly reason: string
	) {
		super(`Validation error for ${field}: ${reason}`, 'VALIDATION_ERROR', 400);
	}
}
