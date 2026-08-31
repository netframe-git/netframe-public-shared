<script lang="ts">
	import { onMount } from 'svelte';
	import { SSO_PAUSE_COOKIE } from '../constants.js';

	/**
	 * Asks Keycloak, once and invisibly, whether this visitor is already signed
	 * in on another netframe.com app.
	 *
	 * Render it only when there is no session. It drops a hidden iframe on
	 * /auth/silent, which redirects to Keycloak with prompt=none and comes back
	 * with an answer. If that answer is 'authenticated' the session cookies have
	 * already been set by the callback, and all that remains is to re-run the
	 * load functions so the header shows the signed-in state.
	 *
	 * Runs on every full page load with no session and no backoff, so signing in
	 * on one app is noticed by the next immediately rather than after a
	 * cooldown. It does not run on client-side navigation, since the component
	 * mounts once per document.
	 *
	 * Everything here is written around one constraint: an unreachable, slow or
	 * broken Keycloak must be indistinguishable from a signed-out visitor.
	 */
	interface Props {
		/** Called when the probe finds a session. Usually invalidateAll(). */
		onAuthenticated: () => void;
		/** How long to wait for Keycloak before giving up on this visit. */
		timeoutMs?: number;
	}

	let { onAuthenticated, timeoutMs = 5000 }: Props = $props();

	type SilentResult = 'authenticated' | 'anonymous' | 'error';

	/** Set by the logout route, so a deliberate sign-out is not undone. */
	function justSignedOut(): boolean {
		return document.cookie.split('; ').some((c) => c.startsWith(`${SSO_PAUSE_COOKIE}=`));
	}

	function startProbe(): () => void {
		if (justSignedOut()) return () => {};

		let settled = false;
		let frame: HTMLIFrameElement | null = null;
		let timeout = 0;

		const onMessage = (event: MessageEvent) => {
			if (event.origin !== window.location.origin) return;
			const data = event.data as { source?: string; result?: SilentResult } | null;
			if (!data || data.source !== 'netframe-sso') return;
			finish(data.result ?? 'error');
		};

		const finish = (result: SilentResult | null) => {
			if (settled) return;
			settled = true;
			window.clearTimeout(timeout);
			window.removeEventListener('message', onMessage);
			frame?.remove();
			frame = null;
			if (result === 'authenticated') {
				try {
					onAuthenticated();
				} catch {
					/* The visitor still has a working, signed-out page. */
				}
			}
		};

		const run = () => {
			window.addEventListener('message', onMessage);
			frame = document.createElement('iframe');
			frame.src = '/auth/silent';
			frame.title = 'Sign-in check';
			frame.setAttribute('aria-hidden', 'true');
			frame.setAttribute('tabindex', '-1');
			frame.style.cssText =
				'position:absolute;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';

			// The iframe never reports back if Keycloak is unreachable, so this
			// timeout is the only thing that ends the probe during an outage.
			timeout = window.setTimeout(() => finish('error'), timeoutMs);
			document.body.appendChild(frame);
		};

		// Deferred to idle time: this is a convenience, not part of rendering,
		// and must never compete with the page for bandwidth or main thread.
		// Called as a method, not detached: an unbound requestIdleCallback
		// throws "Illegal invocation" in Chromium.
		if (typeof window.requestIdleCallback === 'function') {
			const handle = window.requestIdleCallback(run, { timeout: 3000 });
			return () => {
				window.cancelIdleCallback?.(handle);
				finish(null);
			};
		}
		const handle = window.setTimeout(run, 800);
		return () => {
			window.clearTimeout(handle);
			finish(null);
		};
	}

	onMount(() => {
		let stop = () => {};
		try {
			stop = startProbe();
		} catch (err) {
			// Nothing this component does is important enough to break a page over.
			console.log('[sso] silent check could not start', err);
		}
		return () => {
			try {
				stop();
			} catch {
				/* ignore */
			}
		};
	});
</script>

<!--
	No markup by design. The probe is an injected iframe removed as soon as it
	answers, so there is nothing to render or reserve space for.
-->
