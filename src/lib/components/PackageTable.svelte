<script lang="ts">
	import { ExternalLink } from 'lucide-svelte';
	import type { SelectedPackage, MedicationUnit } from '$lib/types';

	interface Props {
		packages: SelectedPackage[];
		unit: MedicationUnit;
	}

	let { packages, unit }: Props = $props();

	function formatNDCForDisplay(ndc: string): string {
		if (ndc.length !== 11) return ndc;
		return `${ndc.slice(0, 5)}-${ndc.slice(5, 9)}-${ndc.slice(9)}`;
	}

	function getNDCVerificationUrl(ndc: string): string {
		return `https://ndclist.com/ndc/${formatNDCForDisplay(ndc)}`;
	}
</script>

<div class="overflow-x-auto">
	<table class="min-w-full divide-y divide-gray-300">
		<thead class="bg-gray-50">
			<tr>
				<th
					scope="col"
					class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-6"
				>
					NDC
				</th>
				<th
					scope="col"
					class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
				>
					Drug Name
				</th>
				<th
					scope="col"
					class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
				>
					Strength
				</th>
				<th
					scope="col"
					class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
				>
					Form
				</th>
				<th
					scope="col"
					class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
				>
					Package Size
				</th>
				<th
					scope="col"
					class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
				>
					Quantity
				</th>
				<th
					scope="col"
					class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
				>
					Total Units
				</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-200 bg-white">
			{#each packages as pkg}
				{@const formattedNDC = formatNDCForDisplay(pkg.package.ndc)}
				<tr class="hover:bg-gray-50 transition-colors">
					<!-- NDC (clickable link) -->
					<td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-mono font-medium sm:pl-6">
						<a
							href={getNDCVerificationUrl(pkg.package.ndc)}
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center gap-1"
						>
							{formattedNDC}
							<ExternalLink class="w-3 h-3" />
						</a>
					</td>

					<!-- Drug Name -->
					<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
						{pkg.package.genericName || pkg.package.brandName || 'N/A'}
					</td>

					<!-- Strength (highlighted) -->
					<td class="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-900">
						{pkg.package.strength || 'N/A'}
					</td>

					<!-- Dosage Form -->
					<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700 capitalize">
						{pkg.package.dosageForm ? pkg.package.dosageForm.toLowerCase() : 'N/A'}
					</td>

					<!-- Package Size -->
					<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
						{pkg.package.packageSize}
						{unit}{pkg.package.packageSize > 1 ? 's' : ''}
					</td>

					<!-- Quantity -->
					<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
						{pkg.quantity}
					</td>

					<!-- Total Units -->
					<td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
						{pkg.totalUnits}
						{unit}{pkg.totalUnits > 1 ? 's' : ''}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
