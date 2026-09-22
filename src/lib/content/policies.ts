/**
 * §03 template 10 — the eight static pages, as DATA.
 *
 * "Contact form, plus the reusable template carrying Shipping, Returns,
 *  Privacy, Terms, FAQ, Size Guide, Care and Track Order. UNLIMITED PAGES ON
 *  ONE TEMPLATE."
 *
 * Every page here is a `PolicyBlock[]`, never HTML. The renderer
 * (src/lib/components/PolicyBody.svelte) owns typography, so a ninth page
 * costs one entry in this array and nothing else — no route, no component, no
 * stylesheet. The Supabase implementation stores exactly this shape in
 * public.policies.body, so the two sources are interchangeable.
 *
 * NOTHING in here retypes a value that lives somewhere else:
 *   returns wording  -> $lib/content/returns (§11, identical in four places)
 *   measurements     -> $lib/drop/sizes      (§09)
 *   identity         -> $lib/content/business (§14, placeholders rendered
 *                       visibly rather than shipped blank)
 *
 * §14: no unprovable environmental claim on any of these pages. Fabric
 * composition and GSM are facts and are stated as such.
 */
import type { Policy, PolicyBlock } from '$lib/server/content/types';
import { RETURNS_WORDING, RETURNS_SHORT } from '$lib/content/returns';
import {
	SIZES,
	SIZE_CHART,
	FIT_DISCLAIMER,
	SIZE_RANGE_LABEL,
	SIZE_CHART_IS_PROVISIONAL
} from '$lib/drop/sizes';
import {
	BUSINESS_NAME,
	BUSINESS_ADDRESS,
	ENTITY_TYPE,
	GST_POSITION,
	SUPPORT_EMAIL,
	INSTAGRAM_HANDLE,
	displayValue
} from '$lib/content/business';

/** Last editorial pass over these pages. Stored per row once the DB is live. */
const REVISED = Date.UTC(2026, 8, 22);

/** §14: the address is an open item, so it renders as outstanding, not blank. */
const ADDRESS = displayValue(BUSINESS_ADDRESS);

/** §10: displayed prices are inclusive either way; the invoice differs. */
const GST_LINE = GST_POSITION.registered
	? `Prices are shown inclusive of GST. GSTIN ${GST_POSITION.gstin} appears on every invoice.`
	: 'Prices are shown inclusive of all applicable taxes. The price on the product page is the price you pay.';

/** §09 — built from SIZE_CHART so the guide can never drift from the product. */
const SIZE_ROWS: string[][] = SIZES.map((size) => [
	size,
	String(SIZE_CHART[size].chestCm),
	String(SIZE_CHART[size].lengthCm)
]);

const SHIPPING: PolicyBlock[] = [
	{
		type: 'paragraph',
		text:
			'Everything below applies to every order, whether it was bought outright or reserved ' +
			'during a tease. If something here does not match what you were told, the page is ' +
			'wrong and we would like to know.'
	},
	{ type: 'heading', text: 'Where we ship' },
	{
		type: 'paragraph',
		text:
			'India only. We do not ship outside India at present, and an address outside India ' +
			'cannot be entered at checkout — the restriction is enforced at the address form and ' +
			'again when the order is created, not merely stated here.'
	},
	{ type: 'heading', text: 'What it costs' },
	{
		type: 'paragraph',
		text: `Shipping is free and flat on every order, to every serviceable pincode. ${GST_LINE}`
	},
	{
		type: 'paragraph',
		text:
			'A small number of pincodes are not serviceable by our courier. If yours is one of ' +
			'them, checkout will say so before you pay rather than after.'
	},
	{ type: 'heading', text: 'When it leaves us' },
	{
		type: 'paragraph',
		text:
			'In this phase every order is picked, numbered, packed and handed to the courier by ' +
			'hand. There is no warehouse and no automated fulfilment. Orders placed on a working ' +
			'day are dispatched within two to four working days; a drop day takes longer, because ' +
			'every piece in the edition is packed in one sitting.'
	},
	{
		type: 'callout',
		text:
			'A pre-order piece is dispatched only after its balance has cleared. Until then the ' +
			'piece is held in your name against the edition cap and nothing moves.'
	},
	{ type: 'heading', text: 'Once it has left' },
	{
		type: 'paragraph',
		text:
			'You get the courier reference by email as soon as the parcel is handed over. Metro ' +
			'addresses usually see it in two to four days after dispatch, the rest of the country ' +
			'in four to seven. Those are the courier’s numbers, not a promise we can enforce.'
	},
	{
		type: 'paragraph',
		text:
			'If the parcel is refused, undeliverable or returned to us, we will write to you before ' +
			're-sending it. A second attempt is free.'
	},
	{
		type: 'contact',
		text: 'Anything about a parcel in transit is answered fastest here:'
	}
];

