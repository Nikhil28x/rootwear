/**
 * RW-037 — Mock repository. Pre-DB, and the only place fixtures are read.
 *
 * Deliberately async so callers are written against the same shape the
 * Supabase implementation will have.
 */
import type { DropRepository } from './repository';
import type { Drop } from '$lib/domain/drop';
import { isOnSale } from '$lib/domain/drop-state';
import { DROP_01 } from './fixtures/drop-01-pineapple-haze';

const ALL: readonly Drop[] = [DROP_01];

export const mockDropRepository: DropRepository = {
	async listDrops() {
		// §06: the archive is chronological, newest first. Nothing is deleted.
		return [...ALL].sort((a, b) => b.launchInstant - a.launchInstant);
	},

	async findBySlug(slug: string) {
		return ALL.find((drop) => drop.slug === slug) ?? null;
	},

	async findLiveDrop() {
		// §06: the storefront assumes one live drop even though the model permits two.
		return ALL.find((drop) => isOnSale(drop.state) || drop.state === 'TEASE') ?? null;
	}
};
