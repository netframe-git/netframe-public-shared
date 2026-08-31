/**
 * Talking to Keycloak directly: discovery, the authorization-code exchange,
 * the refresh grant, and RP-initiated logout.
 *
 * The site used to reach Keycloak through a sessions server that brokered
 * nonces over a pre-shared key. That indirection is gone: this is a plain
 * confidential OIDC client doing Authorization Code + PKCE.
 */

import type { RequestEvent } from '@sveltejs/kit';

export interface OidcConfig {
	issuer: string;
	clientId: string;
	clientSecret: string;
}

interface Discovery {
	issuer: string;
	authorization_endpoint: string;
	token_endpoint: string;
	end_session_endpoint?: string;
	jwks_uri: string;
}

export interface TokenSet {
	access_token: string;
	refresh_token?: string;
	id_token?: string;
	expires_in: number;
}

/**
 * Reads config from the Cloudflare Pages binding, falling back to
 * $env/dynamic/private.
 *
 * The fallback is load-bearing rather than decorative. This project has no
 * wrangler or Cloudflare vite plugin, so `platform` is simply undefined under
 * `vite dev`, and plain `process.env` is not populated from .env either.
 * $env/dynamic/private is the mechanism that does work in both places, and is
 * already what $lib/functionsBackend/files/get.ts uses for its S3 credentials.
 */
/**
 * Where config comes from when `platform.env` is absent.
 *
 * On Cloudflare, platform.env has everything. Under `vite dev` there is no
 * platform at all, so each app calls configureAuth({ envFallback: env }) once
 * with its own $env/dynamic/private. Injecting it keeps this package free of
 * framework-specific imports, which the SvelteKit packaging docs warn against.
 */
let envFallback: Record<string, string | undefined> | undefined;

export function configureAuth(opts: { envFallback?: Record<string, string | undefined> }): void {
	envFallback = opts.envFallback;
}

export function getOidcConfig(event: RequestEvent): OidcConfig {
	const platformEnv = (event.platform as { env?: Record<string, string | undefined> } | undefined)
		?.env;
	const get = (k: string) => platformEnv?.[k] ?? envFallback?.[k];

	const issuer = get('KEYCLOAK_ISSUER');
	const clientId = get('KEYCLOAK_CLIENT_ID');
	const clientSecret = get('KEYCLOAK_CLIENT_SECRET');

	/**
	 * Name the keys that are actually absent.
	 *
	 * The previous message listed all three whatever the cause, so a missing
	 * secret and a missing issuer produced identical output - and the two have
	 * completely different fixes: one is a `wrangler secret put`, the other a
	 * vars entry in wrangler.jsonc. Worth knowing which from the log line
	 * rather than by elimination.
	 *
	 * Only key names are reported. Their values are never logged.
	 */
	if (!issuer || !clientId || !clientSecret) {
		const missing = [
			['KEYCLOAK_ISSUER', issuer],
			['KEYCLOAK_CLIENT_ID', clientId],
			['KEYCLOAK_CLIENT_SECRET', clientSecret]
		]
			.filter(([, v]) => !v)
			.map(([k]) => k);

		throw new Error(
			`auth_misconfigured: missing ${missing.join(', ')}. ` +
				'Vars belong in wrangler.jsonc; secrets are set with `wrangler secret put` ' +
				'or in the Worker\'s Settings, and must be set per environment.'
		);
	}
	return { issuer, clientId, clientSecret };
}

/**
 * Discovery document, cached per Worker isolate.
 *
 * Fetched rather than assembled from the issuer by string concatenation: the
 * paths happen to be predictable for Keycloak, but `end_session_endpoint` is
 * the one we would most like not to guess at, and discovery also means an
 * issuer change cannot leave us pointing half at the old host.
 */
const discoveryCache = new Map<string, { doc: Discovery; fetchedAt: number }>();
const DISCOVERY_TTL_MS = 60 * 60 * 1000;

export async function discover(issuer: string): Promise<Discovery> {
	const cached = discoveryCache.get(issuer);
	if (cached && Date.now() - cached.fetchedAt < DISCOVERY_TTL_MS) return cached.doc;

	const url = `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`discovery_failed:${res.status}`);

	const doc = (await res.json()) as Discovery;
	discoveryCache.set(issuer, { doc, fetchedAt: Date.now() });
	return doc;
}

export async function jwksUri(cfg: OidcConfig): Promise<string> {
	return (await discover(cfg.issuer)).jwks_uri;
}

// ---- PKCE ----------------------------------------------------------------

function base64url(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomUrlSafe(byteLength = 32): string {
	return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

/** S256 challenge for a verifier. Keycloak advertises S256; plain is not used. */
export async function pkceChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return base64url(new Uint8Array(digest));
}

// ---- Flow ----------------------------------------------------------------

export async function authorizeUrl(
	cfg: OidcConfig,
	params: { redirectUri: string; state: string; codeChallenge: string; prompt?: 'none' }
): Promise<string> {
	const { authorization_endpoint } = await discover(cfg.issuer);
	const url = new URL(authorization_endpoint);
	url.searchParams.set('client_id', cfg.clientId);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'openid profile email');
	url.searchParams.set('redirect_uri', params.redirectUri);
	url.searchParams.set('state', params.state);
	url.searchParams.set('code_challenge', params.codeChallenge);
	url.searchParams.set('code_challenge_method', 'S256');

	/**
	 * `prompt=none` asks Keycloak to answer purely from the existing SSO
	 * session and never render a login screen: it returns either an
	 * authorization code or error=login_required. That is what makes the
	 * background check invisible, and what makes it safe to run in a hidden
	 * iframe where a login form could not be interacted with.
	 */
	if (params.prompt) url.searchParams.set('prompt', params.prompt);

	return url.toString();
}

async function tokenRequest(cfg: OidcConfig, body: URLSearchParams): Promise<TokenSet> {
	const { token_endpoint } = await discover(cfg.issuer);

	// Client credentials in the body rather than a Basic header: Keycloak
	// accepts both, and this keeps the secret out of anything that logs headers.
	body.set('client_id', cfg.clientId);
	body.set('client_secret', cfg.clientSecret);

	const res = await fetch(token_endpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`token_request_failed:${res.status}:${text.slice(0, 300)}`);
	}
	return (await res.json()) as TokenSet;
}

export function exchangeCode(
	cfg: OidcConfig,
	params: { code: string; redirectUri: string; codeVerifier: string }
): Promise<TokenSet> {
	return tokenRequest(
		cfg,
		new URLSearchParams({
			grant_type: 'authorization_code',
			code: params.code,
			redirect_uri: params.redirectUri,
			code_verifier: params.codeVerifier
		})
	);
}

export function refreshTokens(cfg: OidcConfig, refreshToken: string): Promise<TokenSet> {
	return tokenRequest(
		cfg,
		new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
	);
}

/**
 * RP-initiated logout URL. `id_token_hint` is what lets Keycloak end the
 * session without showing the user a "do you really want to log out?" prompt,
 * which is why the id token is worth keeping in a cookie.
 */
export async function endSessionUrl(
	cfg: OidcConfig,
	params: { idToken?: string; postLogoutRedirectUri: string }
): Promise<string | null> {
	const { end_session_endpoint } = await discover(cfg.issuer);
	if (!end_session_endpoint) return null;

	const url = new URL(end_session_endpoint);
	url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri);
	if (params.idToken) url.searchParams.set('id_token_hint', params.idToken);
	else url.searchParams.set('client_id', cfg.clientId);
	return url.toString();
}
