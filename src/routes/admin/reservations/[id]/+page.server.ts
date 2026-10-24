import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { enqueue, messagesFor } from '$lib/server/messaging/outbox';
import { siteUrl } from '$lib/server/messaging/config';
import { getServiceClient } from '$lib/server/db/clients';
import { formatInr } from '$lib/money';

/**
 * RW-161 — One reservation, end to end: what was agreed, every payment and
 * refund, the balance link, and the order it became.
 */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'reservations');
	const reservation = await adminRepo.findReservation(event.params.id);
	if (!reservation) error(404, 'No pre-order with that reference.');
	return {
		now: event.locals.now,
		reservation,
		messages: await messagesFor('reservation', reservation.id),
		canEdit: can(actor, 'orders.edit')
	};
};

const DAY = 86_400_000;

export const actions: Actions = {
	/**
	 * §08: asks for the balance. Records the due date (a lapsed balance
	 * releases the piece to the waitlist) and sends the customer the link by
	 * email, and WhatsApp where a number is known.
	 */
	balanceLink: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'orders.edit');
		const days = Number((await event.request.formData()).get('days'));
		if (!Number.isInteger(days) || days < 1 || days > 60) {
			return fail(400, { error: 'Give the customer between 1 and 60 days to pay the balance.' });
		}
		const dueBy = event.locals.now + days * DAY;
		try {
			await adminRepo.markBalanceRequested({
				reservationId: event.params.id,
				dueBy,
				actor: actorLabel(actor)
			});
		} catch (cause) {
			return fail(409, {
				error: cause instanceof Error ? cause.message : 'The balance request failed.'
			});
		}

		const r = await adminRepo.findReservation(event.params.id);
		if (!r) return { message: 'Balance requested.' };
		const variables = {
			name: r.email.split('@')[0],
			drop_name: r.dropName,
			balance: formatInr(r.balance),
			due_by: new Intl.DateTimeFormat('en-IN', {
				day: 'numeric',
				month: 'long',
				timeZone: 'Asia/Kolkata'
			}).format(dueBy),
			pay_url: `${siteUrl()}/checkout/balance/${r.id}`
		};
		const sent = await enqueue({
			template: 'balance_due_email',
			to: r.email,
			variables,
			context: { type: 'reservation', id: r.id },
			createdBy: actorLabel(actor)
		});
		// A pre-order signup carries the phone; use it for WhatsApp when there is one.
		const { data } = await getServiceClient()
			.from('preorder_signups')
			.select('phone, name')
			.eq('email', r.email)
			.limit(1)
			.maybeSingle();
		const signup = data as { phone: string; name: string } | null;
		if (signup?.phone) {
			await enqueue({
				template: 'balance_due_whatsapp',
				to: signup.phone,
				toName: signup.name,
				variables: { ...variables, name: signup.name.split(' ')[0] },
				context: { type: 'reservation', id: r.id },
				createdBy: actorLabel(actor)
			}).catch(() => undefined);
		}
		return {
			message:
				sent.status === 'sent' || sent.status === 'queued'
					? `Balance link sent. Due in ${days} day${days === 1 ? '' : 's'}.`
					: `Balance recorded, due in ${days} day${days === 1 ? '' : 's'}, but the email was not sent: ${sent.lastError ?? sent.status}`
		};
	}
};
