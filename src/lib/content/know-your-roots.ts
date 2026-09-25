/**
 * §03 template 09 — "Know your roots": hemp, why Rootwear, the making.
 *
 * ONE page, deliberately not split into a story page plus a sustainability
 * page. The copy lives here as structured data rather than inline in the
 * markup so that it can move to the `policies`-style content tables later
 * without touching a single line of the view.
 *
 * §14 governs every string below. The fabric composition, the GSM, the
 * edition size and the size range are facts about the garment and may be
 * stated. Nothing here claims an effect on the world — where the copy wants
 * to argue for hemp it argues from material behaviour (staple length, hand,
 * drape, how the cloth ages), never from an environmental benefit.
 * `scripts/content-audit.mjs` fails the build on a regression.
 */
import { EDITION_SIZE } from '$lib/config/commerce';
import { PROVABLE_FACTS } from '$lib/content/claims';
import { FIT_DISCLAIMER, SIZE_RANGE_LABEL } from '$lib/drop/sizes';

/** A term/definition pair in the material-properties list. */
export type RootsProperty = {
	readonly term: string;
	readonly definition: string;
};

/** A numbered entry — used for both the principles and the making steps. */
export type RootsStep = {
	readonly index: string;
	readonly title: string;
	readonly body: string;
};

/** A dated, externally sourced note in the lineage strip. */
export type RootsLineage = {
	readonly era: string;
	readonly place: string;
	readonly body: string;
	readonly source: { readonly label: string; readonly href: string };
};

/** One of the three movements. `surface` drives the light/dark alternation. */
export type RootsMovement = {
	readonly id: string;
	readonly index: string;
	readonly eyebrow: string;
	readonly title: readonly string[];
	readonly lede: string;
	readonly surface: 'light' | 'dark';
};

export const KNOW_YOUR_ROOTS_SEO = {
	title: 'Know your roots — Rootwear',
	description:
		'Hemp as a fibre, why Rootwear exists, and how a drop is made. 30% hemp, 70% cotton, ' +
		'180 GSM, twenty-five hand-numbered pieces, India only.'
} as const;

export const ROOTS_HERO = {
	eyebrow: 'The fibre · the label · the making',
	title: ['Know your', 'roots.'],
	lede:
		'Three things worth knowing before you wear one: what the cloth is actually made of, ' +
		'why this label exists at all, and how a drop gets made. No mythology — the plant, the ' +
		'decisions, and the hands.',
	jumpLabel: 'Skip to'
} as const;

/** The three movements, in order. The page renders them as one continuous read. */
export const ROOTS_MOVEMENTS: readonly RootsMovement[] = [
	{
		id: 'hemp',
		index: '01',
		eyebrow: 'The fibre',
		title: ['It begins', 'as a stalk.'],
		lede:
			'Hemp is a bast fibre. It is stripped from the stem of Cannabis sativa rather than ' +
			'picked from a seed head, and that one difference explains almost everything about how ' +
			'the cloth behaves.',
		surface: 'dark'
	},
	{
		id: 'why-rootwear',
		index: '02',
		eyebrow: 'The label',
		title: ['Established', 'in Process.'],
		lede:
			'Rootwear is not a catalogue. It is a sequence of drops, one at a time, each one ' +
			'finished before the next begins. The drop is the object.',
		surface: 'light'
	},
	{
		id: 'the-making',
		index: '03',
		eyebrow: 'The making',
		title: ['How a drop', 'comes to exist.'],
		lede:
			'Five stages, in order. None of them are automated, which is the reason there are ' +
			`${EDITION_SIZE} pieces in a drop and not more.`,
		surface: 'dark'
	}
] as const;

/* ------------------------------------------------------------------ 01 hemp */

export const HEMP_BODY: readonly string[] = [
	'Cotton grows as a seed hair: short, fine, spun into a soft and round yarn. Bast fibre runs ' +
		'the length of the stalk in long bundles held in the plant’s outer layer. Separated and ' +
		'spun, those bundles give a yarn with a longer staple and a flatter cross-section.',
	'Longer staple means fewer fibre ends at the surface of the yarn. Fewer ends means less ' +
		'surface fuzz, less pilling where a bag strap sits, and a cloth that keeps its face after a ' +
		'year of wear instead of blooming into a haze.',
	'It is a firmer hand out of the parcel. Hemp-led cloth arrives with body to it — it holds a ' +
		'fold and it falls away from the shoulder rather than clinging to it. Then it softens, and ' +
		'it keeps softening. The shirt you unwrap is not the shirt you will own in six months.'
] as const;

export const HEMP_PROPERTIES: readonly RootsProperty[] = [
	{
		term: 'Bast fibre',
		definition: 'Taken from the stem, not the seed head. Long bundles rather than short hairs.'
	},
	{
		term: 'Staple length',
		definition: 'Fewer fibre ends at the yarn surface, so less fuzz raises over time.'
	},
	{
		term: 'Hand',
		definition: 'Firm on day one, softer every wash after. The break-in is the point.'
	},
	{
		term: 'Drape',
		definition: 'Weight instead of cling. It hangs off the frame rather than following it.'
	},
	{
		term: 'How it ages',
		definition: 'Takes a crease, takes a fade, keeps a shape. It records how it was worn.'
	}
] as const;

export const HEMP_BLEND_NOTE =
	'Rootwear runs hemp at 30% against 70% cotton. The cotton carries softness from the first ' +
	'wear; the hemp carries the body, the staple length and the way the cloth ages. 180 GSM is a ' +
	'mid-weight jersey — enough to hang properly, not so much that it stops being wearable ' +
	'through an Indian summer.';

