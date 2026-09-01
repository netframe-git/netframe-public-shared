import { writable } from 'svelte/store';
import { readCookie, writeSharedCookie } from '../internal/cookieDomain.js';

/**
 * Cookie consent, shared across every Netframe app.
 *
 * Essential cookies are always on and are not represented here.
 *
 * Opt-out model, appropriate for the current Australian audience: the optional
 * categories default to ON and tracking runs until the visitor opts out. The
 * choice is persisted for 30 days.
 *
 * The cookie is scoped to the shared parent domain, so a choice made on
 * netframe.com governs the downloads portal and every other app. That is the
 * whole point of it living here: a consent banner that only binds the site the
 * visitor happened to be on when they answered is not consent, and the banner
 * promises otherwise.
 *
 * Google Consent Mode v2, advanced implementation: each app pushes the consent
 * default (derived from this cookie) before its tag loader, the tag always
 * loads, and setConsent() below pushes an update when the visitor chooses.
 * Opted-out visitors still send cookieless pings that GA models, rather than
 * disappearing from reporting entirely.
 *
 * NOTE: this defaults optional categories to granted. That is correct for
 * Australia and NOT correct for the EEA/UK, which require opt-in. When the
 * audience becomes global, flip the defaults to denied for those regions.
 */
export interface ConsentState {
	analytics: boolean;
	marketing: boolean;
	/** True once the visitor has made an explicit choice. */
	decided: boolean;
}

const COOKIE_NAME = 'nf_cookie_consent';
const MAX_AGE = 60 * 60 * 24 * 30;

/** Opt-out default: on until explicitly declined. */
const DEFAULT: ConsentState = { analytics: true, marketing: true, decided: false };

export function readConsent(): ConsentState {
	const raw = readCookie(COOKIE_NAME);
	if (!raw) return { ...DEFAULT };
	try {
		const v = JSON.parse(raw);
		return { analytics: !!v.analytics, marketing: !!v.marketing, decided: true };
	} catch {
		return { ...DEFAULT };
	}
}

export const consent = writable<ConsentState>(readConsent());

/** Controls the preferences modal, so a footer link can reopen it. */
export const cookiePrefsOpen = writable(false);

/**
 * Consent Mode v2 update.
 *
 * Must push the gtag `arguments` object rather than an array, or the tag
 * ignores the command entirely - which looks like consent silently not
 * applying.
 */
function updateGoogleConsent(state: ConsentState): void {
	if (typeof window === 'undefined') return;
	const w = window as unknown as { dataLayer?: unknown[] };
	w.dataLayer = w.dataLayer || [];
	function gtag(..._args: unknown[]) {
		// eslint-disable-next-line prefer-rest-params
		w.dataLayer!.push(arguments);
	}
	gtag('consent', 'update', {
		analytics_storage: state.analytics ? 'granted' : 'denied',
		ad_storage: state.marketing ? 'granted' : 'denied',
		ad_user_data: state.marketing ? 'granted' : 'denied',
		ad_personalization: state.marketing ? 'granted' : 'denied'
	});
}

export function setConsent(prefs: { analytics: boolean; marketing: boolean }): void {
	const state: ConsentState = { ...prefs, decided: true };
	consent.set(state);
	writeSharedCookie(
		COOKIE_NAME,
		JSON.stringify({ analytics: state.analytics, marketing: state.marketing }),
		MAX_AGE
	);
	updateGoogleConsent(state);
}

export const acceptAll = () => setConsent({ analytics: true, marketing: true });
export const rejectOptional = () => setConsent({ analytics: false, marketing: false });
export const openCookiePrefs = () => cookiePrefsOpen.set(true);

/**
 * The consent default for an app's pre-paint tag bootstrap.
 *
 * Ordering matters: this has to reach the dataLayer before the tag loader, so
 * each app inlines it in app.html. Shipping the string here stops six apps
 * keeping six subtly different copies of the same logic.
 */
export const consentBootstrapScript = `(function(){
window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
var a=true,m=true;
try{var c=document.cookie.match(/(?:^|;\\s*)nf_cookie_consent=([^;]+)/);
if(c){var v=JSON.parse(decodeURIComponent(c[1]));if(v){a=v.analytics!==false;m=v.marketing!==false;}}}catch(e){}
gtag('consent','default',{analytics_storage:a?'granted':'denied',ad_storage:m?'granted':'denied',ad_user_data:m?'granted':'denied',ad_personalization:m?'granted':'denied'});
})();`;
