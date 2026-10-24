import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import type { PermissionKey } from '$lib/admin/permissions';
import {
	addNote,
	cancelOrder,
	completeReturn,
	createReturn,
	deleteNote,
	exchangeOptions,
	getOrder,
	markDelivered,
	markDispatched,
	markPacked,
	OrderError,
	orderHistory,
	receiveReturn,
	refund,
	rejectReturn,
	RETURN_REASONS,
	undoFulfilment,
	updateAddress,
	type RefundReason
} from '$lib/server/orders/admin';
import { issueInvoice } from '$lib/server/orders/invoices';
import { notifyOrder, type OrderEvent } from '$lib/server/orders/notify';
import { rupeesToPaise } from '$lib/server/catalogue/forms';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'orders');
	const order = await getOrder(event.params.id);
	if (!order) error(404, 'No such order.');
	const [history, exchange] = await Promise.all([
		orderHistory(order.id),
		['dispatched', 'delivered'].includes(order.state) ? exchangeOptions(order) : Promise.resolve([])
	]);
	return {
		order,
		history,
		exchange,
		returnReasons: RETURN_REASONS,
		me: actorLabel(actor),
		can: {
			edit: can(actor, 'orders.edit'),
			refund: can(actor, 'orders.refund'),
			customers: can(actor, 'customers.view')
		}
	};
};

/** Runs an order action, turning a refused rule into a message on the form. */
async function run(
	event: RequestEvent,
	permission: PermissionKey,
	work: (form: FormData, actor: string) => Promise<string | void>
) {
	const actor = await staffActor(event);
	requirePermission(actor, permission);
	const form = await event.request.formData();
	try {
		const message = await work(form, actorLabel(actor));
		return message ? { message } : {};
	} catch (err) {
		if (err instanceof OrderError) return fail(400, { error: err.message });
		throw err;
	}
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

export const actions: Actions = {
	pack: (event) =>
		run(event, 'orders.edit', async (_, actor) => {
			const moved = await markPacked([event.params.id], actor);
			if (!moved) throw new OrderError('Only a paid order can be marked packed.');
			return 'Marked packed.';
		}),

	dispatch: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			await markDispatched({
				orderId: event.params.id,
				courierName: text(form, 'courier'),
				trackingRef: text(form, 'tracking'),
				notify: form.get('notify') === 'on',
				actor
			});
			return form.get('notify') === 'on' ? 'Dispatched. The customer has been told.' : 'Dispatched.';
		}),

	deliver: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			await markDelivered({ orderId: event.params.id, notify: form.get('notify') === 'on', actor });
			return 'Marked delivered.';
		}),

	undo: (event) =>
		run(event, 'orders.edit', async (_, actor) => {
			const state = await undoFulfilment({ orderId: event.params.id, actor });
			return `Back to ${state}.`;
		}),

	note: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			await addNote({ orderId: event.params.id, body: text(form, 'body'), actor });
			return 'Note added.';
		}),

	deleteNote: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			await deleteNote({ noteId: text(form, 'noteId'), actor });
		}),

	address: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			await updateAddress({
				orderId: event.params.id,
				to: {
					name: text(form, 'name'),
					line1: text(form, 'line1'),
					line2: text(form, 'line2') || null,
					city: text(form, 'city'),
					state: text(form, 'state'),
					pincode: text(form, 'pincode'),
					phone: text(form, 'phone')
				},
				actor
			});
			return 'Address saved.';
		}),

	cancel: (event) =>
		run(event, 'orders.refund', async (form, actor) => {
			await cancelOrder({
				orderId: event.params.id,
				reason: text(form, 'reason'),
				refundMoney: form.get('refund') === 'on',
				notify: form.get('notify') === 'on',
				actor
			});
			return form.get('refund') === 'on' ? 'Cancelled and refunded. Stock is back on sale.' : 'Cancelled. Stock is back on sale.';
		}),

	refund: (event) =>
		run(event, 'orders.refund', async (form, actor) => {
			const amount = rupeesToPaise(text(form, 'amount'));
			if (Number.isNaN(amount)) throw new OrderError('Enter the amount in rupees, e.g. 4100.');
			await refund({
				orderId: event.params.id,
				amount,
				reason: text(form, 'reason') as RefundReason,
				note: text(form, 'note') || null,
				notify: form.get('notify') === 'on',
				actor
			});
			return 'Refund sent. A credit note has been issued.';
		}),

	createReturn: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			const order = await getOrder(event.params.id);
			if (!order) throw new OrderError('That order no longer exists.');
			await createReturn({
				orderId: order.id,
				lines: order.lines.map((line) => ({
					orderLineId: line.id,
					quantity: Number(form.get(`qty_${line.id}`) ?? 0)
				})),
				reason: text(form, 'reason'),
				detail: text(form, 'detail') || null,
				outcome: text(form, 'outcome') as 'refund' | 'exchange' | 'repair' | 'none',
				exchangeVariantId: text(form, 'exchangeVariantId') || null,
				actor
			});
			return 'Return opened. Mark it received when the parcel arrives.';
		}),

	receiveReturn: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			await receiveReturn({ returnId: text(form, 'returnId'), restock: form.get('restock') === 'on', actor });
			return form.get('restock') === 'on' ? 'Received. The pieces are back in stock.' : 'Received.';
		}),

	completeReturn: async (event) => {
		const form = await event.request.clone().formData();
		// A refund moves money; anything else is fulfilment.
		const permission: PermissionKey = form.get('refundAmount') ? 'orders.refund' : 'orders.edit';
		return run(event, permission, async (f, actor) => {
			const amount = text(f, 'refundAmount') ? rupeesToPaise(text(f, 'refundAmount')) : null;
			if (amount !== null && Number.isNaN(amount)) throw new OrderError('Enter the refund in rupees.');
			await completeReturn({
				returnId: text(f, 'returnId'),
				refundAmount: amount,
				courierName: text(f, 'courier') || null,
				trackingRef: text(f, 'tracking') || null,
				notify: f.get('notify') === 'on',
				actor
			});
			return 'Return closed.';
		});
	},

	rejectReturn: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			await rejectReturn({ returnId: text(form, 'returnId'), actor });
			return 'Return rejected.';
		}),

	resend: (event) =>
		run(event, 'orders.edit', async (form, actor) => {
			const kind = text(form, 'event') as OrderEvent;
			if (!['confirmed', 'dispatched', 'delivered'].includes(kind)) throw new OrderError('Pick a message to send.');
			await notifyOrder(event.params.id, kind, { actor, once: false });
			return 'Sent again. It is in the messages below.';
		}),

	invoice: (event) =>
		run(event, 'orders.view', async (_, actor) => {
			const invoice = await issueInvoice(event.params.id, actor);
			if (!invoice) throw new OrderError('An invoice is issued once the order is paid.');
			return `Invoice ${invoice.number} issued.`;
		})
};
