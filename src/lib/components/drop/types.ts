/**
 * View models for the archive and the demand forms.
 *
 * These exist so the load functions can do the deciding — which cover image,
 * which state mark, which sizes are gone — and the components can stay dumb.
 * Everything here is plain data that survives SvelteKit's serialisation.
 */
import type { DropState } from '$lib/domain/drop-state';
import type { Size } from '$lib/drop/sizes';

export type CoverImage = {
	readonly url: string;
	readonly alt: string;
};

/** One card in the chronological grid (§03 template 03). */
export type ArchiveCard = {
	readonly slug: string;
	readonly number: number;
	readonly name: string;
	readonly state: DropState;
	readonly story: string;
	/** §06: archived drops are "dated as released". Falls back to the launch instant. */
	readonly releasedAt: number;
	readonly editionSize: number;
	readonly cover: CoverImage | null;
	/** §12: only a finished drop can be asked for again. */
	readonly canRequest: boolean;
	/** Size options for the request form, pre-labelled server-side. */
	readonly sizeOptions: readonly { value: string; label: string }[];
};

/** One size on a selector or a notify-me row. */
export type SizeOffer = {
	readonly variantId: string;
	readonly size: Size;
	readonly sku: string;
	/** §06: sold-out sizes are GREYED AND VISIBLE, never removed. */
	readonly soldOut: boolean;
	/** Sellable units left. Shown only as a scarcity hint, never as a promise. */
	readonly remaining: number;
};
