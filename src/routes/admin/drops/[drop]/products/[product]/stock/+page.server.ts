import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	CatalogueError,
	findProduct,
	setReserveCap,
	setStock,
	STOCK_REASONS,
	stockMovements,
	type StockReason
} from '$lib/server/catalogue/admin';

export const load: PageServerLoad = async ({ parent }) => {
	const { product } = await parent();
	return {
		reasons: STOCK_REASONS.map((r) => ({ value: r.value, label: r.label })),
		movements: await stockMovements(
			product.variants.map((v) => v.id),
			60
		)
	};
};

export const actions: Actions = {
	/**
	 * Saves every changed row in one go. Each change is its own atomic write
	 * (app.adjust_stock), so one refused row — below what is reserved, say —
	 * does not undo the others; the refusals are listed back.
	 */
	save: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'catalogue.edit');
		const found = await findProduct(event.params.drop, event.params.product);
		if (!found) error(404, 'That product is not in this drop.');

		const form = await event.request.formData();
		const reason = String(form.get('reason') ?? 'correction') as StockReason;
		if (!STOCK_REASONS.some((r) => r.value === reason))
			return fail(400, { error: 'Pick a reason for the change.' });
		const note = String(form.get('note') ?? '').trim() || null;

		const problems: string[] = [];
		let changed = 0;
		for (const variant of found.product.variants) {
			const stockRaw = form.get(`stock_${variant.id}`);
			const capRaw = form.get(`cap_${variant.id}`);
			if (stockRaw === null) continue;
			const stock = Number(stockRaw);
			const cap = Number(capRaw);
			const label = `${variant.sku}`;
			try {
				if (stock !== variant.stock) {
					await setStock({
						variantId: variant.id,
						count: stock,
						reason,
						note,
						actor: actorLabel(actor)
					});
					changed++;
				}
				if (capRaw !== null && cap !== variant.reserveCap) {
					await setReserveCap({ variantId: variant.id, cap, actor: actorLabel(actor) });
					changed++;
				}
			} catch (err) {
				if (err instanceof CatalogueError) problems.push(`${label}: ${err.message}`);
				else throw err;
			}
		}

		if (problems.length) {
			return fail(400, {
				error: `${changed ? `${changed} saved. ` : ''}Not saved — ${problems.join(' ')}`
			});
		}
		return { message: changed ? 'Stock saved.' : 'Nothing had changed.' };
	}
};
