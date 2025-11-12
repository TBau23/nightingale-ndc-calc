<script lang="ts">
	import type { SelectedPackage, MedicationUnit } from '$lib/types';

	interface Props {
		packages: SelectedPackage[];
		unit: MedicationUnit;
	}

	let { packages, unit }: Props = $props();
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
				<tr class="hover:bg-gray-50 transition-colors">
					<td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-mono font-medium text-gray-900 sm:pl-6">
						{pkg.package.ndc}
					</td>
					<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
						{pkg.package.packageSize}
						{unit}{pkg.package.packageSize > 1 ? 's' : ''}
					</td>
					<td class="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
						{pkg.quantity}
					</td>
					<td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
						{pkg.totalUnits}
						{unit}{pkg.totalUnits > 1 ? 's' : ''}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
