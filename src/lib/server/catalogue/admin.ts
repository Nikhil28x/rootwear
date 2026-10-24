/**
 * Catalogue editing for admin: drops, products, colourways, sizes, stock,
 * prices and images.
 *
 * Every write here is attributable (writeAudit) and every rule that protects
 * a customer is enforced here as well as in the database:
 *
 *   - a size or colour that has been sold, reserved or is in a cart is never
 *     deleted, only left in place with no stock;
 *   - stock never drops below what is already reserved (app.adjust_stock);
 *   - a published drop's slug never changes (§05: the URL survives the drop).
 *
 * Reads use the service role: admin must see drafts and unpublished drops,
 * which RLS rightly hides from the anon key.
 */
import { buildSku } from '$lib/catalogue/sku';
import { compareSizes, isSize } from '$lib/drop/sizes';
import { legalTransitionsFrom, type DropState } from '$lib/domain/drop-state';
import { paise, type Paise } from '$lib/money';
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';

export class CatalogueError extends Error {}

/* ------------------------------------------------------------------------ */
/* Types                                                                     */
/* ------------------------------------------------------------------------ */

export type ProductStatus = 'draft' | 'active' | 'archived';

export type AdminColourway = {
	readonly id: string;
	readonly name: string;
	readonly code: string;
	readonly swatch: string | null;
	readonly position: number;
};

export type AdminVariant = {
	readonly id: string;
	readonly sku: string;
	readonly size: string;
	readonly colourwayId: string | null;
	readonly stock: number;
	readonly reserveCap: number;
	readonly reserved: number;
	/** Pieces on orders past payment. */
	readonly sold: number;
	/** Referenced by an order, reservation or cart, so it cannot be deleted. */
	readonly inUse: boolean;
};

export type AdminImage = {
	readonly id: string;
	readonly url: string;
	readonly alt: string;
	readonly role: 'lead' | 'detail' | 'fabric' | 'worn';
	readonly caption: string | null;
	readonly position: number;
	readonly width: number | null;
	readonly height: number | null;
	readonly colourwayId: string | null;
};

export type SizeChartEntry = {
	readonly size: string;
	readonly chestCm: number;
	readonly lengthCm: number;
};

export type AdminProduct = {
	readonly id: string;
	readonly dropId: string;
	readonly slug: string;
	readonly name: string;
	readonly summary: string;
	readonly fabric: string;
	readonly gsm: number;
	readonly care: readonly string[];
	readonly fit: string;
	readonly fitNote: string | null;
	readonly modelHeightCm: number | null;
	readonly modelWornSize: string | null;
	readonly styleCode: string;
	readonly launchPrice: Paise;
	readonly prelaunchPrice: Paise;
	readonly status: ProductStatus;
	readonly position: number;
	readonly hsnCode: string;
	readonly gstRate: number;
	readonly sizeChart: readonly SizeChartEntry[];
	readonly colourways: readonly AdminColourway[];
	readonly variants: readonly AdminVariant[];
	readonly images: readonly AdminImage[];
	/** Sizes this product is cut in, in display order. */
	readonly sizes: readonly string[];
	readonly totals: { readonly stock: number; readonly reserved: number; readonly sold: number };
};

export type AdminDrop = {
	readonly id: string;
	readonly slug: string;
	readonly number: number;
	readonly name: string;
	readonly story: string;
	readonly state: DropState;
	readonly launchInstant: number;
	readonly archivedAt: number | null;
	readonly editionSize: number;
	readonly published: boolean;
	readonly preorderMode: boolean;
	readonly previewToken: string | null;
	readonly legalTransitions: readonly DropState[];
	readonly products: readonly AdminProduct[];
	readonly totals: { readonly stock: number; readonly reserved: number; readonly sold: number };
};

export type SizeOption = {
	readonly code: string;
	readonly label: string;
	readonly sortOrder: number;
};

/* ------------------------------------------------------------------------ */
/* Row shapes                                                                */
/* ------------------------------------------------------------------------ */

type DropRow = {
	id: string;
	slug: string;
	number: number;
	name: string;
	story: string;
	state: DropState;
	launch_instant: string;
	archived_at: string | null;
	edition_size: number;
	published_at: string | null;
	preorder_mode: boolean;
	preview_token: string | null;
};

type ProductRow = {
	id: string;
	drop_id: string;
	slug: string;
	name: string;
	summary: string;
	fabric: string;
	gsm: number;
	care: string[];
	fit: string;
	fit_note: string | null;
	model_height_cm: number | null;
	model_worn_size: string | null;
	style_code: string | null;
	launch_price_paise: number;
	prelaunch_price_paise: number;
	status: ProductStatus;
	position: number;
	hsn_code: string;
	gst_rate: number | string;
	size_chart: { size: string; chest_cm: number; length_cm: number }[] | null;
};

type VariantRow = {
	id: string;
	product_id: string;
	sku: string;
	size: string;
	colourway_id: string | null;
	stock_count: number;
	reserve_cap: number;
	reserved_count: number;
};

type ColourwayRow = {
	id: string;
	product_id: string;
	name: string;
	code: string;
	swatch: string | null;
	position: number;
};

type ImageRow = {
	id: string;
	product_id: string;
	url: string;
	alt: string;
	role: AdminImage['role'];
	caption: string | null;
	position: number;
	width: number | null;
	height: number | null;
	colourway_id: string | null;
};

const DROP_COLUMNS =
	'id, slug, number, name, story, state, launch_instant, archived_at, edition_size, published_at, preorder_mode, preview_token';
const PRODUCT_COLUMNS =
	'id, drop_id, slug, name, summary, fabric, gsm, care, fit, fit_note, model_height_cm, model_worn_size, style_code, ' +
	'launch_price_paise, prelaunch_price_paise, status, position, hsn_code, gst_rate, size_chart';

const SOLD_STATES = ['paid', 'packed', 'dispatched', 'delivered'];

