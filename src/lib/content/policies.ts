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
	SIZE_RANGE_LABEL
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
			'This applies to every order, including pre-orders. If anything here is unclear, ' +
			'write to us.'
	},
	{ type: 'heading', text: 'Where we ship' },
	{
		type: 'paragraph',
		text:
			'We ship within India only, for now.'
	},
	{ type: 'heading', text: 'What it costs' },
	{
		type: 'paragraph',
		text: `Shipping is free and flat on every order, to every serviceable pincode. ${GST_LINE}`
	},
	{
		type: 'paragraph',
		text:
			'A few pincodes are outside our courier’s reach. If yours is one of them, you’ll know ' +
			'at checkout, before you pay.'
	},
	{ type: 'heading', text: 'When it leaves us' },
	{
		type: 'paragraph',
		text:
			'Every order is numbered and packed by hand. Orders ship within two to four working ' +
			'days; on a drop day it can take a little longer.'
	},
	{
		type: 'callout',
		text:
			'Pre-orders ship once the balance is paid. Until then, your piece is kept for you.'
	},
	{ type: 'heading', text: 'Once it has left' },
	{
		type: 'paragraph',
		text:
			'We email your tracking number as soon as your parcel ships. Delivery usually takes two ' +
			'to four days to metro cities and four to seven days elsewhere.'
	},
	{
		type: 'paragraph',
		text:
			'If a parcel can’t be delivered and comes back to us, we’ll get in touch to arrange a ' +
			'second delivery, free of charge.'
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
			'We usually reply within two working days. If your claim is accepted, we pay the ' +
			'return shipping.'
	},
	{
		type: 'callout',
		text:
			`${FIT_DISCLAIMER} Fit isn’t covered by returns, so check the size guide before you ` +
			'order — and write to us if you’re between sizes.'
	},
	{
		type: 'paragraph',
		text:
			'Each drop is a small, limited run. If there’s no replacement left in your size, we ' +
			'refund you to your original payment method.'
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
			'what we collect, why, how long we keep it, and how to ask us to stop.'
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
			'We never see or store your card number, UPI ID or bank details — payment is handled ' +
			'by our payment provider. We don’t buy data about you, we don’t sell yours, and we ' +
			'don’t track you across other sites.'
	},
	{ type: 'heading', text: 'Cookies and measurement' },
	{
		type: 'paragraph',
		text:
			'We use only the cookies the site needs to work — one for your cart and one for your ' +
			'session — unless you agree to more. Analytics and advertising cookies are off until ' +
			'you opt in, and you can turn them off again at any time.'
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
			'Write to us and we’ll respond within thirty days.'
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
			'Only the services we need to fulfil your order: our payment provider, courier, email ' +
			'provider and hosting provider. Each sees only what it needs.'
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
			'We deliver within India only. Any order for delivery outside India will be refunded ' +
			'in full.'
	},
	{ type: 'heading', text: 'Limited editions' },
	{
		type: 'paragraph',
		text:
			'Every drop is a limited run of hand-numbered pieces. Once it sells out, it’s gone. If ' +
			'a piece ever comes back, it will be announced as a re-drop.'
	},
	{ type: 'heading', text: 'Price' },
	{
		type: 'paragraph',
		text:
			`The price that applies is the price displayed at the moment your order is placed. ${GST_LINE} ` +
			'If you pre-order at an early price, that price stays yours even after the drop opens.'
	},
	{ type: 'heading', text: 'Pre-orders, deposits and balances' },
	{
		type: 'paragraph',
		text:
			'Before a drop opens, you can reserve a piece with a deposit instead of paying in full. ' +
			'The deposit secures a numbered piece at the pre-order price. The balance is due before ' +
			'we ship.'
	},
	{
		type: 'paragraph',
		text:
			'If the balance isn’t paid by the date in your reservation email, the piece is offered ' +
			'to someone else and your deposit is refunded. We’ll remind you before that happens.'
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
			'Photographs are taken in daylight and the colour is not retouched, though screens ' +
			'vary. Fabric composition and weight are listed on every product page.'
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
			'Can’t find your answer here? Write to us.'
	},
	{ type: 'heading', text: 'How often do you drop?' },
	{
		type: 'paragraph',
		text:
			'There’s no fixed schedule — a drop opens when it’s ready. Each one is announced in ' +
			'advance on Instagram and by email, with the exact opening time.'
	},
	{ type: 'heading', text: 'How do drops work?' },
	{
		type: 'paragraph',
		text:
			'Each drop is a small, numbered run. Sign up to hear when the next one opens — you may ' +
			'be able to pre-order before it does. Once it’s sold out, it’s gone.'
	},
	{ type: 'heading', text: 'What size should I take?' },
	{
		type: 'paragraph',
		text:
			`${FIT_DISCLAIMER} The size guide carries chest and length in centimetres for every ` +
			`size, ${SIZE_RANGE_LABEL}, cut unisex. For the best fit, measure a t-shirt you already ` +
			'like, laid flat, and compare.'
	},
	{ type: 'heading', text: 'What is a pre-order, and what is the deposit?' },
	{
		type: 'paragraph',
		text:
			'Before a drop opens, you can reserve a piece with a deposit instead of paying in full. ' +
			'The deposit locks in the pre-order price and keeps a numbered piece for you. You’ll ' +
			'see the balance before you pay anything, and it’s due before we ship.'
	},
	{ type: 'heading', text: 'What if I never pay the balance?' },
	{
		type: 'paragraph',
		text:
			'We’ll remind you first. If it’s still unpaid by the date in your reservation email, ' +
			'the piece is offered to someone else and your deposit is refunded in full.'
	},
	{ type: 'heading', text: 'When will my order arrive?' },
	{
		type: 'paragraph',
		text:
			'We ship within two to four working days, then delivery takes two to seven days ' +
			'depending on where you are. Pre-orders ship once the balance is paid. Shipping is free.'
	},
	{ type: 'heading', text: 'Do you ship outside India?' },
	{ type: 'paragraph', text: 'Not yet — we ship within India only.' },
	{ type: 'heading', text: 'Can I return it?' },
	{
		type: 'paragraph',
		text: `${RETURNS_SHORT} The returns page sets out exactly what counts and how to raise a claim.`
	},
	{ type: 'heading', text: 'Is anything restocked?' },
	{
		type: 'paragraph',
		text:
			'Rarely. Tap “Notify me” on the size you want — if it comes back as a re-drop, you’ll ' +
			'hear first.'
	},
	{ type: 'heading', text: 'What is the cloth?' },
	{
		type: 'paragraph',
		text:
			'A hemp-cotton blend. The exact composition and fabric weight (GSM) are listed on every ' +
			'product page.'
	},
	{ type: 'contact', text: 'Still stuck? Ask us directly:' }
];