const RETURNS: PolicyBlock[] = [
	// §11: this exact sentence also appears on the product page, at checkout and
	// in the confirmation email. All four read RETURNS_WORDING — see
	// src/lib/content/returns.ts. Never retype it.
	{ type: 'paragraph', text: RETURNS_WORDING },
	{ type: 'heading', text: 'What counts as a defect' },
	{
		type: 'list',
		items: [
			'A seam that has opened or was never closed.',
			'A hole, cut or run in the cloth that was there when the parcel was opened.',
			'A print or number that has lifted, cracked or was misplaced at the press.',
			'A garment that does not match the size it is labelled as, measured against the size guide.',
			'The wrong piece, or the wrong size, in the parcel.'
		]
	},
	{ type: 'heading', text: 'What does not' },
	{
		type: 'list',
		items: [
			'Fit. The cut is oversized on purpose and the measurements are published before you buy.',
			'Colour, as seen on a screen against the garment in daylight.',
			'Change of mind.',
			'Damage from washing hot, bleaching or tumble drying — see the care page.',
			'Ordinary wear after the first seven days.'
		]
	},
	{ type: 'heading', text: 'How to raise a claim' },
	{
		type: 'list',
		items: [
			'Write to us within 7 days of delivery.',
			'Send your order number — it is in the subject line of your confirmation email.',
			'Send two or three photographs of the defect in daylight, one of them showing the whole garment.',
			'Tell us what you would like: a replacement in the same size if one exists, or a refund.'
		]
	},
	{
		type: 'paragraph',
		text:
			'There is no returns portal and no ticket number. Every claim is read and answered by a ' +
			'person, usually within two working days. We pay the return shipping on an accepted claim.'
	},
	{
		type: 'callout',
		text:
			`${FIT_DISCLAIMER} Fit is the single most common reason a piece comes back, and fit is ` +
			'not a defect — so read the size guide before you order, and write to us if you are between sizes.'
	},
	{
		type: 'paragraph',
		text:
			'A replacement is only possible while a piece in your size still exists. Editions are ' +
			'fixed and small; where nothing is left, the claim is settled as a refund to the ' +
			'original payment method.'
	},
	{
		type: 'contact',
		text: 'Claims are raised by email or by Instagram DM — both reach the same person:'
	}
];

const PRIVACY: PolicyBlock[] = [
	{
		type: 'paragraph',
		text:
			`${BUSINESS_NAME} is a ${ENTITY_TYPE.toLowerCase()} operating from India. This page says ` +
			'what we collect, why we collect it, how long we keep it and how to make us stop. It is ' +
			'written to be read, not to be defensible.'
	},
	{ type: 'heading', text: 'What we collect' },
	{
		type: 'table',
		head: ['What', 'Why', 'When'],
		rows: [
			['Name, email, phone', 'To confirm the order and to reach you about it', 'At checkout'],
			[
				'Shipping address and pincode',
				'To dispatch the parcel and to check serviceability',
				'At checkout'
			],
			[
				'Order and payment status',
				'To take payment, to dispatch, and for tax records',
				'At checkout and after'
			],
			[
				'Email address alone',
				'To tell you when a drop opens or a size returns',
				'Notify-me and drop requests'
			],
			['Your message and name', 'To answer you', 'Contact form'],
			['Cart contents', 'To hold your cart between pages', 'While you browse']
		]
	},
	{ type: 'heading', text: 'What we do not collect' },
	{
		type: 'paragraph',
		text:
			'We never see or store your card number, UPI ID or bank details. Payment is handled ' +
			'entirely inside the payment provider’s own page; what comes back to us is a ' +
			'reference and a status. We do not buy data about you, we do not sell yours, and we do ' +
			'not build a profile of you across other sites.'
	},
	{ type: 'heading', text: 'Cookies and measurement' },
	{
		type: 'paragraph',
		text:
			'Strictly necessary cookies only, unless you say otherwise: one for your cart and one ' +
			'for your session. Nothing measures you until you have agreed to it. Analytics and any ' +
			'advertising pixel are consent-gated, off by default, and withdrawing consent stops ' +
			'them immediately.'
	},
	{ type: 'heading', text: 'Your rights under the DPDP Act, 2023' },
	{
		type: 'list',
		items: [
			'Ask for a copy of what we hold about you.',
			'Ask us to correct anything wrong or incomplete.',
			'Ask us to erase it, where we are not required to keep it for tax or accounting.',
			'Withdraw consent you have given, at any time, as easily as you gave it.',
			'Nominate someone to exercise these rights on your behalf.'
		]
	},
	{
		type: 'paragraph',
		text:
			'Write to us and the owner will answer. We are a small business: there is no data ' +
			'protection officer, no privacy certification and no compliance department, and we will ' +
			'not pretend otherwise. Requests are answered within thirty days.'
	},
	{ type: 'heading', text: 'How long we keep it' },
	{
		type: 'list',
		items: [
			'Order records: as long as Indian tax and accounting law requires us to.',
			'Notify-me and drop-request emails: until you ask to come off the list, or until the drop they refer to is closed.',
			'Contact messages: up to twelve months, so we can pick up a conversation where it left off.',
			'Cart contents: until the cart expires or you empty it.'
		]
	},
	{ type: 'heading', text: 'Who else sees it' },
	{
		type: 'paragraph',
		text:
			'Only the people who have to: the payment provider, the courier carrying your parcel, ' +
			'our email provider and our hosting provider. Each sees the minimum needed to do its ' +
			'part. Nobody else.'
	},
	{
		type: 'callout',
		text: `Registered address: ${ADDRESS}. Written requests may be sent there or to ${SUPPORT_EMAIL}.`
	},
	{ type: 'contact', text: 'To exercise any of the rights above:' }
];