function fail(message: string, error: { message: string } | null): never {
	throw new Error(`${message}: ${error?.message ?? 'no data'}`);
}

/** Turns a database refusal raised with P0001 into a sentence for the screen. */
function friendly(error: { message: string; code?: string }): never {
	if (error.code === 'P0001' || /cannot go below|already reserved/.test(error.message)) {
		throw new CatalogueError(error.message.replace(/^ERROR:\s*/, ''));
	}
	throw new Error(error.message);
}

/* ------------------------------------------------------------------------ */
/* Reads                                                                     */
/* ------------------------------------------------------------------------ */

async function usage(
	variantIds: string[]
): Promise<{ sold: Map<string, number>; used: Set<string> }> {
	const sold = new Map<string, number>();
	const used = new Set<string>();
	if (variantIds.length === 0) return { sold, used };
	const client = getServiceClient();

	const [lines, reservations, carts] = await Promise.all([
		client
			.from('order_lines')
			.select('variant_id, quantity, order_id')
			.in('variant_id', variantIds),
		client.from('reservations').select('variant_id').in('variant_id', variantIds),
		client.from('cart_lines').select('variant_id').in('variant_id', variantIds)
	]);
	if (lines.error) fail('order lines read failed', lines.error);

	const lineRows = (lines.data ?? []) as {
		variant_id: string;
		quantity: number;
		order_id: string;
	}[];
	const orderIds = [...new Set(lineRows.map((l) => l.order_id))];
	const states = new Map<string, string>();
	if (orderIds.length) {
		const { data, error } = await client.from('orders').select('id, state').in('id', orderIds);
		if (error) fail('orders read failed', error);
		for (const o of (data ?? []) as { id: string; state: string }[]) states.set(o.id, o.state);
	}

	for (const line of lineRows) {
		used.add(line.variant_id);
		if (SOLD_STATES.includes(states.get(line.order_id) ?? '')) {
			sold.set(line.variant_id, (sold.get(line.variant_id) ?? 0) + line.quantity);
		}
	}
	for (const r of (reservations.data ?? []) as { variant_id: string }[]) used.add(r.variant_id);
	for (const c of (carts.data ?? []) as { variant_id: string }[]) used.add(c.variant_id);
	return { sold, used };
}

function toProduct(
	row: ProductRow,
	variants: VariantRow[],
	colourways: ColourwayRow[],
	images: ImageRow[],
	sold: Map<string, number>,
	used: Set<string>
): AdminProduct {
	const colours = colourways
		.filter((c) => c.product_id === row.id)
		.sort((a, b) => a.position - b.position)
		.map(({ id, name, code, swatch, position }) => ({ id, name, code, swatch, position }));
	const colourIndex = new Map(colours.map((c, i) => [c.id, i]));

	const vs = variants
		.filter((v) => v.product_id === row.id)
		.sort(
			(a, b) =>
				(colourIndex.get(a.colourway_id ?? '') ?? -1) -
					(colourIndex.get(b.colourway_id ?? '') ?? -1) || compareSizes(a.size, b.size)
		)
		.map((v) => ({
			id: v.id,
			sku: v.sku,
			size: v.size,
			colourwayId: v.colourway_id,
			stock: v.stock_count,
			reserveCap: v.reserve_cap,
			reserved: v.reserved_count,
			sold: sold.get(v.id) ?? 0,
			inUse: used.has(v.id)
		}));

	return {
		id: row.id,
		dropId: row.drop_id,
		slug: row.slug,
		name: row.name,
		summary: row.summary,
		fabric: row.fabric,
		gsm: row.gsm,
		care: row.care ?? [],
		fit: row.fit,
		fitNote: row.fit_note,
		modelHeightCm: row.model_height_cm,
		modelWornSize: row.model_worn_size,
		styleCode: row.style_code ?? 'TEE',
		launchPrice: paise(Number(row.launch_price_paise)),
		prelaunchPrice: paise(Number(row.prelaunch_price_paise)),
		status: row.status ?? 'active',
		position: row.position ?? 0,
		hsnCode: row.hsn_code ?? '6109',
		gstRate: Number(row.gst_rate ?? 5),
		sizeChart: (row.size_chart ?? []).map((r) => ({
			size: r.size,
			chestCm: Number(r.chest_cm),
			lengthCm: Number(r.length_cm)
		})),
		colourways: colours,
		variants: vs,
		images: images
			.filter((i) => i.product_id === row.id)
			.sort((a, b) => a.position - b.position)
			.map((i) => ({
				id: i.id,
				url: i.url,
				alt: i.alt,
				role: i.role,
				caption: i.caption ?? null,
				position: i.position,
				width: i.width ?? null,
				height: i.height ?? null,
				colourwayId: i.colourway_id ?? null
			})),
		sizes: [...new Set(vs.map((v) => v.size))].sort(compareSizes),
		totals: {
			stock: vs.reduce((n, v) => n + v.stock, 0),
			reserved: vs.reduce((n, v) => n + v.reserved, 0),
			sold: vs.reduce((n, v) => n + v.sold, 0)
		}
	};
}

