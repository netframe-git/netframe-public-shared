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
	 * Runs immediately on every full page load with no session. It also checks
	 * again when an anonymous tab becomes active, so a login completed in
	 * another Netframe app (or while this page was in the back/forward cache) is
	 * noticed without requiring a manual reload.
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

	function startProbe(onSettled: () => void): () => void {
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
			onSettled();
			if (result === 'authenticated') {
				try {
					onAuthenticated();
				} catch {
					/* The visitor still has a working, signed-out page. */
				}
			}
		};

		window.addEventListener('message', onMessage);
		frame = document.createElement('iframe');
		frame.src = '/auth/silent';
		frame.title = 'Sign-in check';
		frame.setAttribute('aria-hidden', 'true');
		frame.setAttribute('tabindex', '-1');
		frame.style.cssText =
			'position:absolute;width:0;height:0;border:0;visibility:hidden;pointer-events:none;';

		// The iframe never reports back if the identity service is unreachable,
		// so this timeout is the only thing that ends the probe during an outage.
		timeout = window.setTimeout(() => finish('error'), timeoutMs);
		document.body.appendChild(frame);

		return () => finish(null);
	}

	onMount(() => {
		let stop = () => {};
		let probing = false;
		let lastStartedAt = 0;

		const probe = () => {
			// visibilitychange and focus commonly arrive together. This small guard
			// folds them into one identity request without delaying a genuine check.
			const now = Date.now();
			if (
				probing ||
				document.visibilityState === 'hidden' ||
				justSignedOut() ||
				now - lastStartedAt < 1500
			) {
				return;
			}

			lastStartedAt = now;
			probing = true;
			try {
				stop = startProbe(() => {
					probing = false;
				});
			} catch (err) {
				probing = false;
				// Nothing this component does is important enough to break a page over.
				console.log('[sso] silent check could not start', err);
			}
		};

		const onActive = () => probe();
		probe();
		window.addEventListener('focus', onActive);
		document.addEventListener('visibilitychange', onActive);

		return () => {
			window.removeEventListener('focus', onActive);
			document.removeEventListener('visibilitychange', onActive);
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