/** The four figures §14 permits us to print, sourced from the claims module. */
export const HEMP_FACTS = PROVABLE_FACTS;

export const HEMP_LINEAGE: readonly RootsLineage[] = [
	{
		era: 'c. 6000 BCE',
		place: 'East Asia',
		body:
			'Archaeological work places cannabis seeds and fibre in East Asia around eight thousand ' +
			'years ago. The plant was a material long before it was anything else.',
		source: {
			label: 'The research, in Nature',
			href: 'https://www.nature.com/articles/s41586-025-09065-0'
		}
	},
	{
		era: '1885',
		place: 'Punjab, India',
		body:
			'A hemp fibre sample from Punjab, given by the Royal Botanic Gardens at Kew, is held in ' +
			'the Smithsonian’s collection. India is not new to this fibre.',
		source: {
			label: 'The record, in the Smithsonian',
			href: 'https://americanhistory.si.edu/collections/object/nmah_648677'
		}
	}
] as const;

/* --------------------------------------------------------- 02 why rootwear */

export const WHY_ROOTWEAR_PRINCIPLES: readonly RootsStep[] = [
	{
		index: '01',
		title: 'One strain at a time',
		body:
			'Each drop is named for a single strain and built around it — one story, one palette, ' +
			'one cut. When it is finished it is finished. The page stays up; the pieces do not come back.'
	},
	{
		index: '02',
		title: `${EDITION_SIZE} pieces`,
		body:
			`A drop is ${EDITION_SIZE} hand-numbered pieces. Not twenty-five thousand with a ` +
			'limited-edition sticker on the neck label. The number written on yours is the number ' +
			'that was made.'
	},
	{
		index: '03',
		title: 'India only',
		body:
			'We ship within India and nowhere else — one country, one currency, one set of rules ' +
			'we can actually honour. Every price on the site is shown inclusive of GST.'
	},
	{
		index: '04',
		title: 'Sold nowhere else',
		body:
			'No marketplace listings, no resellers, no third-party storefront. If it did not come ' +
			'from this site, it did not come from us.'
	},
	{
		index: '05',
		title: 'Nothing is ever taken down',
		body:
			'A finished drop keeps its page, its photographs and its story, with the sold pieces ' +
			'marked sold. The archive is the proof that the numbers were real.'
	}
] as const;

export const WHY_ROOTWEAR_PULLQUOTE = {
	line: 'Built from the ground up.',
	attribution: 'The house line, and the working method'
} as const;

/* ----------------------------------------------------------- 03 the making */

export const MAKING_STEPS: readonly RootsStep[] = [
	{
		index: '01',
		title: 'The cloth',
		body:
			'The blend is fixed before anything else: 30% hemp, 70% cotton, knitted at 180 GSM. The ' +
			'weight is chosen for the cut, not the other way around.'
	},
	{
		index: '02',
		title: 'The cut',
		body:
			`One unisex block, graded across ${SIZE_RANGE_LABEL}, cut to the same measurements every ` +
			`time. Chest and length in centimetres sit on the size guide, because “oversized” ` +
			`on its own is how people end up with the wrong shirt. ${FIT_DISCLAIMER}`
	},
	{
		index: '03',
		title: 'The artwork',
		body:
			'The back carries the drop’s artwork. It is set once and proofed on the actual cloth ' +
			'rather than on paper, and it is never rescaled to fit a different garment.'
	},
	{
		index: '04',
		title: 'The hand-numbering',
		body:
			`Each finished piece is numbered by hand, 01 through ${EDITION_SIZE}, on the label. The ` +
			'number is assigned when a piece is allocated to an order, so the one you receive is the ' +
			'one recorded against your name.'
	},
	{
		index: '05',
		title: 'The dispatch',
		body:
			'Packed and sent by hand, with the piece number on the note. Pre-orders leave once the ' +
			'balance is settled, and the dispatch note tells you exactly where yours sits in the queue.'
	}
] as const;

/* ---------------------------------------------------------------- the close */

export const ROOTS_CLOSE = {
	eyebrow: 'Where this goes next',
	line: ['One strain.', `${EDITION_SIZE} pieces.`, 'Then the next one.'],
	body:
		'Everything above exists so that a drop can be small and still be honest about it. The ' +
		'current one is open now; the finished ones are still where we left them.',
	actions: [
		{ label: 'See the current drop', href: '/drops', primary: true },
		{ label: 'Read the size guide', href: '/policies/size-guide', primary: false }
	]
} as const;

/** One object so the route loads the whole page's copy in a single import. */
export const KNOW_YOUR_ROOTS = {
	seo: KNOW_YOUR_ROOTS_SEO,
	hero: ROOTS_HERO,
	movements: ROOTS_MOVEMENTS,
	hemp: {
		body: HEMP_BODY,
		properties: HEMP_PROPERTIES,
		blendNote: HEMP_BLEND_NOTE,
		facts: HEMP_FACTS,
		lineage: HEMP_LINEAGE
	},
	whyRootwear: {
		principles: WHY_ROOTWEAR_PRINCIPLES,
		pullquote: WHY_ROOTWEAR_PULLQUOTE
	},
	making: { steps: MAKING_STEPS },
	close: ROOTS_CLOSE
} as const;

export type KnowYourRootsContent = typeof KNOW_YOUR_ROOTS;
