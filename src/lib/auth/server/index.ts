/**
 * Server-only auth. Never import this from client code: it reads
 * KEYCLOAK_CLIENT_SECRET and must not be reachable from a browser bundle.
 */
export {
	configureAuth,
	getOidcConfig,
	discover,
	authorizeUrl,
	exchangeCode,
	refreshTokens,
	endSessionUrl,
	jwksUri,
	pkceChallenge,
	randomUrlSafe,
	type OidcConfig,
	type TokenSet
} from './oidc.js';

export {
	loadSession,
	clearSession,
	storeTokens,
	setLoginLegCookies,
	takeLoginLegCookies,
	setSilentLegCookies,
	takeSilentLegCookies,
	pauseSilentSso,
	AT_COOKIE,
	RT_COOKIE,
	IT_COOKIE,
	STATE_COOKIE,
	VERIFIER_COOKIE,
	RETURN_COOKIE,
	SSO_STATE_COOKIE,
	SSO_VERIFIER_COOKIE,
	SSO_PAUSE_COOKIE,
	SSO_PAUSE_MAX_AGE
} from './session.js';

export { decodeJwtUnsafe, validateClaims, verifyJwtRS256, getJwks, type AccessTokenClaims } from './jwt.js';

export { createAuthHandle, type AuthPolicy } from './hooks.js';
export {
	handleAuthStart,
	handleAuthCallback,
	handleAuthLogout,
	handleSilentStart,
	handleSilentCallback,
	silentResultPage,
	type SilentResult
} from './handlers.js';
