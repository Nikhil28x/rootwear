import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { requirePermission } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	addColourway,
	addSizeOption,
	CatalogueError,
	findProduct,
	priceHistory,
	removeColourway,
	setProductStatus,
	setSizeChart,
	setSizes,
	updateColourway,
	updateProduct,
	type ProductStatus
} from '$lib/server/catalogue/admin';
import { readProductForm } from '$lib/server/catalogue/forms';
import { formatInr } from '$lib/money';

export const load: PageServerLoad = async ({ params, parent }) => {
	await parent();
	const history = await priceHistory(params.product);
	return {
		priceHistory: history.map((p) => ({ price: formatInr(p.price), kind: p.kind, at: p.at }))
	};
};

async function editor(event: RequestEvent) {
	const actor = await staffActor(event);
	requirePermission(actor, 'catalogue.edit');
	const found = await findProduct(event.params.drop, event.params.product);
	if (!found) error(404, 'That product is not in this drop.');
	return { actor: actorLabel(actor), product: found.product };
}

/** Runs a catalogue write, turning a rule it refuses into a message for the form. */
async function attempt<T>(work: () => Promise<T>): Promise<T | ReturnType<typeof fail>> {
	try {
		return await work();
	} catch (err) {
		if (err instanceof CatalogueError) return fail(400, { error: err.message });
		throw err;
	}
}

export const actions: Actions = {
	status: async (event) => {
		const { actor, product } = await editor(event);
		const status = String((await event.request.formData()).get('status')) as ProductStatus;
		if (!['draft', 'active', 'archived'].includes(status)) return fail(400, { error: 'Unknown status.' });
		const refused = await attempt(() => setProductStatus({ productId: product.id, status, actor }));
		if (refused) return refused;
		return {
			message:
				status === 'active'
					? 'Live. It shows on the site when the drop is published.'
					: status === 'draft'
						? 'Back to draft. It is off the site.'
						: 'Archived. It is off the site; its orders and history stay.'
		};
	},

	details: async (event) => {
		const { actor, product } = await editor(event);
		const form = await event.request.formData();
		const { input } = readProductForm(form);
		// This form edits the copy; keep the saved price and tax.
		input.launchPrice = Number(product.launchPrice);
		input.prelaunchPrice = Number(product.prelaunchPrice);
		input.hsnCode = product.hsnCode;
		input.gstRate = product.gstRate;
		const result = await attempt(() => updateProduct({ productId: product.id, product: input, actor }));
		return result ?? { message: 'Details saved.' };
	},

	price: async (event) => {
		const { actor, product } = await editor(event);
		const form = await event.request.formData();
		const { input } = readProductForm(form);
		if (Number.isNaN(input.launchPrice) || Number.isNaN(input.prelaunchPrice)) {
			return fail(400, { error: 'Enter prices in rupees, e.g. 4100.' });
		}
		const merged = {
			name: product.name,
			summary: product.summary,
			fabric: product.fabric,
			gsm: product.gsm,
			care: [...product.care],
			fit: product.fit,
			fitNote: product.fitNote,
			modelHeightCm: product.modelHeightCm,
			modelWornSize: product.modelWornSize,
			styleCode: product.styleCode,
			launchPrice: input.launchPrice,
			prelaunchPrice: input.prelaunchPrice,
			hsnCode: input.hsnCode,
			gstRate: input.gstRate
		};
		const result = await attempt(() => updateProduct({ productId: product.id, product: merged, actor }));
		return result ?? { message: 'Price and tax saved. Carts already open re-price on their next view.' };
	},

	sizes: async (event) => {
		const { actor, product } = await editor(event);
		const sizes = (await event.request.formData()).getAll('sizes').map(String);
		const result = await attempt(() => setSizes({ productId: product.id, sizes, actor }));
		if (result && 'kept' in result) {
			return {
				message: result.kept.length
					? `Sizes saved. ${result.kept.join(', ')} stayed because they have orders, reservations or carts — set their stock to 0 instead.`
					: 'Sizes saved.'
			};
		}
		return result;
	},

	addSize: async (event) => {
		const { actor } = await editor(event);
		const form = await event.request.formData();
		const result = await attempt(() =>
			addSizeOption({ code: String(form.get('code') ?? ''), label: String(form.get('label') ?? ''), actor })
		);
		return typeof result === 'string' ? { message: `${result} is now available to every product.` } : result;
	},

	addColour: async (event) => {
		const { actor, product } = await editor(event);
		const form = await event.request.formData();
		const result = await attempt(() =>
			addColourway({
				productId: product.id,
				name: String(form.get('name') ?? ''),
				code: String(form.get('code') ?? ''),
				swatch: String(form.get('swatch') ?? '') || null,
				actor
			})
		);
		return result ?? { message: 'Colour added in every size. Set its stock on the Stock tab.' };
	},

	editColour: async (event) => {
		const { actor } = await editor(event);
		const form = await event.request.formData();
		const result = await attempt(() =>
			updateColourway({
				colourwayId: String(form.get('colourwayId') ?? ''),
				name: String(form.get('name') ?? ''),
				swatch: String(form.get('swatch') ?? '') || null,
				actor
			})
		);
		return result ?? { message: 'Colour saved.' };
	},

	removeColour: async (event) => {
		const { actor } = await editor(event);
		const id = String((await event.request.formData()).get('colourwayId') ?? '');
		const result = await attempt(() => removeColourway({ colourwayId: id, actor }));
		return result ?? { message: 'Colour removed.' };
	},

	sizeChart: async (event) => {
		const { actor, product } = await editor(event);
		const form = await event.request.formData();
		const rows = product.sizes
			.map((size) => ({
				size,
				chestCm: Number(form.get(`chest_${size}`)),
				lengthCm: Number(form.get(`length_${size}`))
			}))
			.filter((row) => row.chestCm || row.lengthCm);
		const result = await attempt(() => setSizeChart({ productId: product.id, rows, actor }));
		return result ?? { message: 'Size guide saved.' };
	}
};
