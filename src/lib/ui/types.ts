/** The signed-in user, as each app's server resolves it from its session. */
export interface SessionUser {
	name?: string;
	username?: string;
	email?: string;
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
