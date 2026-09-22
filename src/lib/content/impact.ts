/**
 * The in-depth material record — the long form of the four figures the landing
 * page shows as cards.
 *
 * §14 governs every word here: the fabric composition and GSM are facts and
 * may be stated; nothing carbon-neutral, nothing eco-certified, no unsupported
 * environmental claim. So each entry explains what the number MEANS and how
 * the garment behaves because of it, never what it supposedly saves.
 */

export type ImpactDetail = {
	readonly key: string;
	readonly value: string;
	readonly unit: string;
	readonly label: string;
	/** The one-line version, used on the landing card. */
	readonly summary: string;
	/** The long form, used on /impact. */
	readonly body: readonly string[];
	/** What this figure does NOT claim — stated so nobody reads more into it. */
	readonly notClaimed: string;
};

export const IMPACT_DETAILS: readonly ImpactDetail[] = [
	{
		key: 'composition',
		value: '30/70',
		unit: '',
		label: 'hemp to cotton, by composition',
		summary: 'Bast fibre from the stalk, spun with cotton for hand.',
		body: [
			'Hemp fibre comes from the bast — the layer just under the bark of the stalk — rather than ' +
				'from a seed head. Bast fibres are long, which is why hemp has historically been used for ' +
				'rope and sailcloth before it was used for clothing.',
			'That length is also what makes it stiff on its own. Blending it with cotton at roughly ' +
				'thirty to seventy gives a cloth that holds the structure hemp brings while starting soft ' +
				'enough to wear from the first day rather than the tenth.',
			'The practical consequence is how it ages: the weave relaxes where you move and holds where ' +
				'you do not, so the garment ends up shaped by its wearer rather than by the cut alone.'
		],
		notClaimed:
			'A composition is a fact about the cloth. It is not a claim about land, water or emissions, ' +
			'and we do not make one.'
	},
	{
		key: 'weight',
		value: '180',
		unit: 'GSM',
		label: 'fabric weight',
		summary: 'Grams per square metre — the number behind how a tee feels.',
		body: [
			'GSM is grams per square metre: the mass of the cloth itself, independent of how it is cut. ' +
				'It is the most useful single number for predicting how a garment will feel, and the one ' +
				'most often left off a label.',
			'Below about 150 GSM a jersey is summer-weight and translucent under strong light. Above ' +
				'about 220 it starts behaving like a sweatshirt. At 180 the cloth is opaque, holds a ' +
				'shoulder line, and still drapes rather than standing away from the body.',
			'It also sets expectations for the first wash. A heavier jersey moves less and keeps its ' +
				'length; this is a weight that settles rather than shrinks noticeably.'
		],
		notClaimed: 'Weight describes the cloth. It says nothing about how the cloth was produced.'
	},
	{
		key: 'edition',
		value: '25',
		unit: '',
		label: 'hand-numbered pieces',
		summary: 'One cut, twenty-five pieces, each numbered by hand.',
		body: [
			'A drop is cut once. Twenty-five pieces exist, each carrying a number from 01 to 25 written ' +
				'by hand, and when they are gone the drop closes rather than restocking quietly.',
			'The number is allocated when a payment confirms, never before — so it records who actually ' +
				'holds a piece rather than who reached a page first.',
			'A closed drop stays on the site with its story, its imagery and its price intact. The ' +
				'archive is the record of what was made, not a list of what is currently for sale.'
		],
		notClaimed:
			'A small run means fewer garments made. We do not present that as an environmental outcome.'
	},
	{
		key: 'sizes',
		value: '05',
		unit: '',
		label: 'sizes, cut unisex',
		summary: 'XS to XL on one cut, with measurements published in cm.',
		body: [
			'There is one size axis and one cut. No separate blocks, no colourways — a decision that ' +
				'keeps the run small enough to number by hand and the size guide short enough to read.',
			'The cut is oversized, and the size guide publishes real chest and length measurements in ' +
				'centimetres for every size rather than describing the fit in adjectives.',
			'Fit is the single most common reason a garment goes back, and our returns are for ' +
				'manufacturing defects only. Publishing the numbers is how we keep that fair.'
		],
		notClaimed: 'A shorter size run is an operational choice, not a sustainability claim.'
	}
];

/** Where the fibre came from, before it was a garment. */
export type LineageEntry = {
	readonly era: string;
	readonly title: string;
	readonly body: string;
	readonly source?: { readonly label: string; readonly href: string };
};

export const LINEAGE: readonly LineageEntry[] = [
	{
		era: 'c. 6000 BCE / East Asia',
		title: 'The first threads',
		body:
			"Archaeological evidence places the use of cannabis seeds and fibres in East Asia around " +
			"8,000 years ago. Hemp's material story began long before modern fashion.",
		source: { label: 'Read the research in Nature', href: 'https://www.nature.com/articles/s41586-025-09065-0' }
	},
	{
		era: '1885 / Punjab, India',
		title: 'India, in the fibre',
		body:
			'A hemp fibre sample from Punjab, given by the Royal Botanic Gardens, Kew, in 1885, is ' +
			"preserved in the Smithsonian's collection — a tangible record of India's place in this " +
			"material's history.",
		source: {
			label: 'Explore the Smithsonian archive',
			href: 'https://americanhistory.si.edu/collections/object/nmah_648677'
		}
	},
	{
		era: 'Today / Rootwear',
		title: 'Grown, not manufactured.',
		body:
			'Our chapter starts with hemp-led fabrics and everyday pieces. Knowing the roots of a ' +
			'material is part of choosing what comes next.'
	}
];
