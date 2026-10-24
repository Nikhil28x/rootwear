<script lang="ts">
	import {
		PERMISSION_GROUPS,
		PERMISSION_PRESETS,
		type PermissionKey
	} from '$lib/admin/permissions';

	/**
	 * Owner switch, quick presets, then every permission as a checkbox. The
	 * checkboxes are real form inputs named `permissions`, so the form posts
	 * without JavaScript; presets only tick boxes.
	 */
	let {
		selected = $bindable([]),
		isOwner = $bindable(false),
		canMakeOwners
	}: {
		selected?: string[];
		isOwner?: boolean;
		canMakeOwners: boolean;
	} = $props();

	function applyPreset(permissions: readonly PermissionKey[]) {
		selected = [...permissions];
	}
</script>

<div class="flex flex-col gap-6">
	<label class="flex items-start gap-3 rounded-[10px] border border-q-border p-3">
		<input
			type="checkbox"
			class="q-check mt-0.5"
			name="owner"
			bind:checked={isOwner}
			disabled={!canMakeOwners}
		/>
		<span class="flex flex-col gap-0.5">
			<span class="text-[14px] font-medium text-q-text">Owner</span>
			<span class="text-[13px] leading-[18px] text-q-secondary">
				Full access to everything, now and as new sections are added.
				{#if !canMakeOwners}Only an owner can make someone an owner.{/if}
			</span>
		</span>
	</label>

	{#if !isOwner}
		<div class="flex flex-col gap-2">
			<p class="q-label">Start from</p>
			<div class="flex flex-wrap gap-2">
				{#each PERMISSION_PRESETS as preset (preset.id)}
					<button
						type="button"
						class="q-btn q-btn-secondary q-btn-sm"
						title={preset.detail}
						onclick={() => applyPreset(preset.permissions)}>{preset.label}</button
					>
				{/each}
			</div>
		</div>

		<fieldset class="flex flex-col gap-5">
			<legend class="q-label mb-3">Permissions</legend>
			{#each PERMISSION_GROUPS as group (group.label)}
				<div class="flex flex-col gap-2">
					<p class="text-[13px] font-medium text-q-tertiary">{group.label}</p>
					<div class="flex flex-col gap-1">
						{#each group.permissions as permission (permission.key)}
							<label class="flex items-start gap-3 rounded-[10px] px-2 py-2 hover:bg-q-muted">
								<input
									type="checkbox"
									class="q-check mt-0.5"
									name="permissions"
									value={permission.key}
									bind:group={selected}
								/>
								<span class="flex flex-col gap-0.5">
									<span class="text-[14px] text-q-text">{permission.label}</span>
									<span class="text-[13px] leading-[18px] text-q-secondary"
										>{permission.detail}</span
									>
								</span>
							</label>
						{/each}
					</div>
				</div>
			{/each}
		</fieldset>
	{/if}
</div>
