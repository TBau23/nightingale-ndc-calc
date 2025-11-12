<script lang="ts">
	import { CheckCircle, Loader, XCircle } from 'lucide-svelte';

	interface Props {
		currentStep: number;
		hasError?: boolean;
	}

	let { currentStep, hasError = false }: Props = $props();

	const steps = [
		{ id: 1, label: 'Parsing prescription' },
		{ id: 2, label: 'Finding medications' },
		{ id: 3, label: 'Selecting packages' }
	];

	function getStepStatus(stepId: number): 'complete' | 'current' | 'pending' | 'error' {
		if (hasError && stepId === currentStep) return 'error';
		if (stepId < currentStep) return 'complete';
		if (stepId === currentStep) return 'current';
		return 'pending';
	}
</script>

<div class="card space-y-3">
	{#each steps as step}
		{@const status = getStepStatus(step.id)}
		<div class="flex items-center gap-3">
			<!-- Icon -->
			<div class="flex-shrink-0">
				{#if status === 'complete'}
					<CheckCircle class="w-5 h-5 text-green-500" />
				{:else if status === 'current'}
					<Loader class="w-5 h-5 text-primary-500 animate-spin" />
				{:else if status === 'error'}
					<XCircle class="w-5 h-5 text-red-500" />
				{:else}
					<div class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
				{/if}
			</div>

			<!-- Label -->
			<div
				class="text-sm font-medium"
				class:text-green-700={status === 'complete'}
				class:text-primary-700={status === 'current'}
				class:text-red-700={status === 'error'}
				class:text-gray-500={status === 'pending'}
			>
				{step.label}...
			</div>
		</div>
	{/each}
</div>
