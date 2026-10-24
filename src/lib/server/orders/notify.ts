/**
 * Customer messages about an order: confirmed, dispatched, delivered,
 * refunded. Email always; WhatsApp too when the order carries a mobile
 * number. A confirmation is sent once however many times payment is
 * reported (webhooks are redelivered), so this checks the outbox first.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { enqueue } from '$lib/server/messaging/outbox';
import { siteUrl } from '$lib/server/messaging/config';
import { getTemplate } from '$lib/server/messaging/templates';
import { formatInr, paise } from '$lib/money';

export type OrderEvent = 'confirmed' | 'dispatched' | 'delivered' | 'refunded';

const TEMPLATES: Record<OrderEvent, { email: string; whatsapp: string | null }> = {
	confirmed: { email: 'order_confirmed_email', whatsapp: 'order_confirmed_whatsapp' },
	dispatched: { email: 'order_dispatched_email', whatsapp: 'order_dispatched_whatsapp' },
	delivered: { email: 'order_delivered_email', whatsapp: null },
	refunded: { email: 'refund_issued_email', whatsapp: null }
};

async function alreadySent(orderId: string, template: string): Promise<boolean> {
	const { count } = await getServiceClient()
		.from('message_outbox')
		.select('id', { count: 'exact', head: true })
		.eq('context_type', 'order')
		.eq('context_id', orderId)
		.eq('template_key', template)
		.in('status', ['queued', 'sending', 'sent', 'delivered', 'read']);
	return (count ?? 0) > 0;
}

export async function notifyOrder(
	orderId: string,
	event: OrderEvent,
	options: { actor?: string; extra?: Record<string, string>; once?: boolean } = {}
): Promise<void> {
	const client = getServiceClient();
	const { data } = await client
		.from('orders')
		.select(
			'order_number, total_paise, ship_name, ship_phone, public_token, courier_name, tracking_ref, customer_id'
		)
		.eq('id', orderId)
		.maybeSingle();
	if (!data) return;
	const order = data as {
		order_number: string;
		total_paise: number;
		ship_name: string;
		ship_phone: string | null;
		public_token: string;
		courier_name: string | null;
		tracking_ref: string | null;
		customer_id: string;
	};
	const { data: customer } = await client
		.from('customers')
		.select('email')
		.eq('id', order.customer_id)
		.maybeSingle();
	const email = (customer as { email: string } | null)?.email;

	const variables = {
		name: order.ship_name.split(' ')[0] || order.ship_name,
		order_number: order.order_number,
		total: formatInr(paise(Number(order.total_paise))),
		order_url: `${siteUrl()}/order/${order.public_token}`,
		courier: order.courier_name ?? '',
		tracking_ref: order.tracking_ref ?? '',
		...options.extra
	};

	const { email: emailKey, whatsapp: waKey } = TEMPLATES[event];
	const once = options.once ?? event === 'confirmed';
	const sends: Promise<unknown>[] = [];

	if (email && !(once && (await alreadySent(orderId, emailKey)))) {
		sends.push(
			enqueue({
				template: emailKey,
				to: email,
				toName: order.ship_name,
				variables,
				context: { type: 'order', id: orderId },
				createdBy: options.actor
			})
		);
	}
	if (waKey && order.ship_phone && (await getTemplate(waKey))?.active) {
		if (!(once && (await alreadySent(orderId, waKey)))) {
			sends.push(
				enqueue({
					template: waKey,
					to: order.ship_phone,
					toName: order.ship_name,
					variables,
					context: { type: 'order', id: orderId },
					createdBy: options.actor
				})
			);
		}
	}
	// A provider being down must never fail the order action that triggered it;
	// the outbox keeps the message and the cron retries it.
	await Promise.allSettled(sends);
}
