import { writable } from 'svelte/store';

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
/**
 * Bases whose subdomains share the theme cookie.
 *
 * Longest first: the first match wins, and a shorter base must never shadow a
 * longer one it happens to be a substring of.
 *
 * The .neond.dev entry is what lets the dev deployments share a choice with
 * each other. Without it every dev host sets a host-only cookie and the theme
 * appears not to carry between apps - which looks exactly like the feature
 * being broken, while production works fine.
 */
const SHARED_BASES = ['netframe.com.neond.dev', 'netframe.com'];

const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

function readCookie(): string | null {
	if (!isBrowser()) return null;
	const m = document.cookie.match(/(?:^|;\s*)nf-theme=([^;]*)/);
	return m ? decodeURIComponent(m[1]) : null;
}

function coerce(v: string | null | undefined): ThemeMode {
	return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function readInitial(): ThemeMode {
	if (!isBrowser()) return 'system';
	try {
		return coerce(readCookie() ?? localStorage.getItem(STORAGE_KEY));
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
 * The domain attribute is omitted off netframe.com. A cookie naming a domain
 * the page is not under is silently dropped, which would break the toggle in
 * local development with no error to explain it.
 */
function persist(mode: ThemeMode): void {
	if (!isBrowser()) return;
	try {
		localStorage.setItem(STORAGE_KEY, mode);
		const host = location.hostname;
		const base = SHARED_BASES.find((d) => host === d || host.endsWith('.' + d));
		const domain = base ? `; domain=.${base}` : '';
		const secure = location.protocol === 'https:' ? '; Secure' : '';
		document.cookie = `${STORAGE_KEY}=${mode}; path=/${domain}; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
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
