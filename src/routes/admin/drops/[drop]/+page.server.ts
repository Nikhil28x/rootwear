import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { adminRepo } from '$lib/server/admin';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, resolveAdminAuth } from '$lib/server/admin/session';
import { DROP_STATES, canTransition, isOnSale, type DropState } from '$lib/domain/drop-state';
import { parseIstInput } from '$lib/components/admin/tone';
import { STAGE_COUNT, STAGE_DURATION_MS } from '$lib/drop/schedule';

/**
 * RW-157 — Editing one drop.
 *
 * THE TRANSITION GUARD IS THE POINT OF THIS SCREEN. §06 defines seven states
 * and a fixed set of legal edges between them. The UI never offers an illegal
 * one — the select is built from legalTransitionsFrom() — and the action
 * re-checks before writing, because a select is markup and markup can be
 * posted around.
 *
 * Nothing here deletes anything. The archive is the brand's proof of history.
 */

async function requireStaff(event: RequestEvent) {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'drops');
	return auth.actor;
}

/** A posted state string is untrusted until it is one of the seven. */
function parseState(value: FormDataEntryValue | null): DropState | null {
	const text = String(value ?? '');
	return (DROP_STATES as readonly string[]).includes(text) ? (text as DropState) : null;
}

export const load: PageServerLoad = async (event) => {
	await requireStaff(event);

	const drop = await adminRepo.findDropRow(event.params.drop);
	if (!drop) error(404, `No drop with the slug "${event.params.drop}".`);

	// §06 / RW-043: warn if moving this drop live would make it the second one.
	const all = await adminRepo.listDropRows();
	const othersLive = all.filter((row) => row.id !== drop.id && isOnSale(row.state));

	return {
		now: event.locals.now,
		drop,
		othersLive: othersLive.map((row) => `Drop ${String(row.number).padStart(2, '0')} ${row.name}`),
		/**
		 * §07 — the tease run is derived from the launch instant, not stored
		 * beside it: one stage per day, counted back from launch. Sent to the
		 * page so the operator can see what moving the instant does to the
		 * schedule before they move it.
		 */
		schedule: {
			stageCount: STAGE_COUNT,
			stageDurationMs: STAGE_DURATION_MS,
			teaseStart: drop.launchInstant - STAGE_COUNT * STAGE_DURATION_MS
		}
	};
};

export const actions: Actions = {
	/** §06 — move the drop to another state, if and only if the edge is legal. */
	transition: async (event) => {
		const actor = await requireStaff(event);
		const form = await event.request.formData();
		const dropId = String(form.get('dropId') ?? '');
		const from = parseState(form.get('from'));
		const to = parseState(form.get('to'));

		if (!from || !to) {
			return fail(400, { ok: false, message: 'Unknown drop state.' });
		}
		if (!canTransition(from, to)) {
			return fail(400, {
				ok: false,
				message: `${from} cannot become ${to}. §06 does not allow that edge.`
			});
		}

		try {
			await adminRepo.setDropState({ dropId, from, to, actor: actorLabel(actor) });
		} catch (cause) {
			return fail(409, {
				ok: false,
				message: cause instanceof Error ? cause.message : 'State write failed.'
			});
		}

		return { ok: true, message: `State moved to ${to}.` };
	},

	/** Publication gates anon visibility, separately from state (§06 + 0007 RLS). */
	publish: async (event) => {
		const actor = await requireStaff(event);
		const form = await event.request.formData();
		const dropId = String(form.get('dropId') ?? '');
		const published = String(form.get('published') ?? '') === 'true';

		try {
			await adminRepo.setDropPublished({ dropId, published, actor: actorLabel(actor) });
		} catch (cause) {
			return fail(409, {
				ok: false,
				message: cause instanceof Error ? cause.message : 'Publish write failed.'
			});
		}

		return {
			ok: true,
			message: published ? 'Drop is now visible on the site.' : 'Drop is hidden from the site.'
		};
	},

	/**
	 * §07 — the launch instant, and with it the whole tease schedule.
	 *
	 * The operator types a wall clock; it is read as IST here, once, at the
	 * edge. Everything downstream is an epoch millisecond, so no other module
	 * has to know what zone the brand runs on.
	 *
	 * Moving an instant that has already passed is ALLOWED but not silent: a
	 * mistyped launch time is a real thing to have to correct, and refusing the
	 * correction would leave the wrong figure on the customer's countdown. The
	 * page warns before the submit and the audit log records both values.
	 */
	launchInstant: async (event) => {
		const actor = await requireStaff(event);
		const form = await event.request.formData();
		const dropId = String(form.get('dropId') ?? '');

		const launchInstant = parseIstInput(String(form.get('launchInstant') ?? ''));
		if (launchInstant === null) {
			return fail(400, { ok: false, message: 'Give the launch as a date and a time of day.' });
		}

		try {
			await adminRepo.setDropLaunchInstant({
				dropId,
				launchInstant,
				actor: actorLabel(actor)
			});
		} catch (cause) {
			return fail(409, {
				ok: false,
				message: cause instanceof Error ? cause.message : 'Launch instant write failed.'
			});
		}

		return { ok: true, message: 'Launch instant saved. The tease schedule has moved with it.' };
	},

	/**
	 * §09 per-size stock and the §08 reservation cap. Saved one size at a time
	 * so a mistake in one field cannot silently rewrite the other four.
	 */
	stock: async (event) => {
		const actor = await requireStaff(event);
		const form = await event.request.formData();
		const variantId = String(form.get('variantId') ?? '');
		const stockCount = Number(form.get('stockCount'));
		const reserveCap = Number(form.get('reserveCap'));

		if (!Number.isInteger(stockCount) || !Number.isInteger(reserveCap)) {
			return fail(400, { ok: false, message: 'Stock and cap must be whole numbers.' });
		}
		if (stockCount < 0 || reserveCap < 0) {
			return fail(400, { ok: false, message: 'Stock and cap cannot be negative.' });
		}

		try {
			await adminRepo.setVariantStock({
				variantId,
				stockCount,
				reserveCap,
				actor: actorLabel(actor)
			});
		} catch (cause) {
			return fail(409, {
				ok: false,
				message: cause instanceof Error ? cause.message : 'Stock write failed.'
			});
		}

		return { ok: true, message: 'Stock saved.' };
	}
};
