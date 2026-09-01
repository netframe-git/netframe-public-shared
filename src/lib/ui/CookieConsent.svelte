<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from 'lucide-svelte';
	import {
		consent,
		cookiePrefsOpen,
		acceptAll,
		rejectOptional,
		setConsent
	} from '../consent/index.js';

	/**
	 * Cookie notice and preferences, shared by every Netframe app.
	 *
	 * The choice it records is stored against the shared parent domain, so
	 * answering here governs the public site, the downloads portal and anything
	 * else on netframe.com. A visitor is asked once, not once per subdomain.
	 *
	 * The privacy policy link is a prop: the public site rewrites it per region,
	 * the portals do not, and importing the site's region helper would make this
	 * unbuildable anywhere else.
	 */
	interface Props {
		privacyHref?: string;
	}
	let { privacyHref = 'https://netframe.com/legal/privacy' }: Props = $props();

	// Local toggles for the preferences modal, seeded from current consent.
	let analytics = $state(false);
	let marketing = $state(false);

	// Show the short banner until the visitor has made a choice.
	const showBanner = $derived(!$consent.decided && !$cookiePrefsOpen);

	function openPrefs() {
		analytics = $consent.analytics;
		marketing = $consent.marketing;
		cookiePrefsOpen.set(true);
	}
	function closePrefs() {
		cookiePrefsOpen.set(false);
	}
	function savePrefs() {
		setConsent({ analytics, marketing });
		cookiePrefsOpen.set(false);
	}

	onMount(() => {
		// Re-sync the toggles whenever the modal opens (e.g. via a footer link).
		const unsub = cookiePrefsOpen.subscribe((open) => {
			if (open) {
				analytics = $consent.analytics;
				marketing = $consent.marketing;
			}
		});
		return unsub;
	});
</script>

{#if showBanner}
  <div class="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4">
    <div
      class="mx-auto max-w-4xl rounded-xl border border-nf-border bg-nf-card shadow-xl shadow-black/20 p-4 sm:p-5"
    >
      <div class="flex flex-col lg:flex-row lg:items-center gap-4">
        <p class="text-xs sm:text-sm text-nf-muted-strong leading-relaxed flex-1">
          We use cookies and similar technologies to operate, secure and measure this website, including
          analytics and marketing. By continuing you're okay with this. You can opt out or manage your
          preferences any time. See our
          <a href={privacyHref} class="text-nf-brand-text hover:text-nf-brand-hover underline">Privacy Policy</a>.
        </p>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onclick={acceptAll}
            class="px-3.5 py-2 rounded-md text-xs font-semibold bg-nf-brand text-white hover:bg-nf-brand-hover transition-colors"
          >
            Got it
          </button>
          <button
            onclick={rejectOptional}
            class="px-3.5 py-2 rounded-md text-xs font-semibold bg-nf-surface-alt border border-nf-border text-nf-muted-strong hover:text-nf-text transition-colors"
          >
            Opt out
          </button>
          <button
            onclick={openPrefs}
            class="px-3.5 py-2 rounded-md text-xs font-semibold text-nf-brand-text hover:text-nf-brand-hover transition-colors"
          >
            Manage preferences
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if $cookiePrefsOpen}
  <div class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4">
    <button class="absolute inset-0 bg-black/50" aria-label="Close" onclick={closePrefs}></button>
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
      class="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-nf-border bg-nf-card shadow-2xl"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-nf-border-soft">
        <h2 class="text-base font-bold text-nf-text">Cookie preferences</h2>
        <button onclick={closePrefs} class="text-nf-muted hover:text-nf-text" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      <div class="px-5 py-4 space-y-5 text-sm">
        <!-- Essential -->
        <div>
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-nf-text">Essential cookies</h3>
            <span class="text-[11px] font-medium text-nf-subtle bg-nf-surface-alt border border-nf-border rounded px-2 py-0.5">Always on</span>
          </div>
          <p class="text-xs text-nf-muted leading-relaxed mt-1.5">
            These are required for the website to function properly. They may support security, network
            routing, session management, authentication, fraud prevention and user preference storage.
            Essential cookies cannot be disabled through this preference centre because the website may not
            work correctly without them.
          </p>
        </div>

        <!-- Analytics -->
        <div class="border-t border-nf-border-soft pt-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-nf-text">Analytics and performance cookies</h3>
            <label class="inline-flex items-center gap-2 shrink-0 cursor-pointer">
              <input type="checkbox" bind:checked={analytics} class="accent-nf-brand w-4 h-4" />
              <span class="text-xs text-nf-muted-strong">{analytics ? 'Allow' : 'Do not allow'}</span>
            </label>
          </div>
          <p class="text-xs text-nf-muted leading-relaxed mt-1.5">
            These help us understand how visitors use the website, which pages are viewed, and how the
            website performs. We use this information to improve reliability, content and user experience.
          </p>
        </div>

        <!-- Marketing -->
        <div class="border-t border-nf-border-soft pt-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-semibold text-nf-text">Marketing cookies</h3>
            <label class="inline-flex items-center gap-2 shrink-0 cursor-pointer">
              <input type="checkbox" bind:checked={marketing} class="accent-nf-brand w-4 h-4" />
              <span class="text-xs text-nf-muted-strong">{marketing ? 'Allow' : 'Do not allow'}</span>
            </label>
          </div>
          <p class="text-xs text-nf-muted leading-relaxed mt-1.5">
            These may be used to understand engagement with Netframe content or to support relevant
            marketing activity.
          </p>
        </div>

        <p class="text-xs text-nf-subtle leading-relaxed border-t border-nf-border-soft pt-4">
          You can change your preferences at any time by returning to cookie settings. You can also control
          cookies through your browser settings.
        </p>
      </div>

      <div class="px-5 py-4 border-t border-nf-border-soft flex flex-wrap gap-2 justify-end">
        <button
          onclick={() => { analytics = false; marketing = false; savePrefs(); }}
          class="px-3.5 py-2 rounded-md text-xs font-semibold bg-nf-surface-alt border border-nf-border text-nf-muted-strong hover:text-nf-text transition-colors"
        >
          Reject optional
        </button>
        <button
          onclick={savePrefs}
          class="px-3.5 py-2 rounded-md text-xs font-semibold bg-nf-brand text-white hover:bg-nf-brand-hover transition-colors"
        >
          Save preferences
        </button>
      </div>
    </div>
  </div>
{/if}
