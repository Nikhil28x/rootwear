/**
 * RW-046 — The one place the catalogue data source is chosen.
 *
 * CATALOGUE_SOURCE=supabase reads from Postgres; anything else (the default)
 * uses the in-repo fixtures, so the app runs with no database configured.
 * No route or component changes between the two.
 */
import type { Drop } from '$lib/domain/drop';
import type { DropRepository } from './repository';
import { mockDropRepository } from './mock-repository';
import { supabaseDropRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';
import { serverNow } from '$lib/server/clock';
import { withResolvedState } from '$lib/domain/publish';

function selectRepository(): DropRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabaseDropRepository;
	}
	return mockDropRepository;
}

/**
 * Resolved per call so the switch works without a restart in dev.
 *
 * Every read passes through withResolvedState (RW-041), so a drop whose launch
 * instant has passed presents as LIVE even if the scheduled job that writes
 * that state has not run. Applied HERE, at the one choke point, rather than at
 * each of the two dozen call sites that read drop.state — which is how the
 * storefront and the cart would otherwise drift into disagreeing about whether
 * a drop is open.
 *
 * Admin deliberately does NOT go through this: it has its own repository and
 * must show the STORED state, so an operator can see what is actually written
 * rather than what the clock is currently presenting.
 */
export const drops: DropRepository & {
	listStorefrontDrops(): Promise<Drop[]>;
} = {
	listDrops: async () => {
		const now = serverNow();
		return (await selectRepository().listDrops()).map((drop) => withResolvedState(drop, now));
	},
	findBySlug: async (slug) => {
		const drop = await selectRepository().findBySlug(slug);
		return drop ? withResolvedState(drop, serverNow()) : null;
	},
	findLiveDrop: async () => {
		const drop = await selectRepository().findLiveDrop();
		return drop ? withResolvedState(drop, serverNow()) : null;
	},
	previewToken: (slug) => selectRepository().previewToken(slug),

	/**
	 * Every drop the storefront sells: the published ones, plus the drop the
	 * homepage stands in when nothing live is published (findLiveDrop's
	 * fallback, the same rule requireVisible applies). The cart and order
	 * history read this, so a drop whose sizes are on the page is never then
	 * refused by the cart as "no longer available".
	 */
	listStorefrontDrops: async () => {
		const [published, live] = await Promise.all([drops.listDrops(), drops.findLiveDrop()]);
		return live && !published.some((d) => d.id === live.id) ? [...published, live] : published;
	}
};

export type { DropRepository };
