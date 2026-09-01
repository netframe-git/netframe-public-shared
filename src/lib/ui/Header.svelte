<script lang="ts">
	import { onMount } from 'svelte';
	import {
		ChevronDown,
		ChevronRight,
		Download,
		ExternalLink,
		KeyRound,
		LifeBuoy,
		LogOut,
		Menu,
		MessageSquare,
		Monitor,
		Moon,
		Sun,
		User,
		Users,
		X
	} from 'lucide-svelte';
	import Logo from './Logo.svelte';
	import { theme, type ThemeMode } from '../theme/index.js';
	import type { HeaderUtilityLink, NavItem, NavSection, SessionUser } from './types.js';

	/**
	 * Supplying navItems opts the primary site into the mega menu and mobile
	 * drawer. Other apps supply a sectionLabel and retain the same account menu.
	 */
	interface Props {
		user?: SessionUser | null;
		navItems?: NavItem[];
		utilityLinks?: HeaderUtilityLink[];
		sectionLabel?: string | null;
		logoHref?: string;
		resolveHref?: (href: string) => string;
		/** Region-stripped pathname, used to mark primary-site links active. */
		activePath?: string;
		cta?: { label: string; href: string; external?: boolean } | null;
		onSignIn?: (() => void) | null;
		onSignOut?: (() => void) | null;
	}

	let {
		user = null,
		navItems = [],
		utilityLinks = [],
		sectionLabel = null,
		logoHref = 'https://netframe.com',
		resolveHref = (href: string) => href,
		activePath = '',
		cta = null,
		onSignIn = null,
		onSignOut = null
	}: Props = $props();

	const hasMegaMenu = $derived(navItems.length > 0);
	const isAuth = $derived(!!user);
	const displayName = $derived(user?.name ?? user?.username ?? user?.email ?? 'User');
	const displayEmail = $derived(user?.email ?? '');

	let scrolled = $state(false);
	let accountOpen = $state(false);
	let openMenu = $state<string | null>(null);
	let mobileOpen = $state(false);
	let mobileExpanded = $state<string | null>(null);
	let closeTimer: ReturnType<typeof setTimeout> | null = null;

	function resolved(href: string, external = false): string {
		return external ? href : resolveHref(href);
	}

	function isActive(href: string): boolean {
		if (!activePath) return false;
		return href === '/' ? activePath === '/' : activePath.startsWith(href);
	}

	function toColumns(sections: NavSection[]): NavSection[][] {
		const columns: NavSection[][] = [];
		const numbered = new Map<number, NavSection[]>();
		for (const section of sections) {
			if (section.column === undefined) columns.push([section]);
			else {
				const existing = numbered.get(section.column);
				if (existing) existing.push(section);
				else {
					const column = [section];
					numbered.set(section.column, column);
					columns.push(column);
				}
			}
		}
		return columns;
	}

	function openDropdown(label: string) {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = null;
		openMenu = label;
	}

	function scheduleClose() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = setTimeout(() => (openMenu = null), 120);
	}

	function closeNavigation() {
		if (closeTimer) clearTimeout(closeTimer);
		closeTimer = null;
		openMenu = null;
		mobileOpen = false;
		mobileExpanded = null;
	}

	onMount(() => {
		const onScroll = () => (scrolled = window.scrollY > 4);
		const onClick = (event: MouseEvent) => {
			if (!accountOpen) return;
			const target = event.target;
			if (target instanceof Element && target.closest('[data-account-menu]')) return;
			accountOpen = false;
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			accountOpen = false;
			closeNavigation();
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('scroll', onScroll);
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

<header class="sticky top-0 z-40 w-full border-b bg-nf-header transition-shadow {scrolled ? 'border-nf-border shadow-sm shadow-black/5' : 'border-nf-border-soft'}">
	<div class="mx-auto w-full max-w-[1280px] px-4 sm:px-6 md:px-10">
		<div class="flex h-[60px] items-center justify-between gap-4">
			<Logo href={logoHref} onclick={closeNavigation} />

			{#if hasMegaMenu}
				<nav class="hidden items-center lg:flex" onmouseleave={scheduleClose} aria-label="Main">
					{#each navItems as item (item.label)}
						{#if item.href}
							<a href={resolved(item.href, item.external)} target={item.external ? '_blank' : undefined} rel={item.external ? 'noopener noreferrer' : undefined} onmouseenter={() => (openMenu = null)} class="px-3.5 py-1.5 text-sm transition-colors {isActive(item.href) ? 'font-medium text-nf-brand-text' : 'text-nf-muted-strong hover:text-nf-text'}">{item.label}</a>
						{:else if item.children}
							<div class="relative" role="none" onmouseenter={() => openDropdown(item.label)}>
								<button type="button" class="flex items-center gap-1 px-3.5 py-1.5 text-sm transition-colors {openMenu === item.label ? 'text-nf-text' : 'text-nf-muted-strong hover:text-nf-text'}" aria-expanded={openMenu === item.label}>
									{item.label}<ChevronDown size={13} class="transition-transform duration-150 {openMenu === item.label ? 'rotate-180' : ''}" />
								</button>
							</div>
						{/if}
					{/each}
				</nav>
			{/if}

			<div class="flex shrink-0 items-center gap-1 sm:gap-2">
				{#if cta}
					<a href={resolved(cta.href, cta.external)} target={cta.external ? '_blank' : undefined} rel={cta.external ? 'noopener noreferrer' : undefined} class="inline-flex items-center gap-1.5 rounded bg-nf-brand px-3 py-1.5 text-xs font-medium text-nf-on-brand transition-colors hover:bg-nf-brand-hover">
						<MessageSquare size={12} /><span class="hidden sm:inline">{cta.label}</span>
					</a>
				{/if}

				{#if !hasMegaMenu && sectionLabel}
					<span class="pr-2 text-base font-semibold tracking-tight text-nf-text">{sectionLabel}</span>
					<span class="h-6 w-px bg-nf-border" aria-hidden="true"></span>
				{/if}

				<div class="relative" data-account-menu>
					<button type="button" onclick={() => { accountOpen = !accountOpen; openMenu = null; }} class="flex cursor-pointer items-center gap-1 rounded px-1.5 py-1.5 text-nf-muted-strong transition-colors hover:bg-nf-surface-alt hover:text-nf-text" aria-haspopup="menu" aria-expanded={accountOpen} aria-label={isAuth ? `Account menu for ${displayName}` : 'Account & settings'}>
						{#if isAuth}<span class="flex h-6 w-6 items-center justify-center rounded border border-nf-brand-soft-border bg-nf-brand-soft-bg text-xs font-bold text-nf-brand-text">{displayName?.[0] ?? 'U'}</span>{:else}<User size={14} />{/if}
						<ChevronDown size={11} class="transition-transform duration-150 {accountOpen ? 'rotate-180' : ''}" />
					</button>

					{#if accountOpen}
						<div role="menu" class="absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-lg border border-nf-border bg-nf-card shadow-xl shadow-black/10" style="animation: nfMegaIn 180ms ease forwards;">
							{#if isAuth}
								<div class="flex items-center gap-2.5 border-b border-nf-border-soft px-3 py-2.5">
									<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-nf-brand-soft-border bg-nf-brand-soft-bg text-sm font-bold text-nf-brand-text">{displayName?.[0] ?? 'U'}</span>
									<div class="min-w-0"><div class="truncate text-sm leading-tight font-medium text-nf-text">{displayName}</div>{#if displayEmail}<div class="truncate text-xs leading-tight text-nf-muted">{displayEmail}</div>{/if}</div>
								</div>
							{/if}

							<div class="border-b border-nf-border-soft px-3 py-2.5">
								<div class="mb-1.5 text-[10px] font-semibold tracking-wider text-nf-subtle uppercase">Theme</div>
								<div class="grid grid-cols-3 gap-1">
									{#each THEMES as [mode, Icon, label]}
										<button type="button" onclick={() => theme.set(mode)} class="flex cursor-pointer flex-col items-center gap-1 rounded border py-1.5 text-[10px] font-medium transition-colors {$theme === mode ? 'border-nf-brand-soft-border bg-nf-brand-soft-bg text-nf-brand-text' : 'border-nf-border bg-transparent text-nf-muted-strong hover:bg-nf-surface-alt'}" aria-pressed={$theme === mode}>
											<Icon size={12} />{label}
										</button>
									{/each}
								</div>
							</div>

							<div class="py-1">
								{#if isAuth && onSignOut}
									<button type="button" onclick={() => { onSignOut?.(); accountOpen = false; }} class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-nf-muted-strong hover:bg-nf-surface-alt hover:text-nf-text" role="menuitem"><LogOut size={13} /> Sign out</button>
								{:else if !isAuth && onSignIn}
									<button type="button" onclick={() => { onSignIn?.(); accountOpen = false; }} class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-nf-muted-strong hover:bg-nf-surface-alt hover:text-nf-text" role="menuitem"><User size={13} /> Sign in</button>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				{#if hasMegaMenu}
					<button type="button" onclick={() => (mobileOpen = !mobileOpen)} class="p-2 text-nf-muted-strong hover:text-nf-text lg:hidden" aria-label="Toggle menu" aria-expanded={mobileOpen}>
						{#if mobileOpen}<X size={18} />{:else}<Menu size={18} />{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>

	{#if openMenu}
		{@const active = navItems.find((item) => item.label === openMenu && item.children)}
		{#if active?.children}
			{@const columns = toColumns(active.children)}
			<div role="presentation" onmouseenter={() => openDropdown(active.label)} onmouseleave={scheduleClose} class="absolute inset-x-0 top-full hidden lg:block">
				<div class="mx-auto mt-1 max-w-7xl px-6 md:px-10" style="animation: nfMegaIn 180ms ease forwards;">
					<div class="overflow-hidden rounded-xl border border-nf-border bg-nf-card shadow-xl shadow-black/10">
						<div class="grid divide-x divide-nf-border-soft" style="grid-template-columns: repeat({Math.min(columns.length, 4)}, minmax(0, 1fr));">
							{#each columns as column, columnIndex (columnIndex)}
								<div class="p-6">
									{#each column as section, sectionIndex (sectionIndex)}
										<div class={sectionIndex ? 'mt-5 border-t border-nf-border-soft pt-5' : ''}>
											{#if section.title}<div class="mb-3 text-[10px] font-semibold tracking-[0.14em] text-nf-subtle uppercase">{section.title}</div>{/if}
											<ul class="space-y-0.5">
												{#each section.items as entry (entry.label)}
													<li>
														{#if entry.disabled}
															<div class="block cursor-not-allowed rounded-md px-2.5 py-2 opacity-70" aria-disabled="true"><span class="text-sm font-medium text-nf-muted">{entry.label}</span>{#if entry.badge}<span class="ml-1.5 rounded border border-nf-warning-border bg-nf-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-nf-warning-text">{entry.badge}</span>{/if}{#if entry.description}<p class="mt-0.5 text-xs text-nf-subtle">{entry.description}</p>{/if}</div>
														{:else}
															<a href={resolved(entry.href, entry.external)} target={entry.external ? '_blank' : undefined} rel={entry.external ? 'noopener noreferrer' : undefined} onclick={closeNavigation} class="group block rounded-md px-2.5 py-2 hover:bg-nf-surface-alt"><span class="text-sm font-medium text-nf-text group-hover:text-nf-brand-text">{entry.label}</span>{#if entry.badge}<span class="ml-1.5 rounded border border-nf-success-border bg-nf-success-bg px-1.5 py-0.5 text-[10px] font-semibold text-nf-success-text">{entry.badge}</span>{/if}{#if entry.external}<ExternalLink size={10} class="ml-1 inline text-nf-subtle" />{/if}{#if entry.description}<p class="mt-0.5 text-xs text-nf-muted group-hover:text-nf-muted-strong">{entry.description}</p>{/if}</a>
														{/if}
													</li>
												{/each}
											</ul>
										</div>
									{/each}
								</div>
							{/each}
						</div>

						{#if utilityLinks.length}
							<div class="flex flex-wrap items-center justify-between gap-3 border-t border-nf-border-soft bg-nf-surface-alt px-6 py-3 text-xs">
								<span class="text-[10px] font-semibold tracking-[0.14em] text-nf-subtle uppercase">Quick links</span>
								<div class="flex flex-wrap items-center gap-2">
									{#each utilityLinks as link (link.label)}
										{#if link.disabled}
											<span class="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-nf-border-soft px-2.5 py-1 font-medium text-nf-subtle opacity-60" aria-disabled="true">{#if link.icon === 'download'}<Download size={12} />{:else if link.icon === 'licensing'}<KeyRound size={12} />{:else if link.icon === 'support'}<LifeBuoy size={12} />{:else if link.icon === 'community'}<Users size={12} />{/if}{link.label}</span>
										{:else}
											<a href={resolved(link.href, link.external)} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined} class="inline-flex items-center gap-1.5 rounded-md border border-nf-brand-soft-border bg-nf-brand-soft-bg px-2.5 py-1 font-medium text-nf-brand-text transition-colors hover:border-nf-brand hover:bg-nf-brand hover:text-nf-on-brand">{#if link.icon === 'download'}<Download size={12} />{:else if link.icon === 'licensing'}<KeyRound size={12} />{:else if link.icon === 'support'}<LifeBuoy size={12} />{:else if link.icon === 'community'}<Users size={12} />{/if}{link.label}</a>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}

	{#if mobileOpen && hasMegaMenu}
		<div class="max-h-[calc(100vh-60px)] overflow-y-auto border-t border-nf-border-soft bg-nf-bg lg:hidden">
			<div class="mx-auto w-full max-w-[1280px] px-4 py-4 sm:px-6 md:px-10">
				{#each navItems as item (item.label)}
					{#if item.href}
						<a href={resolved(item.href, item.external)} onclick={closeNavigation} class="block py-2.5 text-sm {isActive(item.href) ? 'font-medium text-nf-brand-text' : 'text-nf-muted-strong hover:text-nf-brand-text'}">{item.label}</a>
					{:else if item.children}
						<div class="py-1">
							<button type="button" onclick={() => (mobileExpanded = mobileExpanded === item.label ? null : item.label)} class="flex w-full items-center justify-between py-2 text-sm font-medium text-nf-text" aria-expanded={mobileExpanded === item.label}>{item.label}<ChevronRight size={14} class="transition-transform {mobileExpanded === item.label ? 'rotate-90' : ''}" /></button>
							{#if mobileExpanded === item.label}
								<div class="pb-2 pl-2">
									{#each item.children as section, sectionIndex (sectionIndex)}
										<div class="mt-2.5">
											{#if section.title}<div class="mb-1.5 text-[10px] tracking-widest text-nf-subtle uppercase">{section.title}</div>{/if}
											{#each section.items as entry (entry.label)}
												{#if entry.disabled}<div class="flex cursor-not-allowed items-center gap-1.5 py-1.5 text-sm text-nf-muted opacity-70" aria-disabled="true">{entry.label}{#if entry.badge}<span class="rounded border border-nf-warning-border bg-nf-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-nf-warning-text">{entry.badge}</span>{/if}</div>{:else}<a href={resolved(entry.href, entry.external)} target={entry.external ? '_blank' : undefined} rel={entry.external ? 'noopener noreferrer' : undefined} onclick={closeNavigation} class="flex items-center gap-1.5 py-1.5 text-sm text-nf-muted-strong hover:text-nf-brand-text">{entry.label}{#if entry.external}<ExternalLink size={10} />{/if}{#if entry.badge}<span class="rounded border border-nf-success-border bg-nf-success-bg px-1.5 py-0.5 text-[10px] font-semibold text-nf-success-text">{entry.badge}</span>{/if}</a>{/if}
											{/each}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				{/each}

				{#if utilityLinks.length}
					<div class="mt-3 border-t border-nf-border-soft pt-4">
						<div class="mb-2 text-[10px] tracking-widest text-nf-subtle uppercase">Portals</div>
						<div class="grid grid-cols-2 gap-1.5">
							{#each utilityLinks as link (link.label)}
								{#if link.disabled}<span class="cursor-not-allowed py-1.5 text-sm text-nf-subtle opacity-60" aria-disabled="true">{link.label}</span>{:else}<a href={resolved(link.href, link.external)} target={link.external ? '_blank' : undefined} rel={link.external ? 'noopener noreferrer' : undefined} onclick={closeNavigation} class="py-1.5 text-sm text-nf-muted-strong hover:text-nf-brand-text">{link.label}</a>{/if}
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</header>
