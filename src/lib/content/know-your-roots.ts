/**
 * §03 template 09 — "Know your roots": hemp, its lineage, why Rootwear,
 * and the making.
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
	readonly title: string;
	readonly body: string;
	readonly source: { readonly label: string; readonly href: string };
};

/** One of the four movements. `surface` drives the light/dark alternation. */
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
		'The long history of plant cloth in India, hemp as a fibre, why Rootwear exists, and ' +
		'how a drop is made. 30% hemp, 70% cotton, 180 GSM, twenty-five hand-numbered pieces.'
} as const;

export const ROOTS_HERO = {
	eyebrow: 'The lineage · the fibre · the label · the making',
	title: ['Know your', 'roots.'],
	lede:
		'The long thread that brought plant fibre here, what the cloth is made of, why this ' +
		'label exists, and how a drop gets made. The history, the plant, the decisions, and the hands.',
	jumpLabel: 'Skip to'
} as const;

/** The four movements, in order. The page renders them as one continuous read. */
export const ROOTS_MOVEMENTS: readonly RootsMovement[] = [
	{
		id: 'lineage',
		index: '01',
		eyebrow: 'The lineage',
		title: ['An old thread,', 'carried forward.'],
		lede:
			'Plant cloth is not a trend we joined. It is a lineage this land has carried for ' +
			'eight thousand years.',
		surface: 'dark'
	},
	{
		id: 'hemp',
		index: '02',
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
		index: '03',
		eyebrow: 'The label',
		title: ['Established', 'in Process.'],
		lede:
			'Rootwear is not a catalogue. It is a sequence of drops, one at a time, each one ' +
			'finished before the next begins. The drop is the object.',
		surface: 'light'
	},
	{
		id: 'the-making',
		index: '04',
		eyebrow: 'The making',
		title: ['How a drop', 'comes to exist.'],
		lede:
			'Five stages, in order. None of them are automated, which is the reason there are ' +
			`${EDITION_SIZE} pieces in a drop and not more.`,
		surface: 'dark'
	}
] as const;

/* ------------------------------------------------------------------ 02 hemp */

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
		era: 'c. 6000 BCE · Mehrgarh',
		title: 'The first thread',
		body:
			'Cotton fibres mineralised inside a copper bead at Mehrgarh, in present-day Pakistan, ' +
			'date to the first half of the sixth millennium BCE. They are the earliest known cotton ' +
			'fibres in the archaeological record: plant cloth was already part of life in this region.',
		source: {
			label: 'Read the archaeological record',
			href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9772618/'
		}
	},
	{
		era: 'The Vedic tradition',
		title: 'Plants worth praising',
		body:
			'The Atharva Veda contains hymns to plants and their healing power. Later traditions ' +
			'associate bhang with that sacred plant vocabulary. Translations and identifications ' +
			'vary, but the underlying idea is clear: useful plants were named, studied, and treated with care.',
		source: {
			label: 'Read the plant history',
			href: 'https://insa.nic.in/writereaddata/UpLoadedFiles/IJHS/10-43539_2024_128_OnlinePDF225-232.pdf'
		}
	},
	{
		era: 'Medieval Ayurveda',
		title: 'Medicine, in measure',
		body:
			'Later Ayurvedic and rasaśāstra texts record cannabis as bhangā or vijayā and describe ' +
			'prepared uses alongside dosage and adverse effects. The record treats it as a potent ' +
			'material to be handled deliberately, not a cure-all.',
		source: {
			label: 'Read the medical history',
			href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5255965/'
		}
	},
	{
		era: 'The western Himalaya',
		title: 'The mountain cloth',
		body:
			'Across the western Himalaya, hemp stalks have been retted, stripped, spun, and woven ' +
			'into cordage and cloth. A surviving 1885 fibre sample from Punjab now sits in the ' +
			'Smithsonian collection; the material history is physical, not imagined.',
		source: {
			label: 'See the fibre record',
			href: 'https://americanhistory.si.edu/collections/object/nmah_648677'
		}
	},
	{
		era: '1894 · The Empire',
		title: 'An inconvenient report',
		body:
			'The colonial Indian Hemp Drugs Commission gathered evidence across the subcontinent. ' +
			'Its report distinguished moderate from excessive use and concluded that moderate use ' +
			'was generally not associated with appreciable harm — a more complicated record than the prohibition story that followed.',
		source: {
			label: 'Explore the commission report',
			href: 'https://wellcomecollection.org/works/ugn4vdz3'
		}
	},
	{
		era: '1985 · NDPS Act',
		title: 'The line, and what it left standing',
		body:
			'India’s central law defined cannabis around resin and flowering or fruiting tops, ' +
			'excluding seeds and leaves when they are not accompanied by those tops. It also allows ' +
			'governments to permit cultivation for fibre, seed, or horticultural purposes.',
		source: {
			label: 'Read the Act',
			href: 'https://www.indiacode.nic.in/bitstream/123456789/6834/1/narcotic-drugs-and-psychotropic-substances-act-1985.pdf'
		}
	},
	{
		era: '2016 onward · Uttarakhand',
		title: 'The return to cultivation',
		body:
			'Uttarakhand became the first Indian state to regulate hemp cultivation and later ' +
			'issued the first commercial pilot licence for high-quality fibre. The return is ' +
			'licensed and measured, but it reconnects the crop with one of its oldest uses.',
		source: {
			label: 'Read the legal survey',
			href: 'https://www.loc.gov/item/2022666115/'
		}
	},
	{
		era: 'Now · Rootwear',
		title: 'You are wearing the rootline',
		body:
			'Rootwear is a continuation: hemp grown as a crop, spun into cloth, and carried into a ' +
			'new garment. Every drop is a small act of remembering. You are holding one end of a very old thread.',
		source: {
			label: 'See the current drop',
			href: '/drops'
		}
	}
] as const;

export const ROOTS_LINEAGE_CLOSE = {
	defiant:
		'We did not start this. We are refusing to let it be forgotten — and asking you to wear it knowing what it is.',
	line: 'Grown slow. Worn loud. Rooted deep.',
	sign: 'ROOTWEAR',
	tag: 'Established in Process.',
	action: { label: 'Join the line', href: '/drops' }
} as const;

/* ----------------------------------------------------------- 03 why rootwear */

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

/* ----------------------------------------------------------- 04 the making */

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
		facts: HEMP_FACTS
	},
	lineage: { entries: HEMP_LINEAGE, close: ROOTS_LINEAGE_CLOSE },
	whyRootwear: {
		principles: WHY_ROOTWEAR_PRINCIPLES,
		pullquote: WHY_ROOTWEAR_PULLQUOTE
	},
	making: { steps: MAKING_STEPS },
	close: ROOTS_CLOSE
} as const;

export type KnowYourRootsContent = typeof KNOW_YOUR_ROOTS;
