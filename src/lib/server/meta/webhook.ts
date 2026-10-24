/**
 * Meta webhook payloads: WhatsApp (delivery receipts, inbound messages) and
 * Page lead ads. The route verifies the signature; this module decides what
 * each change means.
 *
 * Handlers are registered by area so the leads module can add inbound
 * messages and lead ads without this file importing it.
 */
import { recordReceipt } from '$lib/server/messaging/outbox';

export type MetaChange = {
	readonly object: string;
	readonly field: string;
	readonly value: Record<string, unknown>;
	readonly entryId: string;
};

type Handler = (change: MetaChange) => Promise<void>;
const handlers: Handler[] = [];

export function onMetaChange(handler: Handler): void {
	handlers.push(handler);
}

type StatusValue = {
	statuses?: {
		id: string;
		status: string;
		timestamp?: string;
		errors?: { title?: string; message?: string; code?: number }[];
	}[];
};

/** WhatsApp delivery receipts move outbox rows to delivered / read / failed. */
onMetaChange(async (change) => {
	if (change.object !== 'whatsapp_business_account' || change.field !== 'messages') return;
	for (const status of (change.value as StatusValue).statuses ?? []) {
		const at = status.timestamp ? Number(status.timestamp) * 1000 : Date.now();
		const error = status.errors?.[0];
		await recordReceipt(
			status.id,
			status.status,
			at,
			error ? `${error.code ?? ''} ${error.title ?? error.message ?? ''}`.trim() : undefined
		);
	}
});

type Payload = {
	object?: string;
	entry?: { id?: string; changes?: { field?: string; value?: Record<string, unknown> }[] }[];
};

export async function processMetaPayload(payload: Payload): Promise<void> {
	for (const entry of payload.entry ?? []) {
		for (const change of entry.changes ?? []) {
			const item: MetaChange = {
				object: payload.object ?? '',
				field: change.field ?? '',
				value: change.value ?? {},
				entryId: entry.id ?? ''
			};
			for (const handler of handlers) {
				try {
					await handler(item);
				} catch (error) {
					// One bad change must not stop the rest of the batch.
					console.error('meta webhook handler failed', error);
				}
			}
		}
	}
}
