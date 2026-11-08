/**
 * What a customer is told about where their order is, in plain words, from
 * its stored stage and dates. One function, so the order page and anything
 * else that shows an order (emails later) say the same thing.
 *
 * The estimate is the shop's own promise (Admin → Settings → Shipping →
 * Delivery: "about N days"), counted from the order, or from the day the drop
 * opens for a pre-order, or from dispatch once dispatched.
 */
const DAY_MS = 86_400_000;

export type DeliveryInput = {
	state: string;
	email: string;
	shipping: number;
	placedAtMs: number;
	packedAtMs: number | null;
	dispatchedAtMs: number | null;
	deliveredAtMs: number | null;
	hasPreOrderLine: boolean;
	courierName: string | null;
	trackingRef: string | null;
};

export type DeliveryOptions = {
	days: number;
	trackingUrl: string;
	/** When a pre-order's drop opens (it ships after). */
	launchInstant: number;
	now: number;
};

export type DeliveryStep = { key: string; label: string; at: number | null; done: boolean };

export type DeliveryOutlook = {
	headline: string;
	/** Short facts under the headline: delivery cost, the email. */
	notes: string[];
	steps: DeliveryStep[];
	/** The courier's page for this parcel, when a tracking link is set up. */
	trackingHref: string | null;
};

const dayFormat = new Intl.DateTimeFormat('en-IN', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	timeZone: 'Asia/Kolkata'
});
const dateFormat = new Intl.DateTimeFormat('en-IN', {
	day: 'numeric',
	month: 'long',
	timeZone: 'Asia/Kolkata'
});

const daysPhrase = (n: number) => (n === 1 ? '1 day' : `${n} days`);

export function deliveryOutlook(order: DeliveryInput, options: DeliveryOptions): DeliveryOutlook | null {
	const { days, now } = options;
	if (order.state === 'cancelled' || order.state === 'refunded') return null;

	const steps: DeliveryStep[] = [
		{ key: 'placed', label: 'Placed', at: order.placedAtMs, done: order.state !== 'pending_payment' },
		{
			key: 'packed',
			label: 'Packed',
			at: order.packedAtMs,
			done: ['packed', 'dispatched', 'delivered'].includes(order.state)
		},
		{
			key: 'dispatched',
			label: 'Dispatched',
			at: order.dispatchedAtMs,
			done: ['dispatched', 'delivered'].includes(order.state)
		},
		{ key: 'delivered', label: 'Delivered', at: order.deliveredAtMs, done: order.state === 'delivered' }
	];

	const trackingHref =
		order.trackingRef && options.trackingUrl.includes('{ref}')
			? options.trackingUrl.replace('{ref}', encodeURIComponent(order.trackingRef))
			: null;
	const delivery = order.shipping > 0 ? null : 'Free delivery.';

	if (order.state === 'pending_payment') {
		return {
			headline: 'We’re confirming your payment.',
			notes: ['This page updates by itself once it’s through.'],
			steps,
			trackingHref
		};
	}

	if (order.state === 'delivered') {
		return {
			headline: order.deliveredAtMs
				? `Delivered on ${dateFormat.format(order.deliveredAtMs)}.`
				: 'Delivered.',
			notes: ['You have seven days from delivery to report a defect.'],
			steps,
			trackingHref
		};
	}

	if (order.state === 'dispatched') {
		const eta = (order.dispatchedAtMs ?? now) + days * DAY_MS;
		return {
			headline:
				eta > now
					? `On its way — arriving by ${dayFormat.format(eta)}.`
					: 'On its way — it should be with you any day now.',
			notes: [delivery, order.trackingRef ? null : 'Tracking details follow by email.'].filter(
				(note): note is string => note !== null
			),
			steps,
			trackingHref
		};
	}

	// Paid or packed: not yet with the courier.
	const fromLaunch = order.hasPreOrderLine && options.launchInstant > now;
	const start = fromLaunch ? options.launchInstant : order.placedAtMs;
	const eta = start + days * DAY_MS;
	const justPlaced = now - order.placedAtMs < DAY_MS;
	return {
		headline: fromLaunch
			? `Your order ships when the drop opens on ${dateFormat.format(options.launchInstant)}, and arrives about ${daysPhrase(days)} later.`
			: `Your order will be arriving in about ${daysPhrase(days)} — by ${dayFormat.format(eta)}.`,
		notes: [
			delivery,
			justPlaced
				? `You’ll receive a confirmation email at ${order.email} shortly.`
				: `We’ve sent the details to ${order.email}.`
		].filter((note): note is string => note !== null),
		steps,
		trackingHref
	};
}
