/**
 * AI Service Layer - Barrel export
 * Import AI services from this file: import { parseSIG, selectOptimalNDCs } from '$lib/services/ai'
 */

// SIG Parser
export { parseSIG } from './sigParser.js';

// NDC Selector
export { selectOptimalNDCs } from './ndcSelector.js';
export type { NDCSelectionOutput } from './ndcSelector.js';

// Error Advisor
export { adviseOnError } from './errorAdvisor.js';
export type { Advice } from './errorAdvisor.js';

// OpenAI client (for advanced usage)
export { chatCompletion, getAIConfig } from './openai.js';

// Prompts (for reference or customization)
export { SYSTEM_PROMPTS, buildSIGPrompt, buildNDCSelectionPrompt, buildErrorAdvicePrompt } from './prompts.js';
export type { ErrorAdviceInput, NDCSelectionInput } from './prompts.js';
