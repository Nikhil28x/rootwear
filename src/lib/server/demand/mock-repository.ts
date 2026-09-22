/**
 * RW-047 — In-memory DemandRepository.
 *
 * Keeps the whole request / notify-me flow working end to end with no
 * database, which is the point of CATALOGUE_SOURCE=mock. The Maps live for the
 * lifetime of the dev server process only — this is a fixture, not storage,
 * and it says so rather than pretending to persist.
 *
 * The unique keys here are exactly the unique constraints in the schema:
 *   app.drop_requests   unique (drop_id, variant_id, email)
 *   app.notify_requests unique (variant_id, email)
 * so "submitting twice is idempotent" behaves identically in both sources.
 */
import type { DemandRepository } from './repository';
import type { DemandRow, DemandWriteStatus, DropRequestInput, NotifyRequestInput } from './types';
import type { Size } from '$lib/drop/sizes';
import { drops } from '$lib/server/drops';

type StoredRequest = DropRequestInput & { readonly id: string };
type StoredNotify = NotifyRequestInput & { readonly id: string };

const requests = new Map<string, StoredRequest>();
const notifies = new Map<string, StoredNotify>();

const requestKey = (i: DropRequestInput) => `${i.dropId}|${i.variantId}|${i.email}`;
const notifyKey = (i: NotifyRequestInput) => `${i.variantId}|${i.email}`;

/** variantId -> { dropId, size }, read from the same fixtures the storefront uses. */
async function variantIndex(): Promise<Map<string, { dropId: string; size: Size }>> {
	const index = new Map<string, { dropId: string; size: Size }>();
	for (const drop of await drops.listDrops()) {
		for (const product of drop.products) {
			for (const variant of product.variants) {
				index.set(variant.id, { dropId: drop.id, size: variant.size });
			}
		}
	}
	return index;
}

export const mockDemandRepository: DemandRepository = {
	async requestDrop(input: DropRequestInput): Promise<DemandWriteStatus> {
		const key = requestKey(input);
		if (requests.has(key)) return 'already';
		requests.set(key, { ...input, id: `req-${requests.size + 1}` });
		return 'recorded';
	},

	async notifyMe(input: NotifyRequestInput): Promise<DemandWriteStatus> {
		const key = notifyKey(input);
		if (notifies.has(key)) return 'already';
		notifies.set(key, { ...input, id: `ntf-${notifies.size + 1}` });
		return 'recorded';
	},

	async demandForDrop(dropId: string): Promise<DemandRow[]> {
		const index = await variantIndex();

		// Start every variant of the drop at zero, so a size with no demand is
		// reported as 0 rather than omitted. The admin board needs the zeroes.
		const rows = new Map<string, { size: Size; requests: number; notifyMe: number }>();
		for (const [variantId, meta] of index) {
			if (meta.dropId === dropId)
				rows.set(variantId, { size: meta.size, requests: 0, notifyMe: 0 });
		}

		for (const stored of requests.values()) {
			if (stored.dropId !== dropId) continue;
			const row = rows.get(stored.variantId);
			if (row) row.requests += 1;
		}

		for (const stored of notifies.values()) {
			const row = rows.get(stored.variantId);
			if (row) row.notifyMe += 1;
		}

		return [...rows].map(([variantId, row]) => ({
			dropId,
			variantId,
			size: row.size,
			requests: row.requests,
			notifyMe: row.notifyMe,
			// The mock has no reservation engine, so there is no waitlist to report.
			waitlist: 0
		}));
	}
};
