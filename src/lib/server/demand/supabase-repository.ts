/**
 * RW-047 — Postgres-backed DemandRepository.
 *
 * Writes go through the SERVICE client because `app` is not exposed through
 * PostgREST at all: there is no anon path to these tables by design (§04 —
 * nothing the browser can write). The justification for the service role here
 * is the one in db/clients.ts — the server is acting as the system recording a
 * signal, not as the visitor reading their own rows.
 *
 * Both writes rely on the unique constraints rather than a read-then-write:
 *   app.drop_requests   unique (drop_id, variant_id, email)
 *   app.notify_requests unique (variant_id, email)
 * A select-then-insert would race two simultaneous submissions of the same
 * address into two rows. Letting the constraint reject the duplicate and
 * mapping 23505 to 'already' is correct under concurrency and is one round
 * trip instead of two.
 */
import type { DemandRepository } from './repository';
import type {
	DemandRow,
	DemandWriteResult,
	DropRequestInput,
	NotifyRequestInput,
	PreOrderInput
} from './types';
import type { Size } from '$lib/drop/sizes';
import { getServiceClient } from '$lib/server/db/clients';

/** Postgres unique_violation. The duplicate is the expected happy path here. */
const UNIQUE_VIOLATION = '23505';

type BoardRow = {
	drop_id: string;
	variant_id: string;
	size: Size;
	requests: number | string;
	notify_me: number | string;
	waitlist: number | string;
};

/** count(*) arrives from PostgREST as a bigint string. */
const asCount = (value: number | string | null): number => Number(value ?? 0);

export const supabaseDemandRepository: DemandRepository = {
	async requestDrop(input: DropRequestInput): Promise<DemandWriteResult> {
		const service = getServiceClient();
		const { data, error } = await service
			.from('drop_requests')
			.insert({
				drop_id: input.dropId,
				variant_id: input.variantId,
				email: input.email,
				note: input.note,
				// §13: the consent instant and its surface are stored WITH the row.
				consented_at: new Date(input.consentedAt).toISOString(),
				consent_source: input.consentSource
			})
			.select('tracking_id')
			.single();

		if (error) {
			if (error.code === UNIQUE_VIOLATION) {
				const { data: existing, error: readError } = await service
					.from('drop_requests')
					.select('tracking_id')
					.eq('drop_id', input.dropId)
					.eq('variant_id', input.variantId)
					.eq('email', input.email)
					.single();
				if (readError || !existing) {
					throw new Error(
						`requestDrop receipt lookup failed: ${readError?.message ?? 'missing row'}`
					);
				}
				return { status: 'already', trackingId: String(existing.tracking_id) };
			}
			throw new Error(`requestDrop failed: ${error.message}`);
		}
		return { status: 'recorded', trackingId: String(data.tracking_id) };
	},

	async notifyMe(input: NotifyRequestInput): Promise<DemandWriteResult> {
		const service = getServiceClient();
		const { data, error } = await service
			.from('notify_requests')
			.insert({
				variant_id: input.variantId,
				email: input.email,
				consented_at: new Date(input.consentedAt).toISOString(),
				consent_source: input.consentSource
			})
			.select('tracking_id')
			.single();

		if (error) {
			if (error.code === UNIQUE_VIOLATION) {
				const { data: existing, error: readError } = await service
					.from('notify_requests')
					.select('tracking_id')
					.eq('variant_id', input.variantId)
					.eq('email', input.email)
					.single();
				if (readError || !existing) {
					throw new Error(`notifyMe receipt lookup failed: ${readError?.message ?? 'missing row'}`);
				}
				return { status: 'already', trackingId: String(existing.tracking_id) };
			}
			throw new Error(`notifyMe failed: ${error.message}`);
		}
		return { status: 'recorded', trackingId: String(data.tracking_id) };
	},

	async preorderSignup(input: PreOrderInput): Promise<DemandWriteResult> {
		const service = getServiceClient();
		const { data, error } = await service
			.from('preorder_signups')
			.insert({
				drop_id: input.dropId,
				variant_id: input.variantId,
				name: input.name,
				email: input.email,
				phone: input.phone,
				customer_id: input.customerId ?? null,
				consented_at: new Date(input.consentedAt).toISOString(),
				consent_source: input.consentSource
			})
			.select('tracking_id')
			.single();

		if (error) {
			if (error.code === UNIQUE_VIOLATION) {
				const { data: existing, error: readError } = await service
					.from('preorder_signups')
					.select('tracking_id')
					.eq('variant_id', input.variantId)
					.eq('email', input.email)
					.single();
				if (readError || !existing) {
					throw new Error(`preorder receipt lookup failed: ${readError?.message ?? 'missing row'}`);
				}
				return { status: 'already', trackingId: String(existing.tracking_id) };
			}
			throw new Error(`preorderSignup failed: ${error.message}`);
		}
		return { status: 'recorded', trackingId: String(data.tracking_id) };
	},

	async demandForDrop(dropId: string): Promise<DemandRow[]> {
		const { data, error } = await getServiceClient()
			.from('demand_board')
			.select('drop_id, variant_id, size, requests, notify_me, waitlist')
			.eq('drop_id', dropId);

		if (error) throw new Error(`demandForDrop failed: ${error.message}`);

		return (data as unknown as BoardRow[]).map((row) => ({
			dropId: row.drop_id,
			variantId: row.variant_id,
			size: row.size,
			requests: asCount(row.requests),
			notifyMe: asCount(row.notify_me),
			waitlist: asCount(row.waitlist)
		}));
	}
};
