/**
 * Settings the owner edits from /admin/settings, stored in app.settings as
 * one JSON value per area. Every reader gets a complete value: anything not
 * yet saved falls back to the defaults below, which are the values the code
 * used before settings existed ($lib/content/business).
 */
import {
	BUSINESS_ADDRESS,
	BUSINESS_NAME,
	ENTITY_TYPE,
	GST_POSITION,
	INSTAGRAM_HANDLE,
	INSTAGRAM_URL,
	SUPPORT_EMAIL
} from '$lib/content/business';
import { getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';

export type BusinessSettings = {
	readonly legalName: string;
	readonly tradeName: string;
	readonly entityType: string;
	readonly address: string;
	/** For place of supply: same state as the buyer → CGST + SGST, else IGST. */
	readonly state: string;
	readonly stateCode: string;
	readonly email: string;
	readonly phone: string;
	readonly instagram: string;
	readonly gstRegistered: boolean;
	readonly gstin: string;
	readonly pan: string;
	/** Invoice numbers: <prefix>/<FY>/<0001>. */
	readonly invoicePrefix: string;
	/** Printed under the totals on every invoice. */
	readonly invoiceFooter: string;
	readonly signatory: string;
};

export const DEFAULT_BUSINESS: BusinessSettings = {
	legalName: BUSINESS_NAME,
	tradeName: 'Rootwear',
	entityType: ENTITY_TYPE,
	address: BUSINESS_ADDRESS,
	state: 'Karnataka',
	stateCode: '29',
	email: SUPPORT_EMAIL,
	phone: '',
	instagram: INSTAGRAM_HANDLE,
	gstRegistered: GST_POSITION.registered,
	gstin: GST_POSITION.registered ? GST_POSITION.gstin : '',
	pan: '',
	invoicePrefix: 'RW',
	invoiceFooter: 'Prices include all taxes. Thank you for buying slow.',
	signatory: ''
};

export type CartSettings = {
	/**
	 * Send the reminder without anyone clicking. Off by default: a WhatsApp
	 * reminder is a marketing message to Meta, which needs the shopper's
	 * opt-in, so switch this on once checkout asks for it.
	 */
	readonly autoRecover: boolean;
	/** Minutes after the checkout was abandoned before the reminder goes. */
	readonly delayMinutes: number;
	readonly channels: readonly ('email' | 'whatsapp')[];
};

export const DEFAULT_CARTS: CartSettings = {
	autoRecover: false,
	delayMinutes: 60,
	channels: ['email']
};

export type AlertSettings = {
	/** A size with this many or fewer left to sell counts as low. */
	readonly lowStock: number;
};

export const DEFAULT_ALERTS: AlertSettings = { lowStock: 2 };

/**
 * The "next drop" teaser that closes the shop's list of drops. Edited from
 * /admin/drops. The defaults are what the shop showed before it was editable.
 */
export type NextDropSettings = {
	/** Show the teaser at all. */
	readonly show: boolean;
	readonly title: string;
	/** The line beside the dot, e.g. "Coming soon" or "Opens 1 December". */
	readonly status: string;
	/** The small note in place of a piece count, e.g. "Growing". */
	readonly note: string;
	/** A teaser image URL; empty uses a glimpse of the latest drop's piece. */
	readonly image: string;
	readonly linkLabel: string;
	readonly linkUrl: string;
};

export const DEFAULT_NEXT_DROP: NextDropSettings = {
	show: true,
	title: 'Next issue',
	status: 'Coming soon',
	note: 'Growing',
	image: '',
	linkLabel: `Follow ${INSTAGRAM_HANDLE}`,
	linkUrl: INSTAGRAM_URL
};

/**
 * What customers are told about delivery (order page, order lookup), edited
 * from Admin → Settings → Shipping.
 */
export type DeliverySettings = {
	/** Days from placing an order (or dispatch) to the door, as promised. */
	readonly days: number;
	/**
	 * The courier's tracking page, with {ref} where the tracking number goes,
	 * e.g. https://www.delhivery.com/track/package/{ref}. Empty: no link.
	 */
	readonly trackingUrl: string;
};

export const DEFAULT_DELIVERY: DeliverySettings = { days: 2, trackingUrl: '' };

type Defaults = {
	business: BusinessSettings;
	carts: CartSettings;
	alerts: AlertSettings;
	nextDrop: NextDropSettings;
	delivery: DeliverySettings;
};

const DEFAULTS: Defaults = {
	business: DEFAULT_BUSINESS,
	carts: DEFAULT_CARTS,
	alerts: DEFAULT_ALERTS,
	nextDrop: DEFAULT_NEXT_DROP,
	delivery: DEFAULT_DELIVERY
};

export async function getSetting<K extends keyof Defaults>(key: K): Promise<Defaults[K]> {
	const { data, error } = await getServiceClient()
		.from('settings')
		.select('value')
		.eq('key', key)
		.maybeSingle();
	if (error) throw new Error(`settings read failed: ${error.message}`);
	const stored = ((data as { value: Partial<Defaults[K]> } | null)?.value ?? {}) as Partial<
		Defaults[K]
	>;
	return { ...DEFAULTS[key], ...stored };
}

export async function saveSetting<K extends keyof Defaults>(
	key: K,
	value: Defaults[K],
	actor: string
): Promise<void> {
	const before = await getSetting(key);
	const { error } = await getServiceClient()
		.from('settings')
		.upsert(
			{ key, value, updated_by: actor, updated_at: new Date().toISOString() },
			{ onConflict: 'key' }
		);
	if (error) throw new Error(`settings write failed: ${error.message}`);
	const changed = Object.keys(value).filter(
		(field) =>
			JSON.stringify((value as Record<string, unknown>)[field]) !==
			JSON.stringify((before as Record<string, unknown>)[field])
	);
	await writeAudit(actor, 'settings changed', 'settings', key, { fields: changed });
}

/** Indian states and union territories with their GST state codes. */
export const GST_STATES: readonly { name: string; code: string }[] = [
	{ name: 'Andaman and Nicobar Islands', code: '35' },
	{ name: 'Andhra Pradesh', code: '37' },
	{ name: 'Arunachal Pradesh', code: '12' },
	{ name: 'Assam', code: '18' },
	{ name: 'Bihar', code: '10' },
	{ name: 'Chandigarh', code: '04' },
	{ name: 'Chhattisgarh', code: '22' },
	{ name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
	{ name: 'Delhi', code: '07' },
	{ name: 'Goa', code: '30' },
	{ name: 'Gujarat', code: '24' },
	{ name: 'Haryana', code: '06' },
	{ name: 'Himachal Pradesh', code: '02' },
	{ name: 'Jammu and Kashmir', code: '01' },
	{ name: 'Jharkhand', code: '20' },
	{ name: 'Karnataka', code: '29' },
	{ name: 'Kerala', code: '32' },
	{ name: 'Ladakh', code: '38' },
	{ name: 'Lakshadweep', code: '31' },
	{ name: 'Madhya Pradesh', code: '23' },
	{ name: 'Maharashtra', code: '27' },
	{ name: 'Manipur', code: '14' },
	{ name: 'Meghalaya', code: '17' },
	{ name: 'Mizoram', code: '15' },
	{ name: 'Nagaland', code: '13' },
	{ name: 'Odisha', code: '21' },
	{ name: 'Puducherry', code: '34' },
	{ name: 'Punjab', code: '03' },
	{ name: 'Rajasthan', code: '08' },
	{ name: 'Sikkim', code: '11' },
	{ name: 'Tamil Nadu', code: '33' },
	{ name: 'Telangana', code: '36' },
	{ name: 'Tripura', code: '16' },
	{ name: 'Uttar Pradesh', code: '09' },
	{ name: 'Uttarakhand', code: '05' },
	{ name: 'West Bengal', code: '19' }
];

/** "MH", "Maharashtra", "maharashtra " → the GST state, or null. */
export function gstStateOf(value: string): { name: string; code: string } | null {
	const text = value.trim().toLowerCase();
	const ABBR: Record<string, string> = {
		ka: 'Karnataka',
		mh: 'Maharashtra',
		dl: 'Delhi',
		tn: 'Tamil Nadu',
		ts: 'Telangana',
		tg: 'Telangana',
		ap: 'Andhra Pradesh',
		kl: 'Kerala',
		gj: 'Gujarat',
		rj: 'Rajasthan',
		up: 'Uttar Pradesh',
		wb: 'West Bengal',
		mp: 'Madhya Pradesh',
		hr: 'Haryana',
		pb: 'Punjab',
		ga: 'Goa',
		or: 'Odisha',
		od: 'Odisha',
		br: 'Bihar',
		as: 'Assam',
		jh: 'Jharkhand',
		cg: 'Chhattisgarh',
		ct: 'Chhattisgarh',
		uk: 'Uttarakhand',
		ut: 'Uttarakhand',
		hp: 'Himachal Pradesh',
		jk: 'Jammu and Kashmir',
		ch: 'Chandigarh',
		py: 'Puducherry'
	};
	const name = ABBR[text] ?? text;
	return GST_STATES.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? null;
}
