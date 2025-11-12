<script lang="ts">
	import { Info, AlertCircle, XCircle } from 'lucide-svelte';
	import type { Warning } from '$lib/types';

	interface Props {
		warning: Warning;
	}

	let { warning }: Props = $props();

	function getSeverityClasses(
		severity: 'info' | 'warning' | 'error'
	): { container: string; icon: string } {
		switch (severity) {
			case 'info':
				return {
					container: 'bg-blue-50 border-blue-200',
					icon: 'text-blue-500'
				};
			case 'warning':
				return {
					container: 'bg-yellow-50 border-yellow-200',
					icon: 'text-yellow-600'
				};
			case 'error':
				return {
					container: 'bg-red-50 border-red-200',
					icon: 'text-red-500'
				};
		}
	}

	const classes = $derived(getSeverityClasses(warning.severity));
</script>

<div class="flex gap-3 p-3 border rounded-lg {classes.container}">
	<div class="flex-shrink-0">
		{#if warning.severity === 'info'}
			<Info class="w-5 h-5 {classes.icon}" />
		{:else if warning.severity === 'warning'}
			<AlertCircle class="w-5 h-5 {classes.icon}" />
		{:else}
			<XCircle class="w-5 h-5 {classes.icon}" />
		{/if}
	</div>
	<div class="flex-1">
		<p class="text-sm font-medium text-gray-900">{warning.message}</p>
		{#if warning.suggestion}
			<p class="mt-1 text-sm text-gray-600">{warning.suggestion}</p>
		{/if}
	</div>
</div>
