import { redirect, type Handle, type RequestEvent } from '@sveltejs/kit';
import { loadSession } from './session.js';

/**
 * How an app treats visitors with no session.
 *
 * Every Netframe app authenticates the same way against the same Keycloak
 * realm; what differs is only whether anonymous visitors are allowed in at
 * all. Expressing that as policy rather than as six slightly different
 * hooks.server.ts files is the point of this package.
 */
export interface AuthPolicy {
	/**
	 * May anonymous visitors reach the app?
	 *
	 *   false - everything requires a session (licensing, admin)
	 *   true  - the app is browsable, and gates individual features itself
	 *           by checking locals.user (downloads, the public site)
	 *
	 * Defaults to FALSE, deliberately. The two failure modes are not
	 * symmetrical: a missing setting that wrongly demands a login is an
	 * annoyance, while one that wrongly allows anonymous access to the
	 * licensing portal is a breach. Absent or unparseable config fails closed.
	 */
	anonymousAccess?: boolean;

	/**
	 * Where to send an anonymous visitor when anonymousAccess is false.
	 * 'login' starts the Keycloak flow; a URL sends them away entirely.
	 */
	unauthenticatedRedirect?: 'login' | string;

	/**
	 * Extra path prefixes reachable without a session.
	 *
	 * /auth is always included and cannot be removed. Without that, a policy
	 * of anonymousAccess:false redirects /auth/start to /auth/start forever:
	 * the visitor has no session, so the guard bounces them to the login
	 * route, which the guard also protects. That loop is the single easiest
	 * mistake to make here, so the allowlist lives in the package rather than
	 * in six apps that each have to remember it.
	 */
	publicPaths?: string[];
}

/**
 * A library cannot see the consuming app's App.Locals declaration, so the
 * shape it relies on is asserted here in one place rather than at each use.
 * Apps declare `user?: SessionUser` in their own app.d.ts.
 */
function locals(event: RequestEvent): { user?: unknown } {
	return event.locals as { user?: unknown };
}

/** Always reachable, whatever the policy says. */
const ALWAYS_PUBLIC = ['/auth'];

function parseBool(v: unknown): boolean | undefined {
	if (typeof v === 'boolean') return v;
	if (typeof v === 'string') {
		const s = v.trim().toLowerCase();
		if (['true', '1', 'yes', 'on'].includes(s)) return true;
		if (['false', '0', 'no', 'off'].includes(s)) return false;
	}
	return undefined;
}

/**
 * Resolve the policy, preferring an explicit value and falling back to the
 * NF_ANONYMOUS_ACCESS environment variable. Anything unrecognised is treated
 * as absent, and absent means deny.
 */
function anonymousAllowed(policy: AuthPolicy, event: RequestEvent): boolean {
	if (typeof policy.anonymousAccess === 'boolean') return policy.anonymousAccess;
	const env = (event.platform as { env?: Record<string, unknown> } | undefined)?.env;
	return parseBool(env?.NF_ANONYMOUS_ACCESS) ?? false;
}

export function createAuthHandle(policy: AuthPolicy = {}): Handle {
	const publicPaths = [...ALWAYS_PUBLIC, ...(policy.publicPaths ?? [])];

	return async ({ event, resolve }) => {
		/**
		 * A failure to resolve the session must not 500 the app. An expired or
		 * malformed cookie means "not signed in", which the policy below then
		 * handles; it does not mean the request cannot be served.
		 */
		try {
			locals(event).user = (await loadSession(event)) ?? undefined;
		} catch (err) {
			console.log('[auth] session could not be resolved; treating as anonymous', {
				reason: err instanceof Error ? err.message : String(err)
			});
			locals(event).user = undefined;
		}

		if (!locals(event).user && !anonymousAllowed(policy, event)) {
			const path = event.url.pathname;
			const exempt = publicPaths.some((p) => path === p || path.startsWith(p + '/'));
			if (!exempt) {
				const target = policy.unauthenticatedRedirect ?? 'login';
				if (target === 'login') {
					const returnTo = encodeURIComponent(event.url.pathname + event.url.search);
					throw redirect(303, `/auth/start?returnTo=${returnTo}`);
				}
				throw redirect(303, target);
			}
		}

		return resolve(event);
	};
}
