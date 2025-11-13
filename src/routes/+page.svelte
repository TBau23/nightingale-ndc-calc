<script lang="ts">
	import { Pill } from 'lucide-svelte';
	import type { PrescriptionInput, CalculationResult, ErrorAdvice } from '$lib/types';
	import PrescriptionForm from '$lib/components/PrescriptionForm.svelte';
	import LiveSIGPreview from '$lib/components/LiveSIGPreview.svelte';
	import QuickExamples from '$lib/components/QuickExamples.svelte';
	import ProgressStepper from '$lib/components/ProgressStepper.svelte';
	import ResultsDisplay from '$lib/components/ResultsDisplay.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';

	// Form state
	let formData = $state<PrescriptionInput>({
		drugName: '',
		sig: '',
		daysSupply: 30
	});

	// UI state
	let isLoading = $state<boolean>(false);
	let currentStep = $state<number>(0);
	let result = $state<CalculationResult | null>(null);
	let error = $state<{ code: string; message: string; statusCode: number; advice?: ErrorAdvice } | null>(null);

	// Handle form submission
	async function handleSubmit(): Promise<void> {
		isLoading = true;
		currentStep = 1;
		error = null;
		result = null;

		try {
			const response = await fetch('/api/calculate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			const data = await response.json();

			if (data.success) {
				currentStep = 3;
				// Small delay to show final step
				await new Promise((resolve) => setTimeout(resolve, 300));
				result = data.data;
			} else {
				error = data.error;
			}
		} catch (err: any) {
			error = {
				code: 'NETWORK_ERROR',
				message: err.message || 'Failed to connect to server',
				statusCode: 500
			};
		} finally {
			isLoading = false;
			currentStep = 0;
		}
	}

	// Handle example selection
	function handleExampleSelect(example: PrescriptionInput): void {
		formData = { ...example };
		result = null;
		error = null;
	}

	// Handle retry
	function handleRetry(): void {
		error = null;
		result = null;
	}

	// Handle form change
	function handleFormChange(data: PrescriptionInput): void {
		formData = data;
	}
</script>

<svelte:head>
	<title>Nightingale - Prescription Calculator</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
	<div class="max-w-3xl mx-auto">
		<!-- Header -->
		<header class="mb-8 text-center">
			<div class="flex items-center justify-center gap-3 mb-2">
				<Pill class="w-8 h-8 text-primary-600" />
				<h1 class="text-3xl font-bold text-gray-900">Nightingale Calculator</h1>
			</div>
			<p class="text-gray-600">AI-powered prescription quantity calculator</p>
		</header>

		<!-- Quick Examples -->
		<QuickExamples onSelectExample={handleExampleSelect} />

		<!-- Main Form Card -->
		<div class="card mb-6">
			<PrescriptionForm
				bind:formData
				{isLoading}
				onSubmit={handleSubmit}
				onChange={handleFormChange}
			/>

			<!-- Live SIG Preview -->
			<LiveSIGPreview sig={formData.sig} daysSupply={formData.daysSupply} />
		</div>

		<!-- Progress Stepper (shown during loading) -->
		{#if isLoading}
			<div class="mb-6">
				<ProgressStepper {currentStep} hasError={!!error} />
			</div>
		{/if}

		<!-- Error Alert -->
		{#if error}
			<div class="mb-6">
				<ErrorAlert {error} onRetry={handleRetry} />
			</div>
		{/if}

		<!-- Results Display -->
		{#if result}
			<ResultsDisplay {result} {formData} />
		{/if}

		<!-- Footer -->
		<footer class="mt-12 text-center text-sm text-gray-500">
			<p>
				Powered by AI • Built with
				<a
					href="https://kit.svelte.dev"
					target="_blank"
					rel="noopener noreferrer"
					class="text-primary-600 hover:text-primary-700"
				>
					SvelteKit
				</a>
			</p>
		</footer>
	</div>
</div>
