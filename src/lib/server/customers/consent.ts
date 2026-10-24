/**
 * §13: marketing consent at checkout is opt-in — two unticked boxes. The
 * choice is held in a short cookie across order placement (which creates
 * the customer), then written to the customer and logged as a note, with
 * the time, so the opt-in is recorded at the point it was given.
 *
 * Only ever turns consent ON. Withdrawing it is done by staff on the
 * customer's page (or by the customer writing in), never by an unticked box
 * on a later order.
 */
import type { Cookies } from '@sveltejs/kit';
import { getServiceClient } from '$lib/server/db/clients';

const COOKIE = 'rw_optin';

export function rememberOptIn(cookies: Cookies, email: boolean, whatsapp: boolean): void {
	if (!email && !whatsapp) {
		cookies.delete(COOKIE, { path: '/' });
		return;
	}
	cookies.set(COOKIE, [email && 'email', whatsapp && 'whatsapp'].filter(Boolean).join(','), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 30
	});
}

export async function applyOptIn(orderId: string, cookies: Cookies): Promise<void> {
	const raw = cookies.get(COOKIE);
	if (!raw) return;
	const email = raw.includes('email');
	const whatsapp = raw.includes('whatsapp');
	try {
		const client = getServiceClient();
		const { data } = await client.from('orders').select('customer_id, order_number').eq('id', orderId).single();
		if (!data) return;
		const { customer_id: customerId, order_number: number } = data as { customer_id: string; order_number: string };
		await client
			.from('customers')
			.update({ ...(email ? { marketing_email: true } : {}), ...(whatsapp ? { marketing_whatsapp: true } : {}) })
			.eq('id', customerId);
		await client.from('customer_notes').insert({
			customer_id: customerId,
			body: `Opted in to drop news by ${[email && 'email', whatsapp && 'WhatsApp'].filter(Boolean).join(' and ')} at checkout (order ${number}).`,
			author: 'checkout'
		});
	} catch (error) {
		console.error('[consent] opt-in not recorded', error);
	}
}
