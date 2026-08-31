<script lang="ts">
	/**
	 * The Netframe wordmark.
	 *
	 * The relative offsets below are optical alignment, not accidents. Do not
	 * "tidy" them into flex/margins: `top-2` on the title and `left-6 -top-[3px]`
	 * on the subtitle are what make the wordmark sit correctly against the mark.
	 */
	interface Props {
		/** Where the wordmark links. Apps other than the site usually point home. */
		href?: string;
		/** Hide the "by NeonDynamics" line where space is tight. */
		compact?: boolean;
		/** Light-on-dark palette, for dark surfaces like a hero. */
		onDark?: boolean;
		class?: string;
	}

	let {
		href = 'https://netframe.com',
		compact = false,
		onDark = false,
		class: extraClass = ''
	}: Props = $props();

	const titleClass = $derived(onDark ? 'text-white' : 'text-nf-text');
	const subtitleClass = $derived(onDark ? 'text-slate-400' : 'text-nf-subtle');
</script>

<a
	{href}
	class="flex shrink-0 items-center gap-3 transition-opacity duration-200 hover:opacity-85 {extraClass}"
>
	<img src="/assets/img/logo.png" alt="Netframe" loading="lazy" class="h-9 w-9" />
	<div class="leading-tight">
		<div
			class="relative top-2 text-3xl tracking-[-0.055em] {titleClass}"
			style="font-family: 'prime-netframe-regular'; font-weight: 550;"
		>
			Netframe
		</div>
		{#if !compact}
			<div class="relative left-6 -top-[3px] text-[12px] {subtitleClass}">by NeonDynamics</div>
		{/if}
	</div>
</a>