const TERMS: PolicyBlock[] = [
	{ type: 'heading', text: 'Who you are buying from' },
	{
		type: 'paragraph',
		text:
			`${BUSINESS_NAME} is a ${ENTITY_TYPE.toLowerCase()} registered in India at ${ADDRESS}. ` +
			'Placing an order forms a contract with that business and with nobody else.'
	},
	{ type: 'heading', text: 'Where we sell' },
	{
		type: 'paragraph',
		text:
			'India only. We cannot accept an order for delivery outside India; the restriction is ' +
			'applied at the address form and again at order creation. Orders that reach us any ' +
			'other way will be refunded in full.'
	},
	{ type: 'heading', text: 'Limited editions' },
	{
		type: 'paragraph',
		text:
			'Every drop is a fixed edition of hand-numbered pieces. When the edition is claimed it ' +
			'is finished. A sold-out size stays visible on the page rather than disappearing, ' +
			'because the scarcity is the point and because the archive is the record of what we ' +
			'have made. If a piece ever returns, it returns on its own page as a stated re-drop — ' +
			'never as a quiet restock.'
	},
	{ type: 'heading', text: 'Price' },
	{
		type: 'paragraph',
		text:
			`The price that applies is the price displayed at the moment your order is placed. ${GST_LINE} ` +
			'A pre-launch price locked during a tease stays locked for that reservation even after ' +
			'the drop opens at the higher launch price.'
	},
	{ type: 'heading', text: 'Pre-orders, deposits and balances' },
	{
		type: 'paragraph',
		text:
			'During a tease you reserve a piece with a deposit rather than buying it outright. The ' +
			'deposit holds a numbered piece against the edition cap at the locked price. The ' +
			'balance is due before dispatch, and the piece leaves only once it has cleared.'
	},
	{
		type: 'paragraph',
		text:
			'If a balance is not settled within the window stated in your reservation email, the ' +
			'piece is released back to the waitlist and the deposit is refunded. We will write to ' +
			'you before that happens, not after.'
	},
	{ type: 'heading', text: 'Cancellation' },
	{
		type: 'paragraph',
		text:
			'An order can be cancelled for a full refund at any time before it is dispatched — ' +
			'write to us. Once the parcel is with the courier, the returns policy applies instead.'
	},
	{ type: 'heading', text: 'Returns' },
	{ type: 'paragraph', text: RETURNS_WORDING },
	{ type: 'heading', text: 'Images and description' },
	{
		type: 'paragraph',
		text:
			'Photographs are taken in daylight and are not retouched to change the colour of the ' +
			'cloth. Screens still differ. Composition and fabric weight are stated on every product ' +
			'page as measured facts, and we make no claim about the garment beyond them.'
	},
	{ type: 'heading', text: 'Your account' },
	{
		type: 'paragraph',
		text:
			'You are responsible for what happens under your account. Tell us at once if you think ' +
			'someone else has access to it. You can buy as a guest and never make one.'
	},
	{ type: 'heading', text: 'Liability' },
	{
		type: 'paragraph',
		text:
			'Our liability for any order is limited to what you paid for it. Nothing here limits ' +
			'any right you have under Indian consumer law, which stands whatever this page says.'
	},
	{ type: 'heading', text: 'Governing law' },
	{
		type: 'paragraph',
		text:
			'These terms are governed by the law of India, and any dispute falls to the courts ' +
			'having jurisdiction where the business is registered.'
	},
	{ type: 'contact', text: 'Questions about any of the above:' }
];

