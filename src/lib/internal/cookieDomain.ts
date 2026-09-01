/**
 * Where a cross-app cookie may be written.
 *
 * Every Netframe app runs on its own subdomain, so any preference that is
 * supposed to follow a visitor between them - the theme, the consent choice -
 * has to be a cookie scoped to the shared parent domain. localStorage cannot
 * do this: it is origin-scoped, so netframe.com and downloads.netframe.com
 * each get their own private copy.
 *
 * Getting this wrong fails silently. A cookie naming a domain the page is not
 * under is dropped by the browser with no error, and the app then behaves as
 * though the preference simply was not set.
 */

/**
 * Longest first: the first match wins, and a shorter base must never shadow a
 * longer one it happens to be a substring of.
 */
const SHARED_BASES = ['netframe.com.neond.dev', 'netframe.com'];

/**
 * The `; domain=...` fragment for the current host, or '' when the host is not
 * under a shared base - localhost, a preview URL, anything else. Returning ''
 * yields a host-only cookie, which still works for that one origin.
 */
export function cookieDomainAttr(hostname: string): string {
	const base = SHARED_BASES.find((d) => hostname === d || hostname.endsWith('.' + d));
	return base ? `; domain=.${base}` : '';
}

/** Read a cookie by name in the browser. Returns null when absent. */
export function readCookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
	return m ? decodeURIComponent(m[1]) : null;
}

/** Write a cookie scoped as widely as the current host allows. */
export function writeSharedCookie(name: string, value: string, maxAgeSeconds: number): void {
	if (typeof document === 'undefined' || typeof location === 'undefined') return;
	const domain = cookieDomainAttr(location.hostname);
	const secure = location.protocol === 'https:' ? '; Secure' : '';
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/${domain}; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}
