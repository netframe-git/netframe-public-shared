<script lang="ts">
	import { onMount } from 'svelte';
	import { ChevronDown, LogOut, User, Sun, Moon, Monitor } from 'lucide-svelte';
	import Logo from './Logo.svelte';
	import { theme, type ThemeMode } from '../theme/index.js';
	import type { NavItem, SessionUser } from './types.js';

	/**
	 * The Netframe header.
	 *
	 * Serves both the public site and the portals. Nav content, the section
	 * label and the auth handlers are all injected, because the site has a mega
	 * menu and regions while the portals have a single section and neither.
	 *
	 * Pass navItems=[] (the default) and no nav renders at all - which is what
	 * the portals want, and avoids shipping dead markup to them.
	 */
	interface Props {
		user?: SessionUser | null;
		/** Mega-menu content. Empty means no nav is rendered. */
		navItems?: NavItem[];
		/** Quiet label naming the current app, e.g. "Downloads". */
		sectionLabel?: string | null;
		logoHref?: string;
		/** Rewrites nav hrefs; the site injects region handling, others pass through. */
		resolveHref?: (href: string) => string;
		cta?: { label: string; href: string } | null;
		onSignIn?: (() => void) | null;
		onSignOut?: (() => void) | null;
	}

	let {
		user = null,
		navItems = [],
		sectionLabel = null,
		logoHref = 'https://netframe.com',
		resolveHref = (h: string) => h,
		cta = null,
		onSignIn = null,
		onSignOut = null
	}: Props = $props();

	const isAuth = $derived(!!user);
	const displayName = $derived(user?.name ?? user?.username ?? user?.email ?? 'User');
	const displayEmail = $derived(user?.email ?? '');

	let accountOpen = $state(false);
	let openMenu = $state<string | null>(null);
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	function openDropdown(label: string) {
		if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
		openMenu = label;
	}
	function scheduleClose() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = setTimeout(() => (openMenu = null), 120);
	}

	onMount(() => {
		const onClick = (e: MouseEvent) => {
			if (!accountOpen) return;
			const t = e.target;
			if (t instanceof Element && t.closest('[data-account-menu]')) return;
			accountOpen = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') { accountOpen = false; openMenu = null; }
		};
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
		};
	});

	const THEMES: [ThemeMode, typeof Sun, string][] = [
		['light', Sun, 'Light'],
		['dark', Moon, 'Dark'],
		['system', Monitor, 'Auto']
	];
</script>

