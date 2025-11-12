<script lang="ts">
	import type { PrescriptionInput } from '$lib/types';

	interface Props {
		formData: PrescriptionInput;
		isLoading: boolean;
		onSubmit: () => void;
		onChange: (data: PrescriptionInput) => void;
	}

	let { formData = $bindable(), isLoading, onSubmit, onChange }: Props = $props();

	// Validation errors
	let errors = $state<{
		drugName?: string;
		sig?: string;
		daysSupply?: string;
	}>({});

	function validateField(field: keyof PrescriptionInput): void {
		switch (field) {
			case 'drugName':
				if (!formData.drugName || formData.drugName.trim().length === 0) {
					errors.drugName = 'Drug name is required';
				} else if (formData.drugName.length > 200) {
					errors.drugName = 'Drug name must be 200 characters or less';
				} else {
					errors.drugName = undefined;
				}
				break;

			case 'sig':
				if (!formData.sig || formData.sig.trim().length === 0) {
					errors.sig = 'SIG is required';
				} else if (formData.sig.length > 500) {
					errors.sig = 'SIG must be 500 characters or less';
				} else {
					errors.sig = undefined;
				}
				break;

			case 'daysSupply':
				if (!formData.daysSupply) {
					errors.daysSupply = 'Days supply is required';
				} else if (formData.daysSupply < 1 || formData.daysSupply > 365) {
					errors.daysSupply = 'Days supply must be between 1 and 365';
				} else if (!Number.isInteger(formData.daysSupply)) {
					errors.daysSupply = 'Days supply must be a whole number';
				} else {
					errors.daysSupply = undefined;
				}
				break;
		}
	}

	function handleSubmit(e: Event): void {
		e.preventDefault();

		// Validate all fields
		validateField('drugName');
		validateField('sig');
		validateField('daysSupply');

		// Check if any errors
		if (!errors.drugName && !errors.sig && !errors.daysSupply) {
			onSubmit();
		}
	}

	function handleChange(field: keyof PrescriptionInput, value: any): void {
		formData = { ...formData, [field]: value };
		validateField(field);
		onChange(formData);
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<!-- Drug Name -->
	<div>
		<label for="drugName" class="block text-sm font-medium text-gray-700 mb-1">
			Drug Name
		</label>
		<input
			type="text"
			id="drugName"
			value={formData.drugName}
			oninput={(e) => handleChange('drugName', e.currentTarget.value)}
			onblur={() => validateField('drugName')}
			disabled={isLoading}
			class="input-field"
			placeholder="e.g., Lisinopril 10mg"
			autofocus
		/>
		{#if errors.drugName}
			<p class="mt-1 text-sm text-red-600">{errors.drugName}</p>
		{/if}
	</div>

	<!-- SIG -->
	<div>
		<label for="sig" class="block text-sm font-medium text-gray-700 mb-1">
			SIG (Prescription Instructions)
		</label>
		<textarea
			id="sig"
			value={formData.sig}
			oninput={(e) => handleChange('sig', e.currentTarget.value)}
			onblur={() => validateField('sig')}
			disabled={isLoading}
			rows={3}
			class="input-field"
			placeholder="e.g., Take 1 tablet by mouth once daily"
		></textarea>
		{#if errors.sig}
			<p class="mt-1 text-sm text-red-600">{errors.sig}</p>
		{/if}
	</div>

	<!-- Days Supply -->
	<div>
		<label for="daysSupply" class="block text-sm font-medium text-gray-700 mb-1">
			Days Supply
		</label>
		<input
			type="number"
			id="daysSupply"
			value={formData.daysSupply}
			oninput={(e) => handleChange('daysSupply', parseInt(e.currentTarget.value, 10))}
			onblur={() => validateField('daysSupply')}
			disabled={isLoading}
			min={1}
			max={365}
			step={1}
			class="input-field"
			placeholder="30"
		/>
		{#if errors.daysSupply}
			<p class="mt-1 text-sm text-red-600">{errors.daysSupply}</p>
		{/if}
	</div>

	<!-- Submit Button -->
	<button type="submit" disabled={isLoading} class="btn-primary w-full">
		{isLoading ? 'Calculating...' : 'Calculate Prescription'}
	</button>
</form>
