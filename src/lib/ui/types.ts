/**
 * The signed-in user, as resolved from a verified Keycloak access token.
 *
 * Lives here rather than beside the auth code because both sides need it: the
 * server builds it in $lib/server/auth, and components read it off layout
 * data. A component cannot import from $lib/server at all, so a shared type
 * module is the only place the two can meet.
 */
export interface SessionUser {
	/** Keycloak subject id. Stable per user. */
	sub: string;
	username: string;
	/**
	 * Verified email address. This is the load-bearing claim in this portal:
	 * file and product visibility tiers are matched against it, so a user with
	 * no email sees public releases only.
	 */
	email: string | null;
	name: string | null;
}

export interface FooterLink {
	label: string;
	href: string;
	/** Open in a new tab. */
	external?: boolean;
}

export interface FooterColumn {
	heading: string;
	links: FooterLink[];
}

export interface SocialLinks {
	linkedin?: string;
	reddit?: string;
	x?: string;
}

/** Public site only: the /au region switcher in the footer bar. */
export interface RegionSwitcher {
	choices: { value: string; label: string }[];
	current: string;
	hrefFor: (region: string) => string;
}

export interface NavEntry {
	label: string;
	href: string;
	description?: string;
	badge?: string;
}

export interface NavSection {
	title?: string;
	items: NavEntry[];
	/** Sections sharing a column number stack inside it. */
	column?: number;
}

export interface NavItem {
	label: string;
	/** A plain link. Mutually exclusive with `children`. */
	href?: string;
	/** A mega-menu dropdown. */
	children?: NavSection[];
}