<header class="sticky top-0 z-40 w-full border-b border-nf-border-soft bg-nf-header">
	<div class="mx-auto w-full max-w-[1280px] px-4 sm:px-6 md:px-10">
		<div class="flex h-[60px] items-center justify-between gap-4">
			<Logo href={logoHref} />

			{#if navItems.length > 0}
				<nav class="hidden items-center lg:flex" onmouseleave={scheduleClose} aria-label="Main">
					{#each navItems as item (item.label)}
						{#if item.href}
							<a
								href={resolveHref(item.href)}
								onmouseenter={() => (openMenu = null)}
								class="px-3.5 py-1.5 text-sm text-nf-muted-strong transition-colors hover:text-nf-text"
								>{item.label}</a
							>
						{:else if item.children}
							<div class="relative" role="none" onmouseenter={() => openDropdown(item.label)}>
								<button
									class="flex items-center gap-1 px-3.5 py-1.5 text-sm transition-colors {openMenu ===
									item.label
										? 'text-nf-text'
										: 'text-nf-muted-strong hover:text-nf-text'}"
									aria-expanded={openMenu === item.label}
								>
									{item.label}
									<ChevronDown
										size={13}
										class="transition-transform duration-150 {openMenu === item.label ? 'rotate-180' : ''}"
									/>
								</button>

								{#if openMenu === item.label}
									<div
										class="absolute top-full left-0 z-50 mt-2 flex gap-6 rounded-lg border border-nf-border bg-nf-card p-5 shadow-xl shadow-black/10"
										style="animation: nfMegaIn 180ms ease forwards;"
									>
										{#each item.children as section}
											<div class="min-w-[13rem]">
												{#if section.title}
													<div class="mb-2 text-[10px] font-semibold tracking-wider text-nf-subtle uppercase">
														{section.title}
													</div>
												{/if}
												<ul class="space-y-1">
													{#each section.items as entry}
														<li>
															<a
																href={resolveHref(entry.href)}
																class="block rounded px-2 py-1.5 hover:bg-nf-surface-alt"
															>
																<span class="flex items-center gap-2 text-sm text-nf-text">
																	{entry.label}
																	{#if entry.badge}
																		<span class="rounded border border-nf-brand-soft-border bg-nf-brand-soft-bg px-1.5 py-0.5 text-[10px] font-medium text-nf-brand-text">{entry.badge}</span>
																	{/if}
																</span>
																{#if entry.description}
																	<span class="mt-0.5 block text-xs text-nf-muted">{entry.description}</span>
																{/if}
															</a>
														</li>
													{/each}
												</ul>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</nav>
			{/if}

			<div class="flex shrink-0 items-center gap-2 sm:gap-3">
				{#if cta}
					<a
						href={cta.href}
						class="inline-flex items-center gap-2 rounded bg-nf-brand px-3 py-1.5 text-xs font-medium text-nf-on-brand transition-colors hover:bg-nf-brand-hover"
						>{cta.label}</a
					>
				{/if}

				{#if sectionLabel}
					<span class="text-sm font-medium tracking-tight text-nf-muted">{sectionLabel}</span>
					<span class="h-6 w-px bg-nf-border" aria-hidden="true"></span>
				{/if}

				<div class="relative" data-account-menu>
					<button
						type="button"
						onclick={() => (accountOpen = !accountOpen)}
						class="flex items-center gap-1 rounded px-1.5 py-1.5 text-nf-muted-strong transition-colors hover:bg-nf-surface-alt hover:text-nf-text"
						aria-haspopup="menu"
						aria-expanded={accountOpen}
						aria-label={isAuth ? `Account menu for ${displayName}` : 'Account & settings'}
					>
						{#if isAuth}
							<span
								class="flex h-6 w-6 items-center justify-center rounded border border-nf-brand-soft-border bg-nf-brand-soft-bg text-xs font-bold text-nf-brand-text"
								>{displayName?.[0] ?? 'U'}</span
							>
						{:else}
							<User size={14} />
						{/if}
						<ChevronDown size={11} class="transition-transform duration-150 {accountOpen ? 'rotate-180' : ''}" />
					</button>

					{#if accountOpen}
						<div
							role="menu"
							class="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-nf-border bg-nf-card shadow-xl shadow-black/10"
							style="animation: nfMegaIn 180ms ease forwards;"
						>
							{#if isAuth}
								<div class="flex items-center gap-2.5 border-b border-nf-border-soft px-3 py-2.5">
									<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-nf-brand-soft-border bg-nf-brand-soft-bg text-sm font-bold text-nf-brand-text">{displayName?.[0] ?? 'U'}</span>
									<div class="min-w-0">
										<div class="truncate text-sm leading-tight font-medium text-nf-text">{displayName}</div>
										{#if displayEmail}<div class="truncate text-xs leading-tight text-nf-muted">{displayEmail}</div>{/if}
									</div>
								</div>
							{/if}

							<div class="border-b border-nf-border-soft px-3 py-2.5">
								<div class="mb-1.5 text-[10px] font-semibold tracking-wider text-nf-subtle uppercase">Theme</div>
								<div class="grid grid-cols-3 gap-1">
									{#each THEMES as [mode, Icon, label]}
										<button
											type="button"
											onclick={() => theme.set(mode)}
											class="flex flex-col items-center gap-1 rounded border py-1.5 text-[10px] font-medium transition-colors {$theme === mode
												? 'border-nf-brand-soft-border bg-nf-brand-soft-bg text-nf-brand-text'
												: 'border-nf-border bg-transparent text-nf-muted-strong hover:bg-nf-surface-alt'}"
											aria-pressed={$theme === mode}
										>
											<Icon size={12} />
											{label}
										</button>
									{/each}
								</div>
							</div>

							<div class="py-1">
								{#if isAuth && onSignOut}
									<button type="button" onclick={() => { onSignOut?.(); accountOpen = false; }} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-nf-muted-strong hover:bg-nf-surface-alt hover:text-nf-text" role="menuitem">
										<LogOut size={13} /> Sign out
									</button>
								{:else if !isAuth && onSignIn}
									<button type="button" onclick={() => { onSignIn?.(); accountOpen = false; }} class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-nf-muted-strong hover:bg-nf-surface-alt hover:text-nf-text" role="menuitem">
										<User size={13} /> Sign in
									</button>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</header>