const SIZE_GUIDE: PolicyBlock[] = [
	{
		type: 'callout',
		text: `${FIT_DISCLAIMER} ${RETURNS_SHORT} Fit isn’t covered by returns, so it’s worth two minutes here.`
	},
	{
		type: 'paragraph',
		text:
			`This drop comes in ${SIZE_RANGE_LABEL}, cut unisex. Measurements are of the garment ` +
			'laid flat, in centimetres — not body measurements.'
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
			'It’s more reliable than measuring yourself.'
	},
	{
		type: 'paragraph',
		text:
			'If you land between two sizes: take the smaller one if you want the shoulder to sit ' +
			'where a shoulder normally sits, and the larger if you want it to drop.'
	},
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
			'it will last for years. The three instructions on the label cover it; the detail is below.'
	},
	{ type: 'list', items: ['Wash cold', 'Line dry', 'No bleach'] },
	{ type: 'heading', text: 'Washing' },
	{
		type: 'paragraph',
		text:
			'Cold water, inside out, with like colours, on a gentle cycle — or by hand, which is ' +
			'kinder still. Skip the fabric softener: it coats the fibre and dulls the feel of the ' +
			'cloth. Wash before the first wear if you want the ' +
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
			'Sign in and open your order history to see each order’s status and, once shipped, ' +
			'its tracking number.'
	},
	{ type: 'heading', text: 'If you ordered as a guest' },
	{
		type: 'paragraph',
		text:
			'Write to us with your order number and email, and we’ll send your tracking number ' +
			'straight back. If you create an account later with the same email, your past orders ' +
			'will appear there.'
	},
	{
		type: 'callout',
		text:
			'Use your tracking number on the courier’s website for the latest updates.'
	},
	{ type: 'heading', text: 'What each status means' },
	{
		type: 'table',
		head: ['Status', 'What has happened'],
		rows: [
			['Placed', 'Payment cleared. Nothing has been packed yet.'],
			[
				'Reserved',
				'Your deposit is paid and a numbered piece is kept for you. The balance is still due.'
			],
			['Awaiting balance', 'Your piece is kept for you and ships once the balance is paid.'],
			['Packed', 'Numbered, packed and waiting for the courier to collect.'],
			['Dispatched', 'With the courier. Your tracking number is on the order.'],
			['Delivered', 'The courier has marked it delivered. The 7-day returns window starts here.']
		]
	},
	{ type: 'heading', text: 'If tracking has not moved' },
	{
		type: 'paragraph',
		text:
			'Tracking can take up to a day to update, and often pauses over weekends. If nothing ' +
			'has changed for three working days, write to us with your order number and we’ll ' +
			'look into it.'
	},
	{ type: 'contact', text: 'Need help with an order?' }
];

