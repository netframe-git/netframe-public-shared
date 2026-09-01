import { writable } from 'svelte/store';
import { readCookie, writeSharedCookie } from '../internal/cookieDomain.js';

/**
 * Light/dark preference, shared across every Netframe app.
 *
 * The choice lives in an `nf-theme` cookie scoped to .netframe.com, not just
 * localStorage: localStorage is origin-scoped, so netframe.com could not tell
 * downloads.netframe.com or the Keycloak login pages what the visitor picked.
 * localStorage is still written as a same-origin fallback.
 *
 * Deliberately free of $app/* imports. The SvelteKit packaging docs warn
 * against depending on framework modules in a library, and a plain
 * `typeof window` check costs nothing and keeps this usable anywhere.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nf-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

function coerce(v: string | null | undefined): ThemeMode {
	return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function readInitial(): ThemeMode {
	if (!isBrowser()) return 'system';
	try {
		return coerce(readCookie(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY));
	} catch {
		return 'system';
	}
}

export function systemPrefersDark(): boolean {
	return isBrowser() && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Stamp the resolved theme onto <html>, which is what the CSS keys off. */
export function applyMode(mode: ThemeMode): void {
	if (!isBrowser()) return;
	const isDark = mode === 'dark' || (mode === 'system' && systemPrefersDark());
	document.documentElement.classList.toggle('dark', isDark);
	document.documentElement.setAttribute('data-nf-theme', mode);
}

/**
 * Persisted twice on purpose: localStorage as a same-origin fallback, and a
 * cookie scoped to the shared parent domain so the choice follows the visitor
 * to the other Netframe apps. Domain scoping lives in one place for both this
 * and the consent cookie - see internal/cookieDomain.
 */
function persist(mode: ThemeMode) {
	if (!isBrowser()) return;
	try {
		localStorage.setItem(STORAGE_KEY, mode);
		writeSharedCookie(STORAGE_KEY, mode, COOKIE_MAX_AGE);
	} catch {
		/* A visitor who cannot persist the choice still gets it for this page. */
	}
}

function createThemeStore() {
	const initial = readInitial();
	const { subscribe, set: rawSet } = writable<ThemeMode>(initial);

	if (isBrowser()) {
		window
			.matchMedia('(prefers-color-scheme: dark)')
			.addEventListener('change', () => {
				if (readInitial() === 'system') applyMode('system');
			});
	}

	return {
		subscribe,
		set(mode: ThemeMode) {
			persist(mode);
			applyMode(mode);
			rawSet(mode);
		}
	};
}

export const theme = createThemeStore();

/**
 * The pre-paint bootstrap, as a string for each app to inline in app.html.
 *
 * It has to run before any markup renders, which means it cannot be a
 * component. Shipping it here stops six apps keeping six subtly different
 * copies of the same eight lines.
 */
export const themeBootstrapScript = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)nf-theme=([^;]*)/);
var v=m?decodeURIComponent(m[1]):null;
if(!v){try{v=localStorage.getItem('nf-theme')}catch(e){}}
if(v!=='light'&&v!=='dark'&&v!=='system')v='system';
var d=v==='dark'||(v==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.setAttribute('data-nf-theme',v);
document.documentElement.classList.toggle('dark',d);
}catch(e){}})();`;
