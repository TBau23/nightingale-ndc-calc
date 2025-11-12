<script lang="ts">
	import { Pill } from 'lucide-svelte';

	interface Props {
		sig: string;
		daysSupply: number;
	}

	let { sig, daysSupply }: Props = $props();

	let preview = $state<string>('');
	let isVisible = $state<boolean>(false);
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Simple heuristic SIG parser (client-side only)
	function parseSimpleSIG(sigText: string, days: number): string | null {
		if (!sigText || sigText.length < 10) return null;

		const text = sigText.toLowerCase();

		// Extract dose (e.g., "1 tablet", "2 capsules", "5ml")
		const doseMatch =
			text.match(/(\d+\.?\d*)\s*(tablet|capsule|ml|unit|mg|g|patch|spray|puff|drop)s?/i);
		const dose = doseMatch ? parseFloat(doseMatch[1]) : 1;
		const unit = doseMatch ? doseMatch[2] : 'tablet';

		// Extract frequency
		let frequency = 1;
		let frequencyText = 'daily';

		if (text.match(/\b(twice|two times?)\b.*\b(day|daily)\b/)) {
			frequency = 2;
			frequencyText = '2x daily';
		} else if (text.match(/\bthree times?\b.*\b(day|daily)\b/)) {
			frequency = 3;
			frequencyText = '3x daily';
		} else if (text.match(/\bfour times?\b.*\b(day|daily)\b/)) {
			frequency = 4;
			frequencyText = '4x daily';
		} else if (text.match(/\b(once|one time?)\b.*\b(day|daily)\b/)) {
			frequency = 1;
			frequencyText = 'daily';
		} else if (text.match(/\bevery (\d+) hours?\b/)) {
			const hoursMatch = text.match(/\bevery (\d+) hours?\b/);
			const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 24;
			frequency = 24 / hours;
			frequencyText = `every ${hours}h`;
		} else if (text.match(/\bas needed\b|\bprn\b/)) {
			frequencyText = 'as needed';
		}

		// Calculate total quantity
		const totalQuantity = Math.ceil(dose * frequency * days);

		return `${frequencyText} • ${days} days • ~${totalQuantity} ${unit}${totalQuantity > 1 ? 's' : ''}`;
	}

	// Debounced update
	$effect(() => {
		if (debounceTimer) clearTimeout(debounceTimer);

		debounceTimer = setTimeout(() => {
			const parsed = parseSimpleSIG(sig, daysSupply);
			if (parsed) {
				preview = parsed;
				isVisible = true;
			} else {
				isVisible = false;
			}
		}, 500);

		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});
</script>

{#if isVisible}
	<div class="mt-2 flex items-center gap-2 text-sm text-gray-600 transition-opacity">
		<Pill class="w-4 h-4 text-primary-500" />
		<span>{preview}</span>
	</div>
{/if}
