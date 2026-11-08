import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { lookupOrder } from '$lib/server/orders/lookup';

/**
 * Track an order: the order number plus the email or phone it was placed
 * with opens the order's own page. Rate limited and guess-limited — see
 * $lib/server/orders/lookup.ts.
 */
export const load: PageServerLoad = async () => ({});

const NOT_FOUND =
	"We couldn't find an order with those details. Check the order number on your confirmation email, and use the email or phone you ordered with.";

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData();
		const orderNumber = String(data.get('order') ?? '').trim();
		const contact = String(data.get('contact') ?? '').trim();
		if (!orderNumber || !contact) {
			return fail(400, { orderNumber, contact, error: 'Enter your order number and your email or phone.' });
		}
		if (orderNumber.length > 40 || contact.length > 254) {
			return fail(400, { orderNumber: '', contact: '', error: NOT_FOUND });
		}

		const visitor =
			event.request.headers.get('cf-connecting-ip') ??
			(() => {
				try {
					return event.getClientAddress();
				} catch {
					return 'unknown';
				}
			})();
		const result = await lookupOrder({ orderNumber, contact, visitor, now: Date.now() });

		if (result.status === 'blocked') {
			return fail(429, {
				orderNumber,
				contact,
				error: 'Too many tries for now. Wait a little and try again, or write to us and we’ll find it for you.'
			});
		}
		if (result.status === 'not_found') return fail(404, { orderNumber, contact, error: NOT_FOUND });
		redirect(303, `/order/${result.token}`);
	}
};