async function loadDrops(filter: { slug?: string; id?: string }): Promise<AdminDrop[]> {
	const catalogue = getCatalogueClient();
	let query = catalogue.from('drops').select(DROP_COLUMNS).order('number', { ascending: false });
	if (filter.slug) query = query.eq('slug', filter.slug);
	if (filter.id) query = query.eq('id', filter.id);
	const { data: dropData, error: dropError } = await query;
	if (dropError) fail('drops read failed', dropError);
	const drops = (dropData ?? []) as DropRow[];
	if (drops.length === 0) return [];

	const { data: productData, error: productError } = await catalogue
		.from('products')
		.select(PRODUCT_COLUMNS)
		.in(
			'drop_id',
			drops.map((d) => d.id)
		)
		.order('position');
	if (productError) fail('products read failed', productError);
	const products = (productData ?? []) as unknown as ProductRow[];
	const productIds = products.map((p) => p.id);

	const [variants, colourways, images] = productIds.length
		? await Promise.all([
				catalogue
					.from('variants')
					.select(
						'id, product_id, sku, size, colourway_id, stock_count, reserve_cap, reserved_count'
					)
					.in('product_id', productIds),
				catalogue
					.from('colourways')
					.select('id, product_id, name, code, swatch, position')
					.in('product_id', productIds),
				catalogue.from('product_images').select('*').in('product_id', productIds)
			])
		: [{ data: [] }, { data: [] }, { data: [] }];

	const variantRows = (variants.data ?? []) as VariantRow[];
	const { sold, used } = await usage(variantRows.map((v) => v.id));

	return drops.map((drop) => {
		const ps = products
			.filter((p) => p.drop_id === drop.id)
			.map((p) =>
				toProduct(
					p,
					variantRows,
					(colourways.data ?? []) as ColourwayRow[],
					(images.data ?? []) as ImageRow[],
					sold,
					used
				)
			);
		return {
			id: drop.id,
			slug: drop.slug,
			number: drop.number,
			name: drop.name,
			story: drop.story,
			state: drop.state,
			launchInstant: Date.parse(drop.launch_instant),
			archivedAt: drop.archived_at ? Date.parse(drop.archived_at) : null,
			editionSize: drop.edition_size,
			published: drop.published_at !== null,
			preorderMode: drop.preorder_mode ?? false,
			previewToken: drop.preview_token,
			legalTransitions: legalTransitionsFrom(drop.state),
			products: ps,
			totals: {
				stock: ps.reduce((n, p) => n + p.totals.stock, 0),
				reserved: ps.reduce((n, p) => n + p.totals.reserved, 0),
				sold: ps.reduce((n, p) => n + p.totals.sold, 0)
			}
		};
	});
}

export function listDrops(): Promise<AdminDrop[]> {
	return loadDrops({});
}

export async function findDrop(slug: string): Promise<AdminDrop | null> {
	return (await loadDrops({ slug }))[0] ?? null;
}

export async function findDropById(id: string): Promise<AdminDrop | null> {
	return (await loadDrops({ id }))[0] ?? null;
}

export async function findProduct(
	dropSlug: string,
	productId: string
): Promise<{ drop: AdminDrop; product: AdminProduct } | null> {
	const drop = await findDrop(dropSlug);
	const product = drop?.products.find((p) => p.id === productId);
	return drop && product ? { drop, product } : null;
}

export async function listSizeOptions(): Promise<SizeOption[]> {
	const { data, error } = await getCatalogueClient()
		.from('sizes')
		.select('code, label, sort_order')
		.order('sort_order');
	if (error) fail('sizes read failed', error);
	return ((data ?? []) as { code: string; label: string; sort_order: number }[]).map((s) => ({
		code: s.code,
		label: s.label,
		sortOrder: s.sort_order
	}));
}

export type PricePoint = {
	readonly price: Paise;
	readonly kind: 'prelaunch' | 'launch';
	readonly at: number;
};

export async function priceHistory(productId: string): Promise<PricePoint[]> {
	const { data, error } = await getCatalogueClient()
		.from('price_history')
		.select('price_paise, kind, effective_from')
		.eq('product_id', productId)
		.order('effective_from', { ascending: false })
		.limit(20);
	if (error) fail('price history read failed', error);
	return (
		(data ?? []) as { price_paise: number; kind: 'prelaunch' | 'launch'; effective_from: string }[]
	).map((r) => ({
		price: paise(Number(r.price_paise)),
		kind: r.kind,
		at: Date.parse(r.effective_from)
	}));
}

export type StockMovement = {
	readonly id: string;
	readonly variantId: string;
	readonly delta: number;
	readonly stockAfter: number;
	readonly reason: string;
	readonly note: string | null;
	readonly actor: string | null;
	readonly at: number;
};

export async function stockMovements(
	variantIds: readonly string[],
	limit = 50
): Promise<StockMovement[]> {
	if (variantIds.length === 0) return [];
	const { data, error } = await getServiceClient()
		.from('stock_movements')
		.select('id, variant_id, delta, stock_after, reason, note, actor, created_at')
		.in('variant_id', [...variantIds])
		.order('created_at', { ascending: false })
		.limit(limit);
	if (error) fail('stock movements read failed', error);
	return (
		(data ?? []) as {
			id: string;
			variant_id: string;
			delta: number;
			stock_after: number;
			reason: string;
			note: string | null;
			actor: string | null;
			created_at: string;
		}[]
	).map((r) => ({
		id: r.id,
		variantId: r.variant_id,
		delta: r.delta,
		stockAfter: r.stock_after,
		reason: r.reason,
		note: r.note,
		actor: r.actor,
		at: Date.parse(r.created_at)
	}));
}

/* ------------------------------------------------------------------------ */
/* Drops                                                                     */
/* ------------------------------------------------------------------------ */

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

export async function nextDropNumber(): Promise<number> {
	const { data, error } = await getCatalogueClient()
		.from('drops')
		.select('number')
		.order('number', { ascending: false })
		.limit(1);
	if (error) fail('drops read failed', error);
	return (((data ?? [])[0] as { number: number } | undefined)?.number ?? 0) + 1;
}

export async function createDrop(input: {
	number: number;
	name: string;
	story: string;
	launchInstant: number;
	editionSize: number;
	preorderMode: boolean;
	actor: string;
}): Promise<{ id: string; slug: string }> {
	if (!Number.isInteger(input.number) || input.number < 1 || input.number > 99) {
		throw new CatalogueError('The drop number must be between 1 and 99.');
	}
	const id = `drop-${String(input.number).padStart(2, '0')}`;
	const slug = `${String(input.number).padStart(2, '0')}-${slugify(input.name)}`;

	const { error } = await getCatalogueClient()
		.from('drops')
		.insert({
			id,
			slug,
			number: input.number,
			name: input.name,
			story: input.story,
			state: 'TEASE',
			launch_instant: new Date(input.launchInstant).toISOString(),
			edition_size: input.editionSize,
			preorder_mode: input.preorderMode
		});
	if (error) {
		if (error.code === '23505')
			throw new CatalogueError(`Drop ${input.number} already exists. Pick the next number.`);
		fail('drop create failed', error);
	}
	await writeAudit(input.actor, 'drop created', 'drop', id, {
		number: input.number,
		name: input.name
	});
	return { id, slug };
}

