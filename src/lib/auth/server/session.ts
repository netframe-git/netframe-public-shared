/**
 * The signed-in session, held entirely in httpOnly cookies.
 *
 * Browser JavaScript never sees a token. This is the main behavioural change
 * from the sessions-server design, where the access token was handed to the
 * page in a URL fragment and parked in sessionStorage, readable by any script
 * that ran on the site.
 *
 * Consequences worth knowing:
 *   - API calls from the browser are plain same-origin fetches. Cookies ride
 *     along automatically; there is no Authorization header to attach and no
 *     token for a client-side helper to manage.
 *   - Who is signed in is answered on the server and passed down through
 *     layout data, so it is correct during SSR rather than appearing after
 *     hydration.
 */

import type { RequestEvent } from '@sveltejs/kit';
import { getOidcConfig, jwksUri, refreshTokens, type TokenSet } from './oidc';
import { decodeJwtUnsafe, validateClaims, verifyJwtRS256, type AccessTokenClaims } from './jwt';
import { SSO_PAUSE_COOKIE, SSO_PAUSE_MAX_AGE } from '../constants.js';
import type { SessionUser } from '../../ui/types.js';

export type { SessionUser };

export const AT_COOKIE = 'nf_at';
export const RT_COOKIE = 'nf_rt';
export const IT_COOKIE = 'nf_it';

/** Login-leg state, deleted as soon as the callback consumes it. */
export const STATE_COOKIE = 'nf_oidc_state';
export const VERIFIER_COOKIE = 'nf_oidc_verifier';
export const RETURN_COOKIE = 'nf_oidc_return';

const LOGIN_LEG_MAX_AGE = 10 * 60; // 10 minutes to complete a login
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // refresh token lifetime ceiling

/** Refresh this far ahead of expiry so a request never races the clock. */
const REFRESH_SKEW_SECONDS = 30;

function cookieOpts(event: RequestEvent, maxAge: number) {
	return {
		path: '/',
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax' as const,
		maxAge
	};
}

export function setLoginLegCookies(
	event: RequestEvent,
	values: { state: string; verifier: string; returnTo: string }
): void {
	const opts = cookieOpts(event, LOGIN_LEG_MAX_AGE);
	event.cookies.set(STATE_COOKIE, values.state, opts);
	event.cookies.set(VERIFIER_COOKIE, values.verifier, opts);
	event.cookies.set(RETURN_COOKIE, values.returnTo, opts);
}

export function takeLoginLegCookies(event: RequestEvent) {
	const state = event.cookies.get(STATE_COOKIE);
	const verifier = event.cookies.get(VERIFIER_COOKIE);
	const returnTo = event.cookies.get(RETURN_COOKIE);
	for (const name of [STATE_COOKIE, VERIFIER_COOKIE, RETURN_COOKIE]) {
		event.cookies.delete(name, { path: '/' });
	}
	return { state, verifier, returnTo };
}

/**
 * The silent SSO probe carries its own state and verifier rather than reusing
 * the login-leg cookies. A background check must never be able to overwrite
 * the state of a login the visitor started deliberately in another tab, which
 * is exactly what sharing the cookie names would allow.
 */
export const SSO_STATE_COOKIE = 'nf_sso_state';
export const SSO_VERIFIER_COOKIE = 'nf_sso_verifier';

export { SSO_PAUSE_COOKIE, SSO_PAUSE_MAX_AGE };

export function setSilentLegCookies(
	event: RequestEvent,
	values: { state: string; verifier: string }
): void {
	const opts = cookieOpts(event, LOGIN_LEG_MAX_AGE);
	event.cookies.set(SSO_STATE_COOKIE, values.state, opts);
	event.cookies.set(SSO_VERIFIER_COOKIE, values.verifier, opts);
}

export function takeSilentLegCookies(event: RequestEvent) {
	const state = event.cookies.get(SSO_STATE_COOKIE);
	const verifier = event.cookies.get(SSO_VERIFIER_COOKIE);
	for (const name of [SSO_STATE_COOKIE, SSO_VERIFIER_COOKIE]) {
		event.cookies.delete(name, { path: '/' });
	}
	return { state, verifier };
}

/**
 * Tell the browser-side probe to stand down for a while.
 *
 * Deliberately not httpOnly: it exists to be read by script. It holds no
 * secret, only the fact that someone just signed out, and it stops the probe
 * signing them straight back in seconds later.
 */
export function pauseSilentSso(event: RequestEvent): void {
	event.cookies.set(SSO_PAUSE_COOKIE, '1', {
		path: '/',
		httpOnly: false,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: SSO_PAUSE_MAX_AGE
	});
}

export function storeTokens(event: RequestEvent, tokens: TokenSet): void {
	const opts = cookieOpts(event, SESSION_MAX_AGE);
	event.cookies.set(AT_COOKIE, tokens.access_token, opts);
	if (tokens.refresh_token) event.cookies.set(RT_COOKIE, tokens.refresh_token, opts);
	if (tokens.id_token) event.cookies.set(IT_COOKIE, tokens.id_token, opts);
}

export function clearSession(event: RequestEvent): void {
	for (const name of [AT_COOKIE, RT_COOKIE, IT_COOKIE]) {
		event.cookies.delete(name, { path: '/' });
	}
}

function toUser(claims: AccessTokenClaims): SessionUser {
	return {
		sub: claims.sub,
		username: claims.preferred_username ?? claims.email ?? claims.sub,
		email: claims.email ?? null,
		name: claims.name ?? claims.given_name ?? null
	};
}

/** Whether a token is expired, or close enough that we should renew it now. */
function needsRefresh(accessToken: string): boolean {
	const claims = decodeJwtUnsafe(accessToken);
	if (typeof claims?.exp !== 'number') return true;
	return claims.exp <= Math.floor(Date.now() / 1000) + REFRESH_SKEW_SECONDS;
}

/**
 * Resolve the current user from cookies, renewing the access token first if it
 * has expired and we still hold a refresh token.
 *
 * Never throws. A bad, tampered, or expired session is simply not a session:
 * the cookies are cleared and the caller sees an anonymous visitor. Anything
 * that genuinely requires a user enforces that itself.
 */
export async function loadSession(event: RequestEvent): Promise<SessionUser | null> {
	let accessToken = event.cookies.get(AT_COOKIE);
	const refreshToken = event.cookies.get(RT_COOKIE);

	if (!accessToken && !refreshToken) return null;

	try {
		const cfg = getOidcConfig(event);

		if ((!accessToken || needsRefresh(accessToken)) && refreshToken) {
			const renewed = await refreshTokens(cfg, refreshToken);
			storeTokens(event, renewed);
			accessToken = renewed.access_token;
		}

		if (!accessToken) {
			clearSession(event);
			return null;
		}

		const claims = await verifyJwtRS256(accessToken, await jwksUri(cfg));
		validateClaims(claims, { issuer: cfg.issuer, clientId: cfg.clientId });
		return toUser(claims);
	} catch (err) {
		console.log('[auth.session] no usable session', {
			reason: err instanceof Error ? err.message : String(err)
		});
		clearSession(event);
		return null;
	}
}
