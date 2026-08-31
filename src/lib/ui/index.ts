/**
 * Shared chrome for the Netframe apps.
 *
 * Components take their content as props rather than importing it. That is
 * deliberate: the public site has regions, a mega menu and a cookie banner,
 * and the portals have none of those. Anything app-specific is injected by the
 * app, so one component serves all of them.
 */
export { default as Logo } from './Logo.svelte';
export type { NavItem, NavSection, FooterColumn, FooterLink } from './types.js';