export async function updateDropDetails(input: {
	dropId: string;
	name: string;
	story: string;
	editionSize: number;
	actor: string;
}): Promise<void> {
	if (!input.name.trim()) throw new CatalogueError('Give the drop a name.');
	if (!Number.isInteger(input.editionSize) || input.editionSize < 1) {
		throw new CatalogueError('The edition size must be a whole number of pieces, 1 or more.');
	}
	const drop = await findDropById(input.dropId);
	if (!drop) throw new CatalogueError('That drop no longer exists.');
	// Piece numbers already handed out must still fit inside the edition.
	if (input.editionSize < drop.totals.reserved + drop.totals.sold) {
		throw new CatalogueError(
			`${drop.totals.reserved + drop.totals.sold} pieces are already claimed, so the edition cannot be smaller than that.`
		);
	}
	const { error } = await getCatalogueClient()
		.from('drops')
		.update({ name: input.name.trim(), story: input.story, edition_size: input.editionSize })
		.eq('id', input.dropId);
	if (error) fail('drop update failed', error);
	await writeAudit(input.actor, 'drop details edited', 'drop', input.dropId, {
		name: input.name,
		editionSize: input.editionSize
	});
}

/** The secret preview link for an unpublished drop. Rotating it kills the old link. */
export async function rotatePreviewToken(dropId: string, actor: string): Promise<string> {
	const bytes = crypto.getRandomValues(new Uint8Array(18));
	const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
	const { error } = await getCatalogueClient()
		.from('drops')
		.update({ preview_token: token })
		.eq('id', dropId);
	if (error) fail('preview token write failed', error);
	await writeAudit(actor, 'preview link created', 'drop', dropId);
	return token;
}

/* ------------------------------------------------------------------------ */
/* Products                                                                  */
/* ------------------------------------------------------------------------ */

export type ProductInput = {
	name: string;
	summary: string;
	fabric: string;
	gsm: number;
	care: string[];
	fit: string;
	fitNote: string | null;
	modelHeightCm: number | null;
	modelWornSize: string | null;
	styleCode: string;
	launchPrice: number;
	prelaunchPrice: number;
	hsnCode: string;
	gstRate: number;
};

function validateProduct(input: ProductInput): void {
	if (!input.name.trim()) throw new CatalogueError('Give the product a name.');
	if (!input.fabric.trim())
		throw new CatalogueError('Say what the fabric is, e.g. 30% hemp / 70% cotton.');
	if (!Number.isInteger(input.gsm) || input.gsm <= 0)
		throw new CatalogueError('GSM must be a whole number above 0.');
	if (!/^[A-Z]{2,5}$/.test(input.styleCode)) {
		throw new CatalogueError(
			'The style code is 2–5 capital letters, like TEE or HOOD. It goes in the SKU.'
		);
	}
	if (!Number.isInteger(input.launchPrice) || input.launchPrice <= 0) {
		throw new CatalogueError('Enter the launch price in rupees.');
	}
	if (!Number.isInteger(input.prelaunchPrice) || input.prelaunchPrice <= 0) {
		throw new CatalogueError(
			'Enter the pre-launch price in rupees. Use the launch price if there is no discount.'
		);
	}
	if (input.prelaunchPrice > input.launchPrice) {
		throw new CatalogueError('The pre-launch price cannot be higher than the launch price.');
	}
	if (!/^\d{4,8}$/.test(input.hsnCode))
		throw new CatalogueError('The HSN code is 4 to 8 digits, e.g. 6109.');
	if (!(input.gstRate >= 0 && input.gstRate <= 28))
		throw new CatalogueError('GST rate must be between 0 and 28%.');
	if (input.modelWornSize && !isSize(input.modelWornSize))
		throw new CatalogueError('Pick the size the model wears.');
}

function productRow(input: ProductInput) {
	return {
		name: input.name.trim(),
		summary: input.summary.trim(),
		fabric: input.fabric.trim(),
		gsm: input.gsm,
		care: input.care.map((c) => c.trim()).filter(Boolean),
		fit: input.fit.trim(),
		fit_note: input.fitNote?.trim() || null,
		model_height_cm: input.modelHeightCm,
		model_worn_size: input.modelWornSize,
		style_code: input.styleCode,
		launch_price_paise: input.launchPrice,
		prelaunch_price_paise: input.prelaunchPrice,
		hsn_code: input.hsnCode,
		gst_rate: input.gstRate
	};
}

/** IDs follow Drop 01's pattern: product-01-tee, variant-01-tee-m. */
function idPart(text: string): string {
	return slugify(text).replace(/-/g, '');
}

