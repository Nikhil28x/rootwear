/**
 * RW-046 — Postgres-backed DropRepository.
 *
 * Implements exactly the interface the mock implements, so switching between
 * them is one environment variable and no other code change (see ./index.ts).
 *
 * Reads go through the catalogue client. RLS on public.drops restricts anon
 * reads to published rows; this client uses the service role because the
 * storefront must also resolve a drop during TEASE, before publication, for
 * the admin preview path. The published_at gate is therefore applied
 * explicitly below rather than relied upon implicitly.
 */
import type { DropRepository } from './repository';
import type { Drop, Product, Variant, ProductImage } from '$lib/domain/drop';
import type { DropState } from '$lib/domain/drop-state';
import type { Size } from '$lib/drop/sizes';
import { paise } from '$lib/money';
import { getCatalogueClient } from '$lib/server/db/clients';

/** Shape returned by the nested select below. */
type Row = {
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
	products: Array<{
		id: string;
		drop_id: string;
		slug: string;
		name: string;
		summary: string;
		fabric: string;
		gsm: number;
		care: string[];
		fit: string;
		model_height_cm: number | null;
		model_worn_size: Size | null;
		launch_price_paise: number;
		prelaunch_price_paise: number;
		product_images: Array<{ url: string; alt: string; role: ProductImage['role']; position: number }>;
		variants: Array<{
			id: string;
			product_id: string;
			sku: string;
			size: Size;
			stock_count: number;
			reserved_count: number;
		}>;
	}>;
};

const SELECT = `
	id, slug, number, name, story, state, launch_instant, archived_at,
	edition_size, published_at,
	products (
		id, drop_id, slug, name, summary, fabric, gsm, care, fit,
		model_height_cm, model_worn_size, launch_price_paise, prelaunch_price_paise,
		product_images ( url, alt, role, position ),
		variants ( id, product_id, sku, size, stock_count, reserved_count )
	)
`;

function toDomain(row: Row): Drop {
	const products: Product[] = row.products.map((p) => {
		const images: ProductImage[] = [...p.product_images]
			.sort((a, b) => a.position - b.position)
			.map(({ url, alt, role }) => ({ url, alt, role }));

		const variants: Variant[] = p.variants.map((v) => ({
			id: v.id,
			productId: v.product_id,
			sku: v.sku,
			size: v.size,
			stockCount: v.stock_count,
			reservedCount: v.reserved_count
		}));

		return {
			id: p.id,
			dropId: p.drop_id,
			slug: p.slug,
			name: p.name,
			summary: p.summary,
			fabric: p.fabric,
			gsm: p.gsm,
			care: p.care,
			fit: p.fit,
			modelHeightCm: p.model_height_cm ?? 0,
			modelWornSize: (p.model_worn_size ?? 'M') as Size,
			images,
			variants,
			// bigint paise arrives as a number; re-brand it through the money module.
			launchPrice: paise(Number(p.launch_price_paise)),
			prelaunchPrice: paise(Number(p.prelaunch_price_paise))
		};
	});

	return {
		id: row.id,
		slug: row.slug,
		number: row.number,
		name: row.name,
		story: row.story,
		state: row.state,
		launchInstant: Date.parse(row.launch_instant),
		archivedAt: row.archived_at ? Date.parse(row.archived_at) : null,
		editionSize: row.edition_size,
		products
	};
}

export const supabaseDropRepository: DropRepository = {
	async listDrops() {
		const { data, error } = await getCatalogueClient()
			.from('drops')
			.select(SELECT)
			.not('published_at', 'is', null)
			// §06: the archive is chronological, newest first.
			.order('launch_instant', { ascending: false });

		if (error) throw new Error(`listDrops failed: ${error.message}`);
		return (data as unknown as Row[]).map(toDomain);
	},

	async findBySlug(slug: string) {
		const { data, error } = await getCatalogueClient()
			.from('drops')
			.select(SELECT)
			.eq('slug', slug)
			.maybeSingle();

		if (error) throw new Error(`findBySlug failed: ${error.message}`);
		return data ? toDomain(data as unknown as Row) : null;
	},

	async findLiveDrop() {
		// §06: the model permits two live drops; the storefront resolves one.
		const { data, error } = await getCatalogueClient()
			.from('drops')
			.select(SELECT)
			.in('state', ['TEASE', 'REVEALED', 'LIVE', 'PARTIAL', 'RE_DROP'])
			.order('launch_instant', { ascending: false })
			.limit(1)
			.maybeSingle();

		if (error) throw new Error(`findLiveDrop failed: ${error.message}`);
		return data ? toDomain(data as unknown as Row) : null;
	}
};
