<script lang="ts">
	import { XCircle, RefreshCw } from 'lucide-svelte';

	interface Props {
		error: {
			code: string;
			message: string;
			statusCode: number;
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