const FAQ: PolicyBlock[] = [
	{
		type: 'paragraph',
		text:
			'The questions we are actually asked, answered plainly. If yours is not here, write to ' +
			'us — the list grows from what people send.'
	},
	{ type: 'heading', text: 'How often do you drop?' },
	{
		type: 'paragraph',
		text:
			'There is no calendar. A drop opens when the cloth, the cut and the photographs are ' +
			'right. Every drop is announced first on Instagram and to the notify list, with the ' +
			'exact opening time stated in advance.'
	},
	{ type: 'heading', text: 'What are the stages of a drop?' },
	{
		type: 'paragraph',
		text:
			'A teaser first, with the piece unshown and deposits taken against a hard cap. Then the ' +
			'reveal, with a countdown and notify-me but nothing on sale. Then it goes live at an ' +
			'exact stated time. As sizes go, the drop turns partial — sold-out sizes stay visible ' +
			'and greyed, never hidden. Then sold out, then archived, with its story and imagery ' +
			'intact. Nothing is ever taken down.'
	},
	{ type: 'heading', text: 'What size should I take?' },
	{
		type: 'paragraph',
		text:
			`${FIT_DISCLAIMER} The size guide carries chest and length in centimetres for every ` +
			`size, ${SIZE_RANGE_LABEL}, cut unisex. Measure a garment you already like flat and ` +
			'compare it — that is more reliable than measuring yourself.'
	},
	{ type: 'heading', text: 'Why is there only one size axis?' },
	{
		type: 'paragraph',
		text:
			'Because a drop is one colourway. There is no colour to choose, so a colour axis would ' +
			'sit unused on every screen. Size is the only choice you make.'
	},
	{ type: 'heading', text: 'What is a pre-order, and what is the deposit?' },
	{
		type: 'paragraph',
		text:
			'During a tease you can reserve a piece with a deposit instead of paying in full. The ' +
			'deposit locks the pre-launch price and holds a numbered piece for you against the ' +
			'edition cap. The balance is shown to you in rupees before you pay anything, and it is ' +
			'due before the piece is dispatched.'
	},
	{ type: 'heading', text: 'What if I never pay the balance?' },
	{
		type: 'paragraph',
		text:
			'We write to you first. If the balance is still unsettled at the end of the window in ' +
			'your reservation email, the piece goes back to the waitlist and your deposit is ' +
			'refunded in full.'
	},
	{ type: 'heading', text: 'When will my order arrive?' },
	{
		type: 'paragraph',
		text:
			'Two to four working days to dispatch, then two to seven with the courier depending on ' +
			'where you are. A pre-order starts that clock only after its balance clears. Shipping ' +
			'is free and flat.'
	},
	{ type: 'heading', text: 'Do you ship outside India?' },
	{ type: 'paragraph', text: 'Not yet. India only, and the checkout will not let you try.' },
	{ type: 'heading', text: 'Can I return it?' },
	{
		type: 'paragraph',
		text: `${RETURNS_SHORT} The returns page sets out exactly what counts and how to raise a claim.`
	},
	{ type: 'heading', text: 'Is anything restocked?' },
	{
		type: 'paragraph',
		text:
			'Rarely, and never silently. Leave a notify-me on the size you want; if a piece comes ' +
			'back it comes back on its own page, stated as a re-drop, and the notify list is told ' +
			'before anyone else.'
	},
	{ type: 'heading', text: 'What is the cloth?' },
	{
		type: 'paragraph',
		text:
			'The composition and the fabric weight in GSM are printed on every product page. Those ' +
			'are measured facts about the garment, and they are the only claims we make about it.'
	},
	{ type: 'contact', text: 'Still stuck? Ask us directly:' }
];