/**
 * The pages themselves. Add a ninth here and it is live at /policies/<slug>,
 * listed on /policies, searchable, and in the footer if `showInFooter`.
 */
export const POLICIES: readonly Policy[] = [
	{
		slug: 'shipping',
		title: 'Shipping',
		summary: 'Free shipping across India. Dispatch and delivery times.',
		body: SHIPPING,
		updatedAt: REVISED,
		navOrder: 10,
		showInFooter: true
	},
	{
		slug: 'returns',
		title: 'Returns',
		summary: RETURNS_SHORT + ' What counts as a defect, and how to raise a claim.',
		body: RETURNS,
		updatedAt: REVISED,
		navOrder: 20,
		showInFooter: true
	},
	{
		slug: 'size-guide',
		title: 'Size Guide',
		summary: 'Chest and length for every size, and how to choose yours.',
		body: SIZE_GUIDE,
		updatedAt: REVISED,
		navOrder: 30,
		showInFooter: true
	},
	{
		slug: 'care',
		title: 'Care',
		summary: 'Wash cold, line dry, no bleach — and how to keep your piece at its best.',
		body: CARE,
		updatedAt: REVISED,
		navOrder: 40,
		showInFooter: true
	},
	{
		slug: 'track-order',
		title: 'Track Order',
		summary: 'Find your order, what each status means, and what to do if tracking stalls.',
		body: TRACK_ORDER,
		updatedAt: REVISED,
		navOrder: 50,
		showInFooter: true
	},
	{
		slug: 'faq',
		title: 'FAQ',
		summary:
			'Drops, sizing, pre-orders, shipping and returns.',
		body: FAQ,
		updatedAt: REVISED,
		navOrder: 60,
		showInFooter: true
	},
	{
		slug: 'privacy',
		title: 'Privacy',
		summary:
			'What we collect, why, for how long, and your rights under the DPDP Act.',
		body: PRIVACY,
		updatedAt: REVISED,
		navOrder: 70,
		showInFooter: true
	},
	{
		slug: 'terms',
		title: 'Terms',
		summary: `Who you are buying from, where we sell, and how limited drops work. ${BUSINESS_NAME}.`,
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
