import { redirect, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import {
	authorizeUrl,
	exchangeCode,
	endSessionUrl,
	getOidcConfig,
	pkceChallenge,
	randomUrlSafe
} from './oidc.js';
import {
	clearSession,
	pauseSilentSso,
	setLoginLegCookies,
	setSilentLegCookies,
	storeTokens,
	takeLoginLegCookies,
	takeSilentLegCookies,
	IT_COOKIE
} from './session.js';

/**
 * Ready-made auth routes.
 *
 * Every Netframe app runs the same Authorization Code + PKCE flow against the
 * same realm. These are handler factories rather than copied route files, so
 * a fix to the flow is made once. Only the destinations differ per app, and
 * those are arguments.
 */

/**
 * Only ever redirect back to a path on this app.
 *
 * Rejects absolute and protocol-relative URLs, which is what stops
 * /auth/start?returnTo=https://evil.example being an open redirect.
 */
function sanitizeReturnTo(returnTo: string | null): string {
	if (!returnTo) return '/';
	if (returnTo.startsWith('http://') || returnTo.startsWith('https://')) return '/';
	if (returnTo.startsWith('//')) return '/';
	if (!returnTo.startsWith('/')) return '/';
	return returnTo;
}

export function handleAuthStart(): RequestHandler {
	return async (event) => {
		const cfg = getOidcConfig(event);
		const state = randomUrlSafe();
		const verifier = randomUrlSafe();
		const returnTo = sanitizeReturnTo(event.url.searchParams.get('returnTo'));

		setLoginLegCookies(event, { state, verifier, returnTo });

		const destination = await authorizeUrl(cfg, {
			redirectUri: new URL('/auth/callback', event.url.origin).toString(),
			state,
			codeChallenge: await pkceChallenge(verifier)
		});
		throw redirect(303, destination);
	};
}

export function handleAuthCallback(opts: { failureRedirect?: string } = {}): RequestHandler {
	const onFailure = opts.failureRedirect ?? '/';

	return async (event) => {
		const { state, verifier, returnTo } = takeLoginLegCookies(event);
		const code = event.url.searchParams.get('code');
		const returnedState = event.url.searchParams.get('state');
		const oauthError = event.url.searchParams.get('error');

		if (oauthError) {
			console.log('[auth.callback] provider returned an error', {
				error: oauthError,
				description: event.url.searchParams.get('error_description')
			});
			throw redirect(303, onFailure);
		}

		if (!code || !state || !returnedState || state !== returnedState || !verifier) {
			console.log('[auth.callback] rejected', {
				hasCode: Boolean(code),
				hasStoredState: Boolean(state),
				stateMatches: state === returnedState,
				hasVerifier: Boolean(verifier)
			});
			throw redirect(303, onFailure);
		}

		try {
			const cfg = getOidcConfig(event);
			const tokens = await exchangeCode(cfg, {
				code,
				redirectUri: new URL('/auth/callback', event.url.origin).toString(),
				codeVerifier: verifier
			});
			storeTokens(event, tokens);
		} catch (err) {
			/**
			 * The session being replaced is void once the exchange fails, so it
			 * is cleared here. The silent callback deliberately does NOT do this.
			 */
			console.log('[auth.callback] token exchange failed', {
				reason: err instanceof Error ? err.message : String(err)
			});
			clearSession(event);
			throw redirect(303, onFailure);
		}

		throw redirect(303, sanitizeReturnTo(returnTo ?? '/'));
	};
}

export function handleAuthLogout(opts: { signedOutDestination: string }): RequestHandler {
	const dest = opts.signedOutDestination;

	return async (event: RequestEvent) => {
		const idToken = event.cookies.get(IT_COOKIE);
		clearSession(event);

		/**
		 * Stand the silent probe down for a few minutes. RP-initiated logout
		 * ends the Keycloak session too, so a probe would already answer "nobody
		 * is signed in" - this is insurance against that stopping being true.
		 * Without it, a failed end-session leg would let the probe sign the
		 * visitor straight back in seconds after they asked to leave.
		 */
		pauseSilentSso(event);

		let destination = dest;
		try {
			const cfg = getOidcConfig(event);
			destination =
				(await endSessionUrl(cfg, { idToken, postLogoutRedirectUri: dest })) ?? dest;
		} catch (err) {
			// Local cookies are already gone, so the visitor is signed out here
			// even if Keycloak could not be reached to end the session there.
			console.log('[auth.logout] could not build end-session URL', {
				reason: err instanceof Error ? err.message : String(err)
			});
		}

		throw redirect(303, destination);
	};
}

/* ---- silent SSO ------------------------------------------------------- */

export type SilentResult = 'authenticated' | 'anonymous' | 'error';

/**
 * The probe runs in a hidden iframe, so its answer cannot be a redirect or a
 * status code - nothing in the parent document would see either. Every
 * outcome, including every failure, comes back as this tiny postMessage page,
 * so the parent can give up immediately rather than waiting out its timeout.
 */
export function silentResultPage(event: RequestEvent, result: SilentResult): Response {
	const targetOrigin = JSON.stringify(event.url.origin);
	const payload = JSON.stringify(result);

	return new Response(
		`<!doctype html>
<meta charset="utf-8">
<title>Checking sign-in</title>
<script>
(function () {
  try {
    parent.postMessage({ source: 'netframe-sso', result: ${payload} }, ${targetOrigin});
  } catch (e) {}
})();
</script>`,
		{
			status: 200,
			headers: {
				'content-type': 'text/html; charset=utf-8',
				'cache-control': 'no-store',
				'content-security-policy': "frame-ancestors 'self'",
				'x-robots-tag': 'noindex, nofollow'
			}
		}
	);
}

export function handleSilentStart(): RequestHandler {
	return async (event) => {
		let destination: string;
		try {
			const cfg = getOidcConfig(event);
			const state = randomUrlSafe();
			const verifier = randomUrlSafe();
			setSilentLegCookies(event, { state, verifier });

			destination = await authorizeUrl(cfg, {
				redirectUri: new URL('/auth/silent/callback', event.url.origin).toString(),
				state,
				codeChallenge: await pkceChallenge(verifier),
				prompt: 'none'
			});
		} catch (err) {
			/**
			 * Keycloak unreachable or the client misconfigured. Logged, because a
			 * permanently failing probe is worth noticing, but never raised: an
			 * error page in an invisible iframe helps nobody.
			 */
			console.log('[auth.silent] could not start the SSO probe', {
				reason: err instanceof Error ? err.message : String(err)
			});
			return silentResultPage(event, 'error');
		}
		throw redirect(303, destination);
	};
}

/** Keycloak's way of saying "nobody is signed in, and you told me not to ask". */
const NO_SESSION_ERRORS = new Set([
	'login_required',
	'interaction_required',
	'consent_required',
	'account_selection_required'
]);

export function handleSilentCallback(): RequestHandler {
	return async (event) => {
		const { state, verifier } = takeSilentLegCookies(event);
		const code = event.url.searchParams.get('code');
		const returnedState = event.url.searchParams.get('state');
		const oauthError = event.url.searchParams.get('error');

		if (oauthError) {
			return silentResultPage(event, NO_SESSION_ERRORS.has(oauthError) ? 'anonymous' : 'error');
		}

		if (!code || !state || !returnedState || state !== returnedState || !verifier) {
			return silentResultPage(event, 'error');
		}

		try {
			const cfg = getOidcConfig(event);
			const tokens = await exchangeCode(cfg, {
				code,
				redirectUri: new URL('/auth/silent/callback', event.url.origin).toString(),
				codeVerifier: verifier
			});
			storeTokens(event, tokens);
		} catch (err) {
			/**
			 * Never clears the session, unlike the interactive callback. A failure
			 * here means only that a background guess did not pay off; tearing
			 * down a working session over it would turn a silent no-op into a
			 * visible logout.
			 */
			console.log('[auth.silent.callback] token exchange failed', {
				reason: err instanceof Error ? err.message : String(err)
			});
			return silentResultPage(event, 'error');
		}

		return silentResultPage(event, 'authenticated');
	};
}