const SIZE_GUIDE: PolicyBlock[] = [
	{
		type: 'callout',
		text: `${FIT_DISCLAIMER} ${RETURNS_SHORT} A size that does not suit you is not a defect, so it is worth two minutes here.`
	},
	{
		type: 'paragraph',
		text:
			`This drop is cut ${SIZE_RANGE_LABEL}, unisex, one size axis only. All measurements are ` +
			'of the garment laid flat, in centimetres, and are not body measurements.'
	},
	{
		type: 'table',
		head: ['Size', 'Chest (cm)', 'Length (cm)'],
		rows: SIZE_ROWS
	},
	{ type: 'heading', text: 'How these are measured' },
	{
		type: 'list',
		items: [
			'Chest: laid flat and measured straight across, from one underarm seam to the other. Double it for the full circumference.',
			'Length: from the highest point of the shoulder straight down to the hem at the back.',
			'Allow about a centimetre either way — these are cut and sewn by hand, not stamped.'
		]
	},
	{ type: 'heading', text: 'The reliable way to choose' },
	{
		type: 'paragraph',
		text:
			'Take a t-shirt you already wear and like. Lay it flat, measure it across the chest and ' +
			'down the back exactly as described above, and match those two numbers to the table. ' +
			'Measuring your own chest and adding an allowance is guesswork; measuring a garment is not.'
	},
	{
		type: 'paragraph',
		text:
			'If you land between two sizes: take the smaller one if you want the shoulder to sit ' +
			'where a shoulder normally sits, and the larger if you want it to drop.'
	},
	...(SIZE_CHART_IS_PROVISIONAL
		? [
				{
					type: 'callout',
					text:
						'These figures are provisional until the final garment specification is signed off. ' +
						'They will be corrected here the moment it lands, and anyone who has already ordered ' +
						'will be written to if a number moves.'
				} as PolicyBlock
			]
		: []),
	{
		type: 'contact',
		text: 'Between sizes, or unsure? Send us the two numbers and we will tell you which to take:'
	}
];

const CARE: PolicyBlock[] = [
	{
		type: 'paragraph',
		text:
			'Hemp-cotton cloth is heavy when it arrives and softens with every wash. Treated well, ' +
			'it outlasts the drop it came from. The three instructions on your garment label are the ' +
			'whole of it; everything below is detail.'
	},
	{ type: 'list', items: ['Wash cold', 'Line dry', 'No bleach'] },
	{ type: 'heading', text: 'Washing' },
	{
		type: 'paragraph',
		text:
			'Cold water, inside out, with like colours, on a gentle cycle — or by hand, which is ' +
			'kinder still. Skip the fabric softener: it coats the fibre and takes the dry hand off ' +
			'the cloth, which is the thing you paid for. Wash before the first wear if you want the ' +
			'first shrink out of the way.'
	},
	{ type: 'heading', text: 'Drying' },
	{
		type: 'paragraph',
		text:
			'Line dry in shade. Direct sun over hours will pull colour out of the dye, and a tumble ' +
			'dryer will shrink the body and cook the seams. Reshape the shoulders while it is damp ' +
			'and it will hang the way it was cut.'
	},
	{ type: 'heading', text: 'Ironing' },
	{
		type: 'paragraph',
		text:
			'Medium heat, inside out, while it still holds a little damp. Never take an iron ' +
			'directly to a print or to the hand-numbered mark — press from the reverse, or put a ' +
			'cloth between.'
	},
	{ type: 'heading', text: 'Stains' },
	{
		type: 'paragraph',
		text:
			'Cold water and time, straight away. No bleach, ever, and no optical brightener — both ' +
			'attack the hemp before they touch the stain.'
	},
	{ type: 'heading', text: 'Storing' },
	{
		type: 'paragraph',
		text:
			'Fold rather than hang. A heavy knit on a hanger stretches at the shoulder over months ' +
			'and never quite comes back.'
	},
	{
		type: 'callout',
		text:
			'The cloth relaxes across a wear and tightens slightly after a wash. Neither is a fault ' +
			'in the garment; it is what a hemp-cotton knit does.'
	},
	{ type: 'contact', text: 'Something has gone wrong in the wash? Tell us what happened:' }
];