export async function createProduct(input: {
	dropId: string;
	product: ProductInput;
	sizes: string[];
	colourways: { name: string; code: string; swatch: string | null }[];
	actor: string;
}): Promise<string> {
	validateProduct(input.product);
	if (input.sizes.length === 0) throw new CatalogueError('Pick at least one size.');

	const drop = await findDropById(input.dropId);
	if (!drop) throw new CatalogueError('That drop no longer exists.');

	const nn = String(drop.number).padStart(2, '0');
	const slug = slugify(input.product.name.replace(drop.name, '')) || slugify(input.product.name);
	if (drop.products.some((p) => p.slug === slug)) {
		throw new CatalogueError(`This drop already has a product at /${slug}. Use a different name.`);
	}
	const id = `product-${nn}-${idPart(slug)}`;

	const catalogue = getCatalogueClient();
	const { error } = await catalogue.from('products').insert({
		id,
		drop_id: drop.id,
		slug,
		...productRow(input.product),
		status: 'draft',
		position: drop.products.length
	});
	if (error) {
		if (error.code === '23505')
			throw new CatalogueError('A product with that name already exists in this drop.');
		fail('product create failed', error);
	}

	await catalogue.from('price_history').insert([
		{ product_id: id, price_paise: input.product.prelaunchPrice, kind: 'prelaunch' },
		{ product_id: id, price_paise: input.product.launchPrice, kind: 'launch' }
	]);

	for (const [index, colour] of input.colourways.entries()) {
		await addColourway({
			productId: id,
			...colour,
			position: index,
			actor: input.actor,
			audit: false
		});
	}
	await setSizes({ productId: id, sizes: input.sizes, actor: input.actor, audit: false });

	await writeAudit(input.actor, 'product created', 'product', id, {
		name: input.product.name,
		sizes: input.sizes,
		colourways: input.colourways.map((c) => c.name)
	});
	return id;
}

async function productById(productId: string): Promise<AdminProduct> {
	const { data, error } = await getCatalogueClient()
		.from('products')
		.select('drop_id')
		.eq('id', productId)
		.maybeSingle();
	if (error) fail('product read failed', error);
	if (!data) throw new CatalogueError('That product no longer exists.');
	const drop = await findDropById((data as { drop_id: string }).drop_id);
	const product = drop?.products.find((p) => p.id === productId);
	if (!product) throw new CatalogueError('That product no longer exists.');
	return product;
}

async function dropNumberOf(dropId: string): Promise<number> {
	const { data, error } = await getCatalogueClient()
		.from('drops')
		.select('number')
		.eq('id', dropId)
		.single();
	if (error || !data) fail('drop read failed', error);
	return (data as { number: number }).number;
}

export async function updateProduct(input: {
	productId: string;
	product: ProductInput;
	actor: string;
}): Promise<void> {
	validateProduct(input.product);
	const before = await productById(input.productId);

	const catalogue = getCatalogueClient();
	const { error } = await catalogue
		.from('products')
		.update(productRow(input.product))
		.eq('id', input.productId);
	if (error) fail('product update failed', error);

	// §10: prices are history, not just a current value.
	const changes: { product_id: string; price_paise: number; kind: string }[] = [];
	if (input.product.launchPrice !== Number(before.launchPrice)) {
		changes.push({
			product_id: input.productId,
			price_paise: input.product.launchPrice,
			kind: 'launch'
		});
	}
	if (input.product.prelaunchPrice !== Number(before.prelaunchPrice)) {
		changes.push({
			product_id: input.productId,
			price_paise: input.product.prelaunchPrice,
			kind: 'prelaunch'
		});
	}
	if (changes.length) await catalogue.from('price_history').insert(changes);

	// A new style code re-cuts the SKUs of variants nobody has bought yet.
	if (input.product.styleCode !== before.styleCode) {
		await recutSkus(input.productId);
	}

	await writeAudit(input.actor, 'product edited', 'product', input.productId, {
		name: input.product.name,
		...(changes.length
			? {
					prices: {
						before: { launch: before.launchPrice, prelaunch: before.prelaunchPrice },
						after: { launch: input.product.launchPrice, prelaunch: input.product.prelaunchPrice }
					}
				}
			: {})
	});
}

export async function setProductStatus(input: {
	productId: string;
	status: ProductStatus;
	actor: string;
}): Promise<void> {
	const product = await productById(input.productId);
	if (input.status === 'active') {
		if (product.variants.length === 0)
			throw new CatalogueError('Add at least one size before making it live.');
		if (product.images.length === 0)
			throw new CatalogueError('Add at least one photo before making it live.');
	}
	const { error } = await getCatalogueClient()
		.from('products')
		.update({ status: input.status })
		.eq('id', input.productId);
	if (error) fail('product status failed', error);
	await writeAudit(
		input.actor,
		`product ${input.status === 'active' ? 'made live' : input.status === 'draft' ? 'moved to draft' : 'archived'}`,
		'product',
		input.productId
	);
}

export async function moveProduct(input: {
	productId: string;
	direction: -1 | 1;
	actor: string;
}): Promise<void> {
	const product = await productById(input.productId);
	const drop = await findDropById(product.dropId);
	if (!drop) return;
	const order = [...drop.products];
	const index = order.findIndex((p) => p.id === input.productId);
	const target = index + input.direction;
	if (target < 0 || target >= order.length) return;
	[order[index], order[target]] = [order[target], order[index]];
	const catalogue = getCatalogueClient();
	await Promise.all(
		order.map((p, i) => catalogue.from('products').update({ position: i }).eq('id', p.id))
	);
}

/* ------------------------------------------------------------------------ */
/* Colourways and sizes                                                      */
/* ------------------------------------------------------------------------ */

async function recutSkus(productId: string): Promise<void> {
	const product = await productById(productId);
	const number = await dropNumberOf(product.dropId);
	const catalogue = getCatalogueClient();
	for (const v of product.variants) {
		if (v.inUse) continue;
		const colour = product.colourways.find((c) => c.id === v.colourwayId)?.code ?? null;
		const sku = buildSku(number, product.styleCode, v.size, colour);
		if (sku !== v.sku) await catalogue.from('variants').update({ sku }).eq('id', v.id);
	}
}

