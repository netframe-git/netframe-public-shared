/**
 * JWT verification against Keycloak's published signing keys.
 *
 * The RS256 verification here is ported from the auth submodule this module
 * replaced. It was already correct and, importantly, already written against
 * WebCrypto rather than a Node-only crypto library, which is what lets it run
 * unchanged on Cloudflare Workers. Rewriting it would have been risk for no
 * gain.
 *
 * Verification is local: we fetch the realm's JWKS once, cache it, and check
 * signatures ourselves. No introspection call to Keycloak per request.
 */

type Jwk = { kty: string; kid: string; n?: string; e?: string; alg?: string; use?: string };
type Jwks = { keys: Jwk[] };

/** Claims we actually rely on. Keycloak sends a great many more. */
export interface AccessTokenClaims {
	sub: string;
	exp: number;
	iss: string;
	azp?: string;
	aud?: string | string[];
	preferred_username?: string;
	email?: string;
	name?: string;
	given_name?: string;
	realm_access?: { roles?: string[] };
	[key: string]: unknown;
}

/**
 * Cached per Worker isolate. Keycloak rotates realm keys rarely, and an
 * unknown `kid` forces a refetch below, so a generous TTL costs nothing and
 * saves a round trip on almost every cold request.
 */
const jwksCache = new Map<string, { jwks: Jwks; fetchedAt: number }>();
const JWKS_TTL_MS = 10 * 60 * 1000;

async function fetchJwks(jwksUrl: string): Promise<Jwks> {
	const res = await fetch(jwksUrl);
	if (!res.ok) throw new Error(`jwks_fetch_failed:${res.status}`);
	const jwks = (await res.json()) as Jwks;
	jwksCache.set(jwksUrl, { jwks, fetchedAt: Date.now() });
	return jwks;
}

export async function getJwks(jwksUrl: string, force = false): Promise<Jwks> {
	const cached = jwksCache.get(jwksUrl);
	if (!force && cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.jwks;
	return fetchJwks(jwksUrl);
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
	const pad = '='.repeat((4 - (s.length % 4)) % 4);
	const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

function decodePart(part: string) {
	return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

/**
 * Claims without signature verification. Only safe where the token's integrity
 * is already established or irrelevant, such as reading `exp` off our own
 * cookie to decide whether to refresh it.
 */
export function decodeJwtUnsafe<T = AccessTokenClaims>(token: string): T | null {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	try {
		return decodePart(parts[1]) as T;
	} catch {
		return null;
	}
}

async function importRsaPublicKeyFromJwk(jwk: Jwk): Promise<CryptoKey> {
	if (!jwk.n || !jwk.e) throw new Error('unsupported_jwk');
	// No `kid` here: it selected the JWK above and is informational only, and
	// the JsonWebKey type does not carry it.
	const keyData: JsonWebKey = { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', use: 'sig' };
	return crypto.subtle.importKey(
		'jwk',
		keyData,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['verify']
	);
}

/**
 * Verify an RS256 JWT against a JWKS.
 *
 * An unrecognised `kid` triggers one forced JWKS refetch before giving up, so
 * a Keycloak key rotation heals itself on the next request instead of logging
 * everyone out until the cache expires.
 */
export async function verifyJwtRS256(token: string, jwksUrl: string): Promise<AccessTokenClaims> {
	const parts = token.split('.');
	if (parts.length !== 3) throw new Error('bad_jwt');

	const [h, p, s] = parts;
	const header = decodePart(h);
	const kid = header.kid;
	if (!kid) throw new Error('missing_kid');

	let jwks = await getJwks(jwksUrl);
	let jwk = jwks.keys.find((k) => k.kid === kid);
	if (!jwk) {
		jwks = await getJwks(jwksUrl, true);
		jwk = jwks.keys.find((k) => k.kid === kid);
	}
	if (!jwk) throw new Error('unknown_kid');

	const key = await importRsaPublicKeyFromJwk(jwk);
	const data = new TextEncoder().encode(`${h}.${p}`);
	const ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, b64urlToBytes(s), data);
	if (!ok) throw new Error('bad_signature');

	return decodePart(p) as AccessTokenClaims;
}

/**
 * Validate the claims that decide whether this token is ours and still good.
 *
 * We check `azp` (authorized party) rather than `aud`. Keycloak sets `azp` to
 * the client the token was issued to, whereas `aud` on a plain access token is
 * typically just "account" unless someone remembers to add an audience mapper
 * to the client's dedicated scope. Checking `azp` is the conventional Keycloak
 * approach and removes a piece of realm configuration that could silently
 * drift out of sync with this code.
 */
export function validateClaims(
	claims: AccessTokenClaims,
	opts: { issuer: string; clientId: string; leewaySeconds?: number }
): void {
	const leeway = opts.leewaySeconds ?? 10;
	const now = Math.floor(Date.now() / 1000);

	if (claims.iss !== opts.issuer) throw new Error('bad_iss');
	if (claims.azp && claims.azp !== opts.clientId) throw new Error('bad_azp');
	if (typeof claims.exp !== 'number' || claims.exp <= now - leeway) {
		throw new Error('token_expired');
	}
	if (!claims.sub) throw new Error('missing_sub');
}