const TRACK_ORDER: PolicyBlock[] = [
	{
		type: 'paragraph',
		text:
			'Two things find any order: the order number and the email address it was placed with. ' +
			'The order number is in the subject line of your confirmation email.'
	},
	{ type: 'heading', text: 'If you have an account' },
	{
		type: 'paragraph',
		text:
			'Sign in and open your order history. Every order carries its status and, once it has ' +
			'been handed to the courier, the tracking reference against it.'
	},
	{ type: 'heading', text: 'If you ordered as a guest' },
	{
		type: 'paragraph',
		text:
			'Write to us with the order number and the email you used, and we will send the ' +
			'reference straight back. No account is needed, and making one later will attach past ' +
			'orders placed with the same address.'
	},
	{
		type: 'callout',
		text:
			'We do not run a live carrier integration. What you get from us is the reference the ' +
			'courier recorded against your parcel, exactly as it was given to us — you then follow ' +
			'it on the courier’s own site, which knows more than we do.'
	},
	{ type: 'heading', text: 'What each status means' },
	{
		type: 'table',
		head: ['Status', 'What has happened'],
		rows: [
			['Placed', 'Payment cleared. Nothing has been packed yet.'],
			[
				'Reserved',
				'A deposit is in and a numbered piece is held for you. The balance is still due.'
			],
			['Awaiting balance', 'The piece is yours and will not move until the balance clears.'],
			['Packed', 'Numbered, packed and waiting for the courier to collect.'],
			['Dispatched', 'With the courier. The tracking reference is on the order.'],
			['Delivered', 'The courier has marked it delivered. The 7-day returns window starts here.']
		]
	},
	{ type: 'heading', text: 'If tracking has not moved' },
	{
		type: 'paragraph',
		text:
			'A reference can take up to a day to come alive on the courier’s side, and scans ' +
			'stall over weekends. If nothing has moved for three working days, write to us with the ' +
			'order number and we will chase it from our end rather than ask you to.'
	},
	{ type: 'contact', text: 'To trace an order, or if the reference is dead:' }
];

/**
 * The pages themselves. Add a ninth here and it is live at /policies/<slug>,
 * listed on /policies, searchable, and in the footer if `showInFooter`.
 */
export const POLICIES: readonly Policy[] = [
	{
		slug: 'shipping',
		title: 'Shipping',
		summary: 'India only, free and flat, dispatched by hand. What that means for your parcel.',
		body: SHIPPING,
		updatedAt: REVISED,
		navOrder: 10,
		showInFooter: true
	},
	{
		slug: 'returns',
		title: 'Returns',
		summary: RETURNS_SHORT + ' What counts as a defect, and how a claim is handled.',
		body: RETURNS,
		updatedAt: REVISED,
		navOrder: 20,
		showInFooter: true
	},
	{
		slug: 'size-guide',
		title: 'Size Guide',
		summary: 'Chest and length in centimetres for every size, and the reliable way to choose one.',
		body: SIZE_GUIDE,
		updatedAt: REVISED,
		navOrder: 30,
		showInFooter: true
	},
	{
		slug: 'care',
		title: 'Care',
		summary: 'Wash cold, line dry, no bleach — and the detail behind each of the three.',
		body: CARE,
		updatedAt: REVISED,
		navOrder: 40,
		showInFooter: true
	},
	{
		slug: 'track-order',
		title: 'Track Order',
		summary: 'Order number and email. What each status means, and what to do when tracking stalls.',
		body: TRACK_ORDER,
		updatedAt: REVISED,
		navOrder: 50,
		showInFooter: true
	},
	{
		slug: 'faq',
		title: 'FAQ',
		summary:
			'Drops, sizing, pre-orders, dispatch and returns — the questions we are actually asked.',
		body: FAQ,
		updatedAt: REVISED,
		navOrder: 60,
		showInFooter: true
	},
	{
		slug: 'privacy',
		title: 'Privacy',
		summary:
			'What we collect, why, for how long, and how to make us stop. Written under the DPDP Act.',
		body: PRIVACY,
		updatedAt: REVISED,
		navOrder: 70,
		showInFooter: true
	},
	{
		slug: 'terms',
		title: 'Terms',
		summary: `Who you are buying from, where we sell, and how a limited edition is sold. ${BUSINESS_NAME}.`,
		body: TERMS,
		updatedAt: REVISED,
		navOrder: 80,
		showInFooter: true
	}
];

/** Convenience for the mock repository and for any launch-gate check. */
export const POLICY_SLUGS: readonly string[] = POLICIES.map((p) => p.slug);

/** Exposed so the contact page and the footer cannot drift apart. */
export const SUPPORT_CHANNELS = {
	email: SUPPORT_EMAIL,
	instagram: INSTAGRAM_HANDLE
} as const;
