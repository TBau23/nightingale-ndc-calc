<script lang="ts">
	import { XCircle, RefreshCw } from 'lucide-svelte';
	import type { ErrorAdvice } from '$lib/types';

	interface Props {
		error: {
			code: string;
			message: string;
			statusCode: number;
			advice?: ErrorAdvice;
		};
		onRetry?: () => void;
	}

	let { error, onRetry }: Props = $props();
</script>

<div class="card bg-red-50 border-red-200">
	<div class="flex gap-3">
		<div class="flex-shrink-0">
			<XCircle class="w-5 h-5 text-red-500" />
		</div>
		<div class="flex-1">
			<h3 class="text-sm font-semibold text-red-900">Error: {error.code}</h3>
			<p class="mt-1 text-sm text-red-800">{error.message}</p>

			{#if error.advice}
				<div class="mt-3 space-y-2 text-sm text-gray-800">
					{#if error.advice.explanation}
						<p class="font-medium text-gray-900">{error.advice.explanation}</p>
					{/if}
					{#if error.advice.suggestions?.length}
						<ul class="list-disc space-y-1 pl-5">
							{#each error.advice.suggestions as suggestion}
								<li>{suggestion}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}

			{#if onRetry}
				<button
					type="button"
					onclick={onRetry}
					class="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				>
					<RefreshCw class="w-4 h-4" />
					Try Again
				</button>
			{/if}
		</div>
	</div>
</div>
