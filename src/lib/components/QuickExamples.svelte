<script lang="ts">
	import type { PrescriptionInput } from '$lib/types';

	interface Props {
		onSelectExample: (example: PrescriptionInput) => void;
	}

	let { onSelectExample }: Props = $props();

	const examples: Array<{ name: string; data: PrescriptionInput }> = [
		{
			name: 'Lisinopril',
			data: {
				drugName: 'Lisinopril 10mg',
				sig: 'Take 1 tablet by mouth once daily',
				daysSupply: 30
			}
		},
		{
			name: 'Metformin',
			data: {
				drugName: 'Metformin 500mg',
				sig: 'Take 1 tablet by mouth twice daily with meals',
				daysSupply: 90
			}
		},
		{
			name: 'Insulin',
			data: {
				drugName: 'Insulin Glargine',
				sig: 'Inject 20 units subcutaneously once daily at bedtime',
				daysSupply: 30
			}
		}
	];
</script>

<div class="mb-6">
	<p class="text-sm text-gray-600 mb-2">Try an example:</p>
	<div class="flex flex-wrap gap-2">
		{#each examples as example}
			<button
				type="button"
				onclick={() => onSelectExample(example.data)}
				class="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-primary-400 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
			>
				{example.name}
			</button>
		{/each}
	</div>
</div>
