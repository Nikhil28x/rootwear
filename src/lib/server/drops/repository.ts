/**
 * RW-037 — The repository seam.
 *
 * Every route loads catalogue data through this interface and never touches a
 * fixture or a database client directly. Phase 2 swaps the mock implementation
 * for a Supabase-backed one by changing the single export in `index.ts`.
 *
 * Under src/lib/server, so it can never be bundled into client code.
 */
import type { Drop } from '$lib/domain/drop';

export interface DropRepository {
	/** §06: the archive, chronological, newest first. Nothing is ever deleted. */
	listDrops(): Promise<Drop[]>;
	findBySlug(slug: string): Promise<Drop | null>;
	/**
	 * §06: "One live drop at a time." The model permits two; the storefront
	 * resolves one and admin warns on a second (RW-043).
	 */
	findLiveDrop(): Promise<Drop | null>;
}