export async function addColourway(input: {
	productId: string;
	name: string;
	code: string;
	swatch: string | null;
	position?: number;
	actor: string;
	audit?: boolean;
}): Promise<void> {
	const name = input.name.trim();
	const code = input.code.trim().toUpperCase();
	if (!name) throw new CatalogueError('Name the colour, e.g. Forest.');
	if (!/^[A-Z]{2,4}$/.test(code))
		throw new CatalogueError('The colour code is 2–4 letters, e.g. FOR. It goes in the SKU.');
	if (input.swatch && !/^#[0-9a-fA-F]{6}$/.test(input.swatch))
		throw new CatalogueError('Pick a swatch colour.');

	const product = await productById(input.productId);
	if (product.colourways.some((c) => c.code === code))
		throw new CatalogueError(`${code} is already used by another colour.`);

	const catalogue = getCatalogueClient();
	const id = `colour-${idPart(product.id.replace(/^product-/, ''))}-${code.toLowerCase()}`;
	const { error } = await catalogue.from('colourways').insert({
		id,
		product_id: input.productId,
		name,
		code,
		swatch: input.swatch,
		position: input.position ?? product.colourways.length
	});
	if (error) fail('colour create failed', error);

	// The first colour adopts the existing colourless variants, so a product
	// that gains colours keeps its stock rather than starting again at zero.
	if (product.colourways.length === 0 && product.variants.some((v) => v.colourwayId === null)) {
		await catalogue
			.from('variants')
			.update({ colourway_id: id })
			.eq('product_id', input.productId)
			.is('colourway_id', null);
		await recutSkus(input.productId);
	} else if (product.sizes.length) {
		await createVariants(input.productId, [id], product.sizes);
	}

	if (input.audit !== false) {
		await writeAudit(input.actor, 'colour added', 'product', input.productId, { name, code });
	}
}

export async function updateColourway(input: {
	colourwayId: string;
	name: string;
	swatch: string | null;
	actor: string;
}): Promise<void> {
	if (!input.name.trim()) throw new CatalogueError('Name the colour.');
	if (input.swatch && !/^#[0-9a-fA-F]{6}$/.test(input.swatch))
		throw new CatalogueError('Pick a swatch colour.');
	const { error } = await getCatalogueClient()
		.from('colourways')
		.update({ name: input.name.trim(), swatch: input.swatch })
		.eq('id', input.colourwayId);
	if (error) fail('colour update failed', error);
	await writeAudit(input.actor, 'colour edited', 'colourway', input.colourwayId, {
		name: input.name
	});
}

export async function removeColourway(input: {
	colourwayId: string;
	actor: string;
}): Promise<void> {
	const catalogue = getCatalogueClient();
	const { data } = await catalogue
		.from('colourways')
		.select('product_id, name')
		.eq('id', input.colourwayId)
		.maybeSingle();
	if (!data) return;
	const { product_id: productId, name } = data as { product_id: string; name: string };
	const product = await productById(productId);
	const variants = product.variants.filter((v) => v.colourwayId === input.colourwayId);
	if (variants.some((v) => v.inUse)) {
		throw new CatalogueError(
			`${name} has been ordered, reserved or is in a cart, so it cannot be removed. Set its stock to 0 instead.`
		);
	}
	if (variants.length) {
		const { error } = await catalogue
			.from('variants')
			.delete()
			.in(
				'id',
				variants.map((v) => v.id)
			);
		if (error) fail('variant delete failed', error);
	}
	await catalogue.from('colourways').delete().eq('id', input.colourwayId);
	await writeAudit(input.actor, 'colour removed', 'product', productId, { name });
}

async function createVariants(
	productId: string,
	colourIds: readonly (string | null)[],
	sizes: readonly string[]
): Promise<void> {
	const product = await productById(productId);
	const number = await dropNumberOf(product.dropId);
	const existing = new Set(product.variants.map((v) => `${v.colourwayId ?? ''}|${v.size}`));
	const base = product.id.replace(/^product-/, 'variant-');

	const rows = colourIds.flatMap((colourId) => {
		const colour = product.colourways.find((c) => c.id === colourId) ?? null;
		return sizes
			.filter((size) => !existing.has(`${colourId ?? ''}|${size}`))
			.map((size) => ({
				id: [base, colour?.code.toLowerCase(), size.toLowerCase()].filter(Boolean).join('-'),
				product_id: productId,
				sku: buildSku(number, product.styleCode, size, colour?.code ?? null),
				size,
				colourway_id: colourId,
				stock_count: 0,
				reserve_cap: 0
			}));
	});
	if (rows.length === 0) return;
	const { error } = await getCatalogueClient().from('variants').insert(rows);
	if (error) {
		if (error.code === '23505')
			throw new CatalogueError(
				'One of those SKUs already exists. Check the style and colour codes.'
			);
		fail('variant create failed', error);
	}
}

/**
 * Makes the product's size run exactly `sizes`: adds variants for new sizes
 * (in every colour), removes those for dropped sizes that nobody has bought,
 * reserved or carted. A size that is in use stays, and the call says so.
 */
export async function setSizes(input: {
	productId: string;
	sizes: string[];
	actor: string;
	audit?: boolean;
}): Promise<{ kept: string[] }> {
	const sizes = [...new Set(input.sizes)].filter(isSize).sort(compareSizes);
	if (sizes.length === 0) throw new CatalogueError('Pick at least one size.');

	const product = await productById(input.productId);
	const colourIds: (string | null)[] = product.colourways.length
		? product.colourways.map((c) => c.id)
		: [null];
	await createVariants(input.productId, colourIds, sizes);

	const dropped = product.variants.filter((v) => !sizes.includes(v.size));
	const removable = dropped.filter((v) => !v.inUse);
	const kept = [...new Set(dropped.filter((v) => v.inUse).map((v) => v.size))];
	if (removable.length) {
		const { error } = await getCatalogueClient()
			.from('variants')
			.delete()
			.in(
				'id',
				removable.map((v) => v.id)
			);
		if (error) fail('variant delete failed', error);
	}

	if (input.audit !== false) {
		await writeAudit(input.actor, 'sizes changed', 'product', input.productId, {
			before: product.sizes,
			after: sizes,
			...(kept.length ? { keptBecauseInUse: kept } : {})
		});
	}
	return { kept };
}

export async function setSizeChart(input: {
	productId: string;
	rows: SizeChartEntry[];
	actor: string;
}): Promise<void> {
	for (const row of input.rows) {
		if (!(row.chestCm > 0 && row.chestCm < 300) || !(row.lengthCm > 0 && row.lengthCm < 300)) {
			throw new CatalogueError(`Enter chest and length in centimetres for ${row.size}.`);
		}
	}
	const { error } = await getCatalogueClient()
		.from('products')
		.update({
			size_chart: input.rows.map((r) => ({
				size: r.size,
				chest_cm: r.chestCm,
				length_cm: r.lengthCm
			}))
		})
		.eq('id', input.productId);
	if (error) fail('size chart write failed', error);
	await writeAudit(input.actor, 'size chart edited', 'product', input.productId);
}

export async function addSizeOption(input: {
	code: string;
	label: string;
	actor: string;
}): Promise<string> {
	const code = input.code.trim().toUpperCase();
	if (!isSize(code))
		throw new CatalogueError('A size code is 1–5 capital letters or digits, e.g. 6XL or 32.');
	const sizes = await listSizeOptions();
	if (sizes.some((s) => s.code === code)) return code;
	const { error } = await getCatalogueClient()
		.from('sizes')
		.insert({
			code,
			label: input.label.trim() || code,
			sort_order: (sizes.at(-1)?.sortOrder ?? 0) + 10
		});
	if (error) fail('size create failed', error);
	await writeAudit(input.actor, 'size added', 'size', code);
	return code;
}

/* ------------------------------------------------------------------------ */
/* Stock                                                                     */
/* ------------------------------------------------------------------------ */

export const STOCK_REASONS = [
	{ value: 'restock', label: 'Restock', sign: 1 },
	{ value: 'initial', label: 'First count', sign: 1 },
	{ value: 'returned', label: 'Returned to stock', sign: 1 },
	{ value: 'correction', label: 'Count correction', sign: 0 },
	{ value: 'damaged', label: 'Damaged', sign: -1 },
	{ value: 'sample', label: 'Sample or photoshoot', sign: -1 },
	{ value: 'gifted', label: 'Gifted', sign: -1 }
] as const;

export type StockReason = (typeof STOCK_REASONS)[number]['value'];

/**
 * Sets a variant's stock to an exact count, recording the difference as a
 * movement with its reason. Goes through app.adjust_stock so it is atomic
 * with any sale committing at the same moment.
 */
export async function setStock(input: {
	variantId: string;
	count: number;
	reason: StockReason;
	note: string | null;
	actor: string;
}): Promise<void> {
	if (!Number.isInteger(input.count) || input.count < 0)
		throw new CatalogueError('Stock is a whole number, 0 or more.');
	const { data, error } = await getCatalogueClient()
		.from('variants')
		.select('stock_count')
		.eq('id', input.variantId)
		.single();
	if (error || !data) fail('variant read failed', error);
	const delta = input.count - (data as { stock_count: number }).stock_count;
	if (delta === 0) return;

	const { error: rpcError } = await getServiceClient().rpc('adjust_stock', {
		p_variant_id: input.variantId,
		p_delta: delta,
		p_reason: input.reason,
		p_note: input.note,
		p_actor: input.actor
	});
	if (rpcError) friendly(rpcError);
	await writeAudit(
		input.actor,
		`stock ${delta > 0 ? '+' : ''}${delta} (${input.reason})`,
		'variant',
		input.variantId,
		{
			count: input.count,
			note: input.note
		}
	);
}

/** §08: the cap on tease reservations for one size. Never below what is already reserved. */
export async function setReserveCap(input: {
	variantId: string;
	cap: number;
	actor: string;
}): Promise<void> {
	if (!Number.isInteger(input.cap) || input.cap < 0)
		throw new CatalogueError('The reservation cap is a whole number, 0 or more.');
	const { data, error } = await getCatalogueClient()
		.from('variants')
		.select('stock_count, reserved_count, reserve_cap')
		.eq('id', input.variantId)
		.single();
	if (error || !data) fail('variant read failed', error);
	const v = data as { stock_count: number; reserved_count: number; reserve_cap: number };
	if (input.cap === v.reserve_cap) return;
	if (input.cap < v.reserved_count) {
		throw new CatalogueError(
			`${v.reserved_count} are already reserved, so the cap cannot be lower than that.`
		);
	}
	if (input.cap > v.stock_count) {
		throw new CatalogueError(`The cap cannot be more than the ${v.stock_count} in stock.`);
	}
	const { error: updateError } = await getCatalogueClient()
		.from('variants')
		.update({ reserve_cap: input.cap })
		.eq('id', input.variantId);
	if (updateError) fail('cap update failed', updateError);
	await writeAudit(input.actor, 'reservation cap changed', 'variant', input.variantId, {
		before: v.reserve_cap,
		after: input.cap
	});
}

/* ------------------------------------------------------------------------ */
/* Images                                                                    */
/* ------------------------------------------------------------------------ */

const BUCKET = 'catalogue';
const IMAGE_TYPES: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/avif': 'avif'
};
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Width and height from the file header, so the shop can hold the frame's shape. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	// PNG: IHDR at byte 16.
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length > 24) {
		return { width: view.getUint32(16), height: view.getUint32(20) };
	}
	// JPEG: walk the segments to the first start-of-frame.
	if (bytes[0] === 0xff && bytes[1] === 0xd8) {
		let offset = 2;
		while (offset + 9 < bytes.length) {
			if (bytes[offset] !== 0xff) return null;
			const marker = bytes[offset + 1];
			const length = view.getUint16(offset + 2);
			if (
				marker >= 0xc0 &&
				marker <= 0xcf &&
				marker !== 0xc4 &&
				marker !== 0xc8 &&
				marker !== 0xcc
			) {
				return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
			}
			offset += 2 + length;
		}
		return null;
	}
	// WebP: RIFF....WEBP, then VP8 / VP8L / VP8X.
	if (bytes.length > 30 && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') {
		const chunk = String.fromCharCode(...bytes.slice(12, 16));
		if (chunk === 'VP8X') {
			const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
			const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
			return { width: w, height: h };
		}
		if (chunk === 'VP8 ')
			return {
				width: view.getUint16(26, true) & 0x3fff,
				height: view.getUint16(28, true) & 0x3fff
			};
		if (chunk === 'VP8L') {
			const b = bytes.slice(21, 25);
			return {
				width: 1 + (((b[1] & 0x3f) << 8) | b[0]),
				height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6))
			};
		}
	}
	return null;
}

