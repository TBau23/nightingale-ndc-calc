<script lang="ts">
	import { Copy, Check } from 'lucide-svelte';
	import type { CalculationResult, PrescriptionInput } from '$lib/types';
	import PackageTable from './PackageTable.svelte';
	import WarningCard from './WarningCard.svelte';

	interface Props {
		result: CalculationResult;
		formData: PrescriptionInput;
	}

	let { result, formData }: Props = $props();

	let copied = $state<boolean>(false);

	function getFrequencyDisplay(frequency: CalculationResult['parsedSIG']['frequency']): string {
		switch (frequency.type) {
			case 'times_per_day':
				return `${frequency.value}x daily`;
			case 'times_per_period':
				return `${frequency.value}x per ${frequency.period}`;
			case 'specific_times':
				return `at ${frequency.times.join(', ')}`;
			case 'as_needed':
				return frequency.maxPerDay ? `as needed (max ${frequency.maxPerDay}/day)` : 'as needed';
		}
	}

	async function copyResults(): Promise<void> {
		const text = `
Nightingale Calculation Results

Drug: ${formData.drugName}
SIG: ${formData.sig}
Days Supply: ${formData.daysSupply}

Quantity Needed: ${result.totalQuantityNeeded} ${result.unit}

Selected Packages:
${result.selectedPackages.map((pkg) => `- ${pkg.package.ndc}: ${pkg.quantity}x ${pkg.package.packageSize} ${result.unit}`).join('\n')}

Total Dispensed: ${result.totalUnitsDispensed} ${result.unit}
		`.trim();

		try {
			await navigator.clipboard.writeText(text);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (error) {
			console.error('Failed to copy:', error);
		}
	}
</script>

<div class="space-y-6">
	<!-- Header with Copy Button -->
	<div class="flex justify-between items-center">
		<h2 class="text-xl font-semibold text-gray-900">Calculation Results</h2>
		<button
			type="button"
			onclick={copyResults}
			class="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
		>
			{#if copied}
				<Check class="w-4 h-4 text-green-500" />
				<span class="text-green-600">Copied!</span>
			{:else}
				<Copy class="w-4 h-4" />
				<span>Copy</span>
			{/if}
		</button>
	</div>

	<!-- Parsed SIG Summary -->
	<div class="card">
		<h3 class="text-sm font-semibold text-gray-900 mb-3">Prescription Breakdown</h3>
		<dl class="space-y-2 text-sm">
			<div class="flex justify-between">
				<dt class="text-gray-600">Dose:</dt>
				<dd class="font-medium text-gray-900">
					{result.parsedSIG.dose}
					{result.parsedSIG.unit}
				</dd>
			</div>
			<div class="flex justify-between">
				<dt class="text-gray-600">Frequency:</dt>
				<dd class="font-medium text-gray-900">{getFrequencyDisplay(result.parsedSIG.frequency)}</dd>
			</div>
			{#if result.parsedSIG.route}
				<div class="flex justify-between">
					<dt class="text-gray-600">Route:</dt>
					<dd class="font-medium text-gray-900">{result.parsedSIG.route}</dd>
				</div>
			{/if}
			<div class="flex justify-between">
				<dt class="text-gray-600">Duration:</dt>
				<dd class="font-medium text-gray-900">{formData.daysSupply} days</dd>
			</div>
			<div class="flex justify-between border-t pt-2">
				<dt class="text-gray-600 font-semibold">Total Needed:</dt>
				<dd class="font-semibold text-gray-900">
					{result.totalQuantityNeeded}
					{result.unit}{result.totalQuantityNeeded > 1 ? 's' : ''}
				</dd>
			</div>
		</dl>
	</div>

	<!-- Selected Packages Table -->
	<div class="card">
		<h3 class="text-sm font-semibold text-gray-900 mb-3">Selected Packages</h3>
		<PackageTable packages={result.selectedPackages} unit={result.unit} />

		<div class="mt-3 pt-3 border-t flex justify-between text-sm">
			<span class="text-gray-600">Total Dispensed:</span>
			<span class="font-semibold text-gray-900">
				{result.totalUnitsDispensed}
				{result.unit}{result.totalUnitsDispensed > 1 ? 's' : ''}
			</span>
		</div>

		{#if result.fillDifference !== 0}
			<div class="mt-1 flex justify-between text-sm">
				<span class="text-gray-600">{result.fillDifference > 0 ? 'Overfill:' : 'Underfill:'}</span>
				<span class="font-medium text-gray-700">
					{Math.abs(result.fillDifference)}
					{result.unit}{Math.abs(result.fillDifference) > 1 ? 's' : ''}
				</span>
			</div>
		{/if}
	</div>

	<!-- AI Reasoning Card -->
	{#if result.reasoning}
		<div class="card bg-blue-50 border-blue-200">
			<h3 class="text-sm font-semibold text-blue-900 mb-2">AI Reasoning</h3>
			<p class="text-sm text-blue-800">{result.reasoning}</p>
		</div>
	{/if}

	<!-- Warnings -->
	{#if result.warnings.length > 0}
		<div class="space-y-2">
			<h3 class="text-sm font-semibold text-gray-900">Warnings</h3>
			{#each result.warnings as warning}
				<WarningCard {warning} />
			{/each}
		</div>
	{/if}
</div>
