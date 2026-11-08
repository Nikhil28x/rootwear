/**
 * What visitors actually see of a drop, said in plain words.
 *
 * A drop's visibility is the product of four separate switches: its state,
 * whether it is published, pre-order mode, and whether any product is live.
 * Each is right on its own and the combination is easy to get wrong (a drop
 * can be "Live" and in pre-order mode yet still Hidden, so the shop is empty).
 * This turns the combination into one sentence and a checklist, used by both
 * the drops list and the drop screen so they can never disagree.
 */
import { isOnSale, type DropState } from '$lib/domain/drop-state';
import type { ChipTone } from './ui/Chip.svelte';

export type StorefrontInput = {
	state: string;
	published: boolean;
	preorderMode: boolean;
	/** Products with status "active". */
	liveProducts: number;
	/** Units in stock across the drop. */
	stock: number;
};

export type StorefrontStatus = {
	/** Short label for a chip. */
	label: string;
	tone: ChipTone;
	/** One sentence: what a visitor sees right now. */
	headline: string;
	/** What to do about it, or null when nothing is needed. */
	hint: string | null;
	/** True when visitors can see the drop in the shop. */
	visible: boolean;
	/** True when a visitor can buy or pre-order today. */
	open: boolean;
};

export type Check = {
	key: string;
	ok: boolean;
	label: string;
	/** Shown when the check fails. */
	fix: string;
	/** Optional: a form action on the drop screen that resolves it. */
	action?: 'publish' | 'state' | 'products' | 'preorder';
};

export function storefrontStatus(d: StorefrontInput): StorefrontStatus {
	const onSale = isOnSale(d.state as DropState);

	if (!d.published) {
		return {
			label: 'Not in shop',
			tone: 'warning',
			headline: 'Visitors can’t see this drop. The shop is not showing it.',
			hint:
				d.liveProducts === 0
					? 'Make a product live, then publish the drop.'
					: 'Publish the drop to put it in the shop.',
			visible: false,
			open: false
		};
	}
	if (onSale) {
		return d.preorderMode
			? {
					label: 'Taking pre-orders',
					tone: 'success',
					headline: 'In the shop. Visitors can pre-order; no payment is taken.',
					hint: d.liveProducts === 0 ? 'No product is live, so there is nothing to pre-order.' : null,
					visible: true,
					open: d.liveProducts > 0
				}
			: {
					label: 'On sale',
					tone: 'success',
					headline: 'In the shop and on sale. Visitors can buy now.',
					hint: d.stock === 0 ? 'Nothing is in stock. Add stock or move to Sold out.' : null,
					visible: true,
					open: d.liveProducts > 0 && d.stock > 0
				};
	}
	if (d.state === 'TEASE' || d.state === 'REVEALED') {
		return {
			label: 'Counting down',
			tone: 'info',
			headline: 'In the shop with a countdown. Nothing can be bought yet.',
			hint: 'Move the drop to Live when you open the sale.',
			visible: true,
			open: false
		};
	}
	return {
		label: d.state === 'ARCHIVED' ? 'In the archive' : 'Sold out',
		tone: 'neutral',
		headline: 'In the shop as a finished drop. Visitors can ask for it back.',
		hint: null,
		visible: true,
		open: false
	};
}

/** The steps between "created" and "visitors can order", in the order to do them. */
export function goLiveChecks(d: StorefrontInput): Check[] {
	return [
		{
			key: 'products',
			ok: d.liveProducts > 0,
			label: 'A product is live',
			fix: 'Open a product and set it to Live. Drafts never reach the shop.',
			action: 'products'
		},
		{
			key: 'stock',
			ok: d.stock > 0 || d.preorderMode,
			label: 'Stock is set',
			fix: 'Add stock to at least one size. Pre-order mode doesn’t need it.',
			action: 'products'
		},
		{
			key: 'published',
			ok: d.published,
			label: 'Published to the shop',
			fix: 'Publish the drop. Until then only the preview link works.',
			action: 'publish'
		},
		{
			key: 'state',
			ok: isOnSale(d.state as DropState),
			label: 'Sale is open',
			fix: 'The state is not Live yet, so visitors see a countdown, not a button.',
			action: 'state'
		}
	];
}