export async function uploadImage(input: {
	productId: string;
	file: File;
	alt: string;
	role: AdminImage['role'];
	colourwayId: string | null;
	actor: string;
}): Promise<void> {
	const extension = IMAGE_TYPES[input.file.type];
	if (!extension) throw new CatalogueError('Upload a JPG, PNG, WebP or AVIF photo.');
	if (input.file.size > MAX_IMAGE_BYTES)
		throw new CatalogueError('That photo is over 10 MB. Export it smaller and try again.');
	if (!input.alt.trim())
		throw new CatalogueError(
			'Describe the photo for people who cannot see it, e.g. “Back of the tee, worn”.'
		);

	const product = await productById(input.productId);
	const bytes = new Uint8Array(await input.file.arrayBuffer());
	const size = imageSize(bytes);
	const path = `${product.dropId}/${product.id}/${crypto.randomUUID()}.${extension}`;

	const storage = getCatalogueClient().storage;
	let upload = await storage
		.from(BUCKET)
		.upload(path, bytes, { contentType: input.file.type, upsert: false });
	if (upload.error && /bucket not found/i.test(upload.error.message)) {
		await storage.createBucket(BUCKET, { public: true });
		upload = await storage
			.from(BUCKET)
			.upload(path, bytes, { contentType: input.file.type, upsert: false });
	}
	if (upload.error) throw new Error(`upload failed: ${upload.error.message}`);
	const url = storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

	const { error } = await getCatalogueClient()
		.from('product_images')
		.insert({
			product_id: input.productId,
			url,
			alt: input.alt.trim(),
			role: input.role,
			position: product.images.length,
			width: size?.width ?? null,
			height: size?.height ?? null,
			colourway_id: input.colourwayId
		});
	if (error) fail('image record failed', error);
	await writeAudit(input.actor, 'photo added', 'product', input.productId, { role: input.role });
}

