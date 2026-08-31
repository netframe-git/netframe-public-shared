<script lang="ts">
	import Logo from './Logo.svelte';
	import type { FooterColumn, FooterLink, RegionSwitcher, SocialLinks } from './types.js';

	/**
	 * The Netframe footer.
	 *
	 * Everything that differs between apps arrives as a prop. The public site
	 * has a region switcher and a cookie-settings button; the portals have
	 * neither, and importing those would make this component unbuildable
	 * outside the site. Passing them in keeps one footer for all six apps.
	 */
	interface Props {
		/** Link columns, rendered left to right after the brand block. */
		columns?: FooterColumn[];
		tagline?: string;
		phone?: { label: string; href: string } | null;
		social?: SocialLinks | null;
		/** Small print links in the bottom bar. */
		legal?: FooterLink[];
		/** Defaults to "© <year> Neon Dynamics Pty Ltd · ACN 677 066 625 · Melbourne, Australia". */
		copyright?: string | null;
		/** Public site only. Portals pass nothing and no switcher renders. */
		regions?: RegionSwitcher | null;
		/** Public site only: opens the consent manager. */
		onCookieSettings?: (() => void) | null;
		logoHref?: string;
	}

	let {
		columns = [],
		tagline = 'Enterprise virtualisation platform built on proven KVM technology. Made in Melbourne, Australia.',
		phone = null,
		social = null,
		legal = [],
		copyright = null,
		regions = null,
		onCookieSettings = null,
		logoHref = 'https://netframe.com'
	}: Props = $props();

	const year = new Date().getFullYear();
	const copyrightLine = $derived(
		copyright ??
			`© ${year} Neon Dynamics Pty Ltd · ACN 677 066 625 · Melbourne, Australia`
	);
</script>

<footer class="border-t border-nf-border-soft bg-nf-header">
	<div class="mx-auto w-full max-w-[1280px] px-4 sm:px-6 md:px-10">
		<div class="pt-14 pb-8">
			<div class="mb-12 grid grid-cols-2 gap-8 md:grid-cols-6">
				<!-- Brand -->
				<div class="col-span-2">
					<Logo href={logoHref} class="mb-3" />

					{#if tagline}
						<p class="mb-3 max-w-xs text-sm leading-relaxed text-nf-muted">{tagline}</p>
					{/if}

					{#if phone}
						<div class="mb-5">
							<a
								href={phone.href}
								class="inline-flex items-center gap-2 text-sm text-nf-muted transition-colors hover:text-nf-text"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
								{phone.label}
							</a>
						</div>
					{/if}

					{#if social}
						<div class="flex items-center gap-3">
							{#if social.linkedin}
								<a href={social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="Neon Dynamics on LinkedIn" class="text-nf-subtle transition-colors hover:text-nf-text">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05a4.2 4.2 0 0 1 3.75-2c4 0 4.75 2.6 4.75 6V21h-4v-5.6c0-1.35-.03-3.08-1.9-3.08-1.9 0-2.2 1.47-2.2 3v5.68H9z"/></svg>
								</a>
							{/if}
							{#if social.reddit}
								<a href={social.reddit} target="_blank" rel="noopener noreferrer" aria-label="Netframe on Reddit" class="text-nf-subtle transition-colors hover:text-nf-text">
									<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5.5 9.2a1.4 1.4 0 0 1-.7 1.2c0 .13.02.26.02.4 0 2.2-2.6 4-5.8 4s-5.8-1.8-5.8-4c0-.14 0-.27.02-.4a1.4 1.4 0 1 1 1.6-2.28A7.1 7.1 0 0 1 11 8.6l.7-3.3 2.3.5a1 1 0 1 1 .1.9l-1.6-.34-.6 2.85a7.1 7.1 0 0 1 4.1 1.5 1.4 1.4 0 0 1 1.5.5zM9 13.4a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-.6 2.1a.4.4 0 0 1 .02.6A4.6 4.6 0 0 1 12 17a4.6 4.6 0 0 1-2.4-.9.4.4 0 1 1 .5-.6c.5.4 1.2.7 1.9.7s1.4-.3 1.9-.7a.4.4 0 0 1 .5 0z"/></svg>
								</a>
							{/if}
							{#if social.x}
								<a href={social.x} target="_blank" rel="noopener noreferrer" aria-label="Netframe on X" class="text-nf-subtle transition-colors hover:text-nf-text">
									<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.6l-5.2-6.8L5.5 22H2.4l7.6-8.7L1.2 2h6.8l4.7 6.2zm-1.1 18h1.7L7.3 3.7H5.5z"/></svg>
								</a>
							{/if}
						</div>
					{/if}
				</div>

				{#each columns as col}
					<div>
						<h4 class="mb-4 text-xs font-semibold tracking-wider text-nf-subtle uppercase">
							{col.heading}
						</h4>
						<ul class="space-y-2.5">
							{#each col.links as link}
								<li>
									<a
										href={link.href}
										target={link.external ? '_blank' : undefined}
										rel={link.external ? 'noopener noreferrer' : undefined}
										class="text-sm text-nf-muted transition-colors hover:text-nf-text">{link.label}</a
									>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>

			<div
				class="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-nf-border-soft pt-6 text-xs text-nf-subtle"
			>
				<span class="text-center md:text-left">{copyrightLine}</span>

				<span class="flex flex-wrap items-center gap-5">
					{#if regions}
						<span class="flex items-center gap-1.5" aria-label="Region">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/></svg>
							{#each regions.choices as choice, i}
								{#if i > 0}<span class="opacity-40" aria-hidden="true">/</span>{/if}
								{#if choice.value === regions.current}
									<span class="font-medium text-nf-text" aria-current="true">{choice.label}</span>
								{:else}
									<a href={regions.hrefFor(choice.value)} data-sveltekit-reload class="hover:text-nf-text">{choice.label}</a>
								{/if}
							{/each}
						</span>
					{/if}

					{#each legal as link}
						<a href={link.href} class="hover:text-nf-text">{link.label}</a>
					{/each}

					{#if onCookieSettings}
						<button type="button" onclick={onCookieSettings} class="hover:text-nf-text"
							>Cookie settings</button
						>
					{/if}

					<span>Made in Australia</span>
				</span>
			</div>
		</div>
	</div>
</footer>
