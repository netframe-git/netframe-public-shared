/**
 * Shared chrome for the Netframe apps.
 *
 * Components take their content as props rather than importing it. The public
 * site has regions, a mega menu and a cookie banner; the portals have none of
 * those. Anything app-specific is injected, so one component serves them all.
 */
export { default as Logo } from './Logo.svelte';
export { default as Header } from './Header.svelte';
export { default as Footer } from './Footer.svelte';
export { default as CookieConsent } from './CookieConsent.svelte';
export type {
	SessionUser,
	FooterLink,
	FooterColumn,
	SocialLinks,
	RegionSwitcher,
	NavEntry,
	NavSection,
	NavItem
} from './types.js';
