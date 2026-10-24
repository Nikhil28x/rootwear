import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { CartError, checkouts, dismiss, funnel, liveCarts, sendReminder } from '$lib/server/carts/admin';
import { getSetting, saveSetting } from '$lib/server/settings';
import { channelStatus } from '$lib/server/messaging/config';

const VIEWS = ['abandoned', 'checkout', 'live'] as const;

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'carts');
	const view = (VIEWS as readonly string[]).includes(event.url.searchParams.get('view') ?? '')
		? (event.url.searchParams.get('view') as (typeof VIEWS)[number])
		: 'abandoned';
	const days = event.url.searchParams.get('days') === '7' ? 7 : 30;
	const now = event.locals.now;

	const [all, live, numbers, settings] = await Promise.all([
		checkouts(now, days),
		view === 'live' ? liveCarts(now) : Promise.resolve([]),
		funnel(now, days),
		getSetting('carts')
	]);

	const abandoned = all.filter((c) => c.status !== 'in_checkout');
	return {
		view,
		days,
		now,
		funnel: numbers,
		abandoned,
		inCheckout: all.filter((c) => c.status === 'in_checkout'),
		live,
		settings,
		channels: channelStatus().map((c) => ({ channel: c.channel, configured: c.configured })),
		canRecover: can(actor, 'carts.recover'),
		canSettings: can(actor, 'settings.edit'),
		counts: {
			abandoned: abandoned.filter((c) => c.status === 'abandoned').length,
			checkout: all.filter((c) => c.status === 'in_checkout').length
		}
	};
};

export const actions: Actions = {
	remind: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'carts.recover');
		const form = await event.request.formData();
		const channels = form.getAll('channels').map(String).filter((c): c is 'email' | 'whatsapp' => c === 'email' || c === 'whatsapp');
		try {
			const result = await sendReminder({
				orderId: String(form.get('orderId') ?? ''),
				channels,
				actor: actorLabel(actor),
				now: event.locals.now
			});
			if (!result.sent.length) return fail(400, { error: `Not sent — ${result.skipped.join('; ')}` });
			return {
				message: `Reminder sent by ${result.sent.join(' and ')}.${result.skipped.length ? ` Skipped ${result.skipped.join('; ')}.` : ''}`
			};
		} catch (err) {
			if (err instanceof CartError) return fail(400, { error: err.message });
			throw err;
		}
	},

	dismiss: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'carts.recover');
		await dismiss(String((await event.request.formData()).get('orderId') ?? ''), actorLabel(actor));
		return { message: 'Dismissed. It will not be reminded.' };
	},

	settings: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'settings.edit');
		const form = await event.request.formData();
		const delay = Number(form.get('delayMinutes'));
		if (!Number.isInteger(delay) || delay < 15 || delay > 2880) {
			return fail(400, { error: 'Wait between 15 minutes and 2 days before reminding.' });
		}
		const channels = form.getAll('channels').map(String).filter((c): c is 'email' | 'whatsapp' => c === 'email' || c === 'whatsapp');
		if (form.get('autoRecover') === 'on' && !channels.length) return fail(400, { error: 'Pick at least one channel.' });
		await saveSetting(
			'carts',
			{ autoRecover: form.get('autoRecover') === 'on', delayMinutes: delay, channels },
			actorLabel(actor)
		);
		return { message: form.get('autoRecover') === 'on' ? 'Automatic reminders are on.' : 'Automatic reminders are off.' };
	}
};
