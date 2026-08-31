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

export interface NavItem {
	label: string;
	href?: string;
	children?: NavSection[];
}

export interface NavSection {
	title?: string;
	items: { label: string; href: string; description?: string; badge?: string }[];
	/** Sections sharing a column number stack inside it. */
	column?: number;
}
