/**
 * Names shared by both halves of the silent SSO check.
 *
 * Lives outside the server entry point because the browser probe reads this
 * cookie and the sign-out route writes it. Duplicating the string in two files
 * is how the two halves quietly stop agreeing later.
 */
export const SSO_PAUSE_COOKIE = 'nf_sso_pause';

/** How long a deliberate sign-out suppresses the probe, in seconds. */
export const SSO_PAUSE_MAX_AGE = 10 * 60;