export async function updateImage(input: {
	imageId: string;
	alt: string;
	role: AdminImage['role'];
	caption: string | null;
	colourwayId: string | null;
	actor: string;
}): Promise<void> {
	if (!input.alt.trim())
		throw new CatalogueError('Describe the photo for people who cannot see it.');
	const { error } = await getCatalogueClient()
		.from('product_images')
		.update({
			alt: input.alt.trim(),
			role: input.role,
			caption: input.caption?.trim() || null,
			colourway_id: input.colourwayId
		})
		.eq('id', input.imageId);
	if (error) fail('image update failed', error);
}

export async function moveImage(input: {
	productId: string;
	imageId: string;
	direction: -1 | 1;
}): Promise<void> {
	const product = await productById(input.productId);
	const order = [...product.images];
	const index = order.findIndex((i) => i.id === input.imageId);
	const target = index + input.direction;
	if (index < 0 || target < 0 || target >= order.length) return;
	[order[index], order[target]] = [order[target], order[index]];
	const catalogue = getCatalogueClient();
	await Promise.all(
		order.map((image, i) =>
			catalogue.from('product_images').update({ position: i }).eq('id', image.id)
		)
	);
}

export async function deleteImage(input: {
	imageId: string;
	actor: string;
}): Promise<AdminImage | null> {
	const catalogue = getCatalogueClient();
	const { data } = await catalogue
		.from('product_images')
		.select('*')
		.eq('id', input.imageId)
		.maybeSingle();
	if (!data) return null;
	const row = data as ImageRow;
	await catalogue.from('product_images').delete().eq('id', input.imageId);
	await writeAudit(input.actor, 'photo removed', 'product', row.product_id, { url: row.url });
	// The file stays in storage, so Undo can put the record straight back.
	return {
		id: row.id,
		url: row.url,
		alt: row.alt,
		role: row.role,
		caption: row.caption,
		position: row.position,
		width: row.width,
		height: row.height,
		colourwayId: row.colourway_id
	};
}

/** Undo for deleteImage: the file was never removed, so the record goes back as it was. */
export async function restoreImage(input: {
	productId: string;
	image: Omit<AdminImage, 'id'>;
	actor: string;
}): Promise<void> {
	const { error } = await getCatalogueClient().from('product_images').insert({
		product_id: input.productId,
		url: input.image.url,
		alt: input.image.alt,
		role: input.image.role,
		caption: input.image.caption,
		position: input.image.position,
		width: input.image.width,
		height: input.image.height,
		colourway_id: input.image.colourwayId
	});
	if (error) fail('image restore failed', error);
	await writeAudit(input.actor, 'photo restored', 'product', input.productId);
}

/* ------------------------------------------------------------------------ */
/* History                                                                   */
/* ------------------------------------------------------------------------ */

export type StateEvent = {
	readonly from: DropState | null;
	readonly to: DropState;
	readonly trigger: 'schedule' | 'manual' | 'system';
	readonly actor: string | null;
	readonly at: number;
};

/** §06: every state change, including the ones the schedule made on its own. */
export async function dropStateEvents(dropId: string): Promise<StateEvent[]> {
	const { data, error } = await getCatalogueClient()
		.from('drop_state_events')
		.select('from_state, to_state, trigger, actor, occurred_at')
		.eq('drop_id', dropId)
		.order('occurred_at', { ascending: false })
		.limit(30);
	if (error) fail('state events read failed', error);
	return (
		(data ?? []) as {
			from_state: DropState | null;
			to_state: DropState;
			trigger: StateEvent['trigger'];
			actor: string | null;
			occurred_at: string;
		}[]
	).map((r) => ({
		from: r.from_state,
		to: r.to_state,
		trigger: r.trigger,
		actor: r.actor,
		at: Date.parse(r.occurred_at)
	}));
}
